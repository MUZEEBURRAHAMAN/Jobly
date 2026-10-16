import React, { useMemo, useState } from 'react';
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { Job, Preferences } from '../types';
import { JobCard } from './JobCard';
import { EmptyState } from './EmptyState';
import { ROLES, DEFAULT_ROLE_IDS, EXPERIENCE_LABELS, HUB_LABELS } from '../lib/format';
import { DEFAULT_FILTERS, JobFilters, activeFilterCount, chipCounts, filterJobs } from '../lib/filters';

interface JobsFeedProps {
  jobs: Job[];
  loading: boolean;
  preferences?: Preferences | null;
  mutedCompanyIds: number[];
  onToggleSave: (job: Job) => void;
  onOpenPreferences: () => void;
  /** Set when the last load failed: don't present an outage as "no jobs match". */
  loadError?: 'offline' | 'server' | null;
  onRetryLoad?: () => void;
  /** The server is still collecting jobs for the first time. */
  gathering?: boolean;
  /** More jobs exist on the server than are loaded (server pages are capped). */
  hasMore?: boolean;
  onLoadMore?: () => void;
  roleFilter: string;
  onRoleFilterChange: (role: string) => void;
  filters: JobFilters;
  onFiltersChange: (next: JobFilters) => void;
  displayLimit: number;
  onDisplayLimitChange: (n: number) => void;
  large?: boolean;
}

const PAGE = 30;

