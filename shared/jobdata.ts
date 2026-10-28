// Jobly's job data as static files (written by backend/app/static_export.py, hosted on Cloudflare Pages), and the
// same filtering, matching and ordering the API applies, run in the browser. Used by the extension, the website
// and Studio. Each query loads only the files it needs: the chosen categories, newest age buckets first, and stops
// once it has the page it was asked for.

export const DATA_BASE = 'https://jobly-data.pages.dev/v1';

export const TECH_ROLES = ['product_design', 'frontend_engineering', 'fullstack_engineering', 'product_management', 'ai_ml'];

export interface Category { id: string; label: string; tech: boolean; jobs: number }

export interface Meta {
  version: number;
  generated_at: string;
  max_age_days: number;
  total: number;
  companies: number;
  columns: string[];
  age_buckets: number[];
  desc_shards: number;
  categories: Category[];
  files: Record<string, Record<string, { jobs: number; bytes: number }>>;
}

export interface DataJob {
  id: number;
  company_id: number;
  company_name: string;
  title: string;
  normalized_role: string | null;
  category: string;
  seniority: string | null;
  work_mode: string | null;
  location: string | null;
  geo_hub: string | null;
  experience_tier: string | null;
  employment_type: string | null;
  min_salary: number | null;
  max_salary: number | null;
  salary_summary: string | null;
  posted_at: string | null;
  first_seen_at: string;
  application_url: string;
  source_type: string;
  yc_batch: string | null;
  is_match: boolean;
}

/** The visitor's preferences (same fields as the API's `prefs`). */
export interface Prefs {
  roles?: string[];
  seniorities?: string[];
  locations?: string[];
  remote_only?: boolean;
  custom_keywords?: string;
  excluded_keywords?: string;
  min_salary?: number;
  employment_types?: string[];
}

export interface JobQuery {
  /** "tech" (the five tech roles), "all", a tech role or a category id. Empty = all. */
  role?: string;
  /** Several categories or roles at once (ignored when `role` is set). */
  roles?: string[];
  location?: string;
  seniority?: string;
  company_id?: number;
  company_ids?: number[];
  search?: string;
  work_mode?: string;
  geo_hub?: string;
  experience_tier?: string;
  employment_type?: string;
  min_budget?: number;
  has_salary?: boolean;
  freshness_days?: number;
  yc?: boolean;
  only_matching?: boolean;
  prefs?: Prefs;
  limit?: number;
  offset?: number;
}

export interface JobPage {
  items: DataJob[];
  total: number;
  /** True when `total` is extrapolated because not every file was read (it becomes exact as pages load). */
  estimated: boolean;
  limit: number;
  offset: number;
  generated_at: string;
}

