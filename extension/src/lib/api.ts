import { Job, JobsResponse, Company, Preferences, RadarStats } from '../types';
import { JobData, type DataJob, type JobQuery } from '../../../shared/jobdata';
import { API_BASES, DATA_BASE, MAX_PAGE_SIZE, WAKE_TIMEOUTS_MS } from './config';
import { loadPreferences, prefsParam, storePreferences } from './userData';

// Static files time out sooner than the API: they are on a CDN, so a slow answer means they are unreachable.
const timedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) });
export const jobData = new JobData(DATA_BASE, timedFetch);

/** A static-data job in the shape the API returns (the list never carries descriptions). */
export function toJob(j: DataJob, generatedAt: string): Job {
  return {
    ...j, external_id: '', description: null, last_seen_at: generatedAt, status: 'active', is_saved: false,
  };
}

/** The extension's filters as a static-data query. */
export function toQuery(params: import('../types').JobFilterParams, prefs: Preferences): JobQuery {
  return {
    role: params.role, location: params.location, seniority: params.seniority, company_id: params.company_id,
    search: params.search?.slice(0, 100), work_mode: params.work_mode, geo_hub: params.geo_hub, experience_tier: params.experience_tier,
    min_budget: params.min_budget, has_salary: params.has_salary, freshness_days: params.freshness_days,
    only_matching: params.only_matching, prefs, limit: params.limit, offset: params.offset,
  };
}

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

/** Thrown for user-facing failures; `message` is safe to show in the UI. */
export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

type Failure = { kind: 'network' } | { kind: 'http'; status: number };

const hasStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;

class ApiClient {
  private activeBaseUrl: string = API_BASES[0];
  private isOnline = false;
  private lastFailure: Failure | null = null;

