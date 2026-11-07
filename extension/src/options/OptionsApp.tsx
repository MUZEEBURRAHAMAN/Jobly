import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Bookmark, Briefcase, Building2, Calendar, FileText, Kanban, ListChecks, Mail, Moon, RefreshCw, Settings, SlidersHorizontal, Sun, User, Contacts, X } from '../lib/icons';
import { api, ConnectionStatus } from '../lib/api';
import { FEATURES, MAX_PAGE_SIZE } from '../lib/config';
import { DEFAULT_FILTERS, JobFilters } from '../lib/filters';
import { useMutedCompanies } from '../lib/mutedCompanies';
import { useSavedJobs } from '../lib/useSavedJobs';
import { useAlerts } from '../lib/useAlerts';
import { useOnboarded } from '../lib/onboarding';
import { applyTheme, getInitialTheme, switchThemeWithReveal, syncThemeFromStorage, Theme } from '../lib/theme';
import { flushSync } from 'react-dom';
import { Company, Job, Preferences, RadarStats } from '../types';
import { StatusPill, appVersion } from '../components/Header';
import { JobsFeed } from '../components/JobsFeed';
import { CompaniesView } from '../components/CompaniesView';
import { SavedJobsView } from '../components/SavedJobsView';
import { PreferencesView } from '../components/PreferencesView';
import { AlertsView } from '../components/AlertsView';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Notice, useNotice } from '../components/Notice';
import { Welcome } from '../components/Welcome';
import { TrackerView } from '../components/TrackerView';
import { InterviewsView } from '../components/InterviewsView';
import { TasksView } from '../components/TasksView';
import { ApplyPrompt } from '../components/ApplyPrompt';
import { ProfileView } from '../components/ProfileView';
import { ResumeView } from '../components/ResumeView';
import { CoverLetterView } from '../components/CoverLetterView';
import { useProfiles } from '../lib/useProfiles';
import { ContactsView } from '../components/ContactsView';
import { DataSetting } from '../components/DataSetting';
import { CalendarImport } from '../components/CalendarImport';
import { HUNTER_KEY } from '../lib/integrations';
import { onKeysChanged, readKey, writeKey } from '../lib/userData';
import { useTrackerContext } from '../lib/trackerContext';
import { dueLabel } from '../lib/dates';
import { useCompleteness } from '../lib/useCompleteness';
import { CompletenessBar } from '../components/CompletenessBar';

type Tab = 'jobs' | 'companies' | 'saved' | 'tracker' | 'interviews' | 'tasks' | 'profile' | 'resume' | 'letters' | 'contacts' | 'alerts' | 'preferences';
const n = (v: number | undefined) => (v ?? 0).toLocaleString();
const TRACKER_TABS: Tab[] = ['tracker', 'interviews', 'tasks'];
const TABS: Tab[] = ['jobs', 'companies', 'saved', 'tracker', 'interviews', 'tasks', 'profile', 'resume', 'letters', 'contacts', 'alerts', 'preferences'];
const tabFromHash = (): Tab => {
  const h = window.location.hash.replace('#', '');
  // Links to the switched-off tracker pages (old bookmarks, notifications) open Saved, where applied jobs are listed
  if (!FEATURES.tracker && (TRACKER_TABS as string[]).includes(h)) return 'saved';
  if (h === 'profile-setup') return 'profile';
  return (TABS as string[]).includes(h) ? (h as Tab) : 'jobs';
};

