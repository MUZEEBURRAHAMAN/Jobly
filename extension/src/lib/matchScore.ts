import { createContext, useContext } from 'react';
import { Job, Preferences } from '../types';

/**
 * How well a job fits what the user asked for, as a percentage with the reasons. Only what the user has set counts:
 * roles, experience level, place, salary floor, job types, and their profile skills or keywords found in the title.
 * Worked out in the browser from the job's listing; nothing is sent anywhere.
 */
export interface MatchResult { percent: number; reasons: { label: string; ok: boolean | 'unknown' }[] }

const SENIORITY: Record<string, string> = { intern: 'Intern', junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead' };
const words = (s: string) => s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const inTitle = (title: string, term: string) => new RegExp(`(^|[^a-z0-9+#])${esc(term)}($|[^a-z0-9+#])`, 'i').test(title);

export function matchScore(job: Job, prefs: Preferences | null, skills: string[] = []): MatchResult | null {
  if (!prefs) return null;
  const parts: { w: number; v: number; label: string; ok: boolean | 'unknown' }[] = [];
  const title = job.title.toLowerCase();
  if (prefs.roles.length) {
    const ok = prefs.roles.includes(job.normalized_role ?? '') || prefs.roles.includes(job.category ?? '');
    parts.push({ w: 35, v: ok ? 1 : 0, label: ok ? 'One of your roles' : 'Not one of your roles', ok });
  }
  if (prefs.seniorities.length) {
    const level = job.seniority || 'mid';
    const ok = prefs.seniorities.includes(level);
    parts.push({ w: 20, v: ok ? 1 : 0, label: `${SENIORITY[level] ?? level} level${ok ? '' : ', not one you picked'}`, ok });
  }
  if (prefs.remote_only) {
    const ok = job.work_mode === 'remote';
    parts.push({ w: 15, v: ok ? 1 : 0, label: ok ? 'Remote' : 'Not remote', ok });
  } else if (prefs.locations.length) {
    const loc = (job.location ?? '').toLowerCase();
    const ok = job.work_mode === 'remote' || prefs.locations.some((l) => loc.includes(l.toLowerCase()));
    parts.push({ w: 15, v: ok ? 1 : 0, label: ok ? 'In a place you picked' : 'Outside your places', ok });
  }
  if (prefs.min_salary > 0) {
    const max = job.max_salary ?? null;
    const known = max !== null && max >= 1000;
    const ok = known ? max >= prefs.min_salary : 'unknown' as const;
    parts.push({ w: 10, v: ok === 'unknown' ? 0.5 : ok ? 1 : 0, label: ok === 'unknown' ? 'Salary not listed' : ok ? 'Pays your floor or more' : 'Pays less than your floor', ok });
  }
  if (prefs.employment_types?.length) {
    const kind = job.employment_type || 'full_time';
    const ok = prefs.employment_types.includes(kind);
    parts.push({ w: 10, v: ok ? 1 : 0, label: ok ? 'A job type you want' : 'Not a job type you want', ok });
  }
  const terms = [...new Set([...skills.map((s) => s.toLowerCase()), ...words(prefs.custom_keywords)])].filter((t) => t.length > 1);
  if (terms.length) {
    const hit = terms.find((t) => inTitle(title, t));
    parts.push({ w: 10, v: hit ? 1 : 0, label: hit ? `Title mentions ${hit}` : 'Title names none of your skills', ok: hit ? true : 'unknown' });
  }
  if (!parts.length) return null;
  let percent = Math.round((parts.reduce((s, p) => s + p.w * p.v, 0) / parts.reduce((s, p) => s + p.w, 0)) * 100);
  const excluded = words(prefs.excluded_keywords).find((k) => inTitle(title, k));
  if (excluded) { percent = Math.min(percent, 10); parts.push({ w: 0, v: 0, label: `Has "${excluded}", a word you left out`, ok: false }); }
  return { percent, reasons: parts.map(({ label, ok }) => ({ label, ok })) };
}

/** What job cards need to work out a match: the preferences and the active profile's skills. */
export const MatchContext = createContext<{ prefs: Preferences | null; skills: string[] }>({ prefs: null, skills: [] });
export const useMatch = () => useContext(MatchContext);
