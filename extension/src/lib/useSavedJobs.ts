import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Job } from '../types';
import { jobKey, loadSaved, MAX_SAVED_JOBS, onKeysChanged, STORAGE_KEYS, storeSaved } from './userData';

/**
 * Saved jobs live on this device. The list is shared live between the popup, the dashboard and any other open page,
 * and `jobs` comes back with `is_saved` filled in so cards just render it.
 */
export function useSavedJobs(jobs: Job[]) {
  const [saved, setSaved] = useState<Job[]>([]);
  const latest = useRef<Job[]>([]);
  latest.current = saved;

  useEffect(() => {
    let alive = true;
    const refresh = () => loadSaved().then((list) => { if (alive) setSaved(list); });
    refresh();
    const off = onKeysChanged([STORAGE_KEYS.saved], refresh);
    return () => { alive = false; off(); };
  }, []);

  const keys = useMemo(() => new Set(saved.map(jobKey)), [saved]);
  const decorated = useMemo(() => jobs.map((j) => ({ ...j, is_saved: keys.has(jobKey(j)) })), [jobs, keys]);
  const savedList = useMemo(() => saved.map((j) => ({ ...j, is_saved: true })), [saved]);

  /** Resolves a user-facing problem message, or null when it worked. */
  const toggle = useCallback(async (job: Job): Promise<string | null> => {
    const key = jobKey(job);
    const current = latest.current;
    const removing = current.some((j) => jobKey(j) === key);
    if (!removing && current.length >= MAX_SAVED_JOBS) return `You can keep up to ${MAX_SAVED_JOBS} saved jobs. Remove some to save more.`;
    const { description: _drop, ...slim } = job; // the list payload has no description; never keep one around
    const next = removing ? current.filter((j) => jobKey(j) !== key) : [{ ...slim, description: null, is_saved: true }, ...current];
    setSaved(next); // instant
    if (await storeSaved(next)) return null;
    setSaved(current);
    return removing ? "Couldn't remove this job from saved. Please try again." : "Couldn't save this job. Your browser storage may be full.";
  }, []);

  return { jobs: decorated, saved: savedList, toggle };
}
