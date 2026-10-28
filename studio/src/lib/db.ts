// A one-record IndexedDB store: all of Studio's data is one document, saved whole after each change.
// That keeps import, export and "delete everything" exact, and a profile plus a few hundred applications is small.
import type { StudioData } from './types';

const DB_NAME = 'jobly-studio';
const STORE = 'kv';
const KEY = 'data';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

export const loadData = () => tx<StudioData | undefined>('readonly', (s) => s.get(KEY));
export const saveData = (data: StudioData) => tx('readwrite', (s) => s.put(data, KEY));
export const clearData = () => tx('readwrite', (s) => s.delete(KEY));

/** Ask the browser not to evict Studio's data under storage pressure. Harmless if refused. */
export function requestPersistence(): void {
  navigator.storage?.persist?.().catch(() => undefined);
}
