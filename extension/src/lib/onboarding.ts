import { useCallback, useEffect, useState } from 'react';

// First-run state lives on this device. `null` = not read yet (don't flash the welcome screen at returning users).
const KEY = 'onboarded';
const hasChromeStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;

async function read(): Promise<boolean> {
  try {
    if (hasChromeStorage()) return Boolean((await chrome.storage.local.get(KEY))[KEY]);
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // storage unavailable: never trap someone in the welcome flow
  }
}

function write(value: boolean) {
  try {
    if (hasChromeStorage()) void chrome.storage.local.set({ [KEY]: value });
    else localStorage.setItem(KEY, value ? '1' : '0');
  } catch { /* nothing to do */ }
}

export function useOnboarded() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    read().then((v) => { if (alive) setOnboarded(v); });
    if (!hasChromeStorage()) return () => { alive = false; };
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[KEY]) setOnboarded(Boolean(changes[KEY].newValue));
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => { alive = false; chrome.storage.onChanged.removeListener(onChange); };
  }, []);

  const complete = useCallback(() => { write(true); setOnboarded(true); }, []);
  const reset = useCallback(() => { write(false); setOnboarded(false); }, []);
  return { onboarded, complete, reset };
}
