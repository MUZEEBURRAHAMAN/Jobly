import { useCallback, useEffect, useState } from 'react';
import { AlertItem } from '../types';
import { loadAlerts, onKeysChanged, STORAGE_KEYS, storeAlerts } from './userData';

/** New-match alerts found by the background check, stored on this device. */
export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    let alive = true;
    const refresh = () => loadAlerts().then((list) => { if (alive) setAlerts(list); });
    refresh();
    const off = onKeysChanged([STORAGE_KEYS.alerts], refresh);
    return () => { alive = false; off(); };
  }, []);

  const markAllRead = useCallback(async (): Promise<boolean> => {
    const current = await loadAlerts();
    const next = current.map((a) => ({ ...a, is_read: true }));
    setAlerts(next);
    const ok = await storeAlerts(next);
    try { chrome.runtime?.sendMessage({ type: 'CLEAR_BADGE' }, () => void chrome.runtime?.lastError); } catch { /* not in an extension context */ }
    return ok;
  }, []);

  return { alerts, unread: alerts.filter((a) => !a.is_read).length, markAllRead };
}
