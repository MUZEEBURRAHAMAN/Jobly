import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, Briefcase, Building2, SlidersHorizontal, Wand } from '../lib/icons';
import { api, ConnectionStatus } from '../lib/api';
import { IS_DEV_BUILD } from '../lib/config';
import { DEFAULT_FILTERS, JobFilters } from '../lib/filters';
import { useMutedCompanies } from '../lib/mutedCompanies';
import { useSavedJobs } from '../lib/useSavedJobs';
import { useOnboarded } from '../lib/onboarding';
import { applyTheme, getInitialTheme, switchThemeWithReveal, syncThemeFromStorage, Theme } from '../lib/theme';
import { flushSync } from 'react-dom';
import { Company, Job, Preferences, RadarStats } from '../types';
import { Header } from '../components/Header';
import { JobsFeed } from '../components/JobsFeed';
import { CompaniesView } from '../components/CompaniesView';
import { SavedJobsView } from '../components/SavedJobsView';
import { PreferencesView } from '../components/PreferencesView';
import { Notice, useNotice } from '../components/Notice';
import { Welcome } from '../components/Welcome';
import { ApplyPrompt } from '../components/ApplyPrompt';
import { ApplyKitView } from '../components/ApplyKitView';
import { useProfiles } from '../lib/useProfiles';
import { useTrackerContext } from '../lib/trackerContext';

type Tab = 'jobs' | 'apply' | 'companies' | 'saved' | 'preferences';

