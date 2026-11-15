import { AlertItem, Job, Preferences } from '../types';

/**
 * Everything personal lives on this device (chrome.storage.local): preferences, saved jobs and alerts.
 * Jobly has no server: the job list is downloaded as static files and matched to the preferences in the browser.
 */

const KEYS = {
  preferences: 'userPreferences',
  saved: 'savedJobs',
  alerts: 'alerts',
  seen: 'seenAlertKeys',
} as const;
// Before this version the (shared) server held these and the extension cached a copy: adopt that copy once.
const LEGACY = { preferences: 'cachedPreferences', saved: 'cachedSaved' } as const;

export const MAX_SAVED_JOBS = 500;
export const MAX_ALERTS = 100;
export const MAX_SEEN_KEYS = 600;

export const DEFAULT_PREFERENCES: Preferences = {
  roles: ['product_design', 'frontend_engineering', 'product_management', 'ai_ml', 'fullstack_engineering'],
  seniorities: ['intern', 'junior', 'mid', 'senior', 'lead'],
  locations: [],
  remote_only: false,
  custom_keywords: '',
  excluded_keywords: '',
  min_salary: 0,
  employment_types: [],
  notify_enabled: true,
  sync_interval_mins: 30,
};

const hasStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;
const memory = new Map<string, unknown>(); // only used outside an extension (plain dev server)

export async function readKey<T>(key: string): Promise<T | undefined> {
  try {
    if (hasStorage()) return (await chrome.storage.local.get(key))[key] as T | undefined;
  } catch {
    return undefined;
  }
  return memory.get(key) as T | undefined;
}

export async function writeKey(key: string, value: unknown): Promise<boolean> {
  try {
    if (hasStorage()) await chrome.storage.local.set({ [key]: value });
    else memory.set(key, value);
    return true;
  } catch {
    return false; // storage full or unavailable
  }
}

/** Calls `fn` whenever any of `keys` changes in another extension page (popup <-> dashboard <-> worker). */
export function onKeysChanged(keys: string[], fn: () => void): () => void {
  if (!hasStorage()) return () => {};
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && keys.some((k) => k in changes)) fn();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** A job's identity on this device. Database ids can change when the job data is rebuilt, the apply link doesn't. */
export const jobKey = (job: Pick<Job, 'application_url' | 'company_name' | 'external_id'>): string =>
  job.application_url || `${job.company_name}|${job.external_id}`;

// ------------------------------------------------------------------ preferences
/** Preferences with every field of the right type (stored, synced or restored data is never trusted as-is). */
export function cleanPreferences(x: unknown): Preferences {
  const o = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const strs = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').map((s) => s.slice(0, 80)).slice(0, n) : null);
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  return {
    roles: strs(o.roles, 40) ?? DEFAULT_PREFERENCES.roles, seniorities: strs(o.seniorities, 10) ?? DEFAULT_PREFERENCES.seniorities,
    locations: strs(o.locations, 20) ?? [], remote_only: o.remote_only === true, custom_keywords: str(o.custom_keywords, 500), excluded_keywords: str(o.excluded_keywords, 500),
    min_salary: num(o.min_salary, 0, 10_000_000, 0), employment_types: strs(o.employment_types, 6) ?? [], notify_enabled: o.notify_enabled !== false,
    sync_interval_mins: num(o.sync_interval_mins, 15, 1440, DEFAULT_PREFERENCES.sync_interval_mins),
  };
}

export async function loadPreferences(): Promise<Preferences> {
  return cleanPreferences((await readKey<Partial<Preferences>>(KEYS.preferences)) ?? (await readKey<Partial<Preferences>>(LEGACY.preferences)));
}

export async function hasStoredPreferences(): Promise<boolean> {
  return !!((await readKey(KEYS.preferences)) ?? (await readKey(LEGACY.preferences)));
}

export const storePreferences = (prefs: Preferences) => writeKey(KEYS.preferences, prefs);

// ------------------------------------------------------------------ saved jobs
export async function loadSaved(): Promise<Job[]> {
  const saved = (await readKey<Job[]>(KEYS.saved)) ?? (await readKey<Job[]>(LEGACY.saved)) ?? [];
  return Array.isArray(saved) ? saved : [];
}

/** Full copies are kept so a saved job still shows after the posting is gone from the job data. */
export async function storeSaved(jobs: Job[]): Promise<boolean> {
  return writeKey(KEYS.saved, jobs.slice(0, MAX_SAVED_JOBS).map((j) => ({ ...j, is_saved: true })));
}

// ------------------------------------------------------------------ alerts
export async function loadAlerts(): Promise<AlertItem[]> {
  const alerts = await readKey<AlertItem[]>(KEYS.alerts);
  return Array.isArray(alerts) ? alerts : [];
}

export const storeAlerts = (alerts: AlertItem[]) => writeKey(KEYS.alerts, alerts.slice(0, MAX_ALERTS));
export const loadSeenKeys = () => readKey<string[]>(KEYS.seen);
export const storeSeenKeys = (keys: string[]) => writeKey(KEYS.seen, keys.slice(-MAX_SEEN_KEYS));

export const STORAGE_KEYS = KEYS;
