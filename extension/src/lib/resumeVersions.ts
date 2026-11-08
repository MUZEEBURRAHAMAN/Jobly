import { useEffect, useState } from 'react';
import { cleanProfile, newProfileId, Profile } from './profile';
import { onKeysChanged, readKey, writeKey } from './userData';

/** A resume tailored for one job: the tailored copy of the profile, the job, and the coverage before and after. */
export interface ResumeVersion {
  id: string;
  created_at: string;
  job: { key: string | null; title: string; company: string };
  description: string;
  before: number;
  after: number;
  profile: Profile;
}

export const VERSIONS_KEY = 'resumeVersions';
export const MAX_VERSIONS = 30;

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);

export async function loadVersions(): Promise<ResumeVersion[]> {
  const list = await readKey<ResumeVersion[]>(VERSIONS_KEY);
  return (Array.isArray(list) ? list : []).filter((v) => v && v.profile && v.job).map((v) => ({
    ...v, id: clip(v.id, 80), job: { key: v.job.key ? clip(v.job.key, 2000) : null, title: clip(v.job.title, 200), company: clip(v.job.company, 160) },
    description: clip(v.description, 20000), before: Number(v.before) || 0, after: Number(v.after) || 0, profile: cleanProfile(v.profile),
  }));
}

/** Saves a version; one per job, so saving again for the same job replaces it. Resolves a problem, or null. */
export async function saveVersion(v: Omit<ResumeVersion, 'id' | 'created_at'>): Promise<{ problem: string | null; id: string | null }> {
  const list = await loadVersions();
  const same = (x: ResumeVersion) => (v.job.key ? x.job.key === v.job.key : x.job.title === v.job.title && x.job.company === v.job.company);
  const entry: ResumeVersion = { ...v, id: newProfileId(), created_at: new Date().toISOString(), description: v.description.slice(0, 20000) };
  const ok = await writeKey(VERSIONS_KEY, [entry, ...list.filter((x) => !same(x))].slice(0, MAX_VERSIONS));
  return ok ? { problem: null, id: entry.id } : { problem: "Couldn't save. Your browser storage may be full.", id: null };
}

export async function removeVersion(id: string): Promise<boolean> {
  return writeKey(VERSIONS_KEY, (await loadVersions()).filter((v) => v.id !== id));
}

export function useVersions(): ResumeVersion[] {
  const [list, setList] = useState<ResumeVersion[]>([]);
  useEffect(() => { const load = () => void loadVersions().then(setList); load(); return onKeysChanged([VERSIONS_KEY], load); }, []);
  return list;
}
