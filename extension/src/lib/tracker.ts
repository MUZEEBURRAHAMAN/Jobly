import { Job } from '../types';
import { jobKey, readKey, writeKey } from './userData';
import { safeHttpUrl } from './url';

/**
 * The application tracker, interviews and tasks. Like everything personal in Jobly they live on this device only
 * (chrome.storage.local) and are shared live between the popup, the dashboard and the background worker.
 */

export type AppStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn';

export const STATUSES: { id: AppStatus; label: string }[] = [
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'interview', label: 'Interviewing' },
  { id: 'offer', label: 'Offer' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'withdrawn', label: 'Withdrawn' },
];
export const statusLabel = (s: AppStatus) => STATUSES.find((x) => x.id === s)?.label ?? s;
/** Statuses that mean "I applied" (used for the already-applied warning and the stats). */
export const APPLIED_STATUSES: AppStatus[] = ['applied', 'interview', 'offer', 'rejected', 'withdrawn'];

export interface Application {
  /** The job's key on this device (its apply link), or `manual:<id>` for jobs added by hand. */
  key: string;
  title: string;
  company_name: string;
  location: string | null;
  application_url: string;
  salary_summary?: string | null;
  posted_at?: string | null;
  source: 'jobly' | 'manual' | 'import' | 'page';
  status: AppStatus;
  notes: string;
  applied_at: string | null;
  /** When to follow up (ISO date-time); a reminder is shown then. */
  follow_up_at: string | null;
  follow_up_notified?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem { id: string; text: string; done: boolean; due: string | null }

export interface Interview {
  id: string;
  app_key: string;
  round: string;
  /** Start time (ISO). */
  at: string;
  link: string;
  notes: string;
  checklist: ChecklistItem[];
  /** How the round went, 1-5 (null until rated). */
  rating: number | null;
  reminded?: boolean;
  /** The calendar event it was imported from, so it is never imported twice. */
  source_id?: string;
}

export interface Task {
  id: string;
  text: string;
  due_at: string | null;
  done: boolean;
  app_key: string | null;
  created_at: string;
  notified?: boolean;
}

export interface TrackerSettings { weekly_goal: number; reminders: boolean }

export const TRACKER_KEYS = { apps: 'applications', interviews: 'interviews', tasks: 'tasks', settings: 'trackerSettings', pending: 'pendingApply' } as const;
export const DEFAULT_TRACKER_SETTINGS: TrackerSettings = { weekly_goal: 10, reminders: true };
export const MAX_APPS = 1000;
export const MAX_INTERVIEWS = 300;
export const MAX_TASKS = 300;
export const DEFAULT_CHECKLIST = ['Research the company and the team', 'Re-read the job description', 'Prepare two questions to ask', 'Test the meeting link and audio'];

export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const now = () => new Date().toISOString();
const clip = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);

/** A tracker entry's details copied from a job (kept even after the posting disappears). */
export function fromJob(job: Job, status: AppStatus): Application {
  const t = now();
  return {
    key: jobKey(job), title: clip(job.title, 200), company_name: clip(job.company_name, 120), location: job.location ? clip(job.location, 160) : null,
    application_url: safeHttpUrl(job.application_url) ?? '', salary_summary: job.salary_summary ?? null, posted_at: job.posted_at ?? null,
    source: 'jobly', status, notes: '', applied_at: APPLIED_STATUSES.includes(status) ? t : null, follow_up_at: null, created_at: t, updated_at: t,
  };
}

/** Cleans an entry coming from a file or another page so bad data can't break the views. */
export function sanitizeApp(a: Partial<Application> & { title?: unknown; company_name?: unknown }): Application | null {
  const title = clip(a.title, 200), company = clip(a.company_name, 120);
  if (!title || !company) return null;
  const status = STATUSES.some((s) => s.id === a.status) ? (a.status as AppStatus) : 'saved';
  const iso = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
  const t = now();
  return {
    key: clip(a.key, 600) || `manual:${newId()}`, title, company_name: company, location: a.location ? clip(a.location, 160) : null,
    application_url: safeHttpUrl(String(a.application_url ?? '')) ?? '', salary_summary: a.salary_summary ? clip(a.salary_summary, 80) : null,
    posted_at: iso(a.posted_at), source: a.source === 'jobly' || a.source === 'import' || a.source === 'page' ? a.source : 'manual', status, notes: clip(a.notes, 4000),
    applied_at: iso(a.applied_at), follow_up_at: iso(a.follow_up_at), follow_up_notified: !!a.follow_up_notified,
    created_at: iso(a.created_at) ?? t, updated_at: iso(a.updated_at) ?? t,
  };
}

async function readList<T>(key: string): Promise<T[]> {
  const v = await readKey<T[]>(key);
  return Array.isArray(v) ? v : [];
}

export const loadApps = () => readList<Application>(TRACKER_KEYS.apps);
export const loadInterviews = () => readList<Interview>(TRACKER_KEYS.interviews);
export const loadTasks = () => readList<Task>(TRACKER_KEYS.tasks);
export async function loadTrackerSettings(): Promise<TrackerSettings> {
  return { ...DEFAULT_TRACKER_SETTINGS, ...((await readKey<TrackerSettings>(TRACKER_KEYS.settings)) ?? {}) };
}
export const storeApps = (v: Application[]) => writeKey(TRACKER_KEYS.apps, v.slice(0, MAX_APPS));
export const storeInterviews = (v: Interview[]) => writeKey(TRACKER_KEYS.interviews, v.slice(0, MAX_INTERVIEWS));
export const storeTasks = (v: Task[]) => writeKey(TRACKER_KEYS.tasks, v.slice(0, MAX_TASKS));
export const storeTrackerSettings = (v: TrackerSettings) => writeKey(TRACKER_KEYS.settings, v);

/** Monday 00:00 of the current week, local time. */
export function startOfWeek(d = new Date()): Date {
  const s = new Date(d); s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

export function trackerStats(apps: Application[], interviews: Interview[]) {
  const applied = apps.filter((a) => APPLIED_STATUSES.includes(a.status));
  const week = startOfWeek().getTime();
  const responded = applied.filter((a) => a.status === 'interview' || a.status === 'offer' || interviews.some((i) => i.app_key === a.key));
  return {
    tracked: apps.length,
    applied: applied.length,
    appliedThisWeek: applied.filter((a) => a.applied_at && Date.parse(a.applied_at) >= week).length,
    interviewing: apps.filter((a) => a.status === 'interview').length,
    offers: apps.filter((a) => a.status === 'offer').length,
    responseRate: applied.length ? Math.round((responded.length / applied.length) * 100) : 0,
    upcomingInterviews: interviews.filter((i) => Date.parse(i.at) >= Date.now()).length,
  };
}
