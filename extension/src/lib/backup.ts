import { Application, AppStatus, STATUSES, sanitizeApp, TRACKER_KEYS } from './tracker';
import { readKey, writeKey, STORAGE_KEYS } from './userData';
import { cleanProfile, MAX_PROFILES, Profile } from './profile';
import { cleanContact, Contact, MAX_CONTACTS } from './contacts';
import { cleanPreferences } from './userData';
import { cleanItem, MAX_QUEUE, QueueItem, QUEUE_KEY } from './applyQueue';
import { isSensitive, MAX_ANSWERS, questionKey } from './answerBank';
import { MAX_LOGGED, QUESTION_LOG_KEY } from './questionBank';
import { MAX_RESUME_BYTES } from './profile';
import { ANSWERS_KEY, cleanAnswers } from './recruiterQuestions';

/**
 * Export and import. A JSON backup holds everything Jobly keeps on this device; a CSV holds the tracker only and is
 * what spreadsheets, Notion and Google Sheets export, so applications kept elsewhere can be brought in.
 */

const BACKUP_KEYS = [STORAGE_KEYS.preferences, STORAGE_KEYS.saved, TRACKER_KEYS.apps, TRACKER_KEYS.interviews, TRACKER_KEYS.tasks, TRACKER_KEYS.settings, 'mutedCompanyIds', 'followedCompanyIds', 'profiles', 'activeProfileId', 'resumeFile', 'resumeTemplate', 'contacts', 'savedAnswers', 'resumeVersions', 'aiSettings', QUEUE_KEY, QUESTION_LOG_KEY, 'resumeSettings', 'letterSettings', ANSWERS_KEY];  // never the Hunter or Anthropic key
const MAX_FILE_BYTES = 5_000_000;

const isObj = (o: unknown): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o);
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
const has = (o: unknown, fields: string[]) => isObj(o) && fields.every((f) => typeof o[f] === 'string');

