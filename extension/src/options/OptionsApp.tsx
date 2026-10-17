import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Bookmark, Briefcase, Building2, Moon, RefreshCw, SlidersHorizontal, Sun } from 'lucide-react';
import { api, ConnectionStatus } from '../lib/api';
import { IS_DEV_BUILD, MAX_PAGE_SIZE } from '../lib/config';
import { DEFAULT_FILTERS, JobFilters } from '../lib/filters';
import { useMutedCompanies } from '../lib/mutedCompanies';
import { useSavedOverlay } from '../lib/useSavedOverlay';
import { useOnboarded } from '../lib/onboarding';
import { applyTheme, getInitialTheme, syncThemeFromStorage, Theme } from '../lib/theme';
import { Company, Job, NotificationItem, Preferences, RadarStats } from '../types';
import { StatusPill, appVersion } from '../components/Header';
import { JobsFeed } from '../components/JobsFeed';
import { CompaniesView } from '../components/CompaniesView';
import { SavedJobsView } from '../components/SavedJobsView';
import { PreferencesView } from '../components/PreferencesView';
import { AlertsView } from '../components/AlertsView';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Notice, useNotice } from '../components/Notice';
import { Welcome } from '../components/Welcome';

type Tab = 'jobs' | 'companies' | 'saved' | 'alerts' | 'preferences';
const n = (v: number | undefined) => (v ?? 0).toLocaleString();
const TABS: Tab[] = ['jobs', 'companies', 'saved', 'alerts', 'preferences'];
const tabFromHash = (): Tab => { const h = window.location.hash.replace('#', ''); return (TABS as string[]).includes(h) ? (h as Tab) : 'jobs'; };

