import { jobData, toJob } from '../lib/api';
import type { JobQuery } from '../../../shared/jobdata';
import { AlertItem, Job } from '../types';
import {
  jobKey, loadAlerts, loadPreferences, loadSeenKeys, readKey, storeAlerts, storeSeenKeys, writeKey,
} from '../lib/userData';
import { FOLLOWED_KEY, MAX_FOLLOWED } from '../lib/follow';
import { loadApps, loadInterviews, loadTasks, loadTrackerSettings, MAX_APPS, sanitizeApp, storeApps, storeInterviews, storeTasks } from '../lib/tracker';
import { appFromPageJob, readJobInTab } from '../lib/pageJob';
import { FEATURES } from '../lib/config';
import type { PageJob } from '../lib/pageJob';
import type { ScannedField } from '../lib/autofill';
import { assistAnswers } from '../lib/assistLogic';
import { loadAnswers, markUsed, rememberAnswers } from '../lib/answerBank';
import { loadActiveProfileId, loadProfiles, PROFILE_KEYS, ResumeFile } from '../lib/profile';
import { safeHttpUrl } from '../lib/url';
import { TRACKER_KEYS } from '../lib/tracker';
import { ACTIVE, cleanItem, loadQueue, PARALLEL, QueueItem, storeQueue, WAITING } from '../lib/applyQueue';
import { pullSnapshot, pushSnapshot, SYNC_SETTING, SYNC_STATE, syncEnabled, SYNCED_LOCAL_KEYS, syncState } from '../lib/sync';

const ALARM_NAME = 'jobly-sync';
const RECENT_DAYS = 3; // only jobs posted this recently are worth an alert
// New jobs arrive in batches every couple of hours, so checking more often than this only costs the free server load.
const POLL_MIN_MINUTES = 60;
const POLL_SPREAD_MINUTES = 30; // each install picks its own period (60-90 min) so checks don't arrive together
// Reminders are worked out from data on this device only, so checking often costs the server nothing.
const REMINDER_ALARM = 'jobly-reminders';
const REMINDER_MINUTES = 15;

// Alerts are worked out here on the device: read fresh jobs that fit this user's preferences from Jobly's static job
// data (the preferences never leave the device) and compare them with what was already seen.
async function fetchRecentMatches(): Promise<Job[] | null> {
  return fetchJobs({ only_matching: true, freshness_days: RECENT_DAYS, limit: 50, prefs: await loadPreferences() });
}

// New jobs at followed companies, whatever the preferences say: one request for all of them.
async function fetchFollowedJobs(): Promise<Job[]> {
  const ids = ((await readKey<number[]>(FOLLOWED_KEY)) ?? []).filter((n) => Number.isInteger(n)).slice(0, MAX_FOLLOWED);
  if (!ids.length) return [];
  return (await fetchJobs({ company_ids: ids, freshness_days: RECENT_DAYS, limit: 50 })) ?? [];
}

async function fetchJobs(query: JobQuery): Promise<Job[] | null> {
  try {
    jobData.refresh();
    const page = await jobData.query(query);
    return page.items.map((j) => toJob(j, page.generated_at));
  } catch {
    return null;   // the job data can't be reached: try again at the next check
  }
}

// Chrome may drop alarms when the browser restarts (it only guarantees they survive until an update), so
// re-create the alarm every time the worker starts, not only in onInstalled.
async function ensureAlarm() {
  // Reminders belong to the tracker; while it is switched off there is nothing to check
  if (!FEATURES.tracker) await chrome.alarms.clear(REMINDER_ALARM);
  else if (!(await chrome.alarms.get(REMINDER_ALARM))) await chrome.alarms.create(REMINDER_ALARM, { delayInMinutes: 1, periodInMinutes: REMINDER_MINUTES });
  if (await chrome.alarms.get(ALARM_NAME)) return;
  const period = POLL_MIN_MINUTES + Math.floor(Math.random() * POLL_SPREAD_MINUTES);
  await chrome.alarms.create(ALARM_NAME, { delayInMinutes: 1, periodInMinutes: period });
}
void ensureAlarm();

