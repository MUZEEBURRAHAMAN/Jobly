import { SITE } from '../lib/site';
import { JobData } from '../../../shared/jobdata';

type Params = Record<string, string | number | undefined>;
const data = new JobData(SITE.data);
const num = (v: string | number | undefined) => (v === undefined || v === '' ? undefined : Number(v));

/** Answers in the shape the old API gave, from Jobly's static job data. Throws when the data is unreachable. */
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

/** Read Jobly's job data the way the old API answered (same paths and shapes), from the static files. Throws when the
 * data can't be reached. */
export async function apiGet<T>(path: string, params: Params = {}): Promise<T> {
  return (await fromStaticData(path, params)) as T;
}

export const formatNumber = (n: number) => new Intl.NumberFormat('en-US').format(n);
