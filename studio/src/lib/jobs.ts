// Fresh jobs from Jobly's job data, with the date each one was really posted: the static files on Cloudflare Pages
// (shared/jobdata.ts) first, Jobly's API as the fallback. The API must list this site in SITE_ORIGINS (CORS).
import { DATA_BASE, JobData, type DataJob } from '../../../shared/jobdata';

const API = (import.meta.env.VITE_JOBLY_API as string | undefined) ?? 'https://jobly-yd6l.onrender.com';
const jobData = new JobData((import.meta.env.VITE_JOBLY_DATA as string | undefined) ?? DATA_BASE);

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
  { id: 'design_it', label: 'All design, development & IT', group: 'Design & IT' },
  { id: 'tech', label: 'Core tech roles (the five below)', group: 'Design & IT' },
  { id: 'product_design', label: 'Product & UX design', group: 'Design & IT' },
  { id: 'frontend_engineering', label: 'Frontend', group: 'Design & IT' },
  { id: 'fullstack_engineering', label: 'Fullstack & software engineering', group: 'Design & IT' },
  { id: 'product_management', label: 'Product management', group: 'Design & IT' },
  { id: 'ai_ml', label: 'AI / ML', group: 'Design & IT' },
  { id: 'backend', label: 'Backend', group: 'Design & IT' },
  { id: 'mobile', label: 'Mobile', group: 'Design & IT' },
  { id: 'devops', label: 'DevOps, cloud & SRE', group: 'Design & IT' },
  { id: 'qa', label: 'QA & testing', group: 'Design & IT' },
  { id: 'security', label: 'Cybersecurity', group: 'Design & IT' },
  { id: 'it', label: 'IT, support & networks', group: 'Design & IT' },
  { id: 'enterprise', label: 'ERP, CRM & enterprise apps', group: 'Design & IT' },
  { id: 'data', label: 'Data & analytics', group: 'Design & IT' },
  { id: 'design', label: 'Graphic, brand & creative design', group: 'Design & IT' },
  { id: 'engineering', label: 'Other engineering', group: 'Design & IT' },
  { id: 'all', label: 'Every role', group: 'More roles' },
  { id: 'marketing', label: 'Marketing', group: 'More roles' },
  { id: 'sales', label: 'Sales', group: 'More roles' },
  { id: 'customer', label: 'Customer success', group: 'More roles' },
  { id: 'people', label: 'People & recruiting', group: 'More roles' },
  { id: 'finance', label: 'Finance', group: 'More roles' },
  { id: 'legal', label: 'Legal', group: 'More roles' },
  { id: 'operations', label: 'Operations', group: 'More roles' },
  { id: 'healthcare', label: 'Healthcare & science', group: 'More roles' },
];

export interface JobQuery { role: string; search: string; location: string; days: number; remote: boolean; yc: boolean }

export async function searchJobs(q: JobQuery, offset = 0, signal?: AbortSignal): Promise<{ items: JoblyJob[]; total: number }> {
  try {
    const page = await jobData.query({
      role: q.role || 'tech', search: q.search.trim().slice(0, 100), location: q.location.trim(), freshness_days: q.days,
      work_mode: q.remote ? 'remote' : undefined, yc: q.yc, limit: 30, offset,
    }, signal);
    return { items: page.items.map(fromData), total: page.total };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    // the static data is unreachable: ask the API
  }
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

const fromData = (j: DataJob): JoblyJob => ({ ...j, description: null });

/** The job's description from the static data, when the list didn't carry it. */
export async function withDescription(j: JoblyJob): Promise<JoblyJob> {
  if (j.description) return j;
  try { return { ...j, description: await jobData.description(j.id) }; } catch { return j; }
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
