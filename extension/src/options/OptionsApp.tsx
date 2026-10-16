import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Radio, Building2, Bookmark, Sliders, Bell, RefreshCw, ExternalLink, Sun, Moon, ArrowUp } from 'lucide-react';
import { api, ConnectionStatus } from '../lib/api';
import { MAX_PAGE_SIZE } from '../lib/config';
import { safeHttpUrl } from '../lib/url';
import { Notice, useNotice } from '../components/Notice';
import { appVersion } from '../components/Header';
import { Job, Company, Preferences, RadarStats, NotificationItem } from '../types';
import { getInitialTheme, applyTheme, syncThemeFromStorage, Theme } from '../lib/theme';
import { JobCard } from '../components/JobCard';
import { RadarFeed } from '../components/RadarFeed';
import { PreferencesView } from '../components/PreferencesView';
import { WatchlistView } from '../components/WatchlistView';
import { ErrorBoundary } from '../components/ErrorBoundary';

export const OptionsApp: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  const [activeTab, setActiveTab] = useState<'feed' | 'watchlist' | 'saved' | 'rules' | 'notifications'>('feed');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<RadarStats | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [loadError, setLoadError] = useState<'offline' | 'server' | null>(null);
  const [jobsTotal, setJobsTotal] = useState<number>(0);
  const { notice, show: showNotice, clear: clearNotice } = useNotice();
  const isOnline = status === 'online';
  const jobsSeq = useRef(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRole, setSelectedRole] = useState<string>('all_matching');
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  const mainScrollRef = useRef<HTMLElement>(null);

  // Q-3 FIX: Filter state lives here so it survives tab switches
  const [filterHub, setFilterHub] = useState<string>('all');
  const [filterExp, setFilterExp] = useState<string>('all');
  const [filterBudget, setFilterBudget] = useState<number>(0);
  const [filterSalaryOnly, setFilterSalaryOnly] = useState<boolean>(false);
  const [filterFreshness, setFilterFreshness] = useState<number>(0);
  const [filterRemoteOnly, setFilterRemoteOnly] = useState<boolean>(false);
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Q-2 FIX: Pagination — start with 30, user clicks Load More
  const [displayLimit, setDisplayLimit] = useState<number>(30);

  // Apply theme on mount and when changed + S-6: sync from chrome.storage
  useEffect(() => {
    applyTheme(theme);
    syncThemeFromStorage((synced) => setTheme(synced));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { applyTheme(theme); }, [theme]);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  // Everything except the job list (that has its own effect so filters/search/pagination stay in one place).
  const loadSideData = useCallback(async () => {
    const [prefsData, companiesData, statsData, notifsData, savedData] = await Promise.all([
      api.getPreferences(),
      api.getCompanies(),
      api.getStats(),
      api.getNotifications(),
      // Saved jobs come straight from the server. Deriving them from the newest N jobs hid older saved jobs.
      api.getJobs({ saved_only: true, limit: MAX_PAGE_SIZE }),
    ]);
    setPreferences(prefsData);
    setCompanies(companiesData);
    setStats(statsData);
    setNotifications(notifsData);
    if (!savedData.error) setSavedJobs(savedData.items);
  }, []);

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
      const [cachedJobs, cachedCompanies, cachedPrefs] = await Promise.all([api.getCachedJobs(), api.getCachedCompanies(), api.getCachedPreferences()]);
      if (cancelled) return;
      if (cachedJobs.length) { setJobs(cachedJobs); setLoading(false); }
      if (cachedCompanies.length) setCompanies(cachedCompanies);
      if (cachedPrefs) setPreferences(cachedPrefs);
    })();
    connect();
    return () => { cancelled = true; };
  }, [connect]);

  // While offline, keep trying quietly so the dashboard recovers by itself.
  useEffect(() => {
    if (status !== 'offline') return;
    const id = window.setInterval(() => { connect(); }, 30000);
    return () => window.clearInterval(id);
  }, [status, connect]);

  const jobQuery = useCallback(() => {
    const isMatchingOnly = selectedRole === 'all_matching';
    return {
      role: !isMatchingOnly && selectedRole !== 'all' ? selectedRole : undefined,
      only_matching: isMatchingOnly,
      search: filterSearch.trim() || undefined,
    };
  }, [selectedRole, filterSearch]);

  // Dynamic backend search & role filtering. Only the newest request may update the list.
  useEffect(() => {
    if (activeTab !== 'feed' || status === 'connecting') return;
    if (status === 'offline') { setLoadError('offline'); setLoading(false); return; }
    const timer = setTimeout(async () => {
      const seq = ++jobsSeq.current;
      setLoading(true);
      const res = await api.getJobs({ ...jobQuery(), limit: MAX_PAGE_SIZE });
      if (seq !== jobsSeq.current) return;
      setJobs(res.items);
      setJobsTotal(res.error ? res.items.length : res.total);
      setLoadError(res.error ?? null);
      setDisplayLimit(30);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [activeTab, status, jobQuery]);

  // The server caps a page at MAX_PAGE_SIZE, so "load more" past that fetches the next page.
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreJobs = useCallback(async () => {
    if (loadingMore || jobs.length >= jobsTotal) return;
    setLoadingMore(true);
    const seq = jobsSeq.current;
    const res = await api.getJobs({ ...jobQuery(), limit: MAX_PAGE_SIZE, offset: jobs.length });
    if (seq === jobsSeq.current && !res.error) {
      setJobs((prev) => {
        const seen = new Set(prev.map((j) => j.id));
        return [...prev, ...res.items.filter((j) => !seen.has(j.id))];
      });
    }
    setLoadingMore(false);
  }, [loadingMore, jobs.length, jobsTotal, jobQuery]);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const startTime = Date.now();
    try {
      const result = await api.triggerSync();
      if (!result.ok) showNotice("Couldn't reach the server to start a refresh. Showing your last results.");
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          chrome.runtime.sendMessage({ type: 'TRIGGER_BACKGROUND_CHECK' }, () => {
            if (chrome.runtime?.lastError) {}
          });
        } catch {}
      }
      const online = await api.checkHealth();
      setStatus(online ? 'online' : 'offline');
      if (online) await loadSideData();
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) {
        setTimeout(() => setIsSyncing(false), 500 - elapsed);
      } else {
        setIsSyncing(false);
      }
    }
  };

  const handleToggleSave = async (targetJob: Job) => {
    const newSaved = !targetJob.is_saved;
    const apply = (saved: boolean) => {
      setJobs((prev) => prev.map((j) => (j.id === targetJob.id ? { ...j, is_saved: saved } : j)));
      setSavedJobs((prev) =>
        saved ? (prev.some((j) => j.id === targetJob.id) ? prev : [...prev, { ...targetJob, is_saved: true }]) : prev.filter((j) => j.id !== targetJob.id)
      );
    };
    apply(newSaved);
    const ok = newSaved ? await api.saveJob(targetJob.id) : await api.unsaveJob(targetJob.id);
    if (!ok) {
      apply(!newSaved);
      showNotice(newSaved ? "Couldn't save this job — please try again." : "Couldn't remove this job from saved — please try again.");
    }
  };

  const handleSavePreferences = async (newPrefs: Preferences): Promise<boolean> => {
    const { prefs, synced } = await api.updatePreferences(newPrefs);
    setPreferences(prefs);
    if (!synced) showNotice("Saved on this device only — couldn't reach the server.", 'info');
    else await loadSideData();
    return synced;
  };

  const handleToggleCompany = async (companyId: number) => {
    const result = await api.toggleCompany(companyId);
    if (!result.success) {
      showNotice(result.message ?? "Couldn't change tracking for this company.");
      return;
    }
    setCompanies((prev) => prev.map((c) => (c.id === companyId ? { ...c, is_active: result.is_active } : c)));
  };

  const handleAddCompany = async (data: {
    name: string;
    careers_url?: string;
    source_type: string;
    source_identifier: string;
    industry?: string;
  }) => {
    const newComp = await api.addCompany(data); // throws ApiError with a user-facing message
    setCompanies((prev) => [...prev, newComp]);
  };

  const handleClearNotifications = async () => {
    const ok = await api.markAllNotificationsRead();
    if (!ok) { showNotice("Couldn't mark alerts as read — please try again."); return; }
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'CLEAR_BADGE' });
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  // Q-8 FIX: Clear badge immediately when user opens Notifications tab
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === 'notifications') {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'CLEAR_BADGE' });
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      void api.markAllNotificationsRead();
    }
  };

  return (
    <div
      data-theme={theme}
      style={{
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Editorial Brutalist Navigation Bar */}
      <header style={{
        padding: '12px 28px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 38,
            height: 38,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.04em',
              color: 'var(--accent)',
            }}>
              JB
            </span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                Jobly <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>// Find jobs. Apply smarter</span>
              </h1>
              <span className="badge badge-accent">v{appVersion()}</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              marginTop: 2,
            }}>
              <span role="status" aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {status === 'online' && (
                  <>
                    <span className="status-dot" style={{ width: 6, height: 6 }}></span>
                    <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                      {api.getActiveBaseUrl().includes('127.0.0.1') || api.getActiveBaseUrl().includes('localhost')
                        ? 'LOCAL DEV ENGINE ACTIVE'
                        : 'CLOUD RADAR LIVE'}
                    </span>
                    <span>[{api.getActiveBaseUrl().replace('https://', '').replace('http://', '')}]</span>
                  </>
                )}
                {status === 'connecting' && (
                  <>
                    <span className="status-dot offline" style={{ width: 6, height: 6 }}></span>
                    <span style={{ color: 'var(--amber-400)', fontWeight: 600 }}>CONNECTING · WAKING SERVER</span>
                  </>
                )}
                {status === 'offline' && (
                  <>
                    <span className="status-dot offline" style={{ width: 6, height: 6 }}></span>
                    <span style={{ color: 'var(--amber-400)', fontWeight: 600 }}>OFFLINE · SHOWING CACHED DATA</span>
                    <button type="button" onClick={() => { connect(); }} className="btn btn-secondary btn-sm" style={{ padding: '1px 8px', fontSize: 10 }}>RETRY</button>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Sync & Theme Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Dual Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="btn btn-secondary btn-sm"
            style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            <span>{theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}</span>
          </button>

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="btn btn-accent btn-sm"
            style={{ gap: 6 }}
          >
            <RefreshCw size={12} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isSyncing ? 'SYNCING ATS BOARDS...' : 'FORCE RADAR SYNC'}</span>
          </button>
        </div>
      </header>

      {/* Metrics Strip */}
      {stats && (
        <div style={{
          padding: '10px 28px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
          flexShrink: 0,
        }}>
          {[
            { label: 'TARGET MATCHES', value: stats.matched_jobs, highlight: 'var(--accent)' },
            { label: 'TOTAL ACTIVE POSITIONS', value: stats.total_jobs, highlight: 'var(--text-primary)' },
            { label: 'COMPANIES MONITORED', value: stats.active_companies, highlight: 'var(--text-secondary)' },
            { label: 'DISCOVERED (24H)', value: stats.new_jobs_today, highlight: 'var(--green)' },
            { label: 'SAVED SHORTLIST', value: savedJobs.length, highlight: 'var(--accent)' },
          ].map((item, idx) => (
            <div key={idx} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              padding: '8px 12px',
            }}>
              <div className="eyebrow" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                {item.label}
              </div>
              <div style={{
                fontSize: 18,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: item.highlight,
                marginTop: 2,
              }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content Layout — Full Screen Height, Sidebar Pinned */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Editorial Sidebar Nav — Permanently Pinned */}
        <aside style={{
          width: 220,
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
          padding: '16px 0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { id: 'feed', label: 'RADAR FEED', icon: Radio },
              { id: 'watchlist', label: 'WATCHLIST', icon: Building2 },
              { id: 'saved', label: 'SAVED JOBS', icon: Bookmark, badge: savedJobs.length },
              { id: 'rules', label: 'RADAR RULES', icon: Sliders },
              { id: 'notifications', label: 'ALERTS LOG', icon: Bell, badge: notifications.filter((n) => !n.is_read).length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as typeof activeTab)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 20px',
                    borderRadius: 0,
                    background: isActive ? 'var(--bg-card)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    border: 'none',
                    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                    cursor: 'pointer',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em',
                    transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={14} color={isActive ? 'var(--accent)' : 'currentColor'} />
                    <span>{tab.label}</span>
                  </div>
                  {Boolean(tab.badge && tab.badge > 0) && (
                    <span style={{
                      background: 'var(--accent)',
                      color: 'var(--on-accent)',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 5px',
                      fontFamily: 'var(--font-mono)',
                      borderRadius: 0,
                    }}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* System status pinned at bottom of sidebar */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              JOBLY LIVE RADAR
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green)', marginTop: 2 }}>
              {stats ? `${stats.active_companies} MONITORED EMPLOYERS` : 'MONITORING EMPLOYERS'}
            </div>
          </div>
        </aside>

        {/* Content Pane — Independent Smooth Scroll */}
        <main
          ref={mainScrollRef}
          onScroll={(e) => setShowScrollTop(e.currentTarget.scrollTop > 350)}
          style={{
            flex: 1,
            height: '100%',
            minHeight: 0,
            overflowY: 'auto',
            width: '100%',
            padding: activeTab === 'feed' ? '0' : '24px 32px',
            position: 'relative',
          }}
        >
          {activeTab === 'feed' && (
            <ErrorBoundary label="Radar Feed">
              <div style={{ width: '100%' }}>
                <RadarFeed
                  jobs={jobs}
                  loading={loading}
                  preferences={preferences}
                  onToggleSave={handleToggleSave}
                  onConfigureTargets={() => setActiveTab('rules')}
                  onSavePreferences={async (p) => { await handleSavePreferences(p); }}
                  loadError={loadError}
                  onRetryLoad={() => { connect(); }}
                  hasMore={jobs.length < jobsTotal}
                  onLoadMore={loadMoreJobs}
                  activeRoleFilter={selectedRole}
                  setActiveRoleFilter={(r) => { setSelectedRole(r); setDisplayLimit(30); }}
                  // Q-3: lifted filter state passed as props
                  filterHub={filterHub} setFilterHub={setFilterHub}
                  filterExp={filterExp} setFilterExp={setFilterExp}
                  filterBudget={filterBudget} setFilterBudget={setFilterBudget}
                  filterSalaryOnly={filterSalaryOnly} setFilterSalaryOnly={setFilterSalaryOnly}
                  filterFreshness={filterFreshness} setFilterFreshness={setFilterFreshness}
                  filterRemoteOnly={filterRemoteOnly} setFilterRemoteOnly={setFilterRemoteOnly}
                  filterSearch={filterSearch} setFilterSearch={setFilterSearch}
                  displayLimit={displayLimit} setDisplayLimit={setDisplayLimit}
                />
              </div>
            </ErrorBoundary>
          )}

          {activeTab === 'watchlist' && (
            <ErrorBoundary label="Watchlist">
              <div style={{ width: '100%' }}>
                <WatchlistView
                  companies={companies}
                  onToggleCompany={handleToggleCompany}
                  onAddCompany={handleAddCompany}
                />
              </div>
            </ErrorBoundary>
          )}

          {activeTab === 'saved' && (
            <div style={{ width: '100%' }}>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span className="eyebrow" style={{ color: 'var(--accent)' }}>SHORTLIST</span>
                  <h2 style={{ fontSize: 16, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, color: 'var(--text-primary)' }}>
                    Saved Opportunities ({savedJobs.length})
                  </h2>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                {savedJobs.length === 0 ? (
                  <div style={{
                    padding: '44px 20px',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    width: '100%',
                  }}>
                    <Bookmark size={24} color="var(--accent)" style={{ margin: '0 auto 10px', display: 'block' }} />
                    <span className="eyebrow" style={{ fontSize: 10, color: 'var(--accent)', display: 'block', marginBottom: 4 }}>
                      SHORTLIST EMPTY
                    </span>
                    <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                      No Saved Opportunities
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', maxWidth: 300, margin: '6px auto 14px', lineHeight: 1.4 }}>
                      Click the "SAVE" button on any card in the radar stream to pin positions here for active interview tracking.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedRole('all_matching');
                        setActiveTab('feed');
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ gap: 6, margin: '0 auto' }}
                    >
                      <Radio size={12} />
                      <span>BROWSE RADAR MATCHES</span>
                    </button>
                  </div>
                ) : (
                  savedJobs.map((j) => (
                    <JobCard key={`dash-saved-${j.id}`} job={j} onToggleSave={handleToggleSave} />
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'rules' && preferences && (
            <ErrorBoundary label="Radar Rules">
              <div style={{ width: '100%' }}>
                <div style={{ marginBottom: 16 }}>
                  <span className="eyebrow" style={{ color: 'var(--accent)' }}>CONFIGURATION</span>
                  <h2 style={{ fontSize: 16, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, color: 'var(--text-primary)' }}>
                    Radar Matching Rules
                  </h2>
                </div>
                <PreferencesView preferences={preferences} onSave={handleSavePreferences} />
              </div>
            </ErrorBoundary>
          )}

          {activeTab === 'notifications' && (
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <span className="eyebrow" style={{ color: 'var(--accent)' }}>DISPATCH HISTORY</span>
                  <h2 style={{ fontSize: 16, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, color: 'var(--text-primary)' }}>
                    Alerts & Notification Log
                  </h2>
                </div>
                <button onClick={handleClearNotifications} className="btn btn-secondary btn-sm">
                  MARK ALL READ
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {notifications.length === 0 ? (
                  <div style={{
                    padding: '44px 20px',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <Bell size={24} color="var(--text-muted)" style={{ margin: '0 auto 10px', display: 'block' }} />
                    <span className="eyebrow" style={{ fontSize: 10, color: 'var(--accent)', display: 'block', marginBottom: 4 }}>
                      DISPATCH LOG EMPTY
                    </span>
                    <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                      No Alerts Logged Yet
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 11.5, maxWidth: 360, margin: '6px auto 14px', lineHeight: 1.4 }}>
                      Jobly checks every monitored employer automatically in the background. When new jobs match your target rules, instant alerts appear here.
                    </p>
                    <button
                      onClick={handleSync}
                      disabled={isSyncing}
                      className="btn btn-primary btn-sm"
                      style={{ gap: 6, margin: '0 auto' }}
                    >
                      <RefreshCw size={12} className={isSyncing ? 'spin' : ''} />
                      <span>{isSyncing ? 'SCANNING ATS RADARS...' : 'RUN LIVE SCAN NOW'}</span>
                    </button>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} style={{
                      padding: '12px 16px',
                      background: n.is_read ? 'var(--bg-card)' : 'var(--bg-secondary)',
                      border: n.is_read ? '1px solid var(--border-subtle)' : '1px solid var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {n.company_name} — {n.title}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>
                          {n.location || 'Remote'} · Triggered {new Date(n.sent_at).toLocaleTimeString()}
                        </div>
                      </div>

                      {safeHttpUrl(n.application_url) && (
                        <a
                          href={safeHttpUrl(n.application_url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-accent btn-sm"
                          style={{ textDecoration: 'none' }}
                        >
                          <span>VIEW</span>
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Floating Back to Top Button */}
          {showScrollTop && (
            <button
              onClick={() => mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="btn btn-secondary btn-sm"
              style={{
                position: 'fixed',
                bottom: 24,
                right: 28,
                zIndex: 90,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-strong)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                gap: 6,
              }}
            >
              <ArrowUp size={12} />
              <span>TOP</span>
            </button>
          )}
        </main>
      </div>
      <Notice notice={notice} onClose={clearNotice} />
    </div>
  );
};
