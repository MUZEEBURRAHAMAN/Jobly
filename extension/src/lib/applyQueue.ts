import { useEffect, useState } from 'react';
import { onKeysChanged, readKey, writeKey } from './userData';
import { safeHttpUrl } from './url';

/**
 * The apply queue: jobs the user picked for Jobly to prepare, one application tab at a time.
 *
 * For each job Jobly opens the application page in a background tab, reads the form, fills every answer it knows
 * (profile, saved answers, the resume file), and lists the questions it couldn't answer. Then it stops and waits:
 * the user answers what's left (here or on the page), checks the form and presses Submit themselves. Jobly never
 * presses Next or Submit, never signs in, and never solves a CAPTCHA.
 *
 *   queued → opening → reading → filling → needs-input | review → submitted
 *                                         ↘ stopped (no form found, sign-in needed, another site, tab closed)
 */
export type QueueState = 'queued' | 'opening' | 'reading' | 'filling' | 'needs-input' | 'review' | 'submitted' | 'stopped';
export interface QueueItem {
  id: string;
  url: string;
  title: string;
  company: string;
  location: string;
  state: QueueState;
  /** Why it stopped, or what Jobly is doing, in a few words. */
  note: string;
  /** Questions on the form that Jobly couldn't answer. */
  needs: string[];
  filled: number;
  tabId: number | null;
  added_at: string;
  updated_at: string;
}

export const QUEUE_KEY = 'applyQueue';
export const MAX_QUEUE = 30;
/** Application tabs Jobly prepares at the same time. */
export const PARALLEL = 2;

export const STEPS: { state: QueueState; label: string }[] = [
  { state: 'opening', label: 'Opening' }, { state: 'reading', label: 'Reading the form' }, { state: 'filling', label: 'Filling in' },
  { state: 'review', label: 'Your review' }, { state: 'submitted', label: 'Sent' },
];
export const ACTIVE: QueueState[] = ['opening', 'reading', 'filling'];
export const WAITING: QueueState[] = ['needs-input', 'review'];
export const stateLabel: Record<QueueState, string> = {
  queued: 'In the queue', opening: 'Opening', reading: 'Reading the form', filling: 'Filling in', 'needs-input': 'Needs your input',
  review: 'Ready for your review', submitted: 'Submitted', stopped: 'Stopped',
};

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);
const STATES: QueueState[] = ['queued', 'opening', 'reading', 'filling', 'needs-input', 'review', 'submitted', 'stopped'];

export function cleanItem(x: Partial<QueueItem>): QueueItem | null {
  const url = safeHttpUrl(clip(x.url, 2000));
  if (!url) return null;
  return {
    id: clip(x.id, 80) || crypto.randomUUID(), url, title: clip(x.title, 200) || 'Untitled job', company: clip(x.company, 160), location: clip(x.location, 160),
    state: STATES.includes(x.state as QueueState) ? x.state as QueueState : 'queued', note: clip(x.note, 200),
    needs: (Array.isArray(x.needs) ? x.needs : []).map((q) => clip(q, 200)).filter(Boolean).slice(0, 30), filled: Math.max(0, Math.min(500, Number(x.filled) || 0)),
    tabId: typeof x.tabId === 'number' ? x.tabId : null, added_at: x.added_at ?? new Date().toISOString(), updated_at: new Date().toISOString(),
  };
}

export async function loadQueue(): Promise<QueueItem[]> {
  const list = await readKey<QueueItem[]>(QUEUE_KEY);
  return (Array.isArray(list) ? list : []).map((x) => cleanItem(x)).filter((x): x is QueueItem => !!x);
}
export const storeQueue = (list: QueueItem[]) => writeKey(QUEUE_KEY, list.slice(0, MAX_QUEUE));

/** Adds jobs to the queue (once each, by link). Returns a message for the user when something is refused. */
export async function addToQueue(jobs: { url: string; title: string; company: string; location?: string | null }[]): Promise<string | null> {
  const list = await loadQueue();
  const open = list.filter((x) => x.state !== 'submitted');
  const fresh = jobs.map((j) => cleanItem({ url: j.url, title: j.title, company: j.company, location: j.location ?? '' })).filter((x): x is QueueItem => !!x)
    .filter((x) => !list.some((y) => y.url === x.url && y.state !== 'stopped'));
  if (!fresh.length) return jobs.length ? 'Already in your apply queue.' : null;
  if (open.length + fresh.length > MAX_QUEUE) return `The apply queue holds ${MAX_QUEUE} jobs. Finish or remove some first.`;
  const kept = list.filter((y) => !fresh.some((x) => x.url === y.url));
  return (await storeQueue([...kept, ...fresh])) ? null : "Couldn't save the queue. Your browser storage may be full.";
}

export async function updateItem(id: string, patch: Partial<QueueItem>): Promise<QueueItem | null> {
  const list = await loadQueue();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const next = cleanItem({ ...list[i], ...patch, id: list[i].id, added_at: list[i].added_at });
  if (!next) return null;
  list[i] = next;
  await storeQueue(list);
  return next;
}

export async function removeItems(ids: string[]): Promise<void> {
  await storeQueue((await loadQueue()).filter((x) => !ids.includes(x.id)));
}

/** The origins the queue's pages live on, to ask the browser for access to just those sites. */
export const originsOf = (items: QueueItem[]) => [...new Set(items.map((x) => { try { return `${new URL(x.url).origin}/*`; } catch { return ''; } }).filter(Boolean))];

export function useApplyQueue(): QueueItem[] {
  const [list, setList] = useState<QueueItem[]>([]);
  useEffect(() => { const load = () => void loadQueue().then(setList); load(); return onKeysChanged([QUEUE_KEY], load); }, []);
  return list;
}