export const OptionsApp: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [serverSaved, setServerSaved] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<RadarStats | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [loadError, setLoadError] = useState<'offline' | 'server' | 'busy' | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all_matching');
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [displayLimit, setDisplayLimit] = useState(30);
  const overlay = useSavedOverlay(jobs, serverSaved);
  const savedJobs = overlay.saved;
  const { muted, toggle: toggleMuted } = useMutedCompanies();
  const { notice, show: showNotice, clear: clearNotice } = useNotice();
  const { onboarded, complete: completeOnboarding, reset: resetOnboarding } = useOnboarded();
  const jobsSeq = useRef(0);

  useEffect(() => {
    applyTheme(theme);
    syncThemeFromStorage((synced) => setTheme(synced));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  // Everything except the job list (that has its own effect so filters/search/pagination stay in one place).
  const loadSideData = useCallback(async () => {
    const [prefs, comps, st, notifs, saved] = await Promise.all([
      api.getPreferences(), api.getCompanies(), api.getStats(), api.getNotifications(),
      // Saved jobs come straight from the server; deriving them from the newest N jobs hid older saved jobs.
      api.getJobs({ saved_only: true, limit: MAX_PAGE_SIZE }),
    ]);
    setPreferences(prefs); setCompanies(comps); setStats(st); setNotifications(notifs);
    if (!saved.error) setServerSaved(saved.items);
  }, []);

  const connect = useCallback(async () => {
    setStatus('connecting');
    const online = await api.waitForBackend();
    setStatus(online ? 'online' : 'offline');
    if (online) await loadSideData();
    else api.getLocalPreferences().then((lp) => setPreferences((cur) => cur ?? lp));
    return online;
  }, [loadSideData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cj, cc, cp, cs, at] = await Promise.all([api.getCachedJobs(), api.getCachedCompanies(), api.getCachedPreferences(), api.getCachedSaved(), api.getCachedJobsAt()]);
      if (cancelled) return;
      if (cj.length) { setJobs(cj); setLoading(false); setCachedAt(at); }
      if (cc.length) setCompanies(cc);
      if (cp) setPreferences(cp);
      if (cs.length) setServerSaved((cur) => (cur.length ? cur : cs));
    })();
    connect();
    return () => { cancelled = true; };
  }, [connect]);

  useEffect(() => {
    if (status !== 'offline') return;
    const id = window.setInterval(() => { connect(); }, 30000);
    return () => window.clearInterval(id);
  }, [status, connect]);

  const jobQuery = useCallback(() => ({
    role: roleFilter !== 'all_matching' && roleFilter !== 'all' ? roleFilter : undefined,
    only_matching: roleFilter === 'all_matching',
    search: filters.search.trim() || undefined,
    freshness_days: filters.freshnessDays || undefined,
  }), [roleFilter, filters.search, filters.freshnessDays]);

  const fetchJobs = useCallback(async () => {
    const seq = ++jobsSeq.current;
    setLoading(true);
    const res = await api.getJobs({ ...jobQuery(), limit: MAX_PAGE_SIZE });
    if (seq !== jobsSeq.current) return; // a newer request superseded this one
    setJobs(res.items);
    setJobsTotal(res.error ? res.items.length : res.total);
    setLoadError(res.error ?? null);
    if (res.error) setCachedAt(res.cachedAt ?? null);
    setDisplayLimit(30);
    setLoading(false);
  }, [jobQuery]);

  useEffect(() => {
    if (tab !== 'jobs' || status === 'connecting') return;
    if (status === 'offline') { setLoadError('offline'); setLoading(false); return; }
    const timer = setTimeout(fetchJobs, 250);
    return () => clearTimeout(timer);
  }, [tab, status, fetchJobs]);

  // The server caps a page at MAX_PAGE_SIZE, so "show more" past that fetches the next page.
  const loadMoreJobs = useCallback(async () => {
    if (loadingMore || jobs.length >= jobsTotal) return;
    setLoadingMore(true);
    const seq = jobsSeq.current;
    const res = await api.getJobs({ ...jobQuery(), limit: MAX_PAGE_SIZE, offset: jobs.length });
    if (seq === jobsSeq.current && !res.error) {
      setJobs((prev) => { const seen = new Set(prev.map((j) => j.id)); return [...prev, ...res.items.filter((j) => !seen.has(j.id))]; });
    }
    setLoadingMore(false);
  }, [loadingMore, jobs.length, jobsTotal, jobQuery]);

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

  const markAlertsRead = async () => {
    const ok = await api.markAllNotificationsRead();
    if (!ok) { showNotice("Couldn't mark alerts as read. Please try again."); return; }
    try { chrome.runtime?.sendMessage({ type: 'CLEAR_BADGE' }); } catch { /* not in an extension context */ }
    setNotifications((p) => p.map((x) => ({ ...x, is_read: true })));
  };

  const unreadAlerts = notifications.filter((x) => !x.is_read).length;
  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'companies', label: 'Companies', icon: Building2 },
    { id: 'saved', label: 'Saved', icon: Bookmark, badge: savedJobs.length },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: unreadAlerts },
    { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  ];

  const finishWelcome = async (p: Preferences) => { const synced = await handleSavePreferences(p); completeOnboarding(); window.location.hash = ''; return synced; };

  return (
    <div className="dash" data-theme={theme}>
      <header className="topbar" style={{ padding: '12px 24px' }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="brand-mark" aria-hidden="true">J</div>
          <div>
            <h1>Jobly <span className="muted font-medium text-sm">v{appVersion()}</span></h1>
            <StatusPill status={status} onRetry={() => { connect(); }} />
          </div>
        </div>
        <div className="row">
          <button type="button" className="btn btn-outline btn-sm" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
          <button type="button" className="btn btn-sm" onClick={handleSync} disabled={isSyncing}><RefreshCw size={14} className={isSyncing ? 'spin' : ''} aria-hidden="true" />{isSyncing ? 'Refreshing…' : 'Refresh jobs'}</button>
        </div>
      </header>

      {onboarded === false ? (
        <main id="main" className="content"><Welcome initial={preferences} onFinish={finishWelcome} onSkip={completeOnboarding} /></main>
      ) : onboarded === null ? <div className="dash-body" aria-busy="true" /> : (
      <div className="dash-body">
        <nav className="side" aria-label="Sections">
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button key={id} type="button" className="nav-link" aria-current={tab === id ? 'page' : undefined}
              onClick={() => { setTab(id); if (id === 'alerts' && unreadAlerts > 0) void markAlertsRead(); }}>
              <Icon size={16} aria-hidden="true" /> {label}
              {badge ? <span className="nav-badge">{badge}</span> : null}
            </button>
          ))}
        </nav>

        <main id="main" className="content">
          <div className={`content-inner${tab === 'preferences' ? ' narrow' : ''}`}>
            {tab === 'jobs' && stats && (
              <div className="stats">
                {[['For you', stats.matched_jobs], ['Open jobs', stats.total_jobs], ['Companies', stats.active_companies], ['New today', stats.new_jobs_today]].map(([label, value]) => (
                  <div key={label as string} className="card stat"><div className="text-sm muted">{label}</div><div className="value">{n(value as number)}</div></div>
                ))}
              </div>
            )}
            <ErrorBoundary>
              {tab === 'jobs' && (
                <div className="card" style={{ overflow: 'clip' }}>
                  <JobsFeed
                    large jobs={overlay.jobs} loading={loading} preferences={preferences} mutedCompanyIds={muted}
                    onToggleSave={handleToggleSave} onOpenPreferences={() => setTab('preferences')}
                    loadError={loadError} onRetryLoad={() => { status === 'online' ? fetchJobs() : connect(); }} gathering={gathering}
                    hasMore={jobs.length < jobsTotal} onLoadMore={loadMoreJobs} loadingMore={loadingMore} cachedAt={cachedAt} onOpenCompanies={() => setTab('companies')}
                    roleFilter={roleFilter} onRoleFilterChange={(r) => { setRoleFilter(r); setDisplayLimit(30); }}
                    filters={filters} onFiltersChange={(f) => { setFilters(f); setDisplayLimit(30); }}
                    displayLimit={displayLimit} onDisplayLimitChange={setDisplayLimit}
                  />
                </div>
              )}
              {tab === 'companies' && <CompaniesView large companies={companies} mutedCompanyIds={muted} onToggleMuted={toggleMuted} canManage={IS_DEV_BUILD} onAddCompany={handleAddCompany} offline={status === 'offline'} loading={status === 'connecting'} />}
              {tab === 'saved' && <SavedJobsView large savedJobs={savedJobs} onToggleSave={handleToggleSave} onBrowseJobs={() => setTab('jobs')} offline={status === 'offline'} />}
              {tab === 'alerts' && <AlertsView large notifications={notifications} onMarkAllRead={markAlertsRead} offline={status === 'offline'} />}
              {tab === 'preferences' && preferences && <PreferencesView preferences={preferences} onSave={handleSavePreferences} onReplayWelcome={resetOnboarding} />}
              {tab === 'preferences' && !preferences && <div className="section" aria-busy="true" aria-label="Loading your preferences">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: i ? 56 : 28, width: i ? '100%' : '40%' }} />)}</div>}
            </ErrorBoundary>
          </div>
        </main>
      </div>
      )}

      <Notice notice={notice} onClose={clearNotice} />
    </div>
  );
};
