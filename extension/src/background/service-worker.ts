import { API_BASES } from '../lib/config';

const ALARM_NAME = 'jobly-sync';
const MAX_REMEMBERED_ALERTS = 200;

interface NotificationData {
  id: number;
  job_id: number;
  title: string;
  company_name: string;
  role: string;
  location: string | null;
  application_url: string;
  sent_at: string;
  is_read: boolean;
}

// The background check is not user-facing, so it can afford to wait for a sleeping free-tier server.
async function fetchNotifications(): Promise<NotificationData[] | null> {
  for (const base of API_BASES) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(`${base}/api/notifications`, { signal: ctrl.signal });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : null;
      }
    } catch {
      /* try the next candidate */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// Chrome may drop alarms when the browser restarts (it only guarantees they survive until an update), so
// re-create the alarm every time the worker starts, not only in onInstalled.
async function ensureAlarm() {
  if (await chrome.alarms.get(ALARM_NAME)) return;
  // Staggered period (30-45 min) spreads load across users
  const period = 30 + Math.floor(Math.random() * 15);
  await chrome.alarms.create(ALARM_NAME, { delayInMinutes: 1, periodInMinutes: period });
}
void ensureAlarm();

chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.action.setBadgeBackgroundColor({ color: '#06b6d4' });
  await ensureAlarm();
  // First install: remember everything that already exists instead of announcing a backlog of old alerts.
  await checkNewMatchesAndNotify({ silent: details.reason === 'install' });
});

chrome.runtime.onStartup.addListener(() => { void ensureAlarm(); });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME || alarm.name === 'hiring-radar-sync') {
    await checkNewMatchesAndNotify();
  }
});

async function alertsEnabled(): Promise<boolean> {
  // Respect the "Desktop alerts" setting (it used to be saved but never read here).
  const { cachedPreferences } = await chrome.storage.local.get('cachedPreferences');
  return cachedPreferences?.notify_enabled !== false;
}

// Check for newly published matched jobs and dispatch a notification
async function checkNewMatchesAndNotify({ silent = false }: { silent?: boolean } = {}) {
  try {
    const notifs = await fetchNotifications();
    if (!notifs) return; // server unreachable: try again at the next alarm

    const unread = notifs.filter((n) => !n.is_read);
    const stored = await chrome.storage.local.get(['alertedNotificationIds']);
    const alertedIds = new Set<number>(stored.alertedNotificationIds || []);
    const newToAlert = unread.filter((n) => !alertedIds.has(n.id));

    // Badge always reflects the real unread count, not only when something new arrived.
    await chrome.action.setBadgeText({ text: unread.length === 0 ? '' : unread.length > 99 ? '99+' : String(unread.length) });

    if (newToAlert.length > 0 && !silent && (await alertsEnabled())) {
      if (newToAlert.length === 1) {
        const item = newToAlert[0];
        await chrome.notifications.create(`job-${item.job_id}`, {
          type: 'basic',
          iconUrl: 'icons/icon-128.png',
          title: `New Role at ${item.company_name}`,
          message: `${item.title} · ${item.location || 'Remote'}`,
          priority: 1,
        });
      } else {
        const companies = Array.from(new Set(newToAlert.map((n) => n.company_name)));
        const companyStr = companies.slice(0, 2).join(', ') + (companies.length > 2 ? ` and ${companies.length - 2} others` : '');
        await chrome.notifications.create(`digest-${Date.now()}`, {
          type: 'basic',
          iconUrl: 'icons/icon-128.png',
          title: `Jobly: ${newToAlert.length} New Matches Found`,
          message: `${companyStr} published new opportunities matching your preferences.`,
          priority: 1,
        });
      }
    }

    // Remember what we've seen (also while silent or alerts are off) and keep the list bounded.
    newToAlert.forEach((n) => alertedIds.add(n.id));
    const bounded = Array.from(alertedIds).sort((a, b) => b - a).slice(0, MAX_REMEMBERED_ALERTS);
    await chrome.storage.local.set({ alertedNotificationIds: bounded });
  } catch {
    // Unreachable or unexpected response: skip until the next alarm
  }
}

// Notification Click Handler
chrome.notifications.onClicked.addListener(async (notificationId) => {
  await chrome.notifications.clear(notificationId);
  await chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
});

// Runtime Message Listener (only our own extension pages may talk to the worker)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  if (message?.type === 'TRIGGER_BACKGROUND_CHECK') {
    (async () => {
      await checkNewMatchesAndNotify();
      sendResponse({ success: true });
    })();
    return true; // keep the message channel open for the async response
  }

  if (message?.type === 'CLEAR_BADGE') {
    (async () => {
      await chrome.action.setBadgeText({ text: '' });
      sendResponse({ success: true });
    })();
    return true;
  }
});
