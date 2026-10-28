import { Job } from '../types';
import { CATEGORY_IDS } from './format';

export interface JobFilters {
  search: string;
  hub: string;            // 'all' | us | india | europe | apac
  exp: string;            // 'all' | 0-2 | 2-5 | 5-8 | 8+
  minBudget: number;      // 0 = any
  salaryOnly: boolean;
  freshnessDays: number;  // 0 = any
  remoteOnly: boolean;
  jobType: string;        // 'all' | full_time | part_time | contract | internship
}

export const DEFAULT_FILTERS: JobFilters = { search: '', hub: 'all', exp: 'all', minBudget: 0, salaryOnly: false, freshnessDays: 0, remoteOnly: false, jobType: 'all' };

/** Filters other than the search box (the search box is shown separately). */
export function activeFilterCount(f: JobFilters): number {
  return (f.hub !== 'all' ? 1 : 0) + (f.exp !== 'all' ? 1 : 0) + (f.minBudget > 0 ? 1 : 0) + (f.salaryOnly ? 1 : 0) + (f.freshnessDays > 0 ? 1 : 0) + (f.remoteOnly ? 1 : 0) + (f.jobType !== 'all' ? 1 : 0);
}

const ALIASES: Record<string, string[]> = {
  bangalore: ['bangalore', 'bengaluru'], bengaluru: ['bengaluru', 'bangalore'],
  gurgaon: ['gurgaon', 'gurugram'], gurugram: ['gurugram', 'gurgaon'],
  delhi: ['delhi', 'delhi_ncr', 'noida', 'gurgaon', 'gurugram'], noida: ['noida', 'delhi', 'delhi_ncr'],
  sf: ['sf', 'san francisco', 'bay area'], 'bay area': ['bay area', 'san francisco'],
  nyc: ['nyc', 'new york'], ny: ['ny', 'new york'],
};

/** True when the job passes every filter except the role chip. */
export function passesFilters(job: Job, f: JobFilters, mutedCompanyIds: number[]): boolean {
  if (mutedCompanyIds.includes(job.company_id)) return false;
  if (f.remoteOnly && job.work_mode !== 'remote') return false;
  if (f.jobType !== 'all' && (job.employment_type || 'full_time') !== f.jobType) return false;
  if (f.hub !== 'all' && (job.geo_hub || 'global') !== f.hub) return false;
  if (f.exp !== 'all' && job.experience_tier !== f.exp) return false;
  if (f.salaryOnly && !job.salary_summary) return false;
  if (f.minBudget > 0 && (job.max_salary || 0) < f.minBudget) return false;
  if (f.freshnessDays > 0 && !(job.posted_at && new Date(job.posted_at).getTime() >= Date.now() - f.freshnessDays * 86400000)) return false;
  const query = f.search.trim().toLowerCase();
  if (query) {
    const corpus = `${job.title} ${job.company_name} ${job.location || ''} ${job.geo_hub || ''} ${job.normalized_role || ''} ${job.salary_summary || ''}`.toLowerCase();
    if (!query.split(/\s+/).every((token) => (ALIASES[token] || [token]).some((a) => corpus.includes(a)))) return false;
  }
  return true;
}

/** Role chip: 'all_matching' (your preferences), a role id, a broad category from "More roles", or 'all'. */
export function passesRole(job: Job, roleFilter: string, targetRoles: string[]): boolean {
  if (roleFilter === 'all') return true;
  if (CATEGORY_IDS.includes(roleFilter)) return job.category === roleFilter;
  if (roleFilter === 'all_matching') return job.is_match || (!!job.normalized_role && targetRoles.includes(job.normalized_role));
  return (job.normalized_role || '') === roleFilter;
}

export function filterJobs(jobs: Job[], f: JobFilters, roleFilter: string, targetRoles: string[], muted: number[]): Job[] {
  return jobs.filter((j) => passesFilters(j, f, muted) && passesRole(j, roleFilter, targetRoles));
}

/** Count per chip, honouring every other filter, so each chip shows what you'd get if you picked it. */
export function chipCounts(jobs: Job[], f: JobFilters, targetRoles: string[], muted: number[], roleIds: string[]): Record<string, number> {
  const counts: Record<string, number> = { all_matching: 0, all: 0 };
  roleIds.forEach((id) => { counts[id] = 0; });
  for (const job of jobs) {
    if (!passesFilters(job, f, muted)) continue;
    counts.all++;
    if (passesRole(job, 'all_matching', targetRoles)) counts.all_matching++;
    if (job.normalized_role && counts[job.normalized_role] !== undefined) counts[job.normalized_role]++;
  }
  return counts;
}
