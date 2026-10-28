import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Job } from '../types';
import { jobKey, onKeysChanged } from './userData';
import {
  Application, APPLIED_STATUSES, AppStatus, DEFAULT_TRACKER_SETTINGS, fromJob, Interview, loadApps, loadInterviews, loadTasks, loadTrackerSettings,
  MAX_APPS, MAX_INTERVIEWS, MAX_TASKS, sanitizeApp, storeApps, storeInterviews, storeTasks, storeTrackerSettings, Task, TRACKER_KEYS, TrackerSettings,
} from './tracker';
import { safeHttpUrl } from './url';

const now = () => new Date().toISOString();
const clip = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);

/**
 * The tracker store. Each change writes to storage first, and the other open pages pick it up through
 * storage.onChanged. Returns a problem message for the UI, or null when the change was stored.
 */
export function useTracker() {
  const [apps, setApps] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<TrackerSettings>(DEFAULT_TRACKER_SETTINGS);
  const [ready, setReady] = useState(false);
  const ref = useRef({ apps, interviews, tasks });
  ref.current = { apps, interviews, tasks };

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const [a, i, t, s] = await Promise.all([loadApps(), loadInterviews(), loadTasks(), loadTrackerSettings()]);
      if (!alive) return;
      setApps(a); setInterviews(i); setTasks(t); setSettings(s); setReady(true);
    };
    void refresh();
    const off = onKeysChanged([TRACKER_KEYS.apps, TRACKER_KEYS.interviews, TRACKER_KEYS.tasks, TRACKER_KEYS.settings], () => void refresh());
    return () => { alive = false; off(); };
  }, []);

  const FULL = "Couldn't save. Your browser storage may be full.";
  const commitApps = useCallback(async (next: Application[]) => { const prev = ref.current.apps; setApps(next); if (await storeApps(next)) return null; setApps(prev); return FULL; }, []);
  const commitInterviews = useCallback(async (next: Interview[]) => { const prev = ref.current.interviews; setInterviews(next); if (await storeInterviews(next)) return null; setInterviews(prev); return FULL; }, []);
  const commitTasks = useCallback(async (next: Task[]) => { const prev = ref.current.tasks; setTasks(next); if (await storeTasks(next)) return null; setTasks(prev); return FULL; }, []);

  const byKey = useMemo(() => new Map(apps.map((a) => [a.key, a])), [apps]);
  /** Lower-cased company names the user has applied to. */
  const appliedCompanies = useMemo(() => new Set(apps.filter((a) => APPLIED_STATUSES.includes(a.status)).map((a) => a.company_name.trim().toLowerCase())), [apps]);

  /** Add or change one entry. A job not tracked yet is added with its details. `null` removes it. */
  const setStatus = useCallback(async (job: Job, status: AppStatus | null) => {
    const key = jobKey(job);
    const list = ref.current.apps;
    const existing = list.find((a) => a.key === key);
    if (status === null) return commitApps(list.filter((a) => a.key !== key));
    if (!existing && list.length >= MAX_APPS) return `You can track up to ${MAX_APPS} applications. Remove some to add more.`;
    const t = now();
    const next = existing
      ? { ...existing, status, updated_at: t, applied_at: existing.applied_at ?? (APPLIED_STATUSES.includes(status) ? t : null) }
      : fromJob(job, status);
    return commitApps([next, ...list.filter((a) => a.key !== key)]);
  }, [commitApps]);

  const updateApp = useCallback(async (key: string, patch: Partial<Application>) => {
    const list = ref.current.apps;
    const cur = list.find((a) => a.key === key);
    if (!cur) return "This application no longer exists.";
    const merged = sanitizeApp({ ...cur, ...patch, key, updated_at: now() });
    if (!merged) return 'Company and role are required.';
    if (patch.follow_up_at !== undefined) merged.follow_up_notified = false;
    if (patch.status && APPLIED_STATUSES.includes(patch.status) && !merged.applied_at) merged.applied_at = now();
    return commitApps(list.map((a) => (a.key === key ? merged : a)));
  }, [commitApps]);

  const addApp = useCallback(async (draft: Partial<Application>) => {
    const app = sanitizeApp({ ...draft, source: draft.source ?? 'manual' });
    if (!app) return { problem: 'Company and role are required.', key: null };
    if (APPLIED_STATUSES.includes(app.status) && !app.applied_at) app.applied_at = now();
    const list = ref.current.apps;
    if (list.length >= MAX_APPS) return { problem: `You can track up to ${MAX_APPS} applications. Remove some to add more.`, key: null };
    return { problem: await commitApps([app, ...list.filter((a) => a.key !== app.key)]), key: app.key };
  }, [commitApps]);

  /** Adds many entries at once (import). Entries with a key already tracked replace the old one. */
  const addMany = useCallback(async (drafts: Partial<Application>[]) => {
    const clean = drafts.map((d) => sanitizeApp({ ...d, source: d.source ?? 'import' })).filter((a): a is Application => !!a);
    const keys = new Set(clean.map((a) => a.key));
    const next = [...clean, ...ref.current.apps.filter((a) => !keys.has(a.key))].slice(0, MAX_APPS);
    return { problem: await commitApps(next), added: clean.length };
  }, [commitApps]);

  const removeApp = useCallback(async (key: string) => {
    const problem = await commitApps(ref.current.apps.filter((a) => a.key !== key));
    if (problem) return problem;
    // An entry's interviews and its link from tasks go with it.
    await commitInterviews(ref.current.interviews.filter((i) => i.app_key !== key));
    return commitTasks(ref.current.tasks.map((t) => (t.app_key === key ? { ...t, app_key: null } : t)));
  }, [commitApps, commitInterviews, commitTasks]);

  const saveInterview = useCallback(async (iv: Interview) => {
    const list = ref.current.interviews;
    if (!list.some((x) => x.id === iv.id) && list.length >= MAX_INTERVIEWS) return `You can keep up to ${MAX_INTERVIEWS} interviews.`;
    const clean: Interview = {
      ...iv, round: clip(iv.round, 120) || 'Interview', link: safeHttpUrl(iv.link) ?? '', notes: clip(iv.notes, 4000),
      checklist: iv.checklist.slice(0, 40).map((c) => ({ ...c, text: clip(c.text, 300) })).filter((c) => c.text),
      rating: iv.rating && iv.rating >= 1 && iv.rating <= 5 ? Math.round(iv.rating) : null,
    };
    const existing = list.find((x) => x.id === iv.id);
    if (existing && existing.at !== clean.at) clean.reminded = false; // a moved interview gets a fresh reminder
    const problem = await commitInterviews([clean, ...list.filter((x) => x.id !== iv.id)].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)));
    // Having an interview moves the application along, unless it is already further.
    const app = ref.current.apps.find((a) => a.key === iv.app_key);
    if (!problem && app && (app.status === 'saved' || app.status === 'applied')) await updateApp(app.key, { status: 'interview' });
    return problem;
  }, [commitInterviews, updateApp]);

  const removeInterview = useCallback((id: string) => commitInterviews(ref.current.interviews.filter((x) => x.id !== id)), [commitInterviews]);

  const saveTask = useCallback(async (task: Task) => {
    const list = ref.current.tasks;
    if (!list.some((x) => x.id === task.id) && list.length >= MAX_TASKS) return `You can keep up to ${MAX_TASKS} tasks.`;
    const clean: Task = { ...task, text: clip(task.text, 300) };
    if (!clean.text) return 'Write what the task is first.';
    const existing = list.find((x) => x.id === task.id);
    if (existing && existing.due_at !== clean.due_at) clean.notified = false;
    return commitTasks([clean, ...list.filter((x) => x.id !== task.id)]);
  }, [commitTasks]);

  const removeTask = useCallback((id: string) => commitTasks(ref.current.tasks.filter((x) => x.id !== id)), [commitTasks]);

  const saveSettings = useCallback(async (s: TrackerSettings) => {
    const clean = { weekly_goal: Math.max(1, Math.min(200, Math.round(s.weekly_goal) || DEFAULT_TRACKER_SETTINGS.weekly_goal)), reminders: s.reminders !== false };
    const prev = settings; setSettings(clean);
    if (await storeTrackerSettings(clean)) return null;
    setSettings(prev); return FULL;
  }, [settings]);

  return { ready, apps, interviews, tasks, settings, byKey, appliedCompanies, setStatus, updateApp, addApp, addMany, removeApp, saveInterview, removeInterview, saveTask, removeTask, saveSettings };
}

export type TrackerStore = ReturnType<typeof useTracker>;
