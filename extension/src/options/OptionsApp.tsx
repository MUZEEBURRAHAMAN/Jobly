import React, { useEffect, useState, useCallback } from 'react';
import { Radio, Building2, Bookmark, Sliders, Bell, RefreshCw, ExternalLink, Sun, Moon } from 'lucide-react';
import { api } from '../lib/api';
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
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRole, setSelectedRole] = useState<string>('all_matching');

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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const online = await api.checkHealth();
      setIsOnline(online);

      // Q-2: Fetch up to 500 total (paginated in UI)
      const [prefsData, jobsData, companiesData, statsData, notifsData] = await Promise.all([
        api.getPreferences(),
        api.getJobs({ limit: 500, only_matching: false }),
        api.getCompanies(),
        api.getStats(),
        api.getNotifications(),
      ]);

      setPreferences(prefsData);
      setJobs(jobsData.items);
      // Q-5 FIX: saved jobs derived from full list so offline cache works
      setSavedJobs(jobsData.items.filter((j) => j.is_saved));
      setCompanies(companiesData);
      setStats(statsData);
      setNotifications(notifsData);
      setDisplayLimit(30); // Reset pagination on fresh load
    } catch {
      setIsOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await api.triggerSync();
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'TRIGGER_BACKGROUND_CHECK' });
      }
      await loadData();
    } catch {
      setIsOnline(false);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleSave = async (targetJob: Job) => {
    const newSaved = !targetJob.is_saved;
    setJobs((prev) =>
      prev.map((j) => (j.id === targetJob.id ? { ...j, is_saved: newSaved } : j))
    );

    if (newSaved) {
      setSavedJobs((prev) => [...prev, { ...targetJob, is_saved: true }]);
      await api.saveJob(targetJob.id);
    } else {
      setSavedJobs((prev) => prev.filter((j) => j.id !== targetJob.id));
      await api.unsaveJob(targetJob.id);
    }
  };

  const handleSavePreferences = async (newPrefs: Preferences) => {
    const updated = await api.updatePreferences(newPrefs);
    setPreferences(updated);
    await loadData();
  };

  const handleToggleCompany = async (companyId: number) => {
    await api.toggleCompany(companyId);
    setCompanies((prev) =>
      prev.map((c) => (c.id === companyId ? { ...c, is_active: !c.is_active } : c))
    );
  };

  const handleAddCompany = async (data: {
    name: string;
    careers_url?: string;
    source_type: string;
    source_identifier: string;
    industry?: string;
  }) => {
    const newComp = await api.addCompany(data);
    setCompanies((prev) => [...prev, newComp]);
  };

  const handleClearNotifications = async () => {
    await api.markAllNotificationsRead();
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
      api.markAllNotificationsRead().catch(() => {});
    }
  };

  return (
    <div
      data-theme={theme}
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Editorial Brutalist Navigation Bar */}
      <header style={{
        padding: '14px 32px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
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
              <span className="badge badge-accent">V2.5 BRUTALIST</span>
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
              {isOnline ? (
                <>
                  <span className="status-dot" style={{ width: 6, height: 6 }}></span>
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>LOCAL ENGINE ACTIVE</span>
                  <span>[127.0.0.1:8000]</span>
                </>
              ) : (
                <>
                  <span className="status-dot offline" style={{ width: 6, height: 6 }}></span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>ENGINE SLEEPING</span>
                </>
              )}
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
          padding: '14px 32px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
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
              padding: '10px 14px',
            }}>
              <div className="eyebrow" style={{ color: 'var(--text-muted)', fontSize: 9.5 }}>
                {item.label}
              </div>
              <div style={{
                fontSize: 22,
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

      {/* Main Content Layout */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Editorial Sidebar Nav */}
        <aside style={{
          width: 230,
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
          padding: '16px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
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
                    color: '#ffffff',
                    fontSize: 9,
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
        </aside>

        {/* Content Pane */}
        <main style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', width: '100%' }}>
          {activeTab === 'feed' && (
            <ErrorBoundary label="Radar Feed">
              <div style={{ width: '100%' }}>
                <RadarFeed
                  jobs={jobs}
                  loading={loading}
                  preferences={preferences}
                  onToggleSave={handleToggleSave}
                  onConfigureTargets={() => setActiveTab('rules')}
                  onSavePreferences={handleSavePreferences}
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
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    width: '100%',
                  }}>
                    <Bookmark size={24} color="var(--accent)" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                      No Saved Opportunities
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Bookmark jobs from the Radar feed to build your interview queue.
                    </p>
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
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <Bell size={24} color="var(--text-muted)" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      NO ALERTS LOGGED YET. NEW MATCHES DISPATCHED AUTOMATICALLY.
                    </p>
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

                      <a
                        href={n.application_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-accent btn-sm"
                        style={{ textDecoration: 'none' }}
                      >
                        <span>VIEW</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
