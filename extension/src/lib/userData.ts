import { AlertItem, Job, Preferences } from '../types';

/**
 * Everything personal lives on this device (chrome.storage.local): preferences, saved jobs and alerts.
 * The server is stateless: preferences travel with each request only to pick matching jobs, and are never stored there.
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

/** A job's identity on this device. Database ids change when the free-tier server rebuilds, the apply link doesn't. */
export const jobKey = (job: Pick<Job, 'application_url' | 'company_name' | 'external_id'>): string =>
  job.application_url || `${job.company_name}|${job.external_id}`;

// ------------------------------------------------------------------ preferences
export async function loadPreferences(): Promise<Preferences> {
  const stored = (await readKey<Preferences>(KEYS.preferences)) ?? (await readKey<Preferences>(LEGACY.preferences));
  return { ...DEFAULT_PREFERENCES, ...(stored ?? {}) };
}

export async function hasStoredPreferences(): Promise<boolean> {
  return !!((await readKey(KEYS.preferences)) ?? (await readKey(LEGACY.preferences)));
}

export const storePreferences = (prefs: Preferences) => writeKey(KEYS.preferences, prefs);

/** The `prefs` request parameter: only what the server needs to pick matching jobs. */
export function prefsParam(p: Preferences): string {
  return JSON.stringify({
    roles: p.roles, seniorities: p.seniorities, locations: p.locations, remote_only: p.remote_only,
    custom_keywords: p.custom_keywords, excluded_keywords: p.excluded_keywords,
  });
}

// ------------------------------------------------------------------ saved jobs
export async function loadSaved(): Promise<Job[]> {
  const saved = (await readKey<Job[]>(KEYS.saved)) ?? (await readKey<Job[]>(LEGACY.saved)) ?? [];
  return Array.isArray(saved) ? saved : [];
}

/** Full copies are kept so a saved job still shows after the posting is gone or the server restarts. */
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
