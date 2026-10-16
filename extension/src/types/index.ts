export interface Job {
  id: number;
  company_id: number;
  company_name: string;
  source_type: 'greenhouse' | 'lever' | 'ashby' | 'workday' | 'amazon' | 'custom' | string;
  external_id: string;
  title: string;
  normalized_role: string | null;
  seniority: string | null;
  work_mode: string | null;
  location: string | null;
  description: string | null;
  application_url: string;
  first_seen_at: string;
  last_seen_at: string;
  /** Real posting date from the source; null when the source doesn't say. */
  posted_at?: string | null;
  status: string;
  is_saved: boolean;
  is_match: boolean;
  salary_summary?: string | null;
  min_salary?: number | null;
  max_salary?: number | null;
  geo_hub?: string | null;
  experience_tier?: string | null;
}

export interface JobsResponse {
  items: Job[];
  total: number;
  limit: number;
  offset: number;
  /** Set when the request failed: 'offline' = unreachable, 'server' = the server answered with an error. */
  error?: 'offline' | 'server' | 'busy';
  /** True when `items` came from the local cache instead of the server. */
  fromCache?: boolean;
  /** When the cached items were saved (ms since epoch). */
  cachedAt?: number | null;
}

export interface JobFilterParams {
  role?: string;
  location?: string;
  seniority?: string;
  company_id?: number;
  search?: string;
  work_mode?: string;
  geo_hub?: string;
  experience_tier?: string;
  min_budget?: number;
  has_salary?: boolean;
  freshness_days?: number;
  only_matching?: boolean;
  saved_only?: boolean;
  limit?: number;
  offset?: number;
}

export interface Company {
  id: number;
  name: string;
  slug: string;
  careers_url?: string;
  source_type: string;
  source_identifier: string;
  industry?: string;
  logo_url?: string;
  is_active: boolean;
  job_count: number;
  created_at: string;
  updated_at: string;
}

export interface Preferences {
  roles: string[];
  seniorities: string[];
  locations: string[];
  remote_only: boolean;
  custom_keywords: string;
  excluded_keywords: string;
  notify_enabled: boolean;
  sync_interval_mins: number;
}

export interface NotificationItem {
  id: number;
  job_id: number;
  title: string;
  company_name: string;
  role: string;
  location: string | null;
  application_url: string;
  sent_at: string;
  is_read: boolean;
}

export interface RadarStats {
  total_jobs: number;
  active_companies: number;
  matched_jobs: number;
  saved_jobs: number;
  new_jobs_today: number;
  last_sync_time: string | null;
  is_syncing?: boolean;
}
