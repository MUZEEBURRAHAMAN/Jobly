import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, Briefcase, Building2, SlidersHorizontal } from 'lucide-react';
import { api, ConnectionStatus } from '../lib/api';
import { IS_DEV_BUILD } from '../lib/config';
import { DEFAULT_FILTERS, JobFilters } from '../lib/filters';
import { useMutedCompanies } from '../lib/mutedCompanies';
import { useSavedOverlay } from '../lib/useSavedOverlay';
import { applyTheme, getInitialTheme, syncThemeFromStorage, Theme } from '../lib/theme';
import { Company, Job, Preferences, RadarStats } from '../types';
import { Header } from '../components/Header';
import { JobsFeed } from '../components/JobsFeed';
import { CompaniesView } from '../components/CompaniesView';
import { SavedJobsView } from '../components/SavedJobsView';
import { PreferencesView } from '../components/PreferencesView';
import { Notice, useNotice } from '../components/Notice';

type Tab = 'jobs' | 'companies' | 'saved' | 'preferences';

export const PopupApp: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  const [tab, setTab] = useState<Tab>('jobs');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [serverSaved, setServerSaved] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [stats, setStats] = useState<RadarStats | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [loadError, setLoadError] = useState<'offline' | 'server' | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all_matching');
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [displayLimit, setDisplayLimit] = useState(30);
  const overlay = useSavedOverlay(jobs, serverSaved);
  const savedJobs = overlay.saved;
  const { muted, toggle: toggleMuted } = useMutedCompanies();
  const { notice, show: showNotice, clear: clearNotice } = useNotice();
  const jobsSeq = useRef(0); // only the newest request may update the list

  useEffect(() => {
    applyTheme(theme);
    syncThemeFromStorage((synced) => setTheme(synced));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  const jobQuery = useCallback(() => ({
    role: roleFilter !== 'all_matching' && roleFilter !== 'all' ? roleFilter : undefined,
    only_matching: roleFilter === 'all_matching',
    search: filters.search.trim() || undefined,
  }), [roleFilter, filters.search]);

  const fetchJobs = useCallback(async () => {
    const seq = ++jobsSeq.current;
    setLoading(true);
    const data = await api.getJobs({ ...jobQuery(), limit: 100 });
    if (seq !== jobsSeq.current) return; // superseded by a newer request
    setJobs(data.items);
    setJobsTotal(data.error ? data.items.length : data.total);
    setLoadError(data.error ?? null);
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

  const loadSideData = useCallback(async () => {
    const [prefs, comps, st, saved] = await Promise.all([api.getPreferences(), api.getCompanies(), api.getStats(), api.getJobs({ saved_only: true, limit: 200 })]);
    setPreferences(prefs); setCompanies(comps); setStats(st);
    if (!saved.error) setServerSaved(saved.items);
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
      const [cj, cc, cp] = await Promise.all([api.getCachedJobs(), api.getCachedCompanies(), api.getCachedPreferences()]);
      if (cancelled) return;
      if (cj.length) { setJobs(cj); setLoading(false); }
      if (cc.length) setCompanies(cc);
      if (cp) setPreferences(cp);
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
    const next = !target.is_saved;
    overlay.set(target.id, next); // instant, and immune to responses that were already in flight
    const ok = next ? await api.saveJob(target.id) : await api.unsaveJob(target.id);
    if (!ok) { overlay.clear(target.id); showNotice(next ? "Couldn't save this job. Please try again." : "Couldn't remove this job from saved. Please try again."); }
  };

  const handleSavePreferences = async (p: Preferences): Promise<boolean> => {
    const { prefs, synced } = await api.updatePreferences(p);
    setPreferences(prefs);
    if (!synced) showNotice("Saved on this device only. We couldn't reach the server.", 'info');
    else await loadSideData();
    await fetchJobs();
    return synced;
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
    { id: 'companies', label: 'Companies', icon: Building2 },
    { id: 'saved', label: 'Saved', icon: Bookmark, badge: savedJobs.length },
    { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  ];

  return (
    <div className="popup" data-theme={theme}>
      <Header status={status} onRetry={() => { connect(); }} isSyncing={isSyncing} onSync={handleSync} openOptions={openOptions} theme={theme} onToggleTheme={toggleTheme} />

      <main id="main" className="popup-main">
        {tab === 'jobs' && (
          <JobsFeed
            jobs={overlay.jobs} loading={loading} preferences={preferences} mutedCompanyIds={muted}
            onToggleSave={handleToggleSave} onOpenPreferences={() => setTab('preferences')}
            loadError={loadError} onRetryLoad={() => { status === 'online' ? fetchJobs() : connect(); }} gathering={gathering}
            hasMore={jobs.length < jobsTotal} onLoadMore={loadMoreJobs}
            roleFilter={roleFilter} onRoleFilterChange={(r) => { setRoleFilter(r); setDisplayLimit(30); }}
            filters={filters} onFiltersChange={(f) => { setFilters(f); setDisplayLimit(30); }}
            displayLimit={displayLimit} onDisplayLimitChange={setDisplayLimit}
          />
        )}
        {tab === 'companies' && <CompaniesView companies={companies} mutedCompanyIds={muted} onToggleMuted={toggleMuted} canManage={IS_DEV_BUILD} onAddCompany={handleAddCompany} />}
        {tab === 'saved' && <SavedJobsView savedJobs={savedJobs} onToggleSave={handleToggleSave} onBrowseJobs={() => setTab('jobs')} />}
        {tab === 'preferences' && preferences && <PreferencesView preferences={preferences} onSave={handleSavePreferences} />}
        {tab === 'preferences' && !preferences && <p className="section text-sm" role="status">Loading your preferences…</p>}
      </main>

      <nav className="nav" aria-label="Sections">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} type="button" className="nav-item" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}
            aria-label={badge ? `${label}, ${badge} saved` : label}>
            <Icon size={18} aria-hidden="true" />
            <span>{label}{badge ? <span className="nav-badge"> {badge}</span> : null}</span>
          </button>
        ))}
      </nav>

      <Notice notice={notice} onClose={clearNotice} />
    </div>
  );
};
