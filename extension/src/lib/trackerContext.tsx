import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Job } from '../types';
import { APPLIED_STATUSES, AppStatus, TRACKER_KEYS } from './tracker';
import { TrackerStore, useTracker } from './useTracker';
import { jobKey, onKeysChanged, readKey, writeKey } from './userData';

/** The job whose Apply button was clicked last, so Jobly can ask "Did you apply?" when the user comes back. */
interface PendingApply { job: Job; at: number }
const PROMPT_WINDOW_MS = 3 * 24 * 3600 * 1000;

interface TrackerContextValue {
  store: TrackerStore;
  /** Status of a job in the tracker, or null when it isn't tracked. */
  statusOf: (job: Job) => AppStatus | null;
  /** True when the user already applied to another job at this company. */
  appliedAtCompany: (job: Job) => boolean;
  /** Resolves a problem message for the UI, or null. */
  track: (job: Job, status: AppStatus | null) => Promise<string | null>;
  noteApplyClick: (job: Job) => void;
  pending: Job | null;
  answerPending: (applied: boolean) => Promise<string | null>;
}

const Ctx = createContext<TrackerContextValue | null>(null);

export const TrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useTracker();
  const [pending, setPending] = useState<PendingApply | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const p = await readKey<PendingApply>(TRACKER_KEYS.pending);
      if (alive) setPending(p && p.job && Date.now() - p.at < PROMPT_WINDOW_MS ? p : null);
    };
    void refresh();
    const off = onKeysChanged([TRACKER_KEYS.pending], () => void refresh());
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; off(); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const statusOf = useCallback((job: Job) => store.byKey.get(jobKey(job))?.status ?? null, [store.byKey]);
  const appliedAtCompany = useCallback((job: Job) => {
    const own = store.byKey.get(jobKey(job));
    if (own && APPLIED_STATUSES.includes(own.status)) return false; // the card already says Applied
    return store.appliedCompanies.has(job.company_name.trim().toLowerCase());
  }, [store.byKey, store.appliedCompanies]);

  const noteApplyClick = useCallback((job: Job) => {
    const own = store.byKey.get(jobKey(job));
    if (own && APPLIED_STATUSES.includes(own.status)) return;
    const { description: _drop, ...slim } = job;
    const p: PendingApply = { job: { ...slim, description: null }, at: Date.now() };
    void writeKey(TRACKER_KEYS.pending, p);
  }, [store.byKey]);

  const answerPending = useCallback(async (applied: boolean) => {
    const job = pending?.job;
    setPending(null);
    await writeKey(TRACKER_KEYS.pending, null);
    if (!applied || !job) return null;
    return store.setStatus(job, 'applied');
  }, [pending, store]);

  const pendingJob = pending && !APPLIED_STATUSES.includes(store.byKey.get(jobKey(pending.job))?.status as AppStatus) ? pending.job : null;

  return (
    <Ctx.Provider value={{ store, statusOf, appliedAtCompany, track: store.setStatus, noteApplyClick, pending: pendingJob, answerPending }}>
      {children}
    </Ctx.Provider>
  );
};

/** The tracker, when the page provides one (job cards render without it, e.g. on a page that has no tracker). */
export const useTrackerContext = () => useContext(Ctx);
