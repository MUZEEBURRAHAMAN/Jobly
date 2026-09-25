// Mirrors the fallback logic in ApiClient — checks production backend first, then local dev
const API_BASE_CANDIDATES = [
  'https://jobly-yd6l.onrender.com',
  'https://api.getcatchly.com',
  'http://127.0.0.1:8000',
  'http://localhost:8000',
];
let activeApiBase = API_BASE_CANDIDATES[0];

async function resolveApiBase(): Promise<string | null> {
  for (const url of API_BASE_CANDIDATES) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 1200);
      const res = await fetch(`${url}/health`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) { activeApiBase = url; return url; }
    } catch { /* try next */ }
  }
  return null;
}

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

// Alarm Setup on installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Jobly SW] Extension installed/updated.');
  
  // Staggered alarm (30-45 mins jitter) to spread background load across 10,000+ users
  const randomPeriod = 30 + Math.floor(Math.random() * 15);
  await chrome.alarms.create('jobly-sync', {
    delayInMinutes: 1,
    periodInMinutes: randomPeriod,
  });

  // Set default badge styling
  await chrome.action.setBadgeBackgroundColor({ color: '#06b6d4' });
  await checkNewMatchesAndNotify();
});

// Alarm Listener
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'jobly-sync' || alarm.name === 'hiring-radar-sync') {
    await checkNewMatchesAndNotify();
  }
});

// Check for newly published matched jobs and dispatch notification
async function checkNewMatchesAndNotify() {
  try {
    const base = await resolveApiBase();
    if (!base) return; // engine offline
    const res = await fetch(`${activeApiBase}/api/notifications`);
    if (!res.ok) return;

    const notifs: NotificationData[] = await res.json();
    const unread = notifs.filter((n) => !n.is_read);

    // Retrieve already notified IDs to prevent duplicate desktop alerts
    const stored = await chrome.storage.local.get(['alertedNotificationIds']);
    const alertedIds = new Set<number>(stored.alertedNotificationIds || []);

    const newToAlert = unread.filter((n) => !alertedIds.has(n.id));

    if (newToAlert.length > 0) {
      // Update badge text with total unread count
      await chrome.action.setBadgeText({
        text: unread.length > 99 ? '99+' : String(unread.length),
      });

      // Send a single concise grouped notification digest
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

      // Mark IDs as alerted in local storage
      newToAlert.forEach((n) => alertedIds.add(n.id));
      await chrome.storage.local.set({
        alertedNotificationIds: Array.from(alertedIds),
      });
    } else if (unread.length === 0) {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch {
    // Engine offline or unreachable — silently skip background alert until engine wakes up
  }
}

// Notification Click Handler
chrome.notifications.onClicked.addListener(async (notificationId) => {
  // Clear notification
  await chrome.notifications.clear(notificationId);

  // Open options dashboard or focused tab
  const url = chrome.runtime.getURL('options.html');
  await chrome.tabs.create({ url });
});

// Runtime Message Listener
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TRIGGER_BACKGROUND_CHECK') {
    (async () => {
      await checkNewMatchesAndNotify();
      sendResponse({ success: true });
    })();
    return true; // Keep message channel open for async response
  }

  if (message.type === 'CLEAR_BADGE') {
    (async () => {
      await chrome.action.setBadgeText({ text: '' });
      sendResponse({ success: true });
    })();
    return true;
  }
});
