// The profile as a list of citable facts. Every line a model writes must point at fact ids from this list;
// the guard (guard.ts) then checks those pointers in code, so "never invents experience" doesn't rest on a prompt alone.
import type { Profile } from './types';

export interface Fact {
  id: string;
  /** For bullets: the experience or project the bullet belongs to. */
  owner?: string;
  kind: 'summary' | 'experience' | 'bullet' | 'project' | 'education' | 'skill' | 'language' | 'basics';
  text: string;
}

const range = (start: string, end: string) => [start, end || (start ? 'present' : '')].filter(Boolean).join(' – ');

export function profileFacts(p: Profile): Fact[] {
  const facts: Fact[] = [];
  const b = p.basics;
  const basics = [b.name, b.headline, b.location].filter(Boolean).join(' · ');
  if (basics) facts.push({ id: 'basics', kind: 'basics', text: basics });
  if (b.summary.trim()) facts.push({ id: 'summary', kind: 'summary', text: b.summary.trim() });
  for (const e of p.experience) {
    facts.push({ id: e.id, kind: 'experience', text: `${e.title} at ${e.company}${e.location ? `, ${e.location}` : ''} (${range(e.start, e.end)})` });
    for (const bl of e.bullets) if (bl.text.trim()) facts.push({ id: bl.id, owner: e.id, kind: 'bullet', text: bl.text.trim() });
  }
  for (const pr of p.projects) {
    facts.push({ id: pr.id, kind: 'project', text: `${pr.name}${pr.role ? ` (${pr.role})` : ''}${pr.start ? `, ${range(pr.start, pr.end)}` : ''}` });
    for (const bl of pr.bullets) if (bl.text.trim()) facts.push({ id: bl.id, owner: pr.id, kind: 'bullet', text: bl.text.trim() });
  }
  for (const ed of p.education) {
    facts.push({ id: ed.id, kind: 'education', text: [ed.degree, ed.school, range(ed.start, ed.end), ed.details].filter(Boolean).join(', ') });
  }
  for (const s of p.skills) facts.push({ id: s.id, kind: 'skill', text: s.group ? `${s.name} (${s.group})` : s.name });
  for (const l of p.languages) facts.push({ id: l.id, kind: 'language', text: l.level ? `${l.name}: ${l.level}` : l.name });
  return facts;
}

/** The facts as compact lines for a prompt: `[id] text`, bullets indented under their entry. */
export function factsForPrompt(facts: Fact[]): string {
  return facts.map((f) => `${f.kind === 'bullet' ? '    ' : ''}[${f.id}] ${f.kind.toUpperCase()}: ${f.text}`).join('\n');
}

/**
 * How complete the profile is for tailoring, 0–100, with the next thing worth adding.
 * Only counts what a resume needs: contact, a summary, a job with evidence, skills, education.
 */
export function profileStrength(p: Profile): { score: number; next: string | null } {
  const checks: [boolean, number, string][] = [
    [!!p.basics.name.trim() && !!p.basics.email.trim(), 15, 'Add your name and email'],
    [!!p.basics.headline.trim(), 5, 'Add a headline, e.g. “Frontend engineer”'],
    [p.basics.summary.trim().length >= 80, 10, 'Write a short summary (two or three sentences)'],
    [p.experience.length > 0, 20, 'Add your most recent job'],
    [p.experience.some((e) => e.bullets.filter((b) => b.text.trim()).length >= 3), 20, 'Give a job at least three bullets: what you did and what changed'],
    [p.experience.some((e) => e.bullets.some((b) => /\d/.test(b.text))), 10, 'Put a number in a bullet (users, %, time saved): drafts can only use numbers you give'],
    [p.skills.length >= 5, 10, 'List at least five skills'],
    [p.education.length > 0 || p.projects.length > 0, 10, 'Add education or a project'],
  ];
  let score = 0;
  let next: string | null = null;
  for (const [ok, pts, hint] of checks) {
    if (ok) score += pts;
    else if (!next) next = hint;
  }
  return { score, next };
}
