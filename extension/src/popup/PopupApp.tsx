import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Radio, Building2, Bookmark, Sliders } from 'lucide-react';
import { api, ConnectionStatus } from '../lib/api';
import { Notice, useNotice } from '../components/Notice';
import { Job, Company, Preferences, RadarStats } from '../types';
import { getInitialTheme, applyTheme, syncThemeFromStorage, Theme } from '../lib/theme';
import { Header } from '../components/Header';
import { RadarFeed } from '../components/RadarFeed';
import { PreferencesView } from '../components/PreferencesView';
import { WatchlistView } from '../components/WatchlistView';
import { SavedJobsView } from '../components/SavedJobsView';

export const PopupApp: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  const [activeTab, setActiveTab] = useState<'feed' | 'watchlist' | 'saved' | 'rules'>('feed');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [stats, setStats] = useState<RadarStats | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [loadError, setLoadError] = useState<'offline' | 'server' | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeRoleFilter, setActiveRoleFilter] = useState<string>('all_matching');
  const { notice, show: showNotice, clear: clearNotice } = useNotice();

  // Lifted filter state (same pattern as OptionsApp)
  const [filterHub, setFilterHub] = useState<string>('all');
  const [filterExp, setFilterExp] = useState<string>('all');
  const [filterBudget, setFilterBudget] = useState<number>(0);
  const [filterSalaryOnly, setFilterSalaryOnly] = useState<boolean>(false);
  const [filterFreshness, setFilterFreshness] = useState<number>(0);
  const [filterRemoteOnly, setFilterRemoteOnly] = useState<boolean>(false);
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [displayLimit, setDisplayLimit] = useState<number>(30);

  // Only the newest request may update the list (a slow, older response must not overwrite a newer search).
  const jobsSeq = useRef(0);

  // Apply theme on mount + sync from chrome.storage.sync
  useEffect(() => {
    applyTheme(theme);
    syncThemeFromStorage((synced) => setTheme(synced));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  // Load jobs based on current active role filter and optional search query
  const fetchJobsForFilter = useCallback(async (roleFilter: string, searchQuery?: string) => {
    const seq = ++jobsSeq.current;
    setLoading(true);
    const isMatchingOnly = roleFilter === 'all_matching';
    const specificRole = !isMatchingOnly && roleFilter !== 'all' ? roleFilter : undefined;

    const jobsData = await api.getJobs({
      role: specificRole,
      only_matching: isMatchingOnly,
      search: searchQuery?.trim() || undefined,
      limit: 150,
    });
    if (seq !== jobsSeq.current) return; // superseded by a newer request
    setJobs(jobsData.items);
    setLoadError(jobsData.error ?? null);
    setLoading(false);
  }, []);

  const loadSideData = useCallback(async () => {
    const [prefsData, companiesData, statsData, savedData] = await Promise.all([
      api.getPreferences(),
      api.getCompanies(),
      api.getStats(),
      api.getJobs({ saved_only: true, limit: 200 }),
    ]);
    setPreferences(prefsData);
    setCompanies(companiesData);
    setStats(statsData);
    if (!savedData.error) setSavedJobs(savedData.items);
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
      const [cachedJobs, cachedCompanies, cachedPrefs] = await Promise.all([api.getCachedJobs(), api.getCachedCompanies(), api.getCachedPreferences()]);
      if (cancelled) return;
      if (cachedJobs.length) { setJobs(cachedJobs); setLoading(false); }
      if (cachedCompanies.length) setCompanies(cachedCompanies);
      if (cachedPrefs) setPreferences(cachedPrefs);
    })();
    connect();
    return () => { cancelled = true; };
  }, [connect]);

  // While offline, keep trying quietly so the popup recovers on its own once the server is back.
  useEffect(() => {
    if (status !== 'offline') return;
    const id = window.setInterval(() => { connect(); }, 30000);
    return () => window.clearInterval(id);
  }, [status, connect]);

  // Fetch jobs whenever role filter, search query or connection state changes (debounced 250ms)
  useEffect(() => {
    if (activeTab !== 'feed' || status === 'connecting') return;
    if (status === 'offline') { setLoadError('offline'); setLoading(false); return; } // keep showing cached jobs
    const timer = setTimeout(() => {
      fetchJobsForFilter(activeRoleFilter, filterSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [activeTab, activeRoleFilter, filterSearch, status, fetchJobsForFilter]);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const startTime = Date.now();
    try {
      const result = await api.triggerSync();
      if (!result.ok) showNotice("Couldn't reach the server to start a refresh. Showing your last results.");

      // Notify background service worker safely
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          chrome.runtime.sendMessage({ type: 'TRIGGER_BACKGROUND_CHECK' }, () => {
            if (chrome.runtime?.lastError) {}
          });
        } catch {}
      }

      // Re-check the connection and reload everything
      const online = await api.checkHealth();
      setStatus(online ? 'online' : 'offline');
      if (online) await Promise.all([loadSideData(), fetchJobsForFilter(activeRoleFilter, filterSearch)]);
    } finally {
      // Ensure at least 500ms spin feedback for clear visual confirmation
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
    apply(newSaved); // optimistic
    const ok = newSaved ? await api.saveJob(targetJob.id) : await api.unsaveJob(targetJob.id);
    if (!ok) {
      apply(!newSaved); // roll back and tell the user
      showNotice(newSaved ? "Couldn't save this job — please try again." : "Couldn't remove this job from saved — please try again.");
    }
  };

  // Returns true when the change reached the server (the form shows "saved" vs "saved on this device only").
  const handleSavePreferences = async (newPrefs: Preferences): Promise<boolean> => {
    const { prefs, synced } = await api.updatePreferences(newPrefs);
    setPreferences(prefs);
    if (!synced) showNotice("Saved on this device only — couldn't reach the server.", 'info');
    else await loadSideData();
    await fetchJobsForFilter(activeRoleFilter, filterSearch);
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

  // Throws ApiError with a user-facing message; the form displays it.
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

  const openOptions = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('/options.html', '_blank');
    }
  };

  return (
    <div
      data-theme={theme}
      style={{
        width: 400,
        height: 590,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}
    >
      <Header
        status={status}
        onRetry={() => { connect(); }}
        isSyncing={isSyncing}
        stats={stats}
        onSync={handleSync}
        openOptions={openOptions}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main id="main" style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'feed' && (
          <RadarFeed
            jobs={jobs}
            loading={loading}
            preferences={preferences}
            onToggleSave={handleToggleSave}
            onConfigureTargets={() => setActiveTab('rules')}
            onSavePreferences={async (p) => { await handleSavePreferences(p); }}
            loadError={loadError}
            onRetryLoad={() => { fetchJobsForFilter(activeRoleFilter, filterSearch); }}
            activeRoleFilter={activeRoleFilter}
            setActiveRoleFilter={(r) => { setActiveRoleFilter(r); setDisplayLimit(30); }}
            filterHub={filterHub} setFilterHub={setFilterHub}
            filterExp={filterExp} setFilterExp={setFilterExp}
            filterBudget={filterBudget} setFilterBudget={setFilterBudget}
            filterSalaryOnly={filterSalaryOnly} setFilterSalaryOnly={setFilterSalaryOnly}
            filterFreshness={filterFreshness} setFilterFreshness={setFilterFreshness}
            filterRemoteOnly={filterRemoteOnly} setFilterRemoteOnly={setFilterRemoteOnly}
            filterSearch={filterSearch} setFilterSearch={setFilterSearch}
            displayLimit={displayLimit} setDisplayLimit={setDisplayLimit}
          />
        )}

        {activeTab === 'watchlist' && (
          <WatchlistView
            companies={companies}
            onToggleCompany={handleToggleCompany}
            onAddCompany={handleAddCompany}
          />
        )}

        {activeTab === 'saved' && (
          <SavedJobsView
            savedJobs={savedJobs}
            onToggleSave={handleToggleSave}
            onBrowseJobs={() => {
              setActiveRoleFilter('all_matching');
              setActiveTab('feed');
            }}
          />
        )}

        {activeTab === 'rules' && preferences && (
          <PreferencesView
            preferences={preferences}
            onSave={handleSavePreferences}
          />
        )}
      </main>

      {/* Bottom Navigation (Muzeeb Zero-Radius Brutalist) */}
      <nav aria-label="Sections" style={{
        display: 'flex',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        padding: '0 4px',
      }}>
        {[
          { id: 'feed', label: 'Radar', icon: Radio },
          { id: 'watchlist', label: 'Watchlist', icon: Building2 },
          { id: 'saved', label: 'Saved', icon: Bookmark, badge: savedJobs.length },
          { id: 'rules', label: 'Rules', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.badge ? `${tab.label}, ${tab.badge} saved` : tab.label}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                background: 'transparent',
                border: 'none',
                borderTop: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                borderRadius: 0,
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px 0 6px',
                position: 'relative',
                transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div style={{ position: 'relative' }}>
                <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} color={isActive ? 'var(--accent)' : 'currentColor'} />
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span style={{
                    position: 'absolute',
                    top: -4,
                    right: -10,
                    background: 'var(--accent)',
                    color: 'var(--on-accent)',
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 0,
                    padding: '0 4px',
                    lineHeight: '12px',
                    fontFamily: 'var(--font-mono)',
                    border: '1px solid rgba(0,0,0,0.4)',
                  }}>
                    {tab.badge}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-sans)',
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      <Notice notice={notice} onClose={clearNotice} />
    </div>
  );
};
