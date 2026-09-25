import { Job, JobsResponse, Company, Preferences, RadarStats, NotificationItem } from '../types';

const BASE_URLS = [
  'https://api.getcatchly.com',
  'https://jobly-yd6l.onrender.com',
  'http://127.0.0.1:8000',
  'http://localhost:8000',
];

class ApiClient {
  private activeBaseUrl: string = BASE_URLS[0];
  private isOnline: boolean = false;

  async checkHealth(): Promise<boolean> {
    for (const url of BASE_URLS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);
        const res = await fetch(`${url}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          this.activeBaseUrl = url;
          this.isOnline = true;
          return true;
        }
      } catch {
        // Continue to next URL candidate
      }
    }
    this.isOnline = false;
    return false;
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  private async safeFetch(endpoint: string, options?: RequestInit): Promise<Response | null> {
    // Try currently active base URL first, then failover through remaining candidates
    const urlsToTry = [this.activeBaseUrl, ...BASE_URLS.filter((u) => u !== this.activeBaseUrl)];
    for (const baseUrl of urlsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${baseUrl}${endpoint}`, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          this.activeBaseUrl = baseUrl;
          this.isOnline = true;
          return res;
        }
      } catch {
        // Continue to next candidate
      }
    }
    this.isOnline = false;
    return null;
  }

  async getPreferences(): Promise<Preferences> {
    const res = await this.safeFetch('/api/preferences');
    if (res) {
      try {
        const data = await res.json();
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({ cachedPreferences: data });
        }
        return data;
      } catch {
        // Fall through to cache
      }
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const stored = await chrome.storage.local.get('cachedPreferences');
      if (stored.cachedPreferences) return stored.cachedPreferences;
    }

    return {
      roles: ['product_design', 'frontend_engineering', 'product_management', 'ai_ml', 'fullstack_engineering'],
      seniorities: ['intern', 'junior', 'mid', 'senior', 'lead'],
      locations: [],
      remote_only: false,
      custom_keywords: '',
      excluded_keywords: '',
      notify_enabled: true,
      sync_interval_mins: 30,
    };
  }

  async updatePreferences(prefs: Preferences): Promise<Preferences> {
    const res = await this.safeFetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });

    if (res) {
      try {
        const data = await res.json();
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({ cachedPreferences: data });
        }
        return data;
      } catch {
        // Fall through
      }
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ cachedPreferences: prefs });
    }
    return prefs;
  }

  async getJobs(params: import('../types').JobFilterParams): Promise<JobsResponse> {
    const query = new URLSearchParams();
    if (params.role) query.set('role', params.role);
    if (params.location) query.set('location', params.location);
    if (params.seniority) query.set('seniority', params.seniority);
    if (params.company_id) query.set('company_id', String(params.company_id));
    if (params.search) query.set('search', params.search);
    if (params.work_mode) query.set('work_mode', params.work_mode);
    if (params.geo_hub) query.set('geo_hub', params.geo_hub);
    if (params.experience_tier) query.set('experience_tier', params.experience_tier);
    if (params.min_budget) query.set('min_budget', String(params.min_budget));
    if (params.has_salary) query.set('has_salary', 'true');
    if (params.freshness_days) query.set('freshness_days', String(params.freshness_days));
    if (params.only_matching) query.set('only_matching', 'true');
    if (params.saved_only) query.set('saved_only', 'true');
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));

    const res = await this.safeFetch(`/api/jobs?${query.toString()}`);
    if (res) {
      try {
        const data = await res.json();
        if (typeof chrome !== 'undefined' && chrome.storage?.local && !params.saved_only && !params.search) {
          chrome.storage.local.set({ cachedJobs: data.items });
        }
        return data;
      } catch {
        // Fall through to cache
      }
    }

    // Offline cached fallback
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const stored = await chrome.storage.local.get('cachedJobs');
      const items: Job[] = stored.cachedJobs || [];
      return {
        items,
        total: items.length,
        limit: params.limit || 30,
        offset: params.offset || 0,
      };
    }

    return { items: [], total: 0, limit: 30, offset: 0 };
  }

  async getCompanies(): Promise<Company[]> {
    const res = await this.safeFetch('/api/companies');
    if (res) {
      try {
        const data = await res.json();
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({ cachedCompanies: data });
        }
        return data;
      } catch {
        // Fall through
      }
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const stored = await chrome.storage.local.get('cachedCompanies');
      return stored.cachedCompanies || [];
    }
    return [];
  }

  async toggleCompany(companyId: number): Promise<{ success: boolean; is_active: boolean }> {
    const res = await this.safeFetch(`/api/companies/${companyId}/toggle`, {
      method: 'PATCH',
    });
    if (res) {
      return res.json();
    }
    return { success: false, is_active: false };
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
    if (res) {
      return res.json();
    }
    throw new Error('Local engine is unreachable. Please start the engine first.');
  }

  async saveJob(jobId: number): Promise<void> {
    await this.safeFetch(`/api/jobs/${jobId}/save`, { method: 'POST' });
  }

  async unsaveJob(jobId: number): Promise<void> {
    await this.safeFetch(`/api/jobs/${jobId}/save`, { method: 'DELETE' });
  }

  async getStats(): Promise<RadarStats> {
    const res = await this.safeFetch('/api/stats');
    if (res) {
      try {
        return await res.json();
      } catch {
        // Fall through
      }
    }
    return {
      total_jobs: 0,
      active_companies: 0,
      matched_jobs: 0,
      saved_jobs: 0,
      new_jobs_today: 0,
      last_sync_time: null,
    };
  }

  async triggerSync(): Promise<{ status: string }> {
    const res = await this.safeFetch('/api/sync?wait_for_completion=true', {
      method: 'POST',
    });
    if (res) {
      return res.json();
    }
    return { status: 'offline' };
  }

  async getNotifications(): Promise<NotificationItem[]> {
    const res = await this.safeFetch('/api/notifications');
    if (res) {
      try {
        return await res.json();
      } catch {
        // Fall through
      }
    }
    return [];
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.safeFetch('/api/notifications/read-all', { method: 'POST' });
  }

  // S-3 FIX: Wire report submissions to the backend
  async reportJob(jobId: number, reason: string, details: string = ''): Promise<boolean> {
    const params = new URLSearchParams({ reason, details });
    const res = await this.safeFetch(`/api/jobs/${jobId}/report?${params.toString()}`, { method: 'POST' });
    return res !== null;
  }
}

export const api = new ApiClient();

// S-5 FIX: Cache favicon domain hits in chrome.storage.local
const FAVICON_CACHE_KEY = 'hr_favicon_cache';
export async function getFaviconCached(logoUrl: string, domain: string): Promise<string> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return logoUrl;
  try {
    const stored = await chrome.storage.local.get(FAVICON_CACHE_KEY);
    const cache: Record<string, string> = stored[FAVICON_CACHE_KEY] || {};
    if (cache[domain]) return cache[domain];
    cache[domain] = logoUrl;
    chrome.storage.local.set({ [FAVICON_CACHE_KEY]: cache }).catch(() => {});
    return logoUrl;
  } catch {
    return logoUrl;
  }
}