export const OptionsApp: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
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
  const savedStore = useSavedJobs(jobs);
  const savedJobs = savedStore.saved;
  const { alerts, unread: unreadAlerts, markAllRead } = useAlerts();
  // Alerts that were unread when this visit opened the tab stay highlighted until the page closes,
  // even though they are stored as read straight away (so the badge clears).
  const [newThisVisit, setNewThisVisit] = useState<Set<string>>(() => new Set());
  const { muted, toggle: toggleMuted } = useMutedCompanies();
  const { notice, show: showNotice, clear: clearNotice } = useNotice();
  const { onboarded, complete: completeOnboarding, reset: resetOnboarding } = useOnboarded();
  const onboardedRef = useRef(onboarded);
  onboardedRef.current = onboarded;
  const jobsSeq = useRef(0);
  const tracker = useTrackerContext()!.store;
  // Keep the open tab in the address, so reloading or bookmarking returns to it.
  useEffect(() => { const onHash = () => setTab(tabFromHash()); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  useEffect(() => { if (onboardedRef.current && window.location.hash.replace('#', '') !== tab) history.replaceState(null, '', tab === 'jobs' ? window.location.pathname : `#${tab}`); }, [tab]);
  const profiles = useProfiles();
  const completeness = useCompleteness(profiles.active);
  // Opened from "Complete your profile" in the popup or the jobs list: start the setup steps
  const [setupOnOpen, setSetupOnOpen] = useState(() => window.location.hash === '#profile-setup');
  useEffect(() => { if (tab !== 'profile') setSetupOnOpen(false); }, [tab]);
  const NUDGE_KEY = 'profileNudgeHiddenUntil';
  const [nudgeHidden, setNudgeHidden] = useState(true);
  useEffect(() => { void readKey<number>(NUDGE_KEY).then((t) => setNudgeHidden(!!t && t > Date.now())); }, []);
  const hideNudge = () => { setNudgeHidden(true); void writeKey(NUDGE_KEY, Date.now() + 7 * 86400000); };
  const [hasHunterKey, setHasHunterKey] = useState(false);
  useEffect(() => { const load = () => void readKey<string>(HUNTER_KEY).then((k) => setHasHunterKey(!!k)); load(); return onKeysChanged([HUNTER_KEY], load); }, []);
  // Follow-ups and tasks that are due today or overdue, for the Tasks badge.
  const dueNow = (iso: string | null) => !!iso && (dueLabel(iso).overdue || dueLabel(iso).text === 'today');
  const dueCount = tracker.tasks.filter((t) => !t.done && dueNow(t.due_at)).length
    + tracker.apps.filter((a) => !['rejected', 'withdrawn', 'offer'].includes(a.status) && dueNow(a.follow_up_at)).length;
  const upcomingInterviews = tracker.interviews.filter((i) => Date.parse(i.at) >= Date.now()).length;

  useEffect(() => {
    applyTheme(theme);
    syncThemeFromStorage((synced) => setTheme(synced));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTheme = (e?: React.MouseEvent<HTMLElement>) => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    switchThemeWithReveal(e?.currentTarget, () => flushSync(() => { setTheme(next); applyTheme(next); }));
  };

  // Preferences, saved jobs and alerts are on this device, so they are there instantly (even offline).
  useEffect(() => { api.getPreferences().then(setPreferences); }, []);

  // Everything except the job list (that has its own effect so filters/search/pagination stay in one place).
  const loadSideData = useCallback(async () => {
    const [comps, st] = await Promise.all([api.getCompanies(), api.getStats()]);
    setCompanies(comps); setStats(st);
  }, []);

  const connect = useCallback(async () => {
    setStatus('connecting');
    const online = await api.connect();
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

  // A page is capped at MAX_PAGE_SIZE, so "show more" past that fetches the next page.
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

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const started = Date.now();
    try {
      const result = await api.triggerSync();
      if (!result.ok) showNotice("Couldn't reach Jobly's job list. Showing your last results.");
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

  const markAlertsRead = async () => {
    if (!(await markAllRead())) showNotice("Couldn't mark alerts as read. Please try again.");
  };

  const allTabs: { id: Tab; label: string; icon: React.ElementType; badge?: number; badgeText?: string }[] = [
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'companies', label: 'Companies', icon: Building2 },
    { id: 'saved', label: 'Saved', icon: Bookmark, badge: savedJobs.length },
    { id: 'tracker', label: 'Tracker', icon: Kanban, badge: tracker.apps.length },
    { id: 'interviews', label: 'Interviews', icon: Calendar, badge: upcomingInterviews },
    { id: 'tasks', label: 'Tasks', icon: ListChecks, badge: dueCount },
    { id: 'profile', label: 'Profile', icon: User, badgeText: profiles.ready && completeness.percent < 100 ? `${completeness.percent}%` : undefined },
    { id: 'resume', label: 'Resume', icon: FileText },
    { id: 'letters', label: 'Cover letters', icon: Mail },
    { id: 'contacts', label: 'Contacts', icon: Contacts },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: unreadAlerts },
    { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  ];
  // Alerts and Settings live in the header (bell and gear), not the sidebar
  const tabs = allTabs.filter((t) => t.id !== 'alerts' && t.id !== 'preferences' && (FEATURES.tracker || !TRACKER_TABS.includes(t.id)));

  const openAlerts = () => {
    setTab('alerts');
    if (unreadAlerts > 0) { setNewThisVisit((s) => new Set([...s, ...alerts.filter((a) => !a.is_read).map((a) => a.id)])); void markAlertsRead(); }
  };

  const finishWelcome = async (p: Preferences) => { await handleSavePreferences(p); completeOnboarding(); window.location.hash = ''; };

  return (
    <div className="dash" data-theme={theme}>
      <header className="topbar" style={{ padding: '12px 24px' }}>
        <div className="row" style={{ gap: 12 }}>
          <img className="brand-mark" src="icons/icon-48.png" alt="" width={32} height={32} aria-hidden="true" />
          <div>
            <h1>Jobly <span className="muted font-medium text-sm">v{appVersion()}</span></h1>
            <StatusPill status={status} onRetry={() => { connect(); }} />
          </div>
        </div>
        {onboarded ? (
          <div className="row top-actions" style={{ gap: 2 }}>
            <button type="button" className="btn btn-ghost btn-icon icon-badge-wrap" onClick={openAlerts} aria-current={tab === 'alerts' ? 'page' : undefined}
              title={unreadAlerts ? `Alerts: ${unreadAlerts} new` : 'Alerts'} aria-label={unreadAlerts ? `Alerts, ${unreadAlerts} new` : 'Alerts'}>
              <Bell size={18} duo={tab === 'alerts'} aria-hidden="true" />
              {unreadAlerts > 0 && <span className="icon-badge" aria-hidden="true">{unreadAlerts > 99 ? '99+' : unreadAlerts}</span>}
            </button>
            <button type="button" className="btn btn-ghost btn-icon" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            <button type="button" className="btn btn-ghost btn-icon" onClick={handleSync} disabled={isSyncing} title={isSyncing ? 'Refreshing…' : 'Refresh jobs'} aria-label={isSyncing ? 'Refreshing jobs' : 'Refresh jobs'}>
              <RefreshCw size={18} className={isSyncing ? 'spin' : ''} aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setTab('preferences')} aria-current={tab === 'preferences' ? 'page' : undefined} title="Settings" aria-label="Settings">
              <Settings size={18} duo={tab === 'preferences'} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-icon" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
        )}
      </header>

      {onboarded === false ? (
        <main id="main" className="content"><Welcome initial={preferences} onFinish={finishWelcome} onSkip={completeOnboarding} /></main>
      ) : onboarded === null ? <div className="dash-body" aria-busy="true" /> : (
      <div className="dash-body">
        <nav className="side" aria-label="Sections">
          {tabs.map(({ id, label, icon: Icon, badge, badgeText }) => (
            <button key={id} type="button" className="nav-link" aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}>
              <Icon size={16} duo={tab === id} aria-hidden="true" /> {label}
              {badge ? <span className="nav-badge">{badge}</span> : badgeText ? <span className="nav-badge muted-badge">{badgeText}</span> : null}
            </button>
          ))}
        </nav>

        <main id="main" className="content">
          <div className="content-inner">
            <ApplyPrompt onProblem={(m) => showNotice(m)} />
            {tab === 'jobs' && stats && (
              <div className="stats">
                {[['For you', stats.matched_jobs], ['Open jobs', stats.total_jobs], ['Companies', stats.active_companies], ['Posted in 24 hours', stats.new_jobs_today]].map(([label, value]) => (
                  <div key={label as string} className="card stat"><div className="text-sm muted">{label}</div><div className="value">{n(value as number)}</div></div>
                ))}
              </div>
            )}
            {tab === 'jobs' && profiles.ready && completeness.percent < 80 && !nudgeHidden && (
              <div className="card profile-nudge">
                <CompletenessBar completeness={completeness} action={
                  <div className="row" style={{ gap: 4 }}>
                    <button type="button" className="btn btn-sm" onClick={() => { setSetupOnOpen(true); setTab('profile'); }}>Complete your profile</button>
                    <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={hideNudge} aria-label="Hide for a week" title="Hide for a week"><X size={14} aria-hidden="true" /></button>
                  </div>} />
                <p className="text-xs muted">Autofill can only fill in what's in your profile. Import your LinkedIn PDF to finish in a minute.</p>
              </div>
            )}
            <ErrorBoundary>
              {tab === 'jobs' && (
                <div className="card" style={{ overflow: 'clip' }}>
                  <JobsFeed
                    large jobs={savedStore.jobs} loading={loading} preferences={preferences} mutedCompanyIds={muted}
                    onToggleSave={handleToggleSave} onOpenPreferences={() => setTab('preferences')}
                    loadError={loadError} onRetryLoad={() => { status === 'online' ? fetchJobs() : connect(); }}
                    hasMore={jobs.length < jobsTotal} onLoadMore={loadMoreJobs} loadingMore={loadingMore} cachedAt={cachedAt} onOpenCompanies={() => setTab('companies')}
                    roleFilter={roleFilter} onRoleFilterChange={(r) => { setRoleFilter(r); setDisplayLimit(30); }}
                    filters={filters} onFiltersChange={(f) => { setFilters(f); setDisplayLimit(30); }}
                    displayLimit={displayLimit} onDisplayLimitChange={setDisplayLimit}
                  />
                </div>
              )}
              {tab === 'companies' && <CompaniesView large companies={companies} mutedCompanyIds={muted} onToggleMuted={toggleMuted} offline={status === 'offline'} loading={status === 'connecting'} />}
              {tab === 'saved' && <SavedJobsView large savedJobs={savedJobs} onToggleSave={handleToggleSave} onBrowseJobs={() => setTab('jobs')} notify={showNotice} />}
              {FEATURES.tracker && tab === 'tracker' && <TrackerView store={tracker} savedJobs={savedJobs} notify={showNotice} onBrowseJobs={() => setTab('jobs')} />}
              {FEATURES.tracker && tab === 'interviews' && <InterviewsView store={tracker} onOpenTracker={() => setTab('tracker')} calendarImport={<CalendarImport store={tracker} notify={showNotice} />} />}
              {FEATURES.tracker && tab === 'tasks' && <TasksView store={tracker} notify={showNotice} />}
              {tab === 'profile' && <ProfileView store={profiles} notify={showNotice} openSetup={setupOnOpen} />}
              {tab === 'resume' && <ResumeView store={profiles} onOpenProfile={() => setTab('profile')} />}
              {tab === 'letters' && <CoverLetterView profiles={profiles} tracker={tracker} savedJobs={savedJobs} notify={showNotice} onOpenProfile={() => setTab('profile')} />}
              {tab === 'contacts' && <ContactsView tracker={tracker} profile={profiles.active} notify={showNotice} onOpenPreferences={() => setTab('preferences')} hasHunterKey={hasHunterKey} />}
              {tab === 'alerts' && <AlertsView large alerts={alerts} newIds={newThisVisit} onMarkAllRead={markAlertsRead} />}
              {tab === 'preferences' && preferences && <PreferencesView wide title="Settings" preferences={preferences} onSave={handleSavePreferences} onReplayWelcome={resetOnboarding}
                extra={<DataSetting store={tracker} notify={showNotice} />} />}
              {tab === 'preferences' && !preferences && <div className="section" aria-busy="true" aria-label="Loading your settings">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: i ? 56 : 28, width: i ? '100%' : '40%' }} />)}</div>}
            </ErrorBoundary>
          </div>
        </main>
      </div>
      )}

      <Notice notice={notice} onClose={clearNotice} />
    </div>
  );
};
