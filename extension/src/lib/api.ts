import { Job, JobsResponse, Company, Preferences, RadarStats } from '../types';
import { JobData, type DataJob, type JobQuery } from '../../../shared/jobdata';
import { CONNECT_TIMEOUTS_MS, DATA_BASE, MAX_PAGE_SIZE } from './config';
import { loadPreferences, storePreferences } from './userData';

// The files are on a CDN, so a slow answer means they can't be reached.
const timedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) });
export const jobData = new JobData(DATA_BASE, timedFetch);

/** A job from the static data in the shape the app uses (the list never carries descriptions). */
export function toJob(j: DataJob, generatedAt: string): Job {
  return {
    ...j, external_id: '', description: null, last_seen_at: generatedAt, status: 'active', is_saved: false,
  };
}

/** The extension's filters as a job-data query. */
export function toQuery(params: import('../types').JobFilterParams, prefs: Preferences): JobQuery {
  return {
    role: params.role, location: params.location, seniority: params.seniority, company_id: params.company_id,
    search: params.search?.slice(0, 100), work_mode: params.work_mode, geo_hub: params.geo_hub, experience_tier: params.experience_tier,
    min_budget: params.min_budget, has_salary: params.has_salary, freshness_days: params.freshness_days,
    only_matching: params.only_matching, prefs, limit: params.limit, offset: params.offset,
  };
}

export type ConnectionStatus = 'connecting' | 'online' | 'offline';
export type LoadError = 'offline' | 'server' | 'busy';

/** Why reading the job data failed: no answer at all, too many requests, or an error from the host. */
function loadError(e: unknown): LoadError {
  const status = Number(/HTTP (\d{3})/.exec(String(e))?.[1]);
  if (!status) return 'offline';
  return status === 429 || status === 503 ? 'busy' : 'server';
}

const hasStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;

class ApiClient {
  private isOnline = false;

  // ----------------------------------------------------------------- connectivity
  /** Whether the job data can be read right now. */
  async checkHealth(timeoutMs = CONNECT_TIMEOUTS_MS[0]): Promise<boolean> {
    try {
      jobData.refresh();
      await jobData.meta(AbortSignal.timeout(timeoutMs));
      this.isOnline = true;
    } catch {
      this.isOnline = false;
    }
    return this.isOnline;
  }

  /** A second, longer attempt before declaring "offline" (a slow network, not a sleeping server). */
  async connect(): Promise<boolean> {
    for (const ms of CONNECT_TIMEOUTS_MS) if (await this.checkHealth(ms)) return true;
    return false;
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
      return { items, total: page.total, limit, offset: page.offset };
    } catch (e) {
      const items = (await this.readCache<Job[]>('cachedJobs')) ?? [];
      const cachedAt = await this.getCachedJobsAt();
      return { items, total: items.length, limit, offset: params.offset ?? 0, error: loadError(e), fromCache: true, cachedAt };
    }
  }

  // ----------------------------------------------------------------- companies and stats
  async getCompanies(): Promise<Company[]> {
    try {
      const data = await jobData.companies<Company[]>();
      this.writeCache('cachedCompanies', data);
      return data;
    } catch {
      return this.getCachedCompanies();
    }
  }

  async getStats(): Promise<RadarStats> {
    try {
      const prefs = await loadPreferences();
      const [stats, matched] = await Promise.all([
        jobData.stats<RadarStats>(),
        jobData.query({ only_matching: true, prefs, limit: 1 }).then((p) => p.total),
      ]);
      return { ...stats, matched_jobs: matched };
    } catch {
      return { total_jobs: 0, active_companies: 0, matched_jobs: 0, new_jobs_today: 0, last_sync_time: null };
    }
  }

  /** "Refresh": the job data is re-published every few hours, so pick up the newest copy. */
  async triggerSync(): Promise<{ ok: boolean }> {
    return { ok: await this.checkHealth() };
  }
}

export const api = new ApiClient();

export async function getFaviconCached(logoUrl: string, _domain: string): Promise<string> {
  return logoUrl;
}