const ALIASES: Record<string, string[]> = {
  bangalore: ['bangalore', 'bengaluru'], bengaluru: ['bengaluru', 'bangalore'],
  gurgaon: ['gurgaon', 'gurugram'], gurugram: ['gurugram', 'gurgaon'],
  delhi: ['delhi', 'delhi_ncr', 'noida', 'gurgaon', 'gurugram'], noida: ['noida', 'delhi', 'delhi_ncr'],
  sf: ['sf', 'san francisco', 'bay area'], 'bay area': ['bay area', 'san francisco', 'silicon valley'],
  nyc: ['nyc', 'new york'], ny: ['ny', 'new york'],
};
const EMPLOYMENT = ['full_time', 'part_time', 'contract', 'internship'];
const csv = (s?: string) => (s ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
const lower = (s: string | null | undefined) => (s ?? '').toLowerCase();

/** matching.matches_preferences, line for line. */
export function matchesPreferences(job: DataJob, prefs: Prefs, skipRoles = false): boolean {
  if (!skipRoles && prefs.roles?.length && !prefs.roles.includes(job.normalized_role ?? '')) return false;
  if (prefs.seniorities?.length && !prefs.seniorities.includes(job.seniority || 'mid')) return false;
  if (prefs.remote_only && job.work_mode !== 'remote') return false;
  if (prefs.locations?.length) {
    const loc = lower(job.location);
    if (!prefs.locations.some((l) => loc.includes(l.toLowerCase())) && job.work_mode !== 'remote') return false;
  }
  const text = `${job.title} ${job.location ?? ''}`.toLowerCase();
  const keywords = csv(prefs.custom_keywords);
  if (keywords.length && !keywords.some((k) => text.includes(k))) return false;
  const floor = Number(prefs.min_salary) || 0;
  if (floor && job.max_salary != null && job.max_salary >= 1000 && job.max_salary < floor) return false;
  const kinds = (prefs.employment_types ?? []).filter((k) => EMPLOYMENT.includes(k));
  if (kinds.length && !kinds.includes(job.employment_type || 'full_time')) return false;
  const excluded = csv(prefs.excluded_keywords);
  if (excluded.length && excluded.some((k) => text.includes(k))) return false;
  return true;
}

function searchMatches(job: DataJob, tokens: string[]): boolean {
  const fields = [job.title, job.company_name, job.location, job.normalized_role, job.geo_hub, job.category].map(lower);
  return tokens.every((t) => (ALIASES[t] ?? [t]).some((a) => fields.some((f) => f.includes(a))));
}

/** Categories a query reads. */
export function categoriesFor(meta: Meta, q: JobQuery): string[] {
  const all = meta.categories.map((c) => c.id);
  const pick = (r: string) => (r === 'tech' ? TECH_ROLES : r === 'all' || !r ? all : [r]);
  if (q.role) return pick(q.role).filter((c) => all.includes(c));
  if (q.roles?.length) return [...new Set(q.roles.flatMap(pick))].filter((c) => all.includes(c));
  // "Only matching" with chosen roles needs only those roles' files
  if (q.only_matching && q.prefs?.roles?.length) return q.prefs.roles.filter((c) => all.includes(c));
  return all;
}

/** Age buckets a query reads, newest first; "u" (no posting date) last, and only without a date filter. */
export function bucketsFor(meta: Meta, freshnessDays?: number): string[] {
  const days = freshnessDays ? Math.min(freshnessDays, meta.max_age_days) : 0;
  const out: string[] = [];
  let lowerBound = 0;
  for (const bound of meta.age_buckets) {
    if (days && lowerBound >= days + 1) break;   // +1: the data can be a few hours older than now
    out.push(String(bound));
    lowerBound = bound;
  }
  if (!days) out.push('u');
  return out;
}

const DAY = 86_400_000;

export class JobData {
  private metaPromise: Promise<Meta> | null = null;
  private metaAt = 0;
  private files = new Map<string, Promise<DataJob[]>>();
  private descs = new Map<number, Promise<Record<string, string>>>();

  constructor(readonly base = DATA_BASE, private readonly fetchImpl: typeof fetch = (...a) => fetch(...a), private readonly ttlMs = 5 * 60_000) {}

  private async json<T>(path: string, signal?: AbortSignal): Promise<T> {
    const res = await this.fetchImpl(`${this.base}/${path}`, { signal });
    if (!res.ok) throw new Error(`Job data ${path}: HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }

  meta(signal?: AbortSignal): Promise<Meta> {
    if (!this.metaPromise || Date.now() - this.metaAt > this.ttlMs) {
      this.metaAt = Date.now();
      const p = this.json<Meta>('meta.json', signal);
      this.metaPromise = p;
      p.then((m) => {
        // A new export: earlier files belong to the old one
        if (this.generatedAt && this.generatedAt !== m.generated_at) { this.files.clear(); this.descs.clear(); }
        this.generatedAt = m.generated_at;
      }, () => { if (this.metaPromise === p) this.metaPromise = null; });
    }
    return this.metaPromise;
  }
  private generatedAt = '';

  private file(meta: Meta, category: string, bucket: string, signal?: AbortSignal): Promise<DataJob[]> {
    if (!meta.files[category]?.[bucket]) return Promise.resolve([]);
    const key = `${meta.generated_at}/${category}/${bucket}`;
    let p = this.files.get(key);
    if (!p) {
      p = this.json<{ rows: unknown[][] }>(`jobs/${category}/${bucket}.json`, signal).then(({ rows }) => {
        const cols = meta.columns;
        return rows.map((r) => {
          const job = { category, is_match: false } as unknown as Record<string, unknown>;
          cols.forEach((c, i) => { job[c] = r[i]; });
          return job as unknown as DataJob;
        });
      });
      this.files.set(key, p);
      p.catch(() => this.files.delete(key));
    }
    return p;
  }

  /** One page of jobs, filtered, matched and ordered like GET /api/jobs. */
  async query(q: JobQuery, signal?: AbortSignal): Promise<JobPage> {
    const meta = await this.meta(signal);
    const limit = Math.min(Math.max(q.limit ?? 30, 1), 1000);
    const offset = Math.max(q.offset ?? 0, 0);
    const cats = categoriesFor(meta, q);
    const buckets = bucketsFor(meta, q.freshness_days);
    const now = Date.now();
    const since = q.freshness_days ? now - Math.min(q.freshness_days, meta.max_age_days) * DAY : 0;
    const tokens = (q.search ?? '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
    const location = lower(q.location);
    const companies = q.company_ids?.length ? new Set(q.company_ids) : null;
    const prefs = q.prefs && Object.keys(q.prefs).length ? q.prefs : null;
    const skipRoles = !!q.role;

    const keep = (j: DataJob): boolean => {
      if (since && (!j.posted_at || Date.parse(j.posted_at) < since)) return false;
      if (q.company_id && j.company_id !== q.company_id) return false;
      if (companies && !companies.has(j.company_id)) return false;
      if (q.yc && !j.yc_batch) return false;
      if (q.employment_type && (j.employment_type || 'full_time') !== q.employment_type) return false;
      if (q.seniority && j.seniority !== q.seniority) return false;
      if (q.experience_tier && j.experience_tier !== q.experience_tier) return false;
      if (q.work_mode && j.work_mode !== q.work_mode) return false;
      if (q.geo_hub && j.geo_hub !== q.geo_hub) return false;
      if (q.min_budget && !(j.max_salary != null && j.max_salary >= q.min_budget)) return false;
      if (q.has_salary && !j.salary_summary) return false;
      if (location && !lower(j.location).includes(location)) return false;
      if (tokens.length && !searchMatches(j, tokens)) return false;
      j.is_match = prefs ? matchesPreferences(j, prefs) : false;
      if (q.only_matching && prefs && !matchesPreferences(j, prefs, skipRoles)) return false;
      return true;
    };

    const matched: DataJob[] = [];
    let scannedRows = 0;
    let neededRows = 0;
    for (const b of buckets) for (const c of cats) neededRows += meta.files[c]?.[b]?.jobs ?? 0;
    let complete = true;
    for (let i = 0; i < buckets.length; i++) {
      const lists = await Promise.all(cats.map((c) => this.file(meta, c, buckets[i], signal)));
      const rows = lists.flat();
      scannedRows += rows.length;
      // Within a bucket: newest posting first, then newest id (the API's ORDER BY)
      rows.sort((a, b) => (a.posted_at === b.posted_at ? b.id - a.id : (b.posted_at ?? '') > (a.posted_at ?? '') ? 1 : -1));
      for (const j of rows) if (keep(j)) matched.push(j);
      if (matched.length >= offset + limit && i < buckets.length - 1) { complete = false; break; }
    }
    const total = complete || !scannedRows
      ? matched.length
      : Math.max(matched.length + 1, Math.round((matched.length / scannedRows) * neededRows));
    return { items: matched.slice(offset, offset + limit), total, estimated: !complete, limit, offset, generated_at: meta.generated_at };
  }

  /** How many jobs a category set has in the newest `days` (from the file sizes; no rows read). */
  async count(q: Pick<JobQuery, 'role' | 'roles' | 'freshness_days' | 'only_matching' | 'prefs'> = {}): Promise<number> {
    const meta = await this.meta();
    const buckets = bucketsFor(meta, q.freshness_days);
    return categoriesFor(meta, q).reduce((sum, c) => sum + buckets.reduce((s, b) => s + (meta.files[c]?.[b]?.jobs ?? 0), 0), 0);
  }

  /** A job's plain-text description, or null. */
  async description(id: number): Promise<string | null> {
    const meta = await this.meta();
    const shard = id % meta.desc_shards;
    let p = this.descs.get(shard);
    if (!p) {
      p = this.json<Record<string, string>>(`desc/${shard}.json`).catch(() => ({}));
      this.descs.set(shard, p);
    }
    return (await p)[String(id)] ?? null;
  }

  /** Forget the cached meta, so the next query picks up a newer export. */
  refresh(): void { this.metaAt = 0; }

  companies<T = unknown>(): Promise<T> { return this.json<T>('companies.json'); }
  stats<T = unknown>(): Promise<T> { return this.json<T>('stats.json'); }
  geo<T = unknown>(): Promise<T> { return this.json<T>('geo.json'); }
}
