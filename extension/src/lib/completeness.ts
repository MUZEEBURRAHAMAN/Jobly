import { Profile, skillList } from './profile';

/**
 * How complete a profile is for applications: each item has a weight (what forms ask for most weighs most), and the
 * first missing item is the next thing to add. `step` is the setup step that holds it.
 */
export type SetupStep = 'import' | 'contact' | 'professional' | 'experience' | 'education' | 'done';

interface Check { id: string; label: string; weight: number; step: SetupStep; ok: (p: Profile, hasResume: boolean) => boolean }

const CHECKS: Check[] = [
  { id: 'name', label: 'your name', weight: 10, step: 'contact', ok: (p) => !!p.first_name.trim() && !!p.last_name.trim() },
  { id: 'email', label: 'your email', weight: 10, step: 'contact', ok: (p) => /\S+@\S+\.\S+/.test(p.email) },
  { id: 'phone', label: 'your phone number', weight: 8, step: 'contact', ok: (p) => p.phone.replace(/\D/g, '').length >= 7 },
  { id: 'location', label: 'where you live', weight: 5, step: 'contact', ok: (p) => !!p.location.trim() },
  { id: 'linkedin', label: 'your LinkedIn link', weight: 6, step: 'contact', ok: (p) => /linkedin\.com\//i.test(p.linkedin) },
  { id: 'headline', label: 'a headline', weight: 7, step: 'professional', ok: (p) => !!p.headline.trim() },
  { id: 'years', label: 'years of experience', weight: 5, step: 'professional', ok: (p) => !!p.years_experience.trim() },
  { id: 'skills', label: 'at least 3 skills', weight: 9, step: 'professional', ok: (p) => skillList(p).length >= 3 },
  { id: 'authorization', label: 'your work authorization', weight: 6, step: 'professional', ok: (p) => !!p.work_authorization.trim() },
  { id: 'sponsorship', label: 'whether you need visa sponsorship', weight: 4, step: 'professional', ok: (p) => !!p.needs_sponsorship },
  { id: 'summary', label: 'a short summary', weight: 5, step: 'professional', ok: (p) => p.summary.trim().length >= 40 },
  { id: 'experience', label: 'your experience', weight: 12, step: 'experience', ok: (p) => p.work.some((w) => !!w.title.trim() && !!w.company.trim() && !!w.start) },
  { id: 'education', label: 'your education', weight: 6, step: 'education', ok: (p) => p.education.some((e) => !!e.school.trim()) },
  { id: 'resume', label: 'a resume file', weight: 7, step: 'done', ok: (_p, hasResume) => hasResume },
];

export interface Completeness { percent: number; missing: { id: string; label: string; step: SetupStep }[] }

export function profileCompleteness(p: Profile | null, hasResume = false): Completeness {
  if (!p) return { percent: 0, missing: CHECKS.map(({ id, label, step }) => ({ id, label, step })) };
  const total = CHECKS.reduce((s, c) => s + c.weight, 0);
  const done = CHECKS.filter((c) => c.ok(p, hasResume));
  return {
    percent: Math.round((done.reduce((s, c) => s + c.weight, 0) / total) * 100),
    missing: CHECKS.filter((c) => !c.ok(p, hasResume)).map(({ id, label, step }) => ({ id, label, step })),
  };
}

/** "Add your education and a resume file" from the first two missing items. */
export function nextToAdd(c: Completeness): string {
  const [a, b] = c.missing;
  if (!a) return 'Your profile has everything applications usually ask for.';
  return `Next: add ${a.label}${b ? ` and ${b.label}` : ''}.`;
}
