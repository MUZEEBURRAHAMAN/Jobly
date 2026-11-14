import React, { useMemo, useState } from 'react';
import { RotateCcw, Search, SlidersHorizontal, X } from '../lib/icons';
import { Job, Preferences } from '../types';
import { JobCard } from './JobCard';
import { JobDetail } from './JobDetail';
import { EmptyState } from './EmptyState';
import { ROLES, DEFAULT_ROLE_IDS, EXPERIENCE_LABELS, HUB_LABELS, timeAgo, EMPLOYMENT_LABELS, CATEGORIES, CATEGORY_IDS, CATEGORY_GROUPS } from '../lib/format';
import { jobKey } from '../lib/userData';
import { matchScore, useMatch } from '../lib/matchScore';
import { DEFAULT_FILTERS, JobFilters, activeFilterCount, chipCounts, filterJobs } from '../lib/filters';

interface JobsFeedProps {
  jobs: Job[];
  loading: boolean;
  preferences?: Preferences | null;
  mutedCompanyIds: number[];
  onToggleSave: (job: Job) => void;
  onOpenPreferences: () => void;
  /** Set when the last load failed: don't present an outage as "no jobs match". */
  loadError?: 'offline' | 'server' | 'busy' | null;
  onRetryLoad?: () => void;
  /** When the jobs on screen were cached (ms), to say how old they are while offline. */
  cachedAt?: number | null;
  loadingMore?: boolean;
  /** Lets the "you hid these companies" messages link to the Companies screen. */
  onOpenCompanies?: () => void;
  /** More jobs match than are loaded (pages are capped). */
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
  jobs, loading, preferences, mutedCompanyIds, onToggleSave, onOpenPreferences, loadError, onRetryLoad, cachedAt, loadingMore, onOpenCompanies,
  hasMore, onLoadMore, roleFilter, onRoleFilterChange, filters, onFiltersChange, displayLimit, onDisplayLimitChange, large,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const targetRoles = preferences?.roles?.length ? preferences.roles : DEFAULT_ROLE_IDS;
  const set = (patch: Partial<JobFilters>) => onFiltersChange({ ...filters, ...patch });
  const filterCount = activeFilterCount(filters);
  const hasSearch = filters.search.trim().length > 0;

  const counts = useMemo(() => chipCounts(jobs, filters, targetRoles, mutedCompanyIds, ROLES.map((r) => r.id)), [jobs, filters, targetRoles, mutedCompanyIds]);
  const mutedHidden = useMemo(() => (mutedCompanyIds.length ? jobs.filter((j) => mutedCompanyIds.includes(j.company_id)).length : 0), [jobs, mutedCompanyIds]);
  const match = useMatch();
  const canMatch = !!match.prefs;
  const byMatch = canMatch && filters.sort === 'match';
  const visible = useMemo(() => {
    const list = filterJobs(jobs, filters, roleFilter, targetRoles, mutedCompanyIds);
    if (!byMatch) return list;
    // Best match first; ties keep the newest-first order the list already has
    const pct = new Map(list.map((j) => [j, matchScore(j, match.prefs, match.skills)?.percent ?? 0]));
    return list.map((j, i) => [j, i] as const).sort((a, b) => pct.get(b[0])! - pct.get(a[0])! || a[1] - b[1]).map(([j]) => j);
  }, [jobs, filters, roleFilter, targetRoles, mutedCompanyIds, byMatch, match]);

  // Wide page: the job the user clicked opens in a side sheet over the list
  const [picked, setPicked] = useState<string | null>(null);
  const selected = large && picked ? (visible.find((j) => jobKey(j) === picked) ?? null) : null;
  const select = (j: Job) => setPicked(jobKey(j));