// After an uninstall Chrome opens a short, optional feedback page. It carries no identifier.
void chrome.runtime.setUninstallURL('https://jobly-88t.pages.dev/uninstall');

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
  if (!existing && apps.length >= MAX_APPS) { await remind('saved', FEATURES.tracker ? 'Your tracker is full' : 'Jobly is full', `Remove some of the ${MAX_APPS} saved and applied jobs to save more.`); return; }
  if (!existing) await storeApps([app, ...apps]);
  const where = FEATURES.tracker ? 'your Jobly tracker' : 'Jobly';
  await remind('saved', existing ? `Already saved in ${where}` : `Saved to ${where}`, `${app.title} · ${app.company_name}`);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === QUEUE_ALARM) { await checkQueue(); return; }
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
    // Reminders belong to the tracker, Interviews and Tasks, which are switched off for now
    if (!FEATURES.tracker) return;
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
  const page = notificationId.startsWith('rem-iv') ? 'interviews' : notificationId.startsWith('rem-') ? 'tasks' : notificationId.startsWith('saved') ? (FEATURES.tracker ? 'tracker' : 'saved') : 'alerts';
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

  if (typeof message?.type === 'string' && message.type.startsWith('ASSIST_')) {
    void handleAssist(message, sender).then(sendResponse, () => sendResponse(null));
    return true;
  }

  // From Jobly's own pages only (the Applications page runs in a tab, so check where it was sent from)
  if (message?.type === 'QUEUE_PUMP' && sender.url?.startsWith(chrome.runtime.getURL(''))) {
    void pumpQueue().then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
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

// ---------- Apply queue ----------
// Jobs the user queued are prepared one or two at a time: open the page in a background tab, inject the assist in
// auto mode, let it fill what it knows and report back. It stops at "Your review": the user presses Submit.
const QUEUE_RUN = 'applyQueueRunning';
const QUEUE_ALARM = 'jobly-apply-queue';
const MAX_OPEN = 6;          // application tabs open at once (being prepared + waiting for the user)
const STALE_MS = 75_000;     // no word from a tab this long while opening or reading: no form there

// Every change to the queue runs one after another: two tabs reporting at once must not overwrite each other
let queueLock: Promise<unknown> = Promise.resolve();
const locked = <T>(fn: () => Promise<T>): Promise<T> => { const run = queueLock.then(fn, fn); queueLock = run.catch(() => undefined); return run; };

const patchQueue = (match: (x: QueueItem) => boolean, patch: Partial<QueueItem>) => locked(() => patchQueueNow(match, patch));
async function patchQueueNow(match: (x: QueueItem) => boolean, patch: Partial<QueueItem>): Promise<QueueItem | null> {
  const list = await loadQueue();
  const i = list.findIndex(match);
  if (i < 0) return null;
  const next = cleanItem({ ...list[i], ...patch, id: list[i].id, added_at: list[i].added_at });
  if (!next) return null;
  list[i] = next;
  await storeQueue(list);
  return next;
}

const pumpQueue = () => locked(pumpQueueNow);
async function pumpQueueNow(): Promise<void> {
  if (!(await readKey<boolean>(QUEUE_RUN))) return;
  const list = await loadQueue();
  const active = list.filter((x) => ACTIVE.includes(x.state)).length;
  const open = active + list.filter((x) => WAITING.includes(x.state)).length;
  let slots = Math.min(PARALLEL - active, MAX_OPEN - open);
  const queued = list.filter((x) => x.state === 'queued');
  if (!queued.length && !active) { await writeKey(QUEUE_RUN, false); await chrome.alarms.clear(QUEUE_ALARM); return; }
  for (const item of queued) {
    if (slots <= 0) break;
    const origin = `${new URL(item.url).origin}/*`;
    if (!(await chrome.permissions.contains({ origins: [origin] }))) {
      await patchQueueNow((x) => x.id === item.id, { state: 'stopped', note: 'Jobly needs your OK to open this site. Press Start again.' });
      continue;
    }
    // A blank tab first, then the job: Jobly knows the tab before its page starts loading
    const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
    await patchQueueNow((x) => x.id === item.id, { state: 'opening', note: '', tabId: tab.id ?? null, needs: [], filled: 0 });
    if (tab.id != null) {
      // let the blank tab settle before it loads the job page
      for (let i = 0; i < 10; i++) { const t = await chrome.tabs.get(tab.id).catch(() => null); if (!t || t.status === 'complete') break; await new Promise((r) => setTimeout(r, 100)); }
      await new Promise((r) => setTimeout(r, 300));
      await chrome.tabs.update(tab.id, { url: item.url }).catch(() => null);
    }
    slots--;
  }
  if (!(await chrome.alarms.get(QUEUE_ALARM))) await chrome.alarms.create(QUEUE_ALARM, { periodInMinutes: 0.5 });
}

/** Tabs that went quiet: nothing to fill there. */
const checkQueue = () => locked(checkQueueNow);
async function checkQueueNow(): Promise<void> {
  const list = await loadQueue();
  const now = Date.now();
  let changed = false;
  for (const x of list) {
    if (ACTIVE.includes(x.state) && now - Date.parse(x.updated_at) > STALE_MS) {
      x.state = 'stopped'; x.note = 'No application form found on the page. Open it to apply yourself.'; x.updated_at = new Date().toISOString(); changed = true;
    }
  }
  if (changed) await storeQueue(list);
  await pumpQueueNow();
}

async function injectAuto(tabId: number, itemId: string): Promise<void> {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: (id: string) => { (window as Window & { __joblyAuto?: string }).__joblyAuto = id; }, args: [itemId] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['assist.js'] });
  } catch {
    // The page moved somewhere Jobly wasn't allowed to open (often a sign-in or another hiring site)
    await patchQueue((x) => x.id === itemId, { state: 'stopped', note: 'The form moved to another site. Open the tab and finish it there.' });
    await pumpQueue();
  }
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete') return;
  if (/^chrome-error:/.test(tab.url ?? '')) {
    void patchQueue((x) => x.tabId === tabId && ACTIVE.includes(x.state), { state: 'stopped', note: "The page didn't load. Check your connection and use Try again." }).then((x) => { if (x) void pumpQueue(); });
    return;
  }
  if (!/^https?:/.test(tab.url ?? '')) return;
  void loadQueue().then(async (list) => {
    const item = list.find((x) => x.tabId === tabId && (ACTIVE.includes(x.state) || WAITING.includes(x.state)));
    if (!item) return;
    if (item.state === 'opening') await patchQueue((x) => x.id === item.id, { state: 'reading' });
    await injectAuto(tabId, item.id);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    const item = (await loadQueue()).find((x) => x.tabId === tabId);
    if (!item) return;
    if (item.state !== 'submitted' && item.state !== 'stopped') await patchQueue((x) => x.id === item.id, { state: 'stopped', note: 'The tab was closed before you submitted.', tabId: null });
    else await patchQueue((x) => x.id === item.id, { tabId: null });
    await pumpQueue();
  })();
});

