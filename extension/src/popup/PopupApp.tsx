import React, { useEffect, useState, useCallback } from 'react';
import { Radio, Building2, Bookmark, Sliders } from 'lucide-react';
import { api } from '../lib/api';
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
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeRoleFilter, setActiveRoleFilter] = useState<string>('all_matching');

  // Lifted filter state (same pattern as OptionsApp)
  const [filterHub, setFilterHub] = useState<string>('all');
  const [filterExp, setFilterExp] = useState<string>('all');
  const [filterBudget, setFilterBudget] = useState<number>(0);
  const [filterSalaryOnly, setFilterSalaryOnly] = useState<boolean>(false);
  const [filterFreshness, setFilterFreshness] = useState<number>(0);
  const [filterRemoteOnly, setFilterRemoteOnly] = useState<boolean>(false);
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [displayLimit, setDisplayLimit] = useState<number>(30);

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
    setLoading(true);
    try {
      const isMatchingOnly = roleFilter === 'all_matching';
      const specificRole = !isMatchingOnly && roleFilter !== 'all' ? roleFilter : undefined;

      const jobsData = await api.getJobs({
        role: specificRole,
        only_matching: isMatchingOnly,
        search: searchQuery?.trim() || undefined,
        limit: 150,
      });

      setJobs(jobsData.items);
    } catch {
      setIsOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      const online = await api.checkHealth();
      setIsOnline(online);

      const [prefsData, companiesData, statsData, savedData] = await Promise.all([
        api.getPreferences(),
        api.getCompanies(),
        api.getStats(),
        api.getJobs({ saved_only: true, limit: 100 }),
      ]);

      setPreferences(prefsData);
      setCompanies(companiesData);
      setStats(statsData);
      setSavedJobs(savedData.items);
    } catch {
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Fetch jobs whenever role filter or search query changes (debounced 250ms)
  useEffect(() => {
    if (activeTab !== 'feed') return;
    const timer = setTimeout(() => {
      fetchJobsForFilter(activeRoleFilter, filterSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [activeTab, activeRoleFilter, filterSearch, fetchJobsForFilter]);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const startTime = Date.now();
    try {
      // 1. Kick off background ATS sync on backend asynchronously
      api.triggerSync().catch(() => {});

      // 2. Notify background service worker safely
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          chrome.runtime.sendMessage({ type: 'TRIGGER_BACKGROUND_CHECK' }, () => {
            if (chrome.runtime?.lastError) {}
          });
        } catch {}
      }

      // 3. Immediately reload all radar data & current filtered jobs stream
      await Promise.all([
        loadInitialData(),
        fetchJobsForFilter(activeRoleFilter, filterSearch),
      ]);
    } catch {
      // Keep current health status
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
    await loadInitialData();
    await fetchJobsForFilter(activeRoleFilter);
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
        isOnline={isOnline}
        isSyncing={isSyncing}
        stats={stats}
        onSync={handleSync}
        openOptions={openOptions}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'feed' && (
          <RadarFeed
            jobs={jobs}
            loading={loading}
            preferences={preferences}
            onToggleSave={handleToggleSave}
            onConfigureTargets={() => setActiveTab('rules')}
            onSavePreferences={handleSavePreferences}
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
      </div>

      {/* Bottom Navigation (Muzeeb Zero-Radius Brutalist) */}
      <nav style={{
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
                    color: '#ffffff',
                    fontSize: 9,
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
                fontSize: 9.5,
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
    </div>
  );
};
