import { useCallback, useEffect, useState } from 'react';

// "Mute a company" is a personal choice, so it lives on this device (not in the shared server database).
const KEY = 'mutedCompanyIds';
const hasChromeStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;

async function read(): Promise<number[]> {
  try {
    if (hasChromeStorage()) return ((await chrome.storage.local.get(KEY))[KEY] as number[] | undefined) ?? [];
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function write(ids: number[]) {
  try {
    if (hasChromeStorage()) void chrome.storage.local.set({ [KEY]: ids });
    else localStorage.setItem(KEY, JSON.stringify(ids));
  } catch { /* storage unavailable: the choice just won't persist */ }
}

export function useMutedCompanies() {
  const [muted, setMuted] = useState<number[]>([]);

  useEffect(() => {
    let alive = true;
    read().then((ids) => { if (alive) setMuted(ids); });
    if (!hasChromeStorage()) return () => { alive = false; };
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[KEY]) setMuted((changes[KEY].newValue as number[] | undefined) ?? []);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => { alive = false; chrome.storage.onChanged.removeListener(onChange); };
  }, []);

  const toggle = useCallback((companyId: number) => {
    setMuted((prev) => {
      const next = prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId];
      write(next);
      return next;
    });
  }, []);

  return { muted, toggle };
}
