import { useCallback, useMemo, useState } from 'react';
import { Job } from '../types';

/**
 * Remembers the user's own save/unsave taps so a response that was already in flight (and so predates the tap)
 * can't silently flip the button back. `serverSaved` is the authoritative list; overrides win until the page closes.
 */
export function useSavedOverlay(jobs: Job[], serverSaved: Job[]) {
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});

  const decorated = useMemo(() => jobs.map((j) => (j.id in overrides ? { ...j, is_saved: overrides[j.id] } : j)), [jobs, overrides]);

  const saved = useMemo(() => {
    const byId = new Map(serverSaved.map((j) => [j.id, { ...j, is_saved: true }]));
    for (const [key, value] of Object.entries(overrides)) {
      const id = Number(key);
      if (!value) byId.delete(id);
      else if (!byId.has(id)) {
        const job = jobs.find((x) => x.id === id);
        if (job) byId.set(id, { ...job, is_saved: true });
      }
    }
    return [...byId.values()];
  }, [serverSaved, overrides, jobs]);

  const set = useCallback((id: number, value: boolean) => setOverrides((o) => ({ ...o, [id]: value })), []);
  const clear = useCallback((id: number) => setOverrides((o) => { const { [id]: _drop, ...rest } = o; return rest; }), []);
  return { jobs: decorated, saved, set, clear };
}
