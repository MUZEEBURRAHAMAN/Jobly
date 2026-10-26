// Date helpers for the tracker. Form inputs work in local time; storage is ISO.
const pad = (n: number) => String(n).padStart(2, '0');

export function toDateInput(iso: string | null | undefined): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A date input's value as an ISO time at local noon, so a time-zone shift never moves it to another day. */
export function fromDateInput(v: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).toISOString() : null;
}

export function toDateTimeInput(iso: string | null | undefined): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return '';
  const d = new Date(iso);
  return `${toDateInput(iso)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDateTimeInput(v: string): string | null {
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export const formatDate = (iso: string | null | undefined, withYear = false) =>
  iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) }) : '';

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "today", "tomorrow", "in 3 days", "2 days overdue". */
export function dueLabel(iso: string): { text: string; overdue: boolean; soon: boolean } {
  const day = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const diff = Math.round((day(Date.parse(iso)) - day(Date.now())) / 86400000);
  if (diff === 0) return { text: 'today', overdue: false, soon: true };
  if (diff === 1) return { text: 'tomorrow', overdue: false, soon: true };
  if (diff > 1) return { text: `in ${diff} days`, overdue: false, soon: diff <= 3 };
  return { text: diff === -1 ? '1 day overdue' : `${-diff} days overdue`, overdue: true, soon: true };
}

export const todayInput = () => toDateInput(new Date().toISOString());