export const JobsFeed: React.FC<JobsFeedProps> = ({
  jobs, loading, preferences, mutedCompanyIds, onToggleSave, onOpenPreferences, loadError, onRetryLoad, gathering,
  hasMore, onLoadMore, roleFilter, onRoleFilterChange, filters, onFiltersChange, displayLimit, onDisplayLimitChange, large,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const targetRoles = preferences?.roles?.length ? preferences.roles : DEFAULT_ROLE_IDS;
  const set = (patch: Partial<JobFilters>) => onFiltersChange({ ...filters, ...patch });
  const filterCount = activeFilterCount(filters);
  const hasSearch = filters.search.trim().length > 0;

  const counts = useMemo(() => chipCounts(jobs, filters, targetRoles, mutedCompanyIds, ROLES.map((r) => r.id)), [jobs, filters, targetRoles, mutedCompanyIds]);
  const visible = useMemo(() => filterJobs(jobs, filters, roleFilter, targetRoles, mutedCompanyIds), [jobs, filters, roleFilter, targetRoles, mutedCompanyIds]);

  const chips = [{ id: 'all_matching', label: 'For you' }, ...ROLES.map((r) => ({ id: r.id, label: r.short })), { id: 'all', label: 'All' }];
  const resetFilters = () => onFiltersChange({ ...DEFAULT_FILTERS, search: filters.search });

  const renderBody = () => {
    if (loading && jobs.length === 0) {
      return (
        <div aria-busy="true" aria-label="Loading jobs">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card job" style={{ marginTop: i ? 12 : 0 }}>
              <div className="row" style={{ gap: 12 }}>
                <div className="skeleton" style={{ width: 40, height: 40 }} />
                <div className="grow stack" style={{ gap: 8 }}>
                  <div className="skeleton" style={{ height: 14, width: '70%' }} />
                  <div className="skeleton" style={{ height: 12, width: '45%' }} />
                </div>
              </div>
              <div className="skeleton" style={{ height: 24, width: '60%' }} />
            </div>
          ))}
        </div>
      );
    }
    if (visible.length === 0 && loadError) {
      return loadError === 'offline' ? (
        <EmptyState art="offline" large={large} title="Can't reach Jobly" description="The server may be waking up, or you may be offline. Your preferences are safe. This page keeps trying on its own."
          actions={onRetryLoad && <button type="button" className="btn" onClick={onRetryLoad}><RotateCcw size={14} aria-hidden="true" /> Try again</button>} />
      ) : (
        <EmptyState art="error" role="alert" large={large} title="Something went wrong on our side" description="The server answered with an error. This isn't caused by your filters."
          actions={onRetryLoad && <button type="button" className="btn" onClick={onRetryLoad}><RotateCcw size={14} aria-hidden="true" /> Try again</button>} />
      );
    }
    if (visible.length === 0 && gathering) {
      return <EmptyState art="gathering" play large={large} title="Gathering jobs for the first time" description="Jobly is reading hundreds of company career pages. This takes a minute or two; jobs appear here as soon as they're ready." />;
    }
    if (visible.length === 0 && hasSearch) {
      return (
        <EmptyState art="search" large={large} title={`No jobs match "${filters.search.trim()}"`} description="Try a different city, company, or skill, e.g. “Bangalore”, “Stripe”, or “React”."
          actions={<><button type="button" className="btn" onClick={() => set({ search: '' })}><X size={14} aria-hidden="true" /> Clear search</button>
            {roleFilter !== 'all' && <button type="button" className="btn btn-outline" onClick={() => onRoleFilterChange('all')}>Search all roles</button>}</>} />
      );
    }
    if (visible.length === 0 && filterCount > 0) {
      return (
        <EmptyState art="filters" large={large} title="Your filters are too narrow" description="No jobs pass every filter you've set. Loosen one or reset them all."
          actions={<button type="button" className="btn" onClick={resetFilters}><RotateCcw size={14} aria-hidden="true" /> Reset filters</button>} />
      );
    }
    if (visible.length === 0) {
      return (
        <EmptyState art="nomatch" large={large} title={roleFilter === 'all_matching' ? 'No jobs match your preferences yet' : 'No jobs in this category'}
          description={roleFilter === 'all_matching' ? 'Try adding more roles or experience levels, or look at every job.' : 'Check back later, or look at every job.'}
          actions={<>{roleFilter === 'all_matching' && <button type="button" className="btn" onClick={onOpenPreferences}>Edit preferences</button>}
            <button type="button" className="btn btn-outline" onClick={() => onRoleFilterChange('all')}>Show all jobs</button></>} />
      );
    }
    return (
      <>
        {visible.slice(0, displayLimit).map((job) => <JobCard key={`${job.source_type}-${job.external_id}`} job={job} onToggleSave={onToggleSave} />)}
        {(visible.length > displayLimit || hasMore) && (
          <button
            type="button"
            className="btn btn-outline"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => {
              onDisplayLimitChange(displayLimit + PAGE);
              if (hasMore && visible.length - (displayLimit + PAGE) < PAGE) onLoadMore?.();
            }}
          >
            Show more jobs
          </button>
        )}
      </>
    );
  };

  return (
    <div>
      <div className="toolbar">
        <div className="row">
          <div className="search grow">
            <Search size={16} aria-hidden="true" />
            <input
              className="input"
              type="search"
              value={filters.search}
              onChange={(e) => set({ search: e.target.value.slice(0, 100) })}
              placeholder="Search jobs, companies, cities…"
              aria-label="Search jobs"
            />
          </div>
          <button type="button" className={`btn ${showFilters || filterCount ? 'btn-toggled' : 'btn-outline'}`} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="job-filters">
            <SlidersHorizontal size={14} aria-hidden="true" /> Filters{filterCount > 0 && ` · ${filterCount}`}
          </button>
        </div>

        {showFilters && (
          <div id="job-filters" className="filters" role="group" aria-label="Filters">
            <div>
              <label className="label" htmlFor="f-hub">Location</label>
              <select id="f-hub" className="select" value={filters.hub} onChange={(e) => set({ hub: e.target.value })}>
                <option value="all">Anywhere</option>
                {['us', 'india', 'europe', 'apac'].map((h) => <option key={h} value={h}>{HUB_LABELS[h]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="f-exp">Experience</label>
              <select id="f-exp" className="select" value={filters.exp} onChange={(e) => set({ exp: e.target.value })}>
                <option value="all">Any level</option>
                {Object.entries(EXPERIENCE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="f-pay">Minimum salary</label>
              <select id="f-pay" className="select" value={filters.minBudget} onChange={(e) => set({ minBudget: Number(e.target.value) })}>
                <option value={0}>Any</option>
                {[100000, 150000, 200000, 250000].map((n) => <option key={n} value={n}>${n / 1000}K+</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="f-new">Posted</label>
              <select id="f-new" className="select" value={filters.freshnessDays} onChange={(e) => set({ freshnessDays: Number(e.target.value) })}>
                <option value={0}>Any time</option>
                <option value={1}>Last 24 hours</option>
                <option value={3}>Last 3 days</option>
                <option value={7}>Last 7 days</option>
              </select>
            </div>
            <label className="row wide text-sm"><input type="checkbox" className="switch" role="switch" checked={filters.remoteOnly} onChange={(e) => set({ remoteOnly: e.target.checked })} /> Remote jobs only</label>
            <label className="row wide text-sm"><input type="checkbox" className="switch" role="switch" checked={filters.salaryOnly} onChange={(e) => set({ salaryOnly: e.target.checked })} /> Only jobs that list a salary</label>
            {filterCount > 0 && <button type="button" className="btn btn-ghost btn-sm wide" onClick={resetFilters}><RotateCcw size={14} aria-hidden="true" /> Reset filters</button>}
          </div>
        )}

        <div className="chips" role="group" aria-label="Job category">
          {chips.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={roleFilter === c.id} onClick={() => onRoleFilterChange(c.id)}>
              {c.label}
              {counts[c.id] !== undefined && jobs.length > 0 && <span className="count">{counts[c.id]}{hasMore ? '+' : ''}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="list">
        {visible.length > 0 && <p className="text-sm" style={{ marginBottom: 12 }} aria-live="polite">{visible.length}{hasMore ? '+' : ''} job{visible.length === 1 ? '' : 's'}{roleFilter === 'all_matching' ? ' that fit your preferences' : ''}</p>}
        {renderBody()}
      </div>
    </div>
  );
};
