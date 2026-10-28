import { useCallback, useEffect, useRef, useState } from 'react';
import { onKeysChanged } from './userData';
import {
  cleanProfile, emptyProfile, loadActiveProfileId, loadProfiles, MAX_PROFILES, newProfileId, Profile, PROFILE_KEYS, storeActiveProfileId, storeProfiles,
} from './profile';

/** Resume profiles, shared live between the popup and the dashboard. */
export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const ref = useRef(profiles);
  ref.current = profiles;

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const [list, id] = await Promise.all([loadProfiles(), loadActiveProfileId()]);
      if (!alive) return;
      setProfiles(list); setActiveId(id && list.some((p) => p.id === id) ? id : list[0]?.id ?? null); setReady(true);
    };
    void refresh();
    const off = onKeysChanged([PROFILE_KEYS.list, PROFILE_KEYS.active], () => void refresh());
    return () => { alive = false; off(); };
  }, []);

  const active = profiles.find((p) => p.id === activeId) ?? profiles[0] ?? null;
  const FULL = "Couldn't save. Your browser storage may be full.";

  const commit = useCallback(async (next: Profile[]) => {
    const prev = ref.current; setProfiles(next);
    if (await storeProfiles(next)) return null;
    setProfiles(prev); return FULL;
  }, []);

  const save = useCallback(async (p: Profile) => {
    const clean = cleanProfile(p);
    const list = ref.current;
    return commit(list.some((x) => x.id === clean.id) ? list.map((x) => (x.id === clean.id ? clean : x)) : [...list, clean]);
  }, [commit]);

  const create = useCallback(async (fromId?: string) => {
    const list = ref.current;
    if (list.length >= MAX_PROFILES) return { problem: `You can keep up to ${MAX_PROFILES} profiles.`, id: null };
    const source = list.find((p) => p.id === fromId);
    const p = source ? { ...source, id: newProfileId(), label: `${source.label} (copy)` } : emptyProfile(list.length ? `Profile ${list.length + 1}` : 'My profile');
    const problem = await commit([...list, cleanProfile(p)]);
    if (!problem) { setActiveId(p.id); await storeActiveProfileId(p.id); }
    return { problem, id: problem ? null : p.id };
  }, [commit]);

  const remove = useCallback(async (id: string) => {
    const next = ref.current.filter((p) => p.id !== id);
    const problem = await commit(next);
    if (!problem && activeId === id && next[0]) { setActiveId(next[0].id); await storeActiveProfileId(next[0].id); }
    return problem;
  }, [commit, activeId]);

  const choose = useCallback(async (id: string) => { setActiveId(id); await storeActiveProfileId(id); }, []);

  return { ready, profiles, active, save, create, remove, choose };
}

export type ProfilesStore = ReturnType<typeof useProfiles>;
