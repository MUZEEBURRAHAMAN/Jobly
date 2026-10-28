import { Application, AppStatus, STATUSES, sanitizeApp, TRACKER_KEYS } from './tracker';
import { readKey, writeKey, STORAGE_KEYS } from './userData';
import { cleanProfile, MAX_PROFILES, Profile } from './profile';

/**
 * Export and import. A JSON backup holds everything Jobly keeps on this device; a CSV holds the tracker only and is
 * what spreadsheets, Notion and Google Sheets export, so applications kept elsewhere can be brought in.
 */

const BACKUP_KEYS = [STORAGE_KEYS.preferences, STORAGE_KEYS.saved, TRACKER_KEYS.apps, TRACKER_KEYS.interviews, TRACKER_KEYS.tasks, TRACKER_KEYS.settings, 'mutedCompanyIds', 'followedCompanyIds', 'profiles', 'activeProfileId', 'resumeFile', 'resumeTemplate', 'contacts'];  // never the Hunter key
const MAX_FILE_BYTES = 5_000_000;

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
      let value = parsed.data[k];
      if (k === TRACKER_KEYS.apps) {
        value = (Array.isArray(value) ? value : []).map((a) => sanitizeApp(a as Partial<Application>)).filter(Boolean);
        apps = (value as unknown[]).length;
      } else if (['savedJobs', TRACKER_KEYS.interviews, TRACKER_KEYS.tasks, 'mutedCompanyIds', 'followedCompanyIds', 'contacts'].includes(k)) {
        if (!Array.isArray(value)) continue;
        const arr: unknown[] = value;
        const ok = (o: unknown, fields: string[]) => !!o && typeof o === 'object' && fields.every((f) => typeof (o as Record<string, unknown>)[f] === 'string');
        if (k === TRACKER_KEYS.interviews) value = arr.filter((i) => ok(i, ['id', 'app_key', 'at']) && Array.isArray((i as { checklist?: unknown }).checklist));
        if (k === TRACKER_KEYS.tasks) value = arr.filter((t) => ok(t, ['id', 'text']));
        if (k === 'savedJobs') value = arr.filter((j) => ok(j, ['title', 'company_name']));
        if (k === 'mutedCompanyIds' || k === 'followedCompanyIds') value = arr.filter((n) => typeof n === 'number');
        if (k === 'contacts') value = arr.filter((c) => ok(c, ['id', 'name']));
      }
      if (k === 'profiles') value = (Array.isArray(value) ? value : []).slice(0, MAX_PROFILES).map((x) => cleanProfile(x as Partial<Profile>));
      if (k === 'resumeFile' && (typeof value !== 'object' || value === null || Array.isArray(value))) continue;
      if (!(await writeKey(k, value))) throw new Error("Couldn't restore the backup. Your browser storage may be full.");
      restored++;
    }
    return { kind: 'backup', keys: restored, apps };
  }
  return { kind: 'csv', apps: appsFromCsv(text) };
}
