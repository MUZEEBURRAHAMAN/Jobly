/**
 * Optional connections, each turned on by the user:
 *   Google Calendar: reads upcoming events to import interviews (read-only scope, the user's own Google sign-in).
 *   Hunter: finds recruiters and hiring managers at a company with the user's own Hunter API key.
 * Both talk to those services straight from this browser; nothing passes through Jobly's server. Chrome asks the user
 * for access to each service's address the first time it is used (optional host permissions).
 */
import { readKey, writeKey } from './userData';

export const GOOGLE_API = 'https://www.googleapis.com/*';
export const HUNTER_API = 'https://api.hunter.io/*';
export const HUNTER_KEY = 'hunterApiKey';
const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

/** Asks Chrome for access to a service's address. Must run from a click. */
export async function ensureAccess(origin: string): Promise<boolean> {
  try {
    if (await chrome.permissions.contains({ origins: [origin] })) return true;
    return await chrome.permissions.request({ origins: [origin] });
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ Google Calendar
/** Calendar import needs an OAuth client for this extension, added to the manifest at build time. */
export const calendarConfigured = () => {
  try { return !!(chrome.runtime.getManifest() as chrome.runtime.Manifest & { oauth2?: { client_id?: string } }).oauth2?.client_id; } catch { return false; }
};

async function googleToken(interactive: boolean): Promise<string | null> {
  try {
    const res = await chrome.identity.getAuthToken({ interactive, scopes: [CAL_SCOPE] });
    return typeof res === 'string' ? res : res?.token ?? null;
  } catch {
    return null;
  }
}

export interface CalendarEvent { id: string; title: string; start: string; link: string; description: string }
const INTERVIEW_WORDS = /interview|screen|onsite|on-site|hiring|recruit|technical|panel|chat with|meet the team|final round|take-home|portfolio review/i;

/** Upcoming events that look like interviews (next 45 days). Returns null when access was refused. */
export async function fetchInterviewEvents(): Promise<CalendarEvent[] | null> {
  if (!(await ensureAccess(GOOGLE_API))) return null;
  const token = await googleToken(true);
  if (!token) return null;
  const params = new URLSearchParams({ timeMin: new Date().toISOString(), timeMax: new Date(Date.now() + 45 * 86400000).toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) { await chrome.identity.removeCachedAuthToken({ token }); return null; }
  if (!res.ok) throw new Error(`Google Calendar answered ${res.status}`);
  const data = await res.json() as { items?: { id: string; summary?: string; description?: string; start?: { dateTime?: string; date?: string }; hangoutLink?: string; location?: string; conferenceData?: { entryPoints?: { uri?: string }[] } }[] };
  return (data.items ?? [])
    .filter((e) => e.start?.dateTime && INTERVIEW_WORDS.test(`${e.summary ?? ''} ${e.description ?? ''}`))
    .map((e) => ({
      id: e.id, title: (e.summary ?? 'Interview').slice(0, 200), start: e.start!.dateTime!,
      link: e.hangoutLink ?? e.conferenceData?.entryPoints?.find((p) => p.uri?.startsWith('https://'))?.uri ?? (/^https:\/\//.test(e.location ?? '') ? e.location! : ''),
      description: (e.description ?? '').replace(/<[^>]+>/g, ' ').slice(0, 1000),
    }));
}

export async function disconnectGoogle(): Promise<void> {
  const token = await googleToken(false);
  if (token) {
    await chrome.identity.removeCachedAuthToken({ token });
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
  }
}

// ------------------------------------------------------------------ Hunter
export interface FoundContact { name: string; position: string; email: string; linkedin: string; department: string; confidence: number }

export const loadHunterKey = async () => (await readKey<string>(HUNTER_KEY)) ?? '';
export const saveHunterKey = (key: string) => writeKey(HUNTER_KEY, key.trim().slice(0, 100));

/** People at a company's domain, recruiters and leaders first. Throws a readable message on failure. */
export async function findContacts(domain: string, department: string): Promise<FoundContact[]> {
  const key = await loadHunterKey();
  if (!key) throw new Error('Add your Hunter API key in Preferences first.');
  if (!(await ensureAccess(HUNTER_API))) throw new Error('Chrome needs your OK to contact Hunter.');
  const params = new URLSearchParams({ domain, limit: '20', api_key: key });
  if (department) params.set('department', department);
  const res = await fetch(`https://api.hunter.io/v2/domain-search?${params}`);
  const data = await res.json().catch(() => ({})) as { data?: { emails?: { first_name?: string; last_name?: string; position?: string; value?: string; linkedin?: string; department?: string; confidence?: number }[] }; errors?: { details?: string }[] };
  if (!res.ok) throw new Error(data.errors?.[0]?.details ?? `Hunter answered ${res.status}`);
  const rank = (p: string) => (/recruit|talent|people|hr\b|human/i.test(p) ? 0 : /head|director|vp|lead|manager|founder|cto|ceo/i.test(p) ? 1 : 2);
  return (data.data?.emails ?? [])
    .map((e) => ({ name: [e.first_name, e.last_name].filter(Boolean).join(' ') || 'Unknown', position: e.position ?? '', email: e.value ?? '', linkedin: e.linkedin ?? '', department: e.department ?? '', confidence: e.confidence ?? 0 }))
    .filter((c) => c.email)
    .sort((a, b) => rank(a.position) - rank(b.position) || b.confidence - a.confidence);
}

/** A company's web domain from a link, skipping hiring-system hosts that aren't the company's own site. */
export function companyDomain(url: string | null | undefined): string {
  try {
    const host = new URL(url ?? '').hostname.replace(/^www\./, '');
    if (/greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|workable\.com|recruitee\.com|teamtailor\.com|personio\.|weworkremotely|himalayas|arbeitnow|linkedin\.com|indeed\./.test(host)) return '';
    return host.replace(/^(careers|jobs|apply)\./, '');
  } catch {
    return '';
  }
}
