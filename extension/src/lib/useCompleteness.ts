import { useEffect, useState } from 'react';
import { Profile, PROFILE_KEYS } from './profile';
import { onKeysChanged, readKey } from './userData';
import { Completeness, profileCompleteness } from './completeness';

/** Completeness of a profile, counting its resume file (kept under its own key). */
export function useCompleteness(profile: Profile | null): Completeness {
  const [hasResume, setHasResume] = useState(false);
  const id = profile?.id;
  useEffect(() => {
    if (!id) { setHasResume(false); return; }
    let alive = true;
    const load = () => void readKey<Record<string, unknown>>(PROFILE_KEYS.resume).then((m) => { if (alive) setHasResume(!!m?.[id]); });
    load();
    const off = onKeysChanged([PROFILE_KEYS.resume], load);
    return () => { alive = false; off(); };
  }, [id]);
  return profileCompleteness(profile, hasResume);
}
