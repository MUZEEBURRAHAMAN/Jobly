import { AiTask } from './ai';
import { bulletList, fullName, Profile, skillList } from './profile';
import { JobAnalysis, mentions, Suggestion } from './tailor';

/**
 * What the AI is asked to do, and the checks its answers must pass before the user sees them:
 *   - a rewritten bullet replaces one of the profile's own bullets and may not add a number that bullet doesn't have
 *   - nothing may name a skill or tool from the job that the resume doesn't already show
 *   - the summary may only use numbers found somewhere in the profile
 * Lines that fail are dropped (rewrites) or flagged (letters), never shown as if they were fine.
 */

const NUMBER = /\d[\d,.]*\s?(?:%|k\b|m\b|x\b)?/gi;
export const numbersIn = (t: string) => (t.match(NUMBER) ?? []).map((n) => n.toLowerCase().replace(/[,\s]/g, '').replace(/\.$/, '')).filter(Boolean);
const extraNumbers = (text: string, allowedText: string) => {
  const allowed = new Set(numbersIn(allowedText));
  for (const n of [...allowed]) allowed.add(n.replace(/[%kmx]$/, ''));
  return numbersIn(text).filter((n) => !allowed.has(n) && !allowed.has(n.replace(/[%kmx]$/, '')));
};

function facts(p: Profile) {
  const bullets: { id: string; workId: string; where: string; text: string }[] = [];
  p.work.forEach((w, i) => bulletList(w.bullets).forEach((b, j) => bullets.push({ id: `w${i}b${j}`, workId: w.id, where: [w.title, w.company].filter(Boolean).join(' at '), text: b })));
  const text = [p.headline, p.summary, skillList(p).join(', '), ...p.work.map((w) => `${w.title} ${w.company} ${w.bullets}`), ...p.education.map((e) => `${e.degree} ${e.field} ${e.school}`)].join('\n');
  return { bullets, text };
}

const jobBrief = (job: JobAnalysis, role: string, company: string, description: string) =>
  `Role: ${role || 'not given'} at ${company || 'not given'}\nRequirements:\n${job.requirements.map((r) => `- ${r.must ? '[must]' : '[nice]'} ${r.text}`).join('\n') || '(none found)'}\n\nJob description:\n"""\n${description.slice(0, 12000)}\n"""`;

const RULES = `Write only from the candidate's own facts. Rewording, tightening and reordering are fine; inventing is not.
- Never add an employer, title, date, degree, tool, skill, metric or achievement the facts don't state.
- A number may appear only if the fact you rewrite contains it.
- If the job asks for something the facts don't show, leave it out. Don't imply it.
- Plain, specific English. No clichés, no buzzwords.`;

export function rewriteTask(p: Profile, job: JobAnalysis, role: string, company: string, description: string): AiTask {
  const { bullets } = facts(p);
  return {
    system: `You are an expert resume writer.\n\n${RULES}`,
    schema: {
      type: 'object', additionalProperties: false, required: ['summary', 'bullets'],
      properties: {
        summary: { type: 'string' },
        bullets: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'text'], properties: { id: { type: 'string' }, text: { type: 'string' } } } },
      },
    },
    prompt: `Tailor this resume to the job below.
- summary: 2 or 3 sentences aimed at this role, from the candidate's facts only.
- bullets: rewrite up to 6 of the candidate's bullets that matter most for this job. Keep each bullet's id. Start with a verb, under 30 words, keep every number exactly as written. Only rewrite a bullet if the new version is clearly better for this job.

CANDIDATE
Headline: ${p.headline}
Summary: ${p.summary}
Skills: ${skillList(p).join(', ')}
Bullets:
${bullets.map((b) => `[${b.id}] (${b.where}) ${b.text}`).join('\n')}

JOB
${jobBrief(job, role, company, description)}`,
  };
}

/** Turns the AI's answer into rewrite suggestions, dropping any line that fails a check. */
export function guardRewrite(p: Profile, job: JobAnalysis, answer: { summary?: unknown; bullets?: unknown }): { suggestions: Suggestion[]; dropped: string[] } {
  const { bullets, text } = facts(p);
  const unshown = job.keywords.filter((k) => !mentions(text, k));
  const dropped: string[] = [];
  const out: Suggestion[] = [];
  const summary = typeof answer.summary === 'string' ? answer.summary.trim().slice(0, 1200) : '';
  if (summary && summary !== p.summary.trim()) {
    const nums = extraNumbers(summary, text);
    const adds = unshown.filter((k) => mentions(summary, k));
    if (nums.length || adds.length) dropped.push(`Summary: ${nums.length ? `numbers not in your profile (${nums.join(', ')})` : `names ${adds.join(', ')}, which your resume doesn't show`}`);
    else out.push({ id: 'ai-summary', kind: 'rewrite', title: 'Reworded summary for this job', target: 'summary', before: p.summary.trim() || '(no summary yet)', after: summary });
  }
  for (const item of Array.isArray(answer.bullets) ? answer.bullets.slice(0, 8) : []) {
    const id = String((item as { id?: unknown })?.id ?? ''); const after = String((item as { text?: unknown })?.text ?? '').trim().slice(0, 400);
    const src = bullets.find((b) => b.id === id);
    if (!src || !after || after === src.text) continue;
    const nums = extraNumbers(after, src.text);
    const adds = unshown.filter((k) => mentions(after, k));
    if (nums.length || adds.length) { dropped.push(`${src.where}: ${nums.length ? `adds ${nums.join(', ')}` : `names ${adds.join(', ')}`}`); continue; }
    out.push({ id: `ai-${id}`, kind: 'rewrite', title: `Reworded point at ${src.where}`, target: { workId: src.workId }, before: src.text, after });
  }
  return { suggestions: out, dropped };
}

export function letterTask(p: Profile, job: JobAnalysis, role: string, company: string, description: string): AiTask {
  const { bullets } = facts(p);
  return {
    system: `You write cover letters for job seekers.\n\n${RULES}`,
    schema: { type: 'object', additionalProperties: false, required: ['paragraphs'], properties: { paragraphs: { type: 'array', items: { type: 'string' } } } },
    prompt: `Write the body of a cover letter for this job: 3 or 4 short paragraphs, no greeting and no sign-off. Say why this role and company in specific terms from the job description, then show the candidate's matching experience with their own facts. Under 280 words. No "I am writing to express my interest".

CANDIDATE
Name: ${fullName(p)}
Headline: ${p.headline}
Years of experience: ${p.years_experience || 'not given'}
Summary: ${p.summary}
Skills: ${skillList(p).join(', ')}
Experience:
${bullets.map((b) => `(${b.where}) ${b.text}`).join('\n')}

JOB
${jobBrief(job, role, company, description)}`,
  };
}

/** Problems in an AI letter, for the user to fix before sending (the letter stays editable). */
export function guardLetter(p: Profile, job: JobAnalysis, letter: string): string[] {
  const { text } = facts(p);
  const issues: string[] = [];
  const nums = extraNumbers(letter, text);
  if (nums.length) issues.push(`It mentions ${nums.join(', ')}, which isn't in your profile. Check or remove it.`);
  const adds = job.keywords.filter((k) => !mentions(text, k) && mentions(letter, k));
  if (adds.length) issues.push(`It names ${adds.join(', ')}, which your profile doesn't show. Remove it unless you have it.`);
  return issues;
}