export const PopupApp: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  const [tab, setTab] = useState<Tab>('jobs');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [stats, setStats] = useState<RadarStats | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [loadError, setLoadError] = useState<'offline' | 'server' | 'busy' | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all_matching');
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [displayLimit, setDisplayLimit] = useState(30);
  const savedStore = useSavedJobs(jobs);
  const savedJobs = savedStore.saved;
  const { muted, toggle: toggleMuted } = useMutedCompanies();
  const { notice, show: showNotice, clear: clearNotice } = useNotice();
  const { onboarded, complete: completeOnboarding, reset: resetOnboarding } = useOnboarded();
  const jobsSeq = useRef(0); // only the newest request may update the list
  const profiles = useProfiles();
  const tracker = useTrackerContext()!.store;

  useEffect(() => {
    applyTheme(theme);
    syncThemeFromStorage((synced) => setTheme(synced));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTheme = (e?: React.MouseEvent<HTMLElement>) => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    switchThemeWithReveal(e?.currentTarget, () => flushSync(() => { setTheme(next); applyTheme(next); }));
  };

  const jobQuery = useCallback(() => ({
    role: roleFilter !== 'all_matching' && roleFilter !== 'all' ? roleFilter : undefined,
    only_matching: roleFilter === 'all_matching',
    search: filters.search.trim() || undefined,
    freshness_days: filters.freshnessDays || undefined,
  }), [roleFilter, filters.search, filters.freshnessDays]);

  const fetchJobs = useCallback(async () => {
    const seq = ++jobsSeq.current;
    setLoading(true);
    const data = await api.getJobs({ ...jobQuery(), limit: 100 });
    if (seq !== jobsSeq.current) return; // superseded by a newer request
    setJobs(data.items);
    setJobsTotal(data.error ? data.items.length : data.total);
    setLoadError(data.error ?? null);
    if (data.error) setCachedAt(data.cachedAt ?? null);
    setLoading(false);
  }, [jobQuery]);

  // Next page from the server once everything loaded so far has been shown.
  const loadMoreJobs = useCallback(async () => {
    if (loadingMore || jobs.length >= jobsTotal) return;
    setLoadingMore(true);
    const seq = jobsSeq.current;
    const res = await api.getJobs({ ...jobQuery(), limit: 100, offset: jobs.length });
    if (seq === jobsSeq.current && !res.error) {
      setJobs((prev) => { const seen = new Set(prev.map((j) => j.id)); return [...prev, ...res.items.filter((j) => !seen.has(j.id))]; });
    }
    setLoadingMore(false);
  }, [loadingMore, jobs.length, jobsTotal, jobQuery]);

  // Preferences and saved jobs are on this device, so they are there instantly (even offline).
  useEffect(() => { api.getPreferences().then(setPreferences); }, []);

  const loadSideData = useCallback(async () => {
    const [comps, st] = await Promise.all([api.getCompanies(), api.getStats()]);
    setCompanies(comps); setStats(st);
  }, []);

  // Paint from the local cache immediately, then wait (patiently) for a sleeping free-tier server.
  const connect = useCallback(async () => {
    setStatus('connecting');
    const online = await api.waitForBackend();
    setStatus(online ? 'online' : 'offline');
    if (online) await loadSideData();
    return online;
  }, [loadSideData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cj, cc, at] = await Promise.all([api.getCachedJobs(), api.getCachedCompanies(), api.getCachedJobsAt()]);
      if (cancelled) return;
      if (cj.length) { setJobs(cj); setLoading(false); setCachedAt(at); }
      if (cc.length) setCompanies(cc);
    })();
    connect();
    return () => { cancelled = true; };
  }, [connect]);

  // While offline, keep trying quietly so the popup recovers on its own.
  useEffect(() => {
    if (status !== 'offline') return;
    const id = window.setInterval(() => { connect(); }, 30000);
    return () => window.clearInterval(id);
  }, [status, connect]);

  // Fetch jobs when the category / search / connection changes (debounced)
  useEffect(() => {
    if (tab !== 'jobs' || status === 'connecting') return;
    if (status === 'offline') { setLoadError('offline'); setLoading(false); return; } // keep showing cached jobs
    const timer = setTimeout(fetchJobs, 250);
    return () => clearTimeout(timer);
  }, [tab, status, fetchJobs]);

  // A brand-new server is still collecting its first jobs: poll until some arrive.
  const gathering = status === 'online' && !!stats && stats.total_jobs === 0;
  useEffect(() => {
    if (!gathering) return;
    const id = window.setInterval(async () => {
      const st = await api.getStats();
      setStats(st);
      if (st.total_jobs > 0) { await loadSideData(); await fetchJobs(); }
    }, 8000);
    return () => window.clearInterval(id);
  }, [gathering, loadSideData, fetchJobs]);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const started = Date.now();
    try {
      const result = await api.triggerSync();
      if (!result.ok) showNotice("Couldn't reach the server to refresh. Showing your last results.");
      try { chrome.runtime?.sendMessage({ type: 'TRIGGER_BACKGROUND_CHECK' }, () => void chrome.runtime?.lastError); } catch { /* not in an extension context */ }
      const online = await api.checkHealth();
      setStatus(online ? 'online' : 'offline');
      if (online) await Promise.all([loadSideData(), fetchJobs()]);
    } finally {
      setTimeout(() => setIsSyncing(false), Math.max(0, 500 - (Date.now() - started)));
    }
  };

  const handleToggleSave = async (target: Job) => {
    const problem = await savedStore.toggle(target);
    if (problem) showNotice(problem);
  };

  const handleSavePreferences = async (p: Preferences): Promise<void> => {
    const { prefs, stored } = await api.updatePreferences(p);
    setPreferences(prefs);
    if (!stored) { showNotice("Couldn't save your preferences. Your browser storage may be full.", 'error'); return; }
    // Re-baseline alerts so a new preference doesn't announce everything that already exists.
    try { chrome.runtime?.sendMessage({ type: 'TRIGGER_BACKGROUND_CHECK', silent: true }, () => void chrome.runtime?.lastError); } catch { /* not in an extension context */ }
    if (status === 'online') await loadSideData();
    await fetchJobs();
  };

  const handleAddCompany = async (data: Parameters<typeof api.addCompany>[0]) => {
    const created = await api.addCompany(data);
    setCompanies((p) => [...p, created]);
  };

  const openOptions = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) chrome.runtime.openOptionsPage();
    else window.open('/options.html', '_blank');
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'apply', label: 'Apply', icon: Wand },
    { id: 'companies', label: 'Companies', icon: Building2 },
    { id: 'saved', label: 'Saved', icon: Bookmark, badge: savedJobs.length },
    { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  ];

  const finishWelcome = async (p: Preferences) => { await handleSavePreferences(p); completeOnboarding(); };

  if (onboarded === null) return <div className="popup" data-theme={theme} aria-busy="true" />;
  if (onboarded === false) {
    return (
      <div className="popup" data-theme={theme}>
        <Header status={status} onRetry={() => { connect(); }} isSyncing={false} onSync={() => {}} theme={theme} onToggleTheme={toggleTheme} minimal />
        <main id="main" className="popup-main"><Welcome compact initial={preferences} onFinish={finishWelcome} onSkip={completeOnboarding} /></main>
      </div>
    );
  }

  return (
    <div className="popup" data-theme={theme}>
      <Header status={status} onRetry={() => { connect(); }} isSyncing={isSyncing} onSync={handleSync} openOptions={openOptions} theme={theme} onToggleTheme={toggleTheme} />

      <main id="main" className="popup-main">
        <ApplyPrompt onProblem={(m) => showNotice(m)} />
        {tab === 'jobs' && (
          <JobsFeed
            jobs={savedStore.jobs} loading={loading} preferences={preferences} mutedCompanyIds={muted}
            onToggleSave={handleToggleSave} onOpenPreferences={() => setTab('preferences')}
            loadError={loadError} onRetryLoad={() => { status === 'online' ? fetchJobs() : connect(); }} gathering={gathering}
            hasMore={jobs.length < jobsTotal} onLoadMore={loadMoreJobs} loadingMore={loadingMore} cachedAt={cachedAt}
            onOpenCompanies={() => setTab('companies')}
            roleFilter={roleFilter} onRoleFilterChange={(r) => { setRoleFilter(r); setDisplayLimit(30); }}
            filters={filters} onFiltersChange={(f) => { setFilters(f); setDisplayLimit(30); }}
            displayLimit={displayLimit} onDisplayLimitChange={setDisplayLimit}
          />
        )}
        {tab === 'apply' && <ApplyKitView profiles={profiles} tracker={tracker} notify={showNotice}
          openDashboard={(hash) => { try { void chrome.tabs.create({ url: chrome.runtime.getURL(`options.html#${hash}`) }); } catch { window.open(`/options.html#${hash}`, '_blank'); } }} />}
        {tab === 'companies' && <CompaniesView companies={companies} mutedCompanyIds={muted} onToggleMuted={toggleMuted} canManage={IS_DEV_BUILD} onAddCompany={handleAddCompany} offline={status === 'offline'} loading={status === 'connecting'} />}
        {tab === 'saved' && <SavedJobsView savedJobs={savedJobs} onToggleSave={handleToggleSave} onBrowseJobs={() => setTab('jobs')} />}
        {tab === 'preferences' && preferences && <PreferencesView preferences={preferences} onSave={handleSavePreferences} onReplayWelcome={resetOnboarding} />}
        {tab === 'preferences' && !preferences && (
          <div className="section" aria-busy="true" aria-label="Loading your preferences">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: i ? 56 : 28, width: i ? '100%' : '40%' }} />)}
          </div>
        )}
      </main>

      <nav className="nav" aria-label="Sections">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} type="button" className="nav-item" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}
            aria-label={badge ? `${label}, ${badge} saved` : label}>
            <Icon size={18} duo={tab === id} aria-hidden="true" />
            <span>{label}{badge ? <span className="nav-badge"> {badge}</span> : null}</span>
          </button>
        ))}
      </nav>

      <Notice notice={notice} onClose={clearNotice} />
    </div>
  );
};
