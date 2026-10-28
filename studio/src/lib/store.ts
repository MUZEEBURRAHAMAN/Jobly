// App state: one StudioData object, loaded from IndexedDB once and saved shortly after every change.
import { useSyncExternalStore } from 'react';
import { loadData, saveData } from './db';
import { emptyData } from './defaults';
import { migrate } from './data-file';
import type { StudioData } from './types';

let state: StudioData = emptyData();
let ready = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saveError: string | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export async function initStore(): Promise<void> {
  try {
    const stored = await loadData();
    if (stored) state = migrate(stored);
  } catch {
    saveError = 'This browser blocked storage, so changes won’t be kept after you close the tab.';
  }
  ready = true;
  emit();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveData(state).then(
      () => { if (saveError) { saveError = null; emit(); } },
      () => { saveError = 'Couldn’t save to this browser’s storage. Export a backup from Settings to be safe.'; emit(); },
    );
  }, 250);
}

/** Save now (used before the page unloads). */
export function flush(): void {
  if (saveTimer) { clearTimeout(saveTimer); saveData(state).catch(() => undefined); }
}

export function getState(): StudioData { return state; }

/** Replace state with a new object. Updaters return a new object; never mutate the old one. */
export function update(fn: (s: StudioData) => StudioData): void {
  state = fn(state);
  emit();
  scheduleSave();
}

export function replaceAll(next: StudioData): void {
  state = next;
  emit();
  scheduleSave();
}

function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

export function useStudio<T>(select: (s: StudioData) => T): T {
  return useSyncExternalStore(subscribe, () => select(state));
}

export function useReady(): boolean { return useSyncExternalStore(subscribe, () => ready); }
export function useSaveError(): string | null { return useSyncExternalStore(subscribe, () => saveError); }
