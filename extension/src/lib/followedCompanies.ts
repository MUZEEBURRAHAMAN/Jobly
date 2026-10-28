import { useCallback, useEffect, useState } from 'react';
import { readKey, writeKey } from './userData';
import { FOLLOWED_KEY, MAX_FOLLOWED } from './follow';

export { FOLLOWED_KEY, MAX_FOLLOWED };

// Following a company means an alert for any new job there, not only jobs matching the preferences.
// Like muting, it is a personal choice and stays on this device. The background check sends the ids with one request.

export function useFollowedCompanies() {
  const [followed, setFollowed] = useState<number[]>([]);

  useEffect(() => {
    let alive = true;
    readKey<number[]>(FOLLOWED_KEY).then((ids) => { if (alive) setFollowed(Array.isArray(ids) ? ids : []); });
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return () => { alive = false; };
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[FOLLOWED_KEY]) setFollowed((changes[FOLLOWED_KEY].newValue as number[] | undefined) ?? []);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => { alive = false; chrome.storage.onChanged.removeListener(onChange); };
  }, []);

  /** Resolves a problem message, or null when it worked. */
  const toggle = useCallback(async (companyId: number): Promise<string | null> => {
    const current = (await readKey<number[]>(FOLLOWED_KEY)) ?? [];
    const following = current.includes(companyId);
    if (!following && current.length >= MAX_FOLLOWED) return `You can follow up to ${MAX_FOLLOWED} companies.`;
    const next = following ? current.filter((id) => id !== companyId) : [...current, companyId];
    setFollowed(next);
    if (await writeKey(FOLLOWED_KEY, next)) return null;
    setFollowed(current);
    return "Couldn't save that. Your browser storage may be full.";
  }, []);

  return { followed, toggle };
}
