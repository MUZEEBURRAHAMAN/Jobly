// Fresh jobs from Jobly's own server, with the date each one was really posted.
// The server must list this site in SITE_ORIGINS (CORS) for these requests to work.
const API = (import.meta.env.VITE_JOBLY_API as string | undefined) ?? 'https://jobly-yd6l.onrender.com';

export interface JoblyJob {
  id: number;
  company_name: string;
  title: string;
  normalized_role: string | null;
  location: string | null;
  work_mode: string | null;
  description: string | null;
  application_url: string;
  posted_at: string | null;
  first_seen_at: string;
  salary_summary: string | null;
  employment_type: string | null;
  yc_batch: string | null;
}

export const ROLES = [
  { id: 'tech', label: 'All tech roles' },
  { id: 'frontend_engineering', label: 'Frontend' },
  { id: 'fullstack_engineering', label: 'Fullstack' },
  { id: 'product_design', label: 'Product design' },
  { id: 'product_management', label: 'Product management' },
  { id: 'ai_ml', label: 'AI / ML' },
];

export interface JobQuery { role: string; search: string; location: string; days: number; remote: boolean; yc: boolean }

export async function searchJobs(q: JobQuery, offset = 0, signal?: AbortSignal): Promise<{ items: JoblyJob[]; total: number }> {
  const p = new URLSearchParams({ role: q.role || 'tech', limit: '30', offset: String(offset), freshness_days: String(q.days) });
  if (q.search.trim()) p.set('search', q.search.trim().slice(0, 100));
  if (q.location.trim()) p.set('location', q.location.trim().slice(0, 100));
  if (q.remote) p.set('work_mode', 'remote');
  if (q.yc) p.set('yc', 'true');
  let res: Response;
  try {
    res = await fetch(`${API}/api/jobs?${p}`, { signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error('Couldn’t reach Jobly’s job server. It runs on a free plan and may take up to a minute to wake up; try again shortly.');
  }
  if (res.status === 429) throw new Error('Too many searches in a row. Wait a few seconds and try again.');
  if (!res.ok) throw new Error(`Jobly’s job server returned an error (${res.status}).`);
  const data = await res.json();
  return { items: data.items ?? [], total: data.total ?? 0 };
}

/** The posting as text Studio can analyse: what the server knows about the job. */
export function jobAsPostingText(j: JoblyJob): string {
  return [
    `${j.title} at ${j.company_name}`,
    j.location ? `Location: ${j.location}${j.work_mode ? ` (${j.work_mode})` : ''}` : '',
    j.salary_summary ? `Salary: ${j.salary_summary}` : '',
    j.employment_type ? `Type: ${j.employment_type.replace('_', ' ')}` : '',
    `Apply: ${j.application_url}`,
    '',
    stripHtml(j.description ?? ''),
  ].filter((l, i) => l || i === 5).join('\n');
}

export function stripHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('li').forEach((li) => li.prepend('• '));
  doc.querySelectorAll('p, li, br, h1, h2, h3, h4, div').forEach((el) => el.append('\n'));
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

export function ageLabel(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (Number.isNaN(days)) return '';
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const w = Math.floor(days / 7);
  return w === 1 ? '1 week ago' : w < 5 ? `${w} weeks ago` : `${Math.floor(days / 30)} mo ago`;
}
