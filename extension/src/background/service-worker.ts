import { API_BASES } from '../lib/config';
import { AlertItem, Job } from '../types';
import {
  jobKey, loadAlerts, loadPreferences, loadSeenKeys, prefsParam, readKey, storeAlerts, storeSeenKeys,
} from '../lib/userData';
import { FOLLOWED_KEY, MAX_FOLLOWED } from '../lib/follow';
import { loadApps, loadInterviews, loadTasks, loadTrackerSettings, MAX_APPS, sanitizeApp, storeApps, storeInterviews, storeTasks } from '../lib/tracker';
import { appFromPageJob, readJobInTab } from '../lib/pageJob';
import { pullSnapshot, pushSnapshot, SYNC_SETTING, SYNC_STATE, syncEnabled, SYNCED_LOCAL_KEYS, syncState } from '../lib/sync';

const ALARM_NAME = 'jobly-sync';
const RECENT_DAYS = 3; // only jobs posted this recently are worth an alert
// New jobs arrive in batches every couple of hours, so checking more often than this only costs the free server load.
const POLL_MIN_MINUTES = 60;
const POLL_SPREAD_MINUTES = 30; // each install picks its own period (60-90 min) so checks don't arrive together
// Reminders are worked out from data on this device only, so checking often costs the server nothing.
const REMINDER_ALARM = 'jobly-reminders';
const REMINDER_MINUTES = 15;

// The background check is not user-facing, so it can afford to wait for a sleeping free-tier server.
// Alerts are worked out here on the device: ask the server for fresh jobs that fit this user's preferences
// (sent with the request, never stored there) and compare them with what was already seen.
async function fetchRecentMatches(): Promise<Job[] | null> {
  return fetchJobs(new URLSearchParams({
    only_matching: 'true', freshness_days: String(RECENT_DAYS), limit: '50',
    prefs: prefsParam(await loadPreferences()),
  }));
}

// New jobs at followed companies, whatever the preferences say: one request for all of them.
async function fetchFollowedJobs(): Promise<Job[]> {
  const ids = ((await readKey<number[]>(FOLLOWED_KEY)) ?? []).filter((n) => Number.isInteger(n)).slice(0, MAX_FOLLOWED);
  if (!ids.length) return [];
  return (await fetchJobs(new URLSearchParams({ company_ids: ids.join(','), freshness_days: String(RECENT_DAYS), limit: '50' }))) ?? [];
}

async function fetchJobs(query: URLSearchParams): Promise<Job[] | null> {
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
  if (!(await chrome.alarms.get(REMINDER_ALARM))) await chrome.alarms.create(REMINDER_ALARM, { delayInMinutes: 1, periodInMinutes: REMINDER_MINUTES });
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

// Chrome sync (opt-in): a local change is pushed a few seconds later; another device's newer snapshot is pulled in.
let ignoreLocalUntil = 0;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
async function pullQuietly() {
  ignoreLocalUntil = Date.now() + 4000; // the pull's own writes are not local changes
  const applied = await pullSnapshot().catch(() => false);
  if (!applied) ignoreLocalUntil = 0;
  return applied;
}
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync' && 'jobly_meta' in changes) { if (await syncEnabled()) await pullQuietly(); return; }
  if (area !== 'local') return;
  if (SYNC_SETTING in changes && changes[SYNC_SETTING].newValue === true) { if (!(await pullQuietly())) await pushSnapshot(); return; }
  if (!Object.keys(changes).some((k) => SYNCED_LOCAL_KEYS.includes(k)) || Date.now() < ignoreLocalUntil || !(await syncEnabled())) return;
  const state = await syncState();
  await chrome.storage.local.set({ [SYNC_STATE]: { ...state, changedAt: Date.now() } });
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushSnapshot(), 5000);
});
void (async () => { if (await syncEnabled()) await pullQuietly(); })();

