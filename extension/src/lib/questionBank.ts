import { useEffect, useState } from 'react';
import { findSaved, isSensitive, questionKey, SavedAnswer } from './answerBank';
import { bulletList, Profile, skillList } from './profile';
import { onKeysChanged, readKey, writeKey } from './userData';

/**
 * The question bank: how Jobly gets better at forms over time, on this device.
 *
 *   Common questions   what employers ask again and again ("Why are you a good fit for this role?"). The user answers
 *                      once; {company} and {role} in an answer are filled in for each job.
 *   Question log       every question Jobly couldn't answer, with how often and by which companies it was asked. The
 *                      Profile page lists them, most asked first; answering one fills it on every later form.
 *   Skill questions    "Do you have experience with Figma?" is answered from the profile's skills.
 */
export interface CommonQuestion { id: string; question: string; hint: string; match: RegExp }
export const COMMON_QUESTIONS: CommonQuestion[] = [
  { id: 'fit', question: 'Why are you a good fit for this role?', hint: 'What you do best and one result with a number. Use {role} and {company}.',
    match: /(why|what makes) (are )?you .*(good|great|strong|right|ideal|best)? ?(fit|candidate|match)|why should we (hire|choose) you|why (this|the) (role|position)|why are you interested in (this|the) (role|position)|what (would|will) you bring/i },
  { id: 'why-company', question: 'Why do you want to work at {company}?', hint: 'One honest reason in your own words. {company} is filled in for each job.',
    match: /why (do|would) you (want|like) to (work|join)|why (are you|you're) interested in (working|joining|us|our|the company)|what (interests|excites|attracts) you about (us|our|working|the company|joining)|why (us|our company)\b/i },
  { id: 'about', question: 'Tell us about yourself.', hint: 'Three or four sentences: who you are, what you work on, what you want next.',
    match: /tell (us|me) (a bit |a little )?about yourself|introduce yourself|describe yourself|professional summary/i },
  { id: 'project', question: 'Describe a project you are proud of.', hint: 'The problem, what you did, and the result.',
    match: /(proud|favou?rite|best|biggest) (project|achievement|accomplishment)|describe (a|one) project|an achievement you/i },
  { id: 'start', question: 'When can you start?', hint: 'For example "In 30 days" or "Immediately".',
    match: /when (can|could) you start|earliest (possible )?start|available to start|start date|availability to (start|join)/i },
  { id: 'relocate', question: 'Are you willing to relocate?', hint: 'Yes, No, or where you would move to.',
    match: /relocat/i },
  { id: 'office', question: 'Can you work from the office (on-site or hybrid)?', hint: 'For example "Yes, 3 days a week".',
    match: /(work|working) (from|in) (the )?office|on-?site.*(days|week|able|willing)|hybrid.*(days|week|able|willing)|commute/i },
  { id: 'heard', question: 'How did you hear about this job?', hint: 'For example "LinkedIn" or "Company careers page".',
    match: /how did you (hear|find out|learn|come across)|where did you (hear|find|see)|source of (application|referral)/i },
];

const fill = (text: string, job: { company?: string; role?: string }) => text.replace(/\{company\}/gi, job.company?.trim() || 'your company').replace(/\{role\}/gi, job.role?.trim() || 'this role');

/** The user's answer to a common question that this form question asks, with {company} and {role} filled in. */
export function commonAnswer(label: string, saved: SavedAnswer[], job: { company?: string; role?: string }): { value: string; key: string } | null {
  if (isSensitive(label)) return null;
  const q = COMMON_QUESTIONS.find((c) => c.match.test(label));
  if (!q) return null;
  const hit = saved.find((a) => a.key === questionKey(q.question));
  return hit ? { value: fill(hit.value, job), key: hit.key } : null;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SKILL_Q = /\b(experience|familiar|familiarity|proficient|proficiency|worked|comfortable|knowledge|skilled|expertise|used)\b[^?]*?\b(with|in|of|using)\s+([^?.,;]{2,40})/i;

/** "Do you have experience of using Figma?" answered from the profile's skills: Yes, with a point that shows it. */
export function skillAnswer(label: string, kind: string, options: string[], p: Profile): string {
  const m = SKILL_Q.exec(label) ?? /^(do|can) you (know|use)\s+([^?.,;]{2,40})/i.exec(label);
  if (!m) return '';
  const asked = m[3].replace(/^(using|the|a)\s+/i, '').trim();
  const skill = skillList(p).find((s) => new RegExp(`(^|[^a-z0-9+#])${esc(s.toLowerCase())}($|[^a-z0-9+#])`).test(asked.toLowerCase()) || s.toLowerCase() === asked.toLowerCase());
  if (!skill) return '';
  if (kind === 'select' || kind === 'radio') return options.find((o) => /^yes\b/i.test(o)) ?? '';
  if (/how many years|years of/i.test(label)) return p.years_experience || '';
  const point = p.work.flatMap((w) => bulletList(w.bullets).map((b) => ({ b, w }))).find((x) => x.b.toLowerCase().includes(skill.toLowerCase()));
  const role = (p.headline || p.work[0]?.title || '').split(/\s[|·•–—]\s/)[0].trim();
  return [`Yes. I use ${skill} regularly${role ? ` in my work as ${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role}` : ''}.`,
    point ? `For example, at ${point.w.company || 'my last role'} I ${point.b.charAt(0).toLowerCase()}${point.b.slice(1).replace(/\.$/, '')}.` : ''].filter(Boolean).join(' ');
}

// ---------- the question log ----------

export interface LoggedQuestion { key: string; question: string; kind: string; count: number; companies: string[]; last_url: string; last_seen: string }
export const QUESTION_LOG_KEY = 'questionLog';
export const MAX_LOGGED = 150;

export async function loadQuestionLog(): Promise<LoggedQuestion[]> {
  const list = await readKey<LoggedQuestion[]>(QUESTION_LOG_KEY);
  return Array.isArray(list) ? list.filter((x) => x && typeof x.question === 'string' && typeof x.key === 'string') : [];
}

/** Questions a form asked that Jobly couldn't answer. Counted once per page; consent boxes, files and sensitive questions are never logged. */
export async function logQuestions(items: { question: string; kind: string }[], job: { company?: string; url?: string }): Promise<void> {
  const list = await loadQuestionLog();
  const now = new Date().toISOString();
  const url = (job.url ?? '').split('#')[0].slice(0, 500);
  let changed = false;
  for (const it of items) {
    const question = it.question.replace(/\s+/g, ' ').replace(/\s*\*$/, '').trim().slice(0, 300);
    const key = questionKey(question);
    if (!key || key.length < 6 || isSensitive(question) || it.kind === 'file' || it.kind === 'checkbox') continue;
    const i = list.findIndex((x) => x.key === key);
    if (i >= 0) {
      if (list[i].last_url === url) continue;  // the same page read again
      const e = list[i];
      list[i] = { ...e, count: e.count + 1, last_url: url, last_seen: now, companies: [...new Set([job.company ?? '', ...e.companies].filter(Boolean))].slice(0, 6) };
    } else list.unshift({ key, question, kind: it.kind, count: 1, companies: job.company ? [job.company] : [], last_url: url, last_seen: now });
    changed = true;
  }
  if (changed) await writeKey(QUESTION_LOG_KEY, list.sort((a, b) => b.count - a.count || b.last_seen.localeCompare(a.last_seen)).slice(0, MAX_LOGGED));
}

export const forgetQuestion = async (key: string) => writeKey(QUESTION_LOG_KEY, (await loadQuestionLog()).filter((x) => x.key !== key));

/** Logged questions the user hasn't answered yet (a saved answer or a common answer covers them). */
export const openQuestions = (log: LoggedQuestion[], saved: SavedAnswer[]) =>
  log.filter((x) => !findSaved(saved, x.question) && !commonAnswer(x.question, saved, {}) && !COMMON_QUESTIONS.some((c) => c.match.test(x.question)));

export function useQuestionLog(): LoggedQuestion[] {
  const [list, setList] = useState<LoggedQuestion[]>([]);
  useEffect(() => { const load = () => void loadQuestionLog().then(setList); load(); return onKeysChanged([QUESTION_LOG_KEY], load); }, []);
  return list;
}