  const chips = [{ id: 'all_matching', label: 'For you' }, ...ROLES.map((r) => ({ id: r.id, label: r.short })), { id: 'design_it', label: 'Design & IT' }, { id: 'all', label: 'All' }];
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
      const retry = onRetryLoad && <button type="button" className="btn" onClick={onRetryLoad}><RotateCcw size={14} aria-hidden="true" /> Try again</button>;
      if (loadError === 'offline') return <EmptyState art="offline" large={large} title="Can't reach Jobly" description="Jobly can't load its job list. You may be offline. Your preferences are safe, and this page keeps trying on its own." actions={retry} />;
      if (loadError === 'busy') return <EmptyState art="error" large={large} title="Jobly is busy right now" description="Too many requests right now. Wait a minute, then try again." actions={retry} />;
      return <EmptyState art="error" role="alert" large={large} title="Something went wrong on our side" description="Jobly's job list answered with an error. This isn't caused by your filters." actions={retry} />;
    }
    if (visible.length === 0 && mutedHidden > 0 && !hasSearch && filterCount === 0) {
      return <EmptyState art="companies" large={large} title="You've hidden every company in this list" description={`${mutedHidden} job${mutedHidden === 1 ? ' is' : 's are'} hidden because you turned those companies off.`}
        actions={onOpenCompanies && <button type="button" className="btn" onClick={onOpenCompanies}>Manage companies</button>} />;
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
        {visible.slice(0, displayLimit).map((job) => <JobCard key={`${job.id}-${jobKey(job)}`} job={job} onToggleSave={onToggleSave} onSelect={large ? select : undefined} selected={!!selected && jobKey(selected) === jobKey(job)} />)}
        {(visible.length > displayLimit || hasMore) && (
          <button
            type="button"
            className="btn btn-outline"
            disabled={loadingMore}
            style={{ width: '100%', marginTop: 12, gridColumn: '1 / -1' }}
            onClick={() => {
              onDisplayLimitChange(displayLimit + PAGE);
              if (hasMore && visible.length - (displayLimit + PAGE) < PAGE) onLoadMore?.();
            }}
          >
            {loadingMore ? 'Loading…' : 'Show more jobs'}
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
          {!large && <button type="button" className={`btn ${showFilters || filterCount ? 'btn-toggled' : 'btn-outline'}`} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="job-filters">
            <SlidersHorizontal size={14} aria-hidden="true" /> Filters{filterCount > 0 && ` · ${filterCount}`}
          </button>}
          {canMatch && (
            <select className="select sort-select" value={byMatch ? 'match' : 'newest'} onChange={(e) => set({ sort: e.target.value as 'newest' | 'match' })} aria-label="Sort jobs">
              <option value="newest">Newest first</option>
              <option value="match">Best match first</option>
            </select>
          )}
        </div>

        {large && (
          <div id="job-filters" className="pill-filters" role="group" aria-label="Filters">
            <label className={`pill-select${filters.freshnessDays ? ' on' : ''}`}><span>Posted</span>
              <select id="f-new" value={filters.freshnessDays} onChange={(e) => set({ freshnessDays: Number(e.target.value) })}>
                <option value={0}>Any time</option><option value={1}>Past 24 hours</option><option value={3}>Past 3 days</option><option value={7}>Past week</option><option value={14}>Past 2 weeks</option><option value={30}>Past month</option>
              </select></label>
            <label className={`pill-select${filters.hub !== 'all' ? ' on' : ''}`}><span>Location</span>
              <select id="f-hub" value={filters.hub} onChange={(e) => set({ hub: e.target.value })}>
                <option value="all">Anywhere</option>{['us', 'india', 'europe', 'apac'].map((h) => <option key={h} value={h}>{HUB_LABELS[h]}</option>)}
              </select></label>
            <label className={`pill-select${filters.exp !== 'all' ? ' on' : ''}`}><span>Level</span>
              <select id="f-exp" value={filters.exp} onChange={(e) => set({ exp: e.target.value })}>
                <option value="all">Any level</option>{Object.entries(EXPERIENCE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select></label>
            <label className={`pill-select${filters.jobType !== 'all' ? ' on' : ''}`}><span>Type</span>
              <select id="f-type" value={filters.jobType} onChange={(e) => set({ jobType: e.target.value })}>
                <option value="all">Any type</option>{Object.entries(EMPLOYMENT_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select></label>
            <label className={`pill-select${filters.minBudget ? ' on' : ''}`}><span>Salary</span>
              <select id="f-pay" value={filters.minBudget} onChange={(e) => set({ minBudget: Number(e.target.value) })}>
                <option value={0}>Any</option>{[100000, 150000, 200000, 250000].map((n) => <option key={n} value={n}>${n / 1000}K+</option>)}
              </select></label>
            <button type="button" className="pill-toggle" aria-pressed={filters.remoteOnly} onClick={() => set({ remoteOnly: !filters.remoteOnly })}>Remote only</button>
            <button type="button" className="pill-toggle" aria-pressed={filters.salaryOnly} onClick={() => set({ salaryOnly: !filters.salaryOnly })}>Lists a salary</button>
            {filterCount > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}><RotateCcw size={14} aria-hidden="true" /> Reset</button>}
          </div>
        )}

        {!large && showFilters && (
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
              <label className="label" htmlFor="f-new">Date posted</label>
              <select id="f-new" className="select" value={filters.freshnessDays} onChange={(e) => set({ freshnessDays: Number(e.target.value) })}>
                <option value={0}>Any time</option>
                <option value={1}>Past 24 hours</option>
                <option value={3}>Past 3 days</option>
                <option value={7}>Past week</option>
                <option value={14}>Past 2 weeks</option>
                <option value={30}>Past month</option>
              </select>
              <p className="hint">Jobs older than 2 months are never shown.</p>
            </div>
            <div>
              <label className="label" htmlFor="f-type">Job type</label>
              <select id="f-type" className="select" value={filters.jobType} onChange={(e) => set({ jobType: e.target.value })}>
                <option value="all">Any type</option>
                {Object.entries(EMPLOYMENT_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
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
          <select className={`chip chip-select${CATEGORY_IDS.includes(roleFilter) ? ' active' : ''}`} aria-label="More roles"
            value={CATEGORY_IDS.includes(roleFilter) ? roleFilter : ''} onChange={(e) => onRoleFilterChange(e.target.value || 'all')}>
            <option value="">More roles…</option>
            {CATEGORY_GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {CATEGORIES.filter((c) => c.group === g).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div className={large ? 'jobs-wide' : undefined}>
      <div className="list">
        {loadError && jobs.length > 0 && (
          <div className="banner" role="status">
            <span className="grow">
              {loadError === 'offline' && `You're offline. Showing jobs saved ${cachedAt ? timeAgo(cachedAt).toLowerCase() : 'on this device'}.`}
              {loadError === 'server' && "Jobly's job list had a problem. Showing jobs saved earlier."}
              {loadError === 'busy' && 'Jobly is busy right now. Showing jobs saved earlier; try again in a minute.'}
            </span>
          </div>
        )}
        {visible.length > 0 && <p className="text-sm" style={{ marginBottom: large ? 0 : 12 }} aria-live="polite">{visible.length}{hasMore ? '+' : ''} job{visible.length === 1 ? '' : 's'}{roleFilter === 'all_matching' ? ' that fit your preferences' : ''}{filters.freshnessDays === 0 ? ' · posted in the last 2 months' : ''}
          {mutedHidden > 0 && <> · {mutedHidden} hidden from companies you turned off{onOpenCompanies && <> (<button type="button" className="link" onClick={onOpenCompanies}>manage</button>)</>}</>}</p>}
        {renderBody()}
      </div>
      {selected && <JobDetail key={jobKey(selected)} job={selected} onToggleSave={onToggleSave} onClose={() => setPicked(null)} />}
      </div>
    </div>
  );
};
