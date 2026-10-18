import { API_BASES } from '../lib/config';
import { AlertItem, Job } from '../types';
import {
  jobKey, loadAlerts, loadPreferences, loadSeenKeys, prefsParam, readKey, storeAlerts, storeSeenKeys,
} from '../lib/userData';

const ALARM_NAME = 'jobly-sync';
const RECENT_DAYS = 3; // only jobs posted this recently are worth an alert
// New jobs arrive in batches every couple of hours, so checking more often than this only costs the free server load.
const POLL_MIN_MINUTES = 60;
const POLL_SPREAD_MINUTES = 30; // each install picks its own period (60-90 min) so checks don't arrive together

// The background check is not user-facing, so it can afford to wait for a sleeping free-tier server.
// Alerts are worked out here on the device: ask the server for fresh jobs that fit this user's preferences
// (sent with the request, never stored there) and compare them with what was already seen.
async function fetchRecentMatches(): Promise<Job[] | null> {
  const query = new URLSearchParams({
    only_matching: 'true', freshness_days: String(RECENT_DAYS), limit: '50',
    prefs: prefsParam(await loadPreferences()),
  });
  for (const base of API_BASES) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(`${base}/api/jobs?${query}`, { signal: ctrl.signal });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data?.items) ? data.items : null;
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
  const period = POLL_MIN_MINUTES + Math.floor(Math.random() * POLL_SPREAD_MINUTES);
  await chrome.alarms.create(ALARM_NAME, { delayInMinutes: 1, periodInMinutes: period });
}
void ensureAlarm();

// After an uninstall Chrome opens a short, optional feedback page. It carries no identifier.
void chrome.runtime.setUninstallURL('https://joblyextension.netlify.app/uninstall');

chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.action.setBadgeBackgroundColor({ color: '#06b6d4' });
  // Updates replace the old 30-45 minute schedule with the slower one.
  if (details.reason === 'update') await chrome.alarms.clear(ALARM_NAME);
  await ensureAlarm();
  // Before alerts moved onto the device the worker remembered server notification ids: that list is obsolete.
  await chrome.storage.local.remove(['alertedNotificationIds']);
  // First install: greet the user with the welcome tour (it also explains alerts and privacy).
  if (details.reason === 'install') await chrome.tabs.create({ url: chrome.runtime.getURL('options.html#welcome') });
  // The first check only records what already exists, so nobody gets a backlog of old alerts.
  await checkNewMatchesAndNotify();
});

chrome.runtime.onStartup.addListener(() => { void ensureAlarm(); });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME || alarm.name === 'hiring-radar-sync') {
    await checkNewMatchesAndNotify();
  }
});

async function updateBadge(alerts: AlertItem[]) {
  const unread = alerts.filter((a) => !a.is_read).length;
  await chrome.action.setBadgeText({ text: unread === 0 ? '' : unread > 99 ? '99+' : String(unread) });
}

async function mutedCompanyIds(): Promise<Set<number>> {
  return new Set((await readKey<number[]>('mutedCompanyIds')) ?? []);
}

// Check for newly published matched jobs, remember them as alerts and show a desktop notification.
// `silent` (or the very first run) records the current jobs as already seen without announcing them.
async function checkNewMatchesAndNotify({ silent = false }: { silent?: boolean } = {}) {
  try {
    const jobs = await fetchRecentMatches();
    if (!jobs) return; // server unreachable: try again at the next alarm

    const stored = await loadSeenKeys();
    const quiet = silent || !Array.isArray(stored);
    const seen = new Set<string>(stored ?? []);
    const muted = await mutedCompanyIds();
    const fresh = jobs.filter((j) => {
      const key = jobKey(j);
      return !!key && !!j.application_url && !seen.has(key) && !muted.has(j.company_id);
    });

    const alerts = await loadAlerts();
    if (!quiet && fresh.length > 0) {
      const now = new Date().toISOString();
      const added: AlertItem[] = fresh.map((j) => ({
        id: jobKey(j), title: j.title, company_name: j.company_name, location: j.location,
        application_url: j.application_url, sent_at: now, is_read: false,
      }));
      alerts.unshift(...added);
      await storeAlerts(alerts);
      if ((await loadPreferences()).notify_enabled !== false) await announce(fresh).catch(() => {}); // a refused popup must not lose the alert
    }

    // Remember everything that was returned (also while silent or muted) so nothing is announced twice.
    jobs.forEach((j) => seen.add(jobKey(j)));
    await storeSeenKeys([...seen]);
    await updateBadge(alerts);
  } catch {
    // Unreachable or unexpected response: skip until the next alarm
  }
}

async function announce(fresh: Job[]) {
  if (fresh.length === 1) {
    const item = fresh[0];
    await chrome.notifications.create(`job-${item.id}`, {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: `New Role at ${item.company_name}`,
      message: `${item.title} · ${item.location || 'Remote'}`,
      priority: 1,
    });
    return;
  }
  const companies = Array.from(new Set(fresh.map((j) => j.company_name)));
  const companyStr = companies.slice(0, 2).join(', ') + (companies.length > 2 ? ` and ${companies.length - 2} others` : '');
  await chrome.notifications.create(`digest-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: `Jobly: ${fresh.length} New Matches Found`,
    message: `${companyStr} published new opportunities matching your preferences.`,
    priority: 1,
  });
}

// Notification Click Handler
chrome.notifications.onClicked.addListener(async (notificationId) => {
  await chrome.notifications.clear(notificationId);
  await chrome.tabs.create({ url: chrome.runtime.getURL('options.html#alerts') });
});

// Runtime Message Listener (only our own extension pages may talk to the worker)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  if (message?.type === 'TRIGGER_BACKGROUND_CHECK') {
    (async () => {
      await checkNewMatchesAndNotify({ silent: message.silent === true });
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