  // ----------------------------------------------------------------- connectivity
  /** One pass over all base URLs with a per-request timeout. */
  async checkHealth(timeoutMs = 4000): Promise<boolean> {
    try {
      jobData.refresh();
      await jobData.meta(AbortSignal.timeout(Math.max(timeoutMs, 6000)));
      this.isOnline = true;
      return true;
    } catch {
      // the static data is unreachable: see whether the API answers
    }
    for (const url of API_BASES) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`${url}/health`, { signal: controller.signal });
        if (res.ok) {
          this.activeBaseUrl = url;
          this.isOnline = true;
          return true;
        }
      } catch {
        // try next candidate
      } finally {
        clearTimeout(timer);
      }
    }
    this.isOnline = false;
    return false;
  }

  /**
   * Patient health check for a free-tier backend that may be asleep: escalating timeouts (~40s total)
   * instead of declaring "offline" after 1.8s. `onAttempt` lets the UI show "waking up…".
   */
  async waitForBackend(onAttempt?: (attempt: number) => void): Promise<boolean> {
    for (let i = 0; i < WAKE_TIMEOUTS_MS.length; i++) {
      onAttempt?.(i + 1);
      if (await this.checkHealth(WAKE_TIMEOUTS_MS[i])) return true;
    }
    return false;
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  getActiveBaseUrl(): string {
    return this.activeBaseUrl;
  }

  /** Why the last request failed (null if it succeeded). */
  getLastFailure(): Failure | null {
    return this.lastFailure;
  }

  /**
   * Network failures fail over to the next base URL. An HTTP error means a server answered, so it is NOT
   * "offline" and is not retried elsewhere. Non-idempotent requests only ever go to the active base, so a
   * timed-out POST can't be replayed against a second backend.
   */
  private async safeFetch(endpoint: string, options?: RequestInit, timeoutMs = 10000): Promise<Response | null> {
    const idempotent = !options?.method || options.method === 'GET' || options.method === 'HEAD';
    const candidates = idempotent ? [this.activeBaseUrl, ...API_BASES.filter((u) => u !== this.activeBaseUrl)] : [this.activeBaseUrl];
    this.lastFailure = { kind: 'network' };
    for (const baseUrl of candidates) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`${baseUrl}${endpoint}`, { ...options, signal: controller.signal });
        this.activeBaseUrl = baseUrl;
        this.isOnline = true;
        if (res.ok) {
          this.lastFailure = null;
          return res;
        }
        this.lastFailure = { kind: 'http', status: res.status };
        return null;
      } catch {
        // network error / timeout: try the next candidate
      } finally {
        clearTimeout(timer);
      }
    }
    this.isOnline = false;
    return null;
  }

  private async readCache<T>(key: string): Promise<T | undefined> {
    if (!hasStorage()) return undefined;
    try {
      return (await chrome.storage.local.get(key))[key] as T | undefined;
    } catch {
      return undefined;
    }
  }

  private writeCache(key: string, value: unknown): void {
    if (hasStorage()) chrome.storage.local.set({ [key]: value }).catch(() => {});
  }

  // ----------------------------------------------------------------- cached reads (instant paint)
  getCachedJobs = () => this.readCache<Job[]>('cachedJobs').then((v) => v ?? []);
  getCachedJobsAt = () => this.readCache<number>('cachedJobsAt').then((v) => v ?? null);
  getCachedCompanies = () => this.readCache<Company[]>('cachedCompanies').then((v) => v ?? []);

  // ----------------------------------------------------------------- preferences (on this device only)
  getPreferences(): Promise<Preferences> {
    return loadPreferences();
  }

  /** Resolves false only if the browser refused to store them. */
  async updatePreferences(prefs: Preferences): Promise<{ prefs: Preferences; stored: boolean }> {
    return { prefs, stored: await storePreferences(prefs) };
  }

  // ----------------------------------------------------------------- jobs
  async getJobs(params: import('../types').JobFilterParams): Promise<JobsResponse> {
    const limit = Math.min(Math.max(params.limit ?? 30, 1), MAX_PAGE_SIZE);
    try {
      const page = await jobData.query(toQuery({ ...params, limit }, await loadPreferences()));
      const items = page.items.map((j) => toJob(j, page.generated_at));
      if (!params.search && !params.offset) { this.writeCache('cachedJobs', items); this.writeCache('cachedJobsAt', Date.now()); }
      this.isOnline = true;
      this.lastFailure = null;
      return { items, total: page.total, limit, offset: page.offset };
    } catch {
      // the static data is unreachable: ask the API
    }
    const query = new URLSearchParams();
    if (params.role) query.set('role', params.role);
    if (params.location) query.set('location', params.location);
    if (params.seniority) query.set('seniority', params.seniority);
    if (params.company_id) query.set('company_id', String(params.company_id));
    if (params.search) query.set('search', params.search.slice(0, 100));
    if (params.work_mode) query.set('work_mode', params.work_mode);
    if (params.geo_hub) query.set('geo_hub', params.geo_hub);
    if (params.experience_tier) query.set('experience_tier', params.experience_tier);
    if (params.min_budget) query.set('min_budget', String(params.min_budget));
    if (params.has_salary) query.set('has_salary', 'true');
    if (params.freshness_days) query.set('freshness_days', String(params.freshness_days));
    if (params.only_matching) query.set('only_matching', 'true');
    // Preferences are sent only so the server can pick matching jobs; it does not keep them.
    query.set('prefs', prefsParam(await loadPreferences()));
    query.set('limit', String(limit));
    if (params.offset) query.set('offset', String(params.offset));

    const res = await this.safeFetch(`/api/jobs?${query.toString()}`);
    if (res) {
      try {
        const data: JobsResponse = await res.json();
        if (!params.search && !params.offset) { this.writeCache('cachedJobs', data.items); this.writeCache('cachedJobsAt', Date.now()); }
        return data;
      } catch {
        // fall through to cache
      }
    }

    const f = this.lastFailure;
    const error: 'offline' | 'server' | 'busy' = f?.kind === 'http' ? (f.status === 429 || f.status === 503 ? 'busy' : 'server') : 'offline';
    const items = (await this.readCache<Job[]>('cachedJobs')) ?? [];
    const cachedAt = await this.getCachedJobsAt();
    return { items, total: items.length, limit, offset: params.offset ?? 0, error, fromCache: true, cachedAt };
  }

  // ----------------------------------------------------------------- companies
  async getCompanies(): Promise<Company[]> {
    try {
      const data = await jobData.companies<Company[]>();
      this.writeCache('cachedCompanies', data);
      return data;
    } catch {
      // fall back to the API
    }
    const res = await this.safeFetch('/api/companies');
    if (res) {
      try {
        const data = await res.json();
        this.writeCache('cachedCompanies', data);
        return data;
      } catch {
        // fall through
      }
    }
    return this.getCachedCompanies();
  }

  async toggleCompany(companyId: number): Promise<{ success: boolean; is_active: boolean; message?: string }> {
    const res = await this.safeFetch(`/api/companies/${companyId}/toggle`, { method: 'PATCH' });
    if (res) return res.json();
    return { success: false, is_active: false, message: this.writeFailureMessage('Tracking could not be changed') };
  }

  async addCompany(company: {
    name: string;
    careers_url?: string;
    source_type: string;
    source_identifier: string;
    industry?: string;
  }): Promise<Company> {
    const res = await this.safeFetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(company),
    });
    if (res) return res.json();
    throw new ApiError(this.writeFailureMessage('Could not add the company'), this.lastFailure?.kind === 'http' ? this.lastFailure.status : undefined);
  }

  private writeFailureMessage(prefix: string): string {
    const f = this.lastFailure;
    if (f?.kind === 'http') {
      if (f.status === 403) return `${prefix}: the company list is managed by Jobly.`;
      if (f.status === 409) return `${prefix}: it already exists.`;
      if (f.status === 429) return `${prefix}: too many requests, try again in a minute.`;
      if (f.status === 400 || f.status === 422) return `${prefix}: please check the details.`;
      return `${prefix}: the server had a problem (${f.status}).`;
    }
    return `${prefix}: can't reach the server. Check your connection and try again.`;
  }

  // ----------------------------------------------------------------- stats / reports
  async getStats(): Promise<RadarStats> {
    try {
      const prefs = await loadPreferences();
      const [stats, matched] = await Promise.all([
        jobData.stats<RadarStats>(),
        jobData.query({ only_matching: true, prefs, limit: 1 }).then((p) => p.total),
      ]);
      return { ...stats, matched_jobs: matched, is_syncing: false };
    } catch {
      // fall back to the API
    }
    const res = await this.safeFetch(`/api/stats?${new URLSearchParams({ prefs: prefsParam(await loadPreferences()) })}`);
    if (res) {
      try {
        return await res.json();
      } catch {
        // fall through
      }
    }
    return { total_jobs: 0, active_companies: 0, matched_jobs: 0, new_jobs_today: 0, last_sync_time: null };
  }

  async triggerSync(): Promise<{ status: string; ok: boolean }> {
    // The job data is re-published every few hours by the scheduled crawl: "refresh" picks up the newest copy.
    try {
      jobData.refresh();
      await jobData.meta();
      return { status: 'refreshed', ok: true };
    } catch {
      // the static data is unreachable: ask the API to crawl
    }
    const res = await this.safeFetch('/api/sync', { method: 'POST' });
    if (!res) return { status: 'failed', ok: false };
    try {
      return { ...(await res.json()), ok: true };
    } catch {
      return { status: 'enqueued', ok: true };
    }
  }

  async reportJob(jobId: number, reason: string, details = ''): Promise<boolean> {
    const params = new URLSearchParams({ reason, details: details.slice(0, 500) });
    return (await this.safeFetch(`/api/jobs/${jobId}/report?${params.toString()}`, { method: 'POST' })) !== null;
  }
}

export const api = new ApiClient();

export async function getFaviconCached(logoUrl: string, _domain: string): Promise<string> {
  return logoUrl;
}
