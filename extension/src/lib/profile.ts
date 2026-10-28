import { readKey, writeKey } from './userData';
import { safeHttpUrl } from './url';

/**
 * Resume profiles: the facts job applications ask for, kept on this device. One person can keep several
 * (for example "Product design" and "Frontend") and pick one when copying answers, building a resume or autofilling.
 */

export interface WorkItem { id: string; company: string; title: string; location: string; start: string; end: string; current: boolean; bullets: string }
export interface EduItem { id: string; school: string; degree: string; field: string; start: string; end: string }

export interface Profile {
  id: string;
  label: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  summary: string;
  linkedin: string;
  github: string;
  portfolio: string;
  website: string;
  work_authorization: string;
  needs_sponsorship: string;   // '' | 'yes' | 'no'
  years_experience: string;
  salary_expectation: string;
  notice_period: string;
  skills: string;              // comma separated
  work: WorkItem[];
  education: EduItem[];
  updated_at: string;
}

export const PROFILE_KEYS = { list: 'profiles', active: 'activeProfileId', resume: 'resumeFile' } as const;
export const MAX_PROFILES = 5;

export const newProfileId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function emptyProfile(label = 'My profile'): Profile {
  return {
    id: newProfileId(), label, first_name: '', last_name: '', email: '', phone: '', location: '', headline: '', summary: '',
    linkedin: '', github: '', portfolio: '', website: '', work_authorization: '', needs_sponsorship: '', years_experience: '',
    salary_expectation: '', notice_period: '', skills: '', work: [], education: [], updated_at: new Date().toISOString(),
  };
}

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);
const URL_FIELDS = ['linkedin', 'github', 'portfolio', 'website'] as const;

/** Bounds every field so a pasted wall of text or a bad backup can't break the views or fill the storage. */
export function cleanProfile(p: Partial<Profile>): Profile {
  const base = emptyProfile();
  const out: Profile = {
    ...base, ...p,
    id: clip(p.id, 80) || base.id, label: clip(p.label, 60).trim() || 'My profile',
    first_name: clip(p.first_name, 80), last_name: clip(p.last_name, 80), email: clip(p.email, 160), phone: clip(p.phone, 40),
    location: clip(p.location, 120), headline: clip(p.headline, 160), summary: clip(p.summary, 3000),
    work_authorization: clip(p.work_authorization, 160), needs_sponsorship: ['yes', 'no'].includes(String(p.needs_sponsorship)) ? String(p.needs_sponsorship) : '',
    years_experience: clip(p.years_experience, 10), salary_expectation: clip(p.salary_expectation, 60), notice_period: clip(p.notice_period, 60),
    skills: clip(p.skills, 1500),
    work: (Array.isArray(p.work) ? p.work : []).slice(0, 15).map((w) => ({
      id: clip(w.id, 80) || newProfileId(), company: clip(w.company, 120), title: clip(w.title, 120), location: clip(w.location, 120),
      start: clip(w.start, 7), end: clip(w.end, 7), current: !!w.current, bullets: clip(w.bullets, 2500),
    })),
    education: (Array.isArray(p.education) ? p.education : []).slice(0, 8).map((e) => ({
      id: clip(e.id, 80) || newProfileId(), school: clip(e.school, 160), degree: clip(e.degree, 120), field: clip(e.field, 120), start: clip(e.start, 7), end: clip(e.end, 7),
    })),
    updated_at: new Date().toISOString(),
  };
  for (const k of URL_FIELDS) out[k] = clip(p[k], 300).trim();
  return out;
}

export async function loadProfiles(): Promise<Profile[]> {
  const list = await readKey<Profile[]>(PROFILE_KEYS.list);
  return Array.isArray(list) ? list.map(cleanProfile) : [];
}
export const storeProfiles = (list: Profile[]) => writeKey(PROFILE_KEYS.list, list.slice(0, MAX_PROFILES));
export const loadActiveProfileId = () => readKey<string>(PROFILE_KEYS.active);
export const storeActiveProfileId = (id: string) => writeKey(PROFILE_KEYS.active, id);

export const fullName = (p: Profile) => [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
export const skillList = (p: Profile) => p.skills.split(',').map((s) => s.trim()).filter(Boolean);
export const bulletList = (text: string) => text.split('\n').map((b) => b.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
export const linkOrNull = (u: string) => (u ? safeHttpUrl(/^https?:\/\//i.test(u) ? u : `https://${u}`) : null);

/** "Mar 2024" from "2024-03"; "Present" for an ongoing role. */
export function monthLabel(v: string, current = false): string {
  if (current) return 'Present';
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  if (!m) return v;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** The fields the copy kit and autofill offer, in the order forms usually ask for them. */
export function answerFields(p: Profile): { id: string; label: string; value: string }[] {
  const latest = p.work[0];
  return [
    { id: 'first_name', label: 'First name', value: p.first_name },
    { id: 'last_name', label: 'Last name', value: p.last_name },
    { id: 'full_name', label: 'Full name', value: fullName(p) },
    { id: 'email', label: 'Email', value: p.email },
    { id: 'phone', label: 'Phone', value: p.phone },
    { id: 'location', label: 'Location', value: p.location },
    { id: 'linkedin', label: 'LinkedIn', value: p.linkedin },
    { id: 'github', label: 'GitHub', value: p.github },
    { id: 'portfolio', label: 'Portfolio', value: p.portfolio },
    { id: 'website', label: 'Website', value: p.website },
    { id: 'current_company', label: 'Current company', value: latest?.current ? latest.company : '' },
    { id: 'current_title', label: 'Current title', value: latest?.current ? latest.title : p.headline },
    { id: 'years_experience', label: 'Years of experience', value: p.years_experience },
    { id: 'work_authorization', label: 'Work authorization', value: p.work_authorization },
    { id: 'needs_sponsorship', label: 'Needs visa sponsorship', value: p.needs_sponsorship === 'yes' ? 'Yes' : p.needs_sponsorship === 'no' ? 'No' : '' },
    { id: 'salary_expectation', label: 'Salary expectation', value: p.salary_expectation },
    { id: 'notice_period', label: 'Notice period', value: p.notice_period },
    { id: 'headline', label: 'Headline', value: p.headline },
    { id: 'summary', label: 'Summary', value: p.summary },
    { id: 'skills', label: 'Skills', value: skillList(p).join(', ') },
  ].filter((f) => f.value);
}