/** One backup key's value made safe, or undefined to skip it. */
export function restoreValue(k: string, v: unknown): unknown {
  const arr = Array.isArray(v) ? v : null;
  switch (k) {
    case TRACKER_KEYS.apps: return (arr ?? []).map((a) => sanitizeApp(a as Partial<Application>)).filter(Boolean);
    case TRACKER_KEYS.interviews: return arr ? arr.filter((i) => has(i, ['id', 'app_key', 'at']) && Array.isArray((i as { checklist?: unknown }).checklist)).slice(0, 500) : undefined;
    case TRACKER_KEYS.tasks: return arr ? arr.filter((t) => has(t, ['id', 'text'])).slice(0, 1000) : undefined;
    case 'savedJobs': return arr ? arr.filter((j) => has(j, ['title', 'company_name'])).slice(0, 2000) : undefined;
    case 'mutedCompanyIds': case 'followedCompanyIds': return arr ? arr.filter((n) => Number.isInteger(n)).slice(0, 5000) : undefined;
    case 'contacts': return arr ? arr.filter((c) => has(c, ['id', 'name'])).map((c) => cleanContact(c as Partial<Contact>)).filter(Boolean).slice(0, MAX_CONTACTS) : undefined;
    case 'profiles': return (arr ?? []).slice(0, MAX_PROFILES).map((x) => cleanProfile((isObj(x) ? x : {}) as Partial<Profile>));
    case 'activeProfileId': case 'resumeTemplate': return typeof v === 'string' ? v.slice(0, 80) : undefined;
    case STORAGE_KEYS.preferences: return cleanPreferences(v);
    case 'savedAnswers':
      return arr ? arr.filter((a) => has(a, ['question', 'value']) && !isSensitive(String((a as Record<string, unknown>).question))).slice(0, MAX_ANSWERS).map((a) => {
        const o = a as Record<string, unknown>; const question = str(o.question, 300);
        return { question, key: questionKey(question), value: str(o.value, 3000), kind: str(o.kind, 20) || 'text', used_at: str(o.used_at, 40), uses: Number.isInteger(o.uses) ? o.uses : 0 };
      }) : undefined;
    case 'resumeVersions':
      return arr ? arr.filter((x) => isObj(x) && isObj(x.profile) && isObj(x.job)).slice(0, 30).map((x) => {
        const o = x as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
        return { id: str(o.id, 80) || crypto.randomUUID(), created_at: str(o.created_at, 40), description: str(o.description, 20000), before: Number(o.before) || 0, after: Number(o.after) || 0,
          job: { key: typeof o.job.key === 'string' ? o.job.key.slice(0, 600) : null, title: str(o.job.title, 200), company: str(o.job.company, 160) }, profile: cleanProfile(o.profile) };
      }) : undefined;
    case 'resumeFile': {
      // Only a real PDF or Word file under the resume limit, stored as base64
      if (!isObj(v)) return undefined;
      const out: Record<string, unknown> = {};
      for (const [id, f] of Object.entries(v).slice(0, MAX_PROFILES)) {
        if (!isObj(f) || typeof f.data !== 'string') continue;
        const m = /^data:(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document);base64,([A-Za-z0-9+/=]+)$/.exec(f.data);
        if (!m || m[2].length * 0.75 > MAX_RESUME_BYTES) continue;
        out[id.slice(0, 80)] = { name: str(f.name, 120).replace(/[\\/:*?"<>|]/g, '_') || 'resume.pdf', type: m[1], size: Math.round(m[2].length * 0.75), data: f.data };
      }
      return out;
    }
    case 'aiSettings': return isObj(v) && ['off', 'chrome', 'anthropic'].includes(String(v.provider)) ? { provider: v.provider, model: str(v.model, 60) } : undefined;
    case TRACKER_KEYS.settings: return isObj(v) ? v : undefined;
    case QUEUE_KEY:
      // Tabs belong to the computer the backup came from: open jobs come back to the queue, the rest as they were
      return arr ? arr.map((x) => cleanItem(isObj(x) ? x as Partial<QueueItem> : {})).filter((x): x is QueueItem => !!x).slice(0, MAX_QUEUE)
        .map((x) => ({ ...x, tabId: null, state: x.state === 'submitted' || x.state === 'stopped' ? x.state : 'queued' })) : undefined;
    case QUESTION_LOG_KEY:
      return arr ? arr.filter((q) => has(q, ['question']) && !isSensitive(String((q as Record<string, unknown>).question))).slice(0, MAX_LOGGED).map((q) => {
        const o = q as Record<string, unknown>; const question = str(o.question, 300);
        return { key: questionKey(question), question, kind: str(o.kind, 20) || 'text', count: Math.max(1, Math.min(10000, Number(o.count) || 1)),
          companies: (Array.isArray(o.companies) ? o.companies : []).filter((c): c is string => typeof c === 'string').map((c) => c.slice(0, 160)).slice(0, 6), last_url: '', last_seen: str(o.last_seen, 40) };
      }) : undefined;
    case 'resumeSettings':
      return isObj(v) ? { template: str(v.template, 30), accent: str(v.accent, 20), page: v.page === 'letter' ? 'letter' : 'a4', fit: v.fit !== false } : undefined;
    case 'letterSettings':
      return isObj(v) ? { tone: str(v.tone, 20), length: str(v.length, 20), design: str(v.design, 20), accent: str(v.accent, 20) } : undefined;
    case ANSWERS_KEY: return cleanAnswers(v);
    default: return undefined;
  }
}

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportBackup(): Promise<void> {
  const data: Record<string, unknown> = {};
  for (const k of BACKUP_KEYS) { const v = await readKey(k); if (v !== undefined) data[k] = v; }
  download(`jobly-backup-${stamp()}.json`, 'application/json', JSON.stringify({ app: 'jobly', version: 1, exported_at: new Date().toISOString(), data }, null, 2));
}

const CSV_COLUMNS: [keyof Application, string][] = [
  ['company_name', 'Company'], ['title', 'Role'], ['status', 'Status'], ['applied_at', 'Applied'], ['location', 'Location'],
  ['application_url', 'Link'], ['salary_summary', 'Salary'], ['follow_up_at', 'Follow up'], ['notes', 'Notes'],
];

const cell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheets would run these as formulas
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCsv(apps: Application[]): void {
  const label = (s: AppStatus) => STATUSES.find((x) => x.id === s)?.label ?? s;
  const rows = [CSV_COLUMNS.map(([, h]) => h).join(',')];
  for (const a of apps) rows.push(CSV_COLUMNS.map(([k]) => cell(k === 'status' ? label(a.status) : k.endsWith('_at') && a[k] ? String(a[k]).slice(0, 10) : a[k])).join(','));
  download(`jobly-applications-${stamp()}.csv`, 'text/csv', rows.join('\r\n'));
}

/** RFC 4180 CSV parser (quoted fields, doubled quotes, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

// Header names people use in their own spreadsheets, mapped to tracker fields.
const HEADER_ALIASES: Record<string, keyof Application> = {
  company: 'company_name', 'company name': 'company_name', employer: 'company_name', organization: 'company_name',
  role: 'title', title: 'title', position: 'title', job: 'title', 'job title': 'title',
  status: 'status', stage: 'status',
  applied: 'applied_at', 'applied on': 'applied_at', 'date applied': 'applied_at', 'applied date': 'applied_at', date: 'applied_at',
  location: 'location', city: 'location',
  link: 'application_url', url: 'application_url', 'job link': 'application_url', 'job url': 'application_url', posting: 'application_url',
  salary: 'salary_summary', pay: 'salary_summary', compensation: 'salary_summary',
  'follow up': 'follow_up_at', 'follow-up': 'follow_up_at', notes: 'notes', note: 'notes', comments: 'notes',
};

function toStatus(v: string, hasApplied: boolean): AppStatus {
  const s = v.trim().toLowerCase();
  if (/offer/.test(s)) return 'offer';
  if (/interview|screen|onsite|phone/.test(s)) return 'interview';
  if (/reject|declin|no longer|closed/.test(s)) return 'rejected';
  if (/withdr/.test(s)) return 'withdrawn';
  if (/applied|submitted|sent/.test(s)) return 'applied';
  if (/save|wish|interest|to apply|bookmark/.test(s)) return 'saved';
  return hasApplied ? 'applied' : 'saved';
}

export function appsFromCsv(text: string): Partial<Application>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const map = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()]);
  if (!map.includes('company_name') || !map.includes('title')) throw new Error('The file needs a Company column and a Role (or Title) column.');
  return rows.slice(1).map((r) => {
    const draft: Record<string, string> = {};
    map.forEach((field, i) => { if (field && r[i] !== undefined && !draft[field]) draft[field] = r[i].trim(); });
    const appliedAt = draft.applied_at && !Number.isNaN(Date.parse(draft.applied_at)) ? new Date(draft.applied_at).toISOString() : null;
    return {
      company_name: draft.company_name, title: draft.title, location: draft.location || null, application_url: draft.application_url || '',
      salary_summary: draft.salary_summary || null, notes: draft.notes || '', applied_at: appliedAt,
      follow_up_at: draft.follow_up_at && !Number.isNaN(Date.parse(draft.follow_up_at)) ? new Date(draft.follow_up_at).toISOString() : null,
      status: toStatus(draft.status ?? '', !!appliedAt), source: 'import' as const,
    };
  }).filter((d) => d.company_name && d.title);
}

export type ImportResult =
  | { kind: 'csv'; apps: Partial<Application>[] }
  | { kind: 'backup'; keys: number; apps: number };

/** Reads a chosen file. A CSV returns rows to add to the tracker; a Jobly backup is restored straight away. */
export async function importFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) throw new Error('That file is too large (over 5 MB).');
  const text = await file.text();
  if (/\.json$/i.test(file.name) || text.trimStart().startsWith('{')) {
    let parsed: { app?: string; data?: Record<string, unknown> };
    try { parsed = JSON.parse(text); } catch { throw new Error("That file isn't valid JSON."); }
    if (parsed?.app !== 'jobly' || typeof parsed.data !== 'object' || !parsed.data) throw new Error("That isn't a Jobly backup file.");
    let restored = 0, apps = 0;
    for (const k of BACKUP_KEYS) {
      if (!(k in parsed.data)) continue;
      // A backup file comes from outside: every key goes through its own cleaner, and anything that isn't the right
      // shape is dropped, so a crafted file can't put scripts, odd links or oversized data into Jobly
      const value = restoreValue(k, parsed.data[k]);
      if (value === undefined) continue;
      if (k === TRACKER_KEYS.apps) apps = (value as unknown[]).length;
      if (!(await writeKey(k, value))) throw new Error("Couldn't restore the backup. Your browser storage may be full.");
      restored++;
    }
    return { kind: 'backup', keys: restored, apps };
  }
  return { kind: 'csv', apps: appsFromCsv(text) };
}
