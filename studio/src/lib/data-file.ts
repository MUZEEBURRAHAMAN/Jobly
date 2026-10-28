// The backup file: everything Studio keeps, as one JSON file. Import checks the shape and fills anything missing,
// so a file from an older version (or hand-edited) loads instead of breaking the app.
import { DEFAULT_SETTINGS, EMPTY_PROFILE } from './defaults';
import type { Application, Profile, Settings, StudioData } from './types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function migrate(raw: unknown): StudioData {
  if (!isObj(raw)) throw new Error('This file isn’t a Jobly Studio backup.');
  const p = isObj(raw.profile) ? raw.profile : {};
  const profile: Profile = {
    ...EMPTY_PROFILE,
    ...p,
    basics: { ...EMPTY_PROFILE.basics, ...(isObj(p.basics) ? p.basics : {}) } as Profile['basics'],
    experience: arr(p.experience),
    projects: arr(p.projects),
    education: arr(p.education),
    skills: arr(p.skills),
    languages: arr(p.languages),
    order: arr<Profile['order'][number]>(p.order).length ? arr(p.order) : EMPTY_PROFILE.order,
  };
  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...s,
    ai: { ...DEFAULT_SETTINGS.ai, ...(isObj(s.ai) ? s.ai : {}) },
    resumeStyle: { ...DEFAULT_SETTINGS.resumeStyle, ...(isObj(s.resumeStyle) ? s.resumeStyle : {}) },
  } as Settings;
  const applications = arr<Application>(raw.applications).filter((a) => isObj(a) && typeof a.id === 'string').map((a) => ({
    ...a,
    statusHistory: arr(a.statusHistory),
    matches: arr(a.matches),
    resume: arr(a.resume),
    letter: arr(a.letter),
    chat: arr(a.chat),
    interviews: arr(a.interviews),
    notes: a.notes ?? '',
    followUp: a.followUp ?? '',
  })) as Application[];
  return { version: 1, profile, applications, settings };
}

/** The backup leaves out the API key unless asked: a backup file gets emailed and synced in ways a browser profile doesn't. */
export function exportData(data: StudioData, includeKey: boolean): string {
  const copy = structuredClone(data);
  if (!includeKey) copy.settings.ai.apiKey = '';
  return JSON.stringify({ app: 'jobly-studio', exportedAt: new Date().toISOString(), ...copy }, null, 2);
}

export function parseImport(text: string, current: StudioData): StudioData {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('This file isn’t valid JSON.'); }
  const next = migrate(raw);
  // Keep the key already in this browser when the backup was saved without one.
  if (!next.settings.ai.apiKey && current.settings.ai.provider === next.settings.ai.provider) {
    next.settings.ai.apiKey = current.settings.ai.apiKey;
  }
  return next;
}

export function download(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
