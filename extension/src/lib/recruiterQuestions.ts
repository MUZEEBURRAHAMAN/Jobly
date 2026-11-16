import { useEffect, useState } from 'react';
import { bulletList, Profile } from './profile';
import { onKeysChanged, readKey, writeKey } from './userData';

/**
 * Recruiter questions: the resume starts from questions, not from a template.
 *
 * A recruiter gives a resume a few seconds and looks for three things: what you built, what you figured out, and why
 * they should talk to you. Most resumes bury those under safe, borrowed phrases ("drove efficiency", "aligned
 * stakeholders"), and leave out what recruiters find most interesting: a decision you owned, people you hired or
 * mentored, the outage you fixed, the side project people use. These are the questions a recruiter would ask if they
 * had the time. Each answer, in the user's own words, becomes one resume line; Jobly tidies it (drops "I", starts
 * with the verb) and never adds a fact or a number the user didn't write.
 */
export type Place = 'summary' | 'work' | 'projects' | 'achievements';
export interface RecruiterQuestion { id: string; question: string; why: string; example: string; place: Place }

export const RECRUITER_QUESTIONS: RecruiterQuestion[] = [
  { id: 'top-line', place: 'summary', question: 'In one line: what have you spent your career doing?',
    why: 'The first line a recruiter reads. Years plus what you build is more memorable than any adjective.',
    example: '6 years building design systems for fintech products used by 2 million people' },
  { id: 'built', place: 'work', question: 'What did you build or ship that you are proud of, and who used it?',
    why: '"Here is what I actually built" is the fastest reason to call you.',
    example: 'Built the new checkout flow, now used by 40,000 shoppers a day' },
  { id: 'figured-out', place: 'work', question: 'What problem did you figure out that others were stuck on?',
    why: 'Shows how you think, not just what you were assigned.',
    example: 'Found why 30% of sign-ups dropped at step 2 and fixed it, lifting completion to 85%' },
  { id: 'decision', place: 'work', question: 'Which decision did you own from start to finish?',
    why: 'Ownership is what separates a senior hire. Say what you decided and what changed.',
    example: 'Owned the move to weekly releases when no one else stepped up, cutting release time from 2 weeks to 1 day' },
  { id: 'people', place: 'work', question: 'Did you hire, interview, mentor or lead people? How many, and what happened?',
    why: 'Rarely in a job description, often the first thing asked about in an interview.',
    example: 'Mentored 8 engineers; 3 were promoted within a year' },
  { id: 'pressure', place: 'work', question: 'When did you fix something under pressure?',
    why: 'Recruiters remember the 3am fix far longer than "ensured system reliability".',
    example: 'Fixed a 3am production outage before a $150K client noticed it was down' },
  { id: 'ai', place: 'work', question: 'If you use AI or automation, what did you actually build with it?',
    why: 'Everyone says "working on AI". What you built with it, and what it saved, is what gets read.',
    example: 'Built an AI review step that cut QA from two weeks to two days' },
  { id: 'side', place: 'projects', question: 'A side project, open-source repo or portfolio piece people use? Stars, users, downloads?',
    why: 'Proof beats polish: GitHub stars, a live link or a Figma file show the work exists.',
    example: 'Open-source date library with 400 GitHub stars, used by other developers in production' },
  { id: 'early', place: 'achievements', question: 'Did you join early or do something few people have?',
    why: 'A founding role, an early team or a rare result is a strong signal and easy to leave out.',
    example: 'Founding engineer at Acme before its $20M Series A' },
  { id: 'lesson', place: 'work', question: 'Something that did not work: what did you learn and change?',
    why: 'The best resumes show wins and losses. It is asked in the interview anyway.',
    example: 'Ran a pricing test that lost 8% of trials, then used the data to design the plan that grew upgrades 20%' },
];

/** Safe, borrowed phrases that make every resume sound the same. Shown when an answer or a point uses one. */
export const GENERIC = /\b(optimi[sz]ed (the )?process(es)?|drove efficienc(y|ies)|led (various |multiple |several |key )?projects|scaled solutions|strategi[sz]ed initiatives|key initiatives|aligned (with )?stakeholders|stakeholder alignment|best practices|delivered results|process improvements?|increased? productivity|cross[- ]functional collaboration|value[- ]add(ed)?|leveraged synergies|end[- ]to[- ]end solutions|worked on ai|working on ai|various tasks|day[- ]to[- ]day operations)\b/i;
const NUMBER = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand|million|billion)\b/i;

/** Tidies an answer into a resume line, in the user's own words: drops a leading "I", "I've" or "I have", starts with a capital, no full stop. */
export function toLine(answer: string, place: Place): string {
  let t = answer.replace(/\s+/g, ' ').trim().replace(/^[-•*]\s*/, '');
  if (place !== 'summary') t = t.replace(/^(i was able to|i have|i had|i've|i'd|i)\s+/i, '');
  t = t.charAt(0).toUpperCase() + t.slice(1);
  t = place === 'summary' ? t.replace(/[.\s]+$/, '') + (t ? '.' : '') : t.replace(/[.\s]+$/, '');
  return t.slice(0, 280);
}

