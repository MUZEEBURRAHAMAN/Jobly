/**
 * Optional sync across the user's own Chrome browsers, through Chrome's sync storage (their Google account; Jobly's
 * server never sees it). Off by default. The whole state travels as one snapshot split into chunks, and the newest
 * snapshot wins: a device that changed something last is the one the others follow.
 *
 * Chrome limits sync storage to about 100 KB, so the snapshot keeps the newest applications and trims long notes when
 * it has to. A device never deletes its own older applications because a trimmed snapshot doesn't mention them.
 */
import { readKey, writeKey } from './userData';

export const SYNC_SETTING = 'syncEnabled';
export const SYNC_STATE = 'syncState';
const LOCAL_KEYS = ['userPreferences', 'followedCompanyIds', 'mutedCompanyIds', 'trackerSettings', 'profiles', 'activeProfileId', 'applications', 'interviews', 'tasks'] as const;
export const SYNCED_LOCAL_KEYS: readonly string[] = LOCAL_KEYS;
const CHUNK = 7000;                 // under Chrome's 8 KB per item
const BUDGET = 92_000;              // under the 102 KB total, with room for the meta item
const META = 'jobly_meta';
const MAX_SYNCED_APPS = 400;

export interface SyncState { device: string; changedAt: number; syncedAt: number; trimmed: boolean; error: string | null }
interface Meta { chunks: number; updatedAt: number; device: string; trimmed: boolean }

export async function syncState(): Promise<SyncState> {
  const s = await readKey<SyncState>(SYNC_STATE);
  if (s?.device) return s;
  const fresh: SyncState = { device: crypto.randomUUID(), changedAt: 0, syncedAt: 0, trimmed: false, error: null };
  await writeKey(SYNC_STATE, fresh);
  return fresh;
}
const saveState = async (patch: Partial<SyncState>) => writeKey(SYNC_STATE, { ...(await syncState()), ...patch });

type Snapshot = Record<string, unknown>;

async function buildSnapshot(): Promise<{ json: string; trimmed: boolean }> {
  const snap: Snapshot = {};
  for (const k of LOCAL_KEYS) { const v = await readKey(k); if (v !== undefined) snap[k] = v; }
  let apps = (Array.isArray(snap.applications) ? snap.applications : []) as { updated_at?: string; notes?: string }[];
  apps = [...apps].sort((a, b) => Date.parse(b.updated_at ?? '') - Date.parse(a.updated_at ?? '')).slice(0, MAX_SYNCED_APPS);
  let trimmed = apps.length < ((snap.applications as unknown[]) ?? []).length;
  snap.applications = apps;
  let json = JSON.stringify(snap);
  // Over budget: shorten notes first, then drop the oldest applications.
  if (json.length > BUDGET) { snap.applications = apps.map((a) => ({ ...a, notes: (a.notes ?? '').slice(0, 280) })); trimmed = true; json = JSON.stringify(snap); }
  while (json.length > BUDGET && (snap.applications as unknown[]).length > 0) {
    snap.applications = (snap.applications as unknown[]).slice(0, Math.floor((snap.applications as unknown[]).length * 0.8));
    trimmed = true; json = JSON.stringify(snap);
  }
  return { json, trimmed };
}

/** Writes this device's state to sync storage. */
export async function pushSnapshot(): Promise<void> {
  const state = await syncState();
  try {
    const { json, trimmed } = await buildSnapshot();
    const parts: Record<string, string> = {};
    for (let i = 0; i * CHUNK < json.length; i++) parts[`jobly_${i}`] = json.slice(i * CHUNK, (i + 1) * CHUNK);
    const meta: Meta = { chunks: Object.keys(parts).length, updatedAt: state.changedAt || Date.now(), device: state.device, trimmed };
    const old = (await chrome.storage.sync.get(META))[META] as Meta | undefined;
    await chrome.storage.sync.set({ ...parts, [META]: meta });
    if (old && old.chunks > meta.chunks) await chrome.storage.sync.remove(Array.from({ length: old.chunks - meta.chunks }, (_, i) => `jobly_${meta.chunks + i}`));
    await saveState({ syncedAt: Date.now(), trimmed, error: null });
  } catch (e) {
    await saveState({ error: e instanceof Error ? e.message.slice(0, 200) : 'Sync failed' });
  }
}

/** Takes another device's newer snapshot. Returns true when something was applied. */
export async function pullSnapshot(): Promise<boolean> {
  const state = await syncState();
  const meta = (await chrome.storage.sync.get(META))[META] as Meta | undefined;
  if (!meta || meta.device === state.device || meta.updatedAt <= state.changedAt) return false;
  const keys = Array.from({ length: meta.chunks }, (_, i) => `jobly_${i}`);
  const parts = await chrome.storage.sync.get(keys);
  let snap: Snapshot;
  try { snap = JSON.parse(keys.map((k) => parts[k] ?? '').join('')); } catch { return false; } // a half-written snapshot: wait for the next change
  for (const k of LOCAL_KEYS) {
    if (!(k in snap)) continue;
    let value = snap[k];
    if (k === 'applications' && meta.trimmed) {
      // Keep this device's older applications that a trimmed snapshot left out.
      const remote = (Array.isArray(value) ? value : []) as { key: string }[];
      const seen = new Set(remote.map((a) => a.key));
      const local = ((await readKey<{ key: string }[]>(k)) ?? []).filter((a) => !seen.has(a.key));
      value = [...remote, ...local];
    }
    await writeKey(k, value);
  }
  await saveState({ changedAt: meta.updatedAt, syncedAt: Date.now(), error: null });
  return true;
}

export const syncEnabled = async () => (await readKey<boolean>(SYNC_SETTING)) === true;