// Right-click any job posting: "Save this job to Jobly". Chrome lets the extension read only that tab, only on that click.
const SAVE_MENU = 'jobly-save-page';
function ensureMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: SAVE_MENU, title: 'Save this job to Jobly', contexts: ['page'], documentUrlPatterns: ['https://*/*', 'http://*/*'] }, () => void chrome.runtime.lastError);
  });
}
ensureMenu();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== SAVE_MENU || !tab?.id) return;
  const job = await readJobInTab(tab.id);
  const draft = job ? appFromPageJob(job) : { key: tab.url, title: tab.title, company_name: tab.url ? new URL(tab.url).hostname.replace(/^www\./, '') : '', application_url: tab.url, status: 'saved' as const, source: 'page' as const };
  const app = sanitizeApp(draft);
  if (!app) return;
  const apps = await loadApps();
  const existing = apps.find((a) => a.key === app.key);
  if (!existing && apps.length >= MAX_APPS) { await remind('saved', 'Your tracker is full', `Remove some of the ${MAX_APPS} applications to save more.`); return; }
  if (!existing) await storeApps([app, ...apps]);
  await remind('saved', existing ? 'Already in your Jobly tracker' : 'Saved to your Jobly tracker', `${app.title} · ${app.company_name}`);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME || alarm.name === 'hiring-radar-sync') {
    await checkNewMatchesAndNotify();
  }
  if (alarm.name === REMINDER_ALARM) await checkReminders();
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
    const matches = await fetchRecentMatches();
    if (!matches) return; // server unreachable: try again at the next alarm
    const followedJobs = await fetchFollowedJobs();
    const matchKeys = new Set(matches.map(jobKey));
    const jobs = [...matches, ...followedJobs.filter((j) => !matchKeys.has(jobKey(j)))];

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
        application_url: j.application_url, sent_at: now, is_read: false, reason: matchKeys.has(jobKey(j)) ? 'match' : 'follow',
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

// Follow-ups and tasks are due on a day; interviews get a reminder about an hour before they start.
// Each reminder is shown once (the flag is stored with the item) and only while reminders are on.
async function checkReminders() {
  try {
    const settings = await loadTrackerSettings();
    if (!settings.reminders) return;
    const now = Date.now();
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    const dueToday = (iso: string | null | undefined) => !!iso && Date.parse(iso) <= endOfToday.getTime();

    const apps = await loadApps();
    const follow = apps.filter((a) => dueToday(a.follow_up_at) && !a.follow_up_notified && !['rejected', 'withdrawn', 'offer'].includes(a.status));
    if (follow.length) {
      await remind('rem-follow', follow.length === 1 ? `Follow up with ${follow[0].company_name}` : `${follow.length} follow-ups are due`,
        follow.length === 1 ? follow[0].title : follow.slice(0, 3).map((a) => a.company_name).join(', '));
      const keys = new Set(follow.map((a) => a.key));
      await storeApps(apps.map((a) => (keys.has(a.key) ? { ...a, follow_up_notified: true } : a)));
    }

    const tasks = await loadTasks();
    const due = tasks.filter((t) => !t.done && !t.notified && dueToday(t.due_at));
    if (due.length) {
      await remind('rem-task', due.length === 1 ? 'A task is due today' : `${due.length} tasks are due`, due.slice(0, 3).map((t) => t.text).join(' · '));
      const ids = new Set(due.map((t) => t.id));
      await storeTasks(tasks.map((t) => (ids.has(t.id) ? { ...t, notified: true } : t)));
    }

    const interviews = await loadInterviews();
    const soon = interviews.filter((i) => !i.reminded && Date.parse(i.at) > now && Date.parse(i.at) - now <= 75 * 60000);
    for (const iv of soon) {
      const app = apps.find((a) => a.key === iv.app_key);
      const mins = Math.max(1, Math.round((Date.parse(iv.at) - now) / 60000));
      await remind(`rem-iv-${iv.id}`, `${iv.round} in ${mins} minutes`, app ? `${app.title} at ${app.company_name}` : 'Your interview is coming up');
    }
    if (soon.length) {
      const ids = new Set(soon.map((i) => i.id));
      await storeInterviews(interviews.map((i) => (ids.has(i.id) ? { ...i, reminded: true } : i)));
    }
  } catch {
    // Storage unavailable: try again at the next alarm
  }
}

async function remind(id: string, title: string, message: string) {
  try {
    await chrome.notifications.create(`${id}-${Date.now()}`, { type: 'basic', iconUrl: 'icons/icon-128.png', title, message, priority: 2 });
  } catch { /* notifications refused: the item stays on the Tasks page */ }
}

// Notification Click Handler: reminders open the page they are about; job alerts open Alerts.
chrome.notifications.onClicked.addListener(async (notificationId) => {
  await chrome.notifications.clear(notificationId);
  const page = notificationId.startsWith('rem-iv') ? 'interviews' : notificationId.startsWith('rem-') ? 'tasks' : notificationId.startsWith('saved') ? 'tracker' : 'alerts';
  await chrome.tabs.create({ url: chrome.runtime.getURL(`options.html#${page}`) });
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

  if (message?.type === 'CHECK_REMINDERS') {
    (async () => { await checkReminders(); sendResponse({ success: true }); })();
    return true;
  }

  if (message?.type === 'CLEAR_BADGE') {
    (async () => {
      await chrome.action.setBadgeText({ text: '' });
      sendResponse({ success: true });
    })();
    return true;
  }
});
