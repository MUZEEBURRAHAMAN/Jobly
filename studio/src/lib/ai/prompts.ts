// What Studio asks the model to do. Each task returns JSON matching a schema in schemas.ts.
// The rules about facts are stated here, and enforced again in code by guard.ts.
import { factsForPrompt, type Fact } from '../facts';
import type { CoverLetter, Posting, RequirementMatch, TailoredResume, Tone } from '../types';
import { TONES } from '../types';
import { analyzeSchema, draftSchema, profileImportSchema, refineLetterSchema, refineResumeSchema } from './schemas';

export interface Task { system: string; prompt: string; schema: Record<string, unknown>; label: string }

const FACT_RULES = `You write only from the candidate's profile facts. Each fact has an id in square brackets.
- Every resume line you write must list, in "sources", the ids of the facts it is based on.
- Never add an employer, title, date, degree, tool, metric or achievement that the cited facts don't state. Rewording, tightening and reordering are fine; inventing is not.
- A number may appear only if a cited fact contains it.
- Bullets under a job may only use facts from that job (its own bullet ids or its id).
- If the posting asks for something the profile doesn't show, leave it out. Don't imply it.`;

export function analyzeTask(postingText: string, facts: Fact[]): Task {
  return {
    label: 'Reading the posting',
    schema: analyzeSchema,
    system: `You read job postings for a job seeker and compare them with their profile. Be precise and brief.`,
    prompt: `Read this job posting and return:
- title, company, location (as written; empty string if not stated)
- contact: the email address or link the posting says to apply through, else ""
- language: the language the posting is written in, e.g. "English"
- requirements: the 5 to 12 things the role asks for, each short (under 12 words), with id r1, r2, … and must=true for required, false for nice-to-have
- matches: one per requirement. level "met" when the profile clearly shows it, "partial" when it shows something close, "gap" when it doesn't. sources = ids of the facts that show it (empty for a gap). note = one short sentence saying why.

Only count what the facts actually show. A related skill is "partial", not "met".

PROFILE FACTS
${factsForPrompt(facts)}

JOB POSTING
"""
${postingText.slice(0, 30000)}
"""`,
  };
}

function postingBrief(p: Posting, matches: RequirementMatch[]): string {
  const req = p.requirements.map((r) => {
    const m = matches.find((x) => x.requirementId === r.id);
    return `- ${r.must ? '[must]' : '[nice]'} ${r.text} → ${m?.level ?? 'gap'}${m?.sources.length ? ` (${m.sources.join(', ')})` : ''}`;
  }).join('\n');
  return `Role: ${p.title || 'unknown'} at ${p.company || 'unknown'}${p.location ? `, ${p.location}` : ''}
Requirements and how the profile matches:
${req || '(none extracted)'}

Posting text:
"""
${p.text.slice(0, 20000)}
"""`;
}

const toneLine = (tone: Tone) => {
  const t = TONES.find((x) => x.id === tone)!;
  return `Tone: ${t.label.toLowerCase()} (${t.hint.toLowerCase()}).`;
};

export function draftTask(posting: Posting, matches: RequirementMatch[], facts: Fact[], tone: Tone): Task {
  return {
    label: 'Writing your resume and cover letter',
    schema: draftSchema,
    system: `You are an expert resume writer and career coach.\n\n${FACT_RULES}`,
    prompt: `Write a tailored resume and cover letter for this job.

RESUME
- headline: the candidate's own headline, adjusted toward this role only if their facts support it.
- summary: 2 or 3 sentences aimed at this role, with sources.
- experience: the candidate's jobs by id, most recent first; leave out only jobs that are irrelevant and old. For each, 2 to 5 bullets, strongest for this role first. Start bullets with a verb. Keep each under 30 words.
- projects: only projects that help for this role, by id, with 1 to 3 bullets each.
- skills: ids of the skills that matter most for this role first, then the rest that are still relevant.
- education: ids, most recent first.

COVER LETTER
- In ${posting.language || 'English'}. ${toneLine(tone)}
- recipient: the hiring manager's name if the posting gives one, else the company's hiring team.
- greeting, then 3 or 4 paragraphs, then closing (sign-off word only, no name).
- Paragraphs that state the candidate's experience must cite their facts in sources. Say why this company and role in specific terms drawn from the posting. No clichés ("I am writing to express my interest").
- Under 350 words.

${postingBrief(posting, matches)}

PROFILE FACTS
${factsForPrompt(facts)}`,
  };
}

export function refineTask(
  target: 'resume' | 'letter', doc: TailoredResume | CoverLetter, instruction: string,
  posting: Posting, facts: Fact[], history: { role: string; text: string }[],
): Task {
  const recent = history.slice(-6).map((h) => `${h.role === 'user' ? 'Candidate' : 'You'}: ${h.text}`).join('\n');
  return {
    label: target === 'resume' ? 'Revising your resume' : 'Revising your cover letter',
    schema: target === 'resume' ? refineResumeSchema : refineLetterSchema,
    system: `You revise a candidate's ${target === 'resume' ? 'tailored resume' : 'cover letter'} at their request.\n\n${FACT_RULES}\n\nIf they ask you to add something their facts don't support, don't add it: say so in "reply" and suggest they add it to their profile.`,
    prompt: `Apply the candidate's request and return the whole revised ${target}, plus a one or two sentence "reply" saying what you changed.

Request: ${instruction}

${recent ? `Earlier in this conversation:\n${recent}\n\n` : ''}Current ${target} (JSON):
${JSON.stringify(doc)}

Job: ${posting.title} at ${posting.company}

PROFILE FACTS
${factsForPrompt(facts)}`,
  };
}

export function profileImportTask(resumeText: string): Task {
  return {
    label: 'Reading your resume',
    schema: profileImportSchema,
    system: `You turn a resume into structured profile data. Copy facts exactly; never add or embellish anything.`,
    prompt: `Extract this resume into the schema. Keep each bullet's wording. Use "" for anything the resume doesn't state; leave "end" empty for a current role. Group skills (e.g. "Languages", "Frameworks", "Tools") when the resume does, else "".

RESUME
"""
${resumeText.slice(0, 40000)}
"""`,
  };
}

/** For people without an API key: a prompt to paste into Claude (or any chat), which answers with JSON to paste back. */
export function handoffPrompt(task: Task): string {
  return `${task.system}

${task.prompt}

Answer with only a JSON object that matches this JSON Schema, with no other text and no code fence:
${JSON.stringify(task.schema)}`;
}