// ---------- Apply assist (the panel on an application page) ----------
// The panel runs in the page's tab, so everything it sends is checked here: it gets answers only for the active
// profile, and never writes anything but saved answers and the job's Applied entry.
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
function pageJobFrom(v: unknown): PageJob | null {
  if (!v || typeof v !== 'object') return null;
  const j = v as Record<string, unknown>;
  const url = safeHttpUrl(str(j.url, 2000));
  if (!url) return null;
  return { found: !!j.found, title: str(j.title, 200) || 'Untitled job', company: str(j.company, 160), location: str(j.location, 160), datePosted: str(j.datePosted, 40),
    employmentType: str(j.employmentType, 40), salary: str(j.salary, 120), url, description: '' };
}

async function handleAssist(message: Record<string, unknown>, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (!sender.tab?.id) return null; // only the panel in a page sends these
  switch (message.type) {
    case 'ASSIST_PROPOSE': {
      const [profiles, activeId, saved, resumes] = await Promise.all([loadProfiles(), loadActiveProfileId(), loadAnswers(), readKey<Record<string, unknown>>(PROFILE_KEYS.resume)]);
      const profile = profiles.find((p) => p.id === activeId) ?? profiles[0];
      if (!profile) return { error: 'no-profile' };
      const fields = (Array.isArray(message.fields) ? message.fields : []).slice(0, 150) as ScannedField[];
      return { profileLabel: profile.label, answers: assistAnswers(fields, profile, saved, !!resumes?.[profile.id]) };
    }
    case 'ASSIST_RESUME': {
      const [profiles, activeId, resumes] = await Promise.all([loadProfiles(), loadActiveProfileId(), readKey<Record<string, ResumeFile>>(PROFILE_KEYS.resume)]);
      const profile = profiles.find((p) => p.id === activeId) ?? profiles[0];
      const r = profile ? resumes?.[profile.id] : undefined;
      return { resume: r ? { name: r.name, type: r.type, data: r.data } : null };
    }
    case 'ASSIST_REMEMBER': {
      const items = (Array.isArray(message.items) ? message.items : []).slice(0, 50)
        .map((i) => ({ question: str((i as Record<string, unknown>)?.question, 300), value: str((i as Record<string, unknown>)?.value, 3000), kind: str((i as Record<string, unknown>)?.kind, 20) }));
      return { saved: await rememberAnswers(items) };
    }
    case 'ASSIST_USED':
      await markUsed((Array.isArray(message.keys) ? message.keys : []).filter((k): k is string => typeof k === 'string').slice(0, 50));
      return { ok: true };
    case 'ASSIST_PROGRESS': {
      // The assist in a queued tab reports where it got to
      const states = ['reading', 'filling', 'needs-input', 'review', 'stopped'] as const;
      const state = states.find((s) => s === message.state);
      if (!state) return null;
      const item = await patchQueue((x) => x.tabId === sender.tab!.id && x.id === message.id, {
        state, note: str(message.note, 200), filled: Number(message.filled) || 0,
        needs: (Array.isArray(message.needs) ? message.needs : []).map((q) => str(q, 200)).filter(Boolean).slice(0, 30),
      });
      if (item && state !== 'reading' && state !== 'filling') await pumpQueue();
      return { ok: !!item };
    }
    case 'ASSIST_SUBMITTED': {
      // From a queued tab: that application is done; it goes to Applied straight away
      const queued = (await loadQueue()).find((x) => x.tabId === sender.tab!.id && x.state !== 'submitted');
      if (queued) {
        await patchQueue((x) => x.id === queued.id, { state: 'submitted', note: '', needs: [] });
        const job = pageJobFrom({ ...(message.job as object), url: queued.url, title: queued.title, company: queued.company });
        const app = job ? sanitizeApp({ ...appFromPageJob(job), status: 'applied', applied_at: new Date().toISOString() }) : null;
        if (app) { const apps = await loadApps(); if (!apps.some((a) => a.key === app.key && a.status !== 'saved')) await storeApps([app, ...apps.filter((a) => a.key !== app.key)].slice(0, MAX_APPS)); }
        await pumpQueue();
        return { ok: true, queued: true };
      }
      // Pressing Submit on the page: ask "Did you apply?" next time Jobly opens, in case the page moves on
      const job = pageJobFrom(message.job);
      if (!job) return null;
      const apps = await loadApps();
      if (apps.some((a) => a.key === job.url.split('#')[0] && a.status !== 'saved')) return { ok: true };
      await writeKey(TRACKER_KEYS.pending, { at: Date.now(), job: { id: 0, company_id: 0, company_name: job.company, source_type: 'page', external_id: job.url, title: job.title, normalized_role: null, seniority: null, work_mode: null, location: job.location || null, description: null, application_url: job.url, first_seen_at: '', last_seen_at: '', status: 'active', is_saved: false, is_match: false } });
      return { ok: true };
    }
    case 'ASSIST_APPLIED': {
      const job = pageJobFrom(message.job);
      if (!job) return null;
      const app = sanitizeApp({ ...appFromPageJob(job), status: 'applied', applied_at: new Date().toISOString() });
      if (!app) return null;
      const apps = await loadApps();
      const existing = apps.find((a) => a.key === app.key);
      await storeApps([existing ? { ...existing, status: 'applied' as const, applied_at: existing.applied_at ?? app.applied_at, updated_at: new Date().toISOString() } : app, ...apps.filter((a) => a.key !== app.key)].slice(0, MAX_APPS));
      await writeKey(TRACKER_KEYS.pending, null);
      return { ok: true };
    }
    case 'ASSIST_OPEN_PROFILE':
      await chrome.tabs.create({ url: chrome.runtime.getURL('options.html#profile-setup') });
      return { ok: true };
    default:
      return null;
  }
}