/** What would make the line land better: a number, no borrowed phrase, enough detail. */
export function lineTips(line: string): string[] {
  const tips: string[] = [];
  const words = line.split(/\s+/).filter(Boolean).length;
  if (words && words < 5) tips.push('Add a little more: what it was, and what changed.');
  if (words && !NUMBER.test(line)) tips.push('Add a number if you have a real one: how many, how much, how fast.');
  const g = GENERIC.exec(line);
  if (g) tips.push(`"${g[0]}" is on most resumes. Say what you actually did instead.`);
  if (/^(responsible for|helped|worked on|assisted|involved in)\b/i.test(line)) tips.push('Start with what you did: Built, Fixed, Owned, Hired…');
  return tips;
}

/** Where an answer can go: a role, a project, the achievements, or the start of the summary. */
export interface Target { id: string; label: string }
export function targets(p: Profile, place: Place): Target[] {
  if (place === 'summary') return [{ id: 'summary', label: 'Start of your summary' }];
  const roles = p.work.filter((w) => w.title.trim() || w.company.trim()).map((w) => ({ id: `work:${w.id}`, label: `${w.title || 'Role'}${w.company ? ` at ${w.company}` : ''}` }));
  const projects = p.projects.filter((x) => x.name.trim()).map((x) => ({ id: `project:${x.id}`, label: `Project: ${x.name}` }));
  const ach = { id: 'achievements', label: 'Achievements' };
  if (place === 'projects') return [...projects, ach, ...roles];
  if (place === 'achievements') return [ach, ...roles, ...projects];
  return [...roles, ...projects, ach];
}

const has = (lines: string[], line: string) => lines.some((l) => l.trim().toLowerCase() === line.trim().toLowerCase());

/** Puts the line on the resume. A role's or project's top points are what a recruiter reads, so it goes first. */
export function addLine(p: Profile, target: string, line: string): Profile {
  if (!line.trim()) return p;
  if (target === 'summary') {
    if (p.summary.toLowerCase().includes(line.toLowerCase().replace(/\.$/, ''))) return p;
    return { ...p, summary: [line, p.summary.trim()].filter(Boolean).join(' ') };
  }
  if (target === 'achievements') {
    const lines = p.achievements.split('\n').filter((l) => l.trim());
    return has(lines, line) ? p : { ...p, achievements: [line, ...lines].join('\n') };
  }
  const [kind, id] = target.split(':');
  if (kind === 'work') return { ...p, work: p.work.map((w) => (w.id === id && !has(bulletList(w.bullets), line) ? { ...w, bullets: [line, ...bulletList(w.bullets)].join('\n') } : w)) };
  if (kind === 'project') return { ...p, projects: p.projects.map((x) => (x.id === id && !has(bulletList(x.bullets), line) ? { ...x, bullets: [line, ...bulletList(x.bullets)].join('\n') } : x)) };
  return p;
}

/** Whether the line is already on the resume. */
export function onResume(p: Profile, line: string): boolean {
  const l = line.trim().toLowerCase().replace(/\.$/, '');
  if (!l) return false;
  const all = [p.summary, p.achievements, ...p.work.map((w) => w.bullets), ...p.projects.map((x) => x.bullets)].join('\n').toLowerCase();
  return all.includes(l);
}

// Drafts are kept on this device, per profile, so a half-written answer survives closing the page.
export const ANSWERS_KEY = 'recruiterAnswers';
export type Answers = Record<string, Record<string, string>>;
export function cleanAnswers(v: unknown): Answers | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const ids = new Set(RECRUITER_QUESTIONS.map((q) => q.id));
  const out: Answers = {};
  for (const [pid, a] of Object.entries(v as Record<string, unknown>).slice(0, 10)) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) continue;
    out[String(pid).slice(0, 80)] = Object.fromEntries(Object.entries(a as Record<string, unknown>).filter(([k, t]) => ids.has(k) && typeof t === 'string').map(([k, t]) => [k, (t as string).slice(0, 600)]));
  }
  return out;
}
export const saveAnswers = (a: Answers) => writeKey(ANSWERS_KEY, a);
export function useAnswers(): [Answers, (a: Answers) => void] {
  const [a, setA] = useState<Answers>({});
  useEffect(() => { const load = () => void readKey(ANSWERS_KEY).then((v) => setA(cleanAnswers(v) ?? {})); load(); return onKeysChanged([ANSWERS_KEY], load); }, []);
  return [a, (n: Answers) => { setA(n); void saveAnswers(n); }];
}
