import { SITE } from '../lib/site';
import { JobData } from '../../../shared/jobdata';

type Params = Record<string, string | number | undefined>;
const data = new JobData(SITE.data);
const num = (v: string | number | undefined) => (v === undefined || v === '' ? undefined : Number(v));

/** The same answers as the API, from Jobly's static job data. Throws when the data is unreachable. */
async function fromStaticData(path: string, p: Params): Promise<unknown> {
  if (path === '/api/stats') return data.stats();
  if (path === '/api/geo') return data.geo();
  if (path === '/api/companies') return data.companies();
  if (path === '/api/jobs') {
    const role = p.role ? String(p.role) : undefined;
    const freshness_days = num(p.freshness_days);
    const limit = num(p.limit) ?? 30;
    const filtered = ['search', 'location', 'work_mode', 'yc', 'offset', 'seniority', 'experience_tier'].some((k) => p[k] !== undefined && p[k] !== '');
    // A count ("how many in this role this week") comes straight from the file sizes: exact, and no job files read
    if (limit <= 1 && !filtered) return { items: [], total: await data.count({ role, freshness_days }), limit, offset: 0 };
    return data.query({
      role, freshness_days, limit, offset: num(p.offset), search: p.search ? String(p.search) : undefined,
      location: p.location ? String(p.location) : undefined, work_mode: p.work_mode ? String(p.work_mode) : undefined, yc: p.yc === 'true',
    });
  }
  throw new Error(`no static data for ${path}`);
}

/** GET a JSON endpoint of the Jobly API with a timeout: answered from the static job data when it can be, else by the
 * API. `onSlow` fires if the free server is still waking up. */
export async function apiGet<T>(path: string, params: Params = {}, opts: { timeoutMs?: number; onSlow?: () => void } = {}): Promise<T> {
  try {
    return (await fromStaticData(path, params)) as T;
  } catch {
    // the static data is unreachable or doesn't cover this request: ask the API
  }
  const url = new URL(path, SITE.api);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30000);
  const slow = opts.onSlow ? window.setTimeout(opts.onSlow, 4000) : 0;
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
    if (slow) window.clearTimeout(slow);
  }
}

export const formatNumber = (n: number) => new Intl.NumberFormat('en-US').format(n);
