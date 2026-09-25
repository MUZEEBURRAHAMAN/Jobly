import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  X,
  Palette,
  Code2,
  Layers,
  Bot,
  Zap,
  Globe,
  DollarSign,
  Banknote,
  Clock,
  Calendar,
  MapPin,
  Sliders,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Job, Preferences } from '../types';
import { JobCard } from './JobCard';

const AVAILABLE_TARGET_ROLES = [
  { id: 'product_design', label: 'PRODUCT DESIGN', sub: 'UI/UX, Design Systems, UX Research', icon: Palette },
  { id: 'frontend_engineering', label: 'FRONTEND ENGINEERING', sub: 'React, TypeScript, Web Platform, Next.js', icon: Code2 },
  { id: 'product_management', label: 'PRODUCT MANAGEMENT', sub: 'Product Manager, Technical PM, Lead PM', icon: Layers },
  { id: 'ai_ml', label: 'AI & MACHINE LEARNING', sub: 'ML Engineer, AI Researcher, Applied Scientist, LLMs', icon: Bot },
  { id: 'fullstack_engineering', label: 'FULLSTACK ENGINEERING', sub: 'Fullstack, Software Engineer, Cloud Services', icon: Zap },
];

const AVAILABLE_SENIORITIES = [
  { id: 'intern', label: 'INTERN' },
  { id: 'junior', label: '0–2Y (JUNIOR)' },
  { id: 'mid', label: '2–5Y (MID)' },
  { id: 'senior', label: '5–8Y (SENIOR)' },
  { id: 'lead', label: '8+Y (LEAD/STAFF)' },
];

interface RadarFeedProps {
  jobs: Job[];
  loading: boolean;
  preferences?: Preferences | null;
  onToggleSave: (job: Job) => void;
  onConfigureTargets?: () => void;
  onSavePreferences?: (prefs: Preferences) => Promise<void>;
  activeRoleFilter: string;
  setActiveRoleFilter: (role: string) => void;
  // Q-3: Lifted filter state props
  filterHub: string;        setFilterHub: (v: string) => void;
  filterExp: string;        setFilterExp: (v: string) => void;
  filterBudget: number;     setFilterBudget: (v: number) => void;
  filterSalaryOnly: boolean; setFilterSalaryOnly: (v: boolean) => void;
  filterFreshness: number;  setFilterFreshness: (v: number) => void;
  filterRemoteOnly: boolean; setFilterRemoteOnly: (v: boolean) => void;
  filterSearch: string;     setFilterSearch: (v: string) => void;
  // Q-2: Pagination props
  displayLimit: number;     setDisplayLimit: (v: number) => void;
}

export const RadarFeed: React.FC<RadarFeedProps> = ({
  jobs,
  loading,
  preferences,
  onToggleSave,
  onConfigureTargets,
  onSavePreferences,
  activeRoleFilter,
  setActiveRoleFilter,
  filterHub: selectedHub, setFilterHub: setSelectedHub,
  filterExp: selectedExp, setFilterExp: setSelectedExp,
  filterBudget: selectedBudget, setFilterBudget: setSelectedBudget,
  filterSalaryOnly: salaryOnly, setFilterSalaryOnly: setSalaryOnly,
  filterFreshness: freshnessDays, setFilterFreshness: setFreshnessDays,
  filterRemoteOnly: remoteOnly, setFilterRemoteOnly: setRemoteOnly,
  filterSearch: search, setFilterSearch: setSearch,
  displayLimit, setDisplayLimit,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [draftRoles, setDraftRoles] = useState<string[]>([]);
  const [draftSeniorities, setDraftSeniorities] = useState<string[]>([]);
  const [draftRemoteOnly, setDraftRemoteOnly] = useState<boolean>(false);
  const [isSavingTargets, setIsSavingTargets] = useState<boolean>(false);

  const currentTargetRoles = useMemo(() => {
    return preferences?.roles && preferences.roles.length > 0
      ? preferences.roles
      : ['product_design', 'frontend_engineering', 'product_management', 'ai_ml', 'fullstack_engineering'];
  }, [preferences?.roles]);

  const openTargetModal = () => {
    setDraftRoles(
      preferences?.roles && preferences.roles.length > 0
        ? preferences.roles
        : ['product_design', 'frontend_engineering', 'product_management', 'ai_ml', 'fullstack_engineering']
    );
    setDraftSeniorities(
      preferences?.seniorities && preferences.seniorities.length > 0
        ? preferences.seniorities
        : ['intern', 'junior', 'mid', 'senior', 'lead']
    );
    setDraftRemoteOnly(preferences?.remote_only ?? false);
    setShowTargetModal(true);
  };

  const toggleDraftRole = (roleId: string) => {
    setDraftRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const toggleDraftSeniority = (senId: string) => {
    setDraftSeniorities((prev) =>
      prev.includes(senId) ? prev.filter((s) => s !== senId) : [...prev, senId]
    );
  };

  const handleSaveTargets = async () => {
    if (onSavePreferences) {
      setIsSavingTargets(true);
      try {
        const basePrefs: Preferences = preferences || {
          roles: [],
          seniorities: ['intern', 'junior', 'mid', 'senior', 'lead'],
          locations: [],
          remote_only: false,
          custom_keywords: '',
          excluded_keywords: '',
          notify_enabled: true,
          sync_interval_mins: 30,
        };
        await onSavePreferences({
          ...basePrefs,
          roles: draftRoles,
          seniorities: draftSeniorities,
          remote_only: draftRemoteOnly,
        });
        setShowTargetModal(false);
      } finally {
        setIsSavingTargets(false);
      }
    } else if (onConfigureTargets) {
      setShowTargetModal(false);
      onConfigureTargets();
    } else {
      setShowTargetModal(false);
    }
  };

  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 3);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 3);
  }, []);

  useEffect(() => {
    checkScroll();
    const handleResize = () => checkScroll();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkScroll, jobs.length, activeRoleFilter]);

  const scrollTabs = (dir: 'left' | 'right') => {
    const el = tabsScrollRef.current;
    if (!el) return;
    const distance = 130;
    el.scrollBy({ left: dir === 'left' ? -distance : distance, behavior: 'smooth' });
    setTimeout(checkScroll, 200);
  };

  const roleTabs = [
    { id: 'all_matching', label: 'TARGET MATCHES', shortLabel: 'TARGET', icon: Sparkles },
    { id: 'product_design', label: 'DESIGN', shortLabel: 'DESIGN', icon: Palette },
    { id: 'frontend_engineering', label: 'FRONTEND', shortLabel: 'FRONTEND', icon: Code2 },
    { id: 'product_management', label: 'PRODUCT', shortLabel: 'PRODUCT', icon: Layers },
    { id: 'ai_ml', label: 'AI & MACHINE LEARNING', shortLabel: 'AI/ML', icon: Bot },
    { id: 'fullstack_engineering', label: 'FULLSTACK', shortLabel: 'FULLSTACK', icon: Zap },
    { id: 'all', label: 'ALL ROLES', shortLabel: 'ALL', icon: Globe },
  ];

  // Dynamic live count for each tab based on active filters and search
  const tabCounts = useMemo(() => {
    const targetRoles = preferences?.roles && preferences.roles.length > 0
      ? preferences.roles
      : ['product_design', 'frontend_engineering', 'product_management', 'ai_ml', 'fullstack_engineering'];

    let targetCount = 0;
    const roleCounts: Record<string, number> = {
      product_design: 0,
      frontend_engineering: 0,
      product_management: 0,
      ai_ml: 0,
      fullstack_engineering: 0,
    };

    const ALIAS_MAP: Record<string, string[]> = {
      bangalore: ['bangalore', 'bengaluru'],
      bengaluru: ['bengaluru', 'bangalore'],
      gurgaon: ['gurgaon', 'gurugram'],
      gurugram: ['gurugram', 'gurgaon'],
      delhi: ['delhi', 'delhi_ncr', 'noida', 'gurgaon', 'gurugram'],
      noida: ['noida', 'delhi', 'delhi_ncr'],
      sf: ['sf', 'san francisco', 'bay area'],
      'bay area': ['bay area', 'san francisco'],
      nyc: ['nyc', 'new york'],
      ny: ['ny', 'new york'],
    };

    jobs.forEach((job) => {
      // Remote
      if (remoteOnly && job.work_mode !== 'remote') return;
      // Hub
      if (selectedHub !== 'all' && (job.geo_hub || 'global') !== selectedHub) return;
      // Exp
      if (selectedExp !== 'all' && job.experience_tier !== selectedExp) return;
      // Budget
      if (salaryOnly && !job.salary_summary) return;
      if (selectedBudget > 0 && (job.max_salary || 0) < selectedBudget) return;
      // Freshness
      if (freshnessDays > 0) {
        const cutoff = Date.now() - freshnessDays * 24 * 60 * 60 * 1000;
        if (new Date(job.first_seen_at).getTime() < cutoff) return;
      }
      // Search
      if (search.trim()) {
        const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const corpus = `${job.title} ${job.company_name} ${job.location || ''} ${job.geo_hub || ''} ${job.normalized_role || ''} ${job.salary_summary || ''}`.toLowerCase();
        const allTokensMatch = tokens.every((token) => {
          const aliases = ALIAS_MAP[token] || [token];
          return aliases.some((a) => corpus.includes(a));
        });
        if (!allTokensMatch) return;
      }

      // Target match
      const roleMatches = job.normalized_role ? targetRoles.includes(job.normalized_role as any) : false;
      if (job.is_match || roleMatches) {
        targetCount++;
      }

      // Role specific count
      if (job.normalized_role && roleCounts[job.normalized_role] !== undefined) {
        roleCounts[job.normalized_role]++;
      }
    });

    return {
      all_matching: targetCount,
      all: jobs.length,
      ...roleCounts,
    };
  }, [jobs, preferences?.roles, search, remoteOnly, selectedHub, selectedExp, salaryOnly, selectedBudget, freshnessDays]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedHub !== 'all') count++;
    if (selectedExp !== 'all') count++;
    if (selectedBudget > 0) count++;
    if (salaryOnly) count++;
    if (freshnessDays > 0) count++;
    if (remoteOnly) count++;
    return count;
  }, [selectedHub, selectedExp, selectedBudget, salaryOnly, freshnessDays, remoteOnly]);

  const resetFilters = () => {
    setSelectedHub('all');
    setSelectedExp('all');
    setSelectedBudget(0);
    setSalaryOnly(false);
    setFreshnessDays(0);
    setRemoteOnly(false);
    setSearch('');
    setDisplayLimit(30);
    setActiveRoleFilter('all_matching');
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // ── Role / Tab filter ─────────────────────────────────────
      if (activeRoleFilter === 'all_matching') {
        const targetRoles = preferences?.roles && preferences.roles.length > 0
          ? preferences.roles
          : ['product_design', 'frontend_engineering', 'product_management', 'ai_ml', 'fullstack_engineering'];
        const roleMatches = job.normalized_role ? targetRoles.includes(job.normalized_role as any) : false;
        if (!job.is_match && !roleMatches) return false;
      } else if (activeRoleFilter !== 'all') {
        if ((job.normalized_role || '') !== activeRoleFilter) return false;
      }
      // 'all' → no role filter applied

      // Remote
      if (remoteOnly && job.work_mode !== 'remote') return false;

      // Geo Hub
      if (selectedHub !== 'all') {
        if ((job.geo_hub || 'global') !== selectedHub) return false;
      }

      // Experience Tier
      if (selectedExp !== 'all') {
        if (job.experience_tier !== selectedExp) return false;
      }

      // Budget / Salary
      if (salaryOnly && !job.salary_summary) return false;
      if (selectedBudget > 0) {
        const maxSal = job.max_salary || 0;
        if (maxSal < selectedBudget) return false;
      }

      // Freshness
      if (freshnessDays > 0) {
        const cutoff = Date.now() - freshnessDays * 24 * 60 * 60 * 1000;
        const jobTime = new Date(job.first_seen_at).getTime();
        if (jobTime < cutoff) return false;
      }

      // Search query (Multi-token match with alias expansion)
      if (search.trim()) {
        const ALIAS_MAP: Record<string, string[]> = {
          bangalore: ['bangalore', 'bengaluru'],
          bengaluru: ['bengaluru', 'bangalore'],
          gurgaon: ['gurgaon', 'gurugram'],
          gurugram: ['gurugram', 'gurgaon'],
          delhi: ['delhi', 'delhi_ncr', 'noida', 'gurgaon', 'gurugram'],
          noida: ['noida', 'delhi', 'delhi_ncr'],
          sf: ['sf', 'san francisco', 'bay area'],
          'bay area': ['bay area', 'san francisco'],
          nyc: ['nyc', 'new york'],
          ny: ['ny', 'new york'],
        };
        const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const corpus = `${job.title} ${job.company_name} ${job.location || ''} ${job.geo_hub || ''} ${job.normalized_role || ''} ${job.salary_summary || ''}`.toLowerCase();
        const allTokensMatch = tokens.every((token) => {
          const aliases = ALIAS_MAP[token] || [token];
          return aliases.some((a) => corpus.includes(a));
        });
        if (!allTokensMatch) return false;
      }

      return true;
    });
  }, [jobs, activeRoleFilter, preferences, remoteOnly, selectedHub, selectedExp, selectedBudget, salaryOnly, freshnessDays, search]);

  return (
    <div style={{ width: '100%' }}>
      {/* Sticky Header: Search Bar + Role Pills + Target Match Indicator */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        width: '100%',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      }}>
        {/* Compact Search & Arrow Tabs Bar */}
        <div style={{
          padding: '8px 12px 6px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {/* Row 1: Search Input + Filter Drawer Button */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={13}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                className="input-text"
                placeholder="Search jobs, skills, cities (e.g. noida, react)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 28, paddingRight: search ? 28 : 8, fontSize: 11.5, height: 30, width: '100%' }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 2,
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`btn btn-sm ${activeFilterCount > 0 ? 'btn-accent' : 'btn-secondary'}`}
              style={{
                padding: '0 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                gap: 4,
                height: 30,
                flexShrink: 0,
                border: activeFilterCount > 0 ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
              }}
            >
              <SlidersHorizontal size={11} />
              <span>FILTERS{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
            </button>
          </div>

          {/* Row 2: Single-Row Arrow-Navigated Role Tabs Carousel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
            {/* Left Scroll Arrow */}
            <button
              type="button"
              onClick={() => scrollTabs('left')}
              disabled={!canScrollLeft}
              title="Scroll tabs left"
              style={{
                width: 20,
                height: 26,
                minWidth: 20,
                flexShrink: 0,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canScrollLeft ? 'pointer' : 'default',
                opacity: canScrollLeft ? 1 : 0.25,
                color: 'var(--text-primary)',
                padding: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <ChevronLeft size={12} />
            </button>

            {/* Scrollable Tabs Container */}
            <div
              ref={tabsScrollRef}
              onScroll={checkScroll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                flex: 1,
                scrollBehavior: 'smooth',
                padding: '1px 0',
              }}
            >
              {roleTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeRoleFilter === tab.id;
                const isTargetTab = tab.id === 'all_matching';
                const count = tabCounts[tab.id as keyof typeof tabCounts] ?? 0;

                return (
                  <div key={tab.id} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRoleFilter(tab.id);
                        setDisplayLimit(30);
                      }}
                      className={`filter-pill ${isActive ? 'active' : ''}`}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9.5,
                        padding: '3px 8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        borderRadius: 0,
                        height: 26,
                        border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                        background: isActive ? 'var(--accent)' : 'var(--bg-card)',
                        color: isActive ? '#ffffff' : 'var(--text-secondary)',
                        fontWeight: isActive ? 700 : 500,
                        letterSpacing: '0.03em',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Icon size={10} color={isActive ? '#ffffff' : 'var(--accent)'} />
                      <span>{tab.shortLabel}</span>
                      <span style={{
                        fontSize: 8.5,
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        padding: '0 4px',
                        lineHeight: '13px',
                        borderRadius: 0,
                        background: isActive ? 'rgba(0, 0, 0, 0.25)' : 'var(--bg-tertiary)',
                        color: isActive ? '#ffffff' : 'var(--accent)',
                        border: isActive ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid var(--border-subtle)',
                      }}>
                        {count}
                      </span>
                    </button>

                    {isTargetTab && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openTargetModal();
                        }}
                        title="Configure Target Roles & Rules"
                        style={{
                          background: isActive ? 'var(--accent)' : 'var(--bg-card)',
                          color: isActive ? '#ffffff' : 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                          borderLeft: 'none',
                          padding: '0 5px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: 26,
                          borderRadius: 0,
                          flexShrink: 0,
                        }}
                      >
                        <Sliders size={10} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right Scroll Arrow */}
            <button
              type="button"
              onClick={() => scrollTabs('right')}
              disabled={!canScrollRight}
              title="Scroll tabs right"
              style={{
                width: 20,
                height: 26,
                minWidth: 20,
                flexShrink: 0,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canScrollRight ? 'pointer' : 'default',
                opacity: canScrollRight ? 1 : 0.25,
                color: 'var(--text-primary)',
                padding: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <ChevronRight size={12} />
            </button>
          </div>

        {/* Expandable Advanced Filter Drawer (Clean SVG Icons, Zero Emojis) */}
        {showFilters && (
          <div className="filter-drawer" style={{ marginTop: 10 }}>
            {/* Row 1: Location Hubs */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span className="eyebrow">LOCATION & REGIONAL HUBS</span>
                {activeFilterCount > 0 && (
                  <button
                    onClick={resetFilters}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <RotateCcw size={10} /> RESET ALL
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'ANYWHERE' },
                  { id: 'us', label: 'US & CAN' },
                  { id: 'india', label: 'INDIA' },
                  { id: 'europe', label: 'EUROPE' },
                  { id: 'apac', label: 'APAC' },
                ].map((hub) => (
                  <button
                    key={hub.id}
                    onClick={() => setSelectedHub(hub.id)}
                    className={`filter-pill ${selectedHub === hub.id ? 'active' : ''}`}
                    style={{ fontSize: 10, padding: '3px 8px' }}
                  >
                    {hub.label}
                  </button>
                ))}

                <button
                  onClick={() => setRemoteOnly(!remoteOnly)}
                  className={`filter-pill ${remoteOnly ? 'active' : ''}`}
                  style={{ fontSize: 10, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Globe size={10} />
                  <span>REMOTE ONLY</span>
                </button>
              </div>
            </div>

            {/* Row 2: Experience / Years */}
            <div>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>EXPERIENCE TIER</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'ALL LEVELS' },
                  { id: '0-2', label: '0–2Y (ENTRY)' },
                  { id: '2-5', label: '2–5Y (MID)' },
                  { id: '5-8', label: '5–8Y (SENIOR)' },
                  { id: '8+', label: '8+Y (LEAD/STAFF)' },
                ].map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => setSelectedExp(exp.id)}
                    className={`filter-pill ${selectedExp === exp.id ? 'active' : ''}`}
                    style={{ fontSize: 10, padding: '3px 8px' }}
                  >
                    {exp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 3: Compensation / Budget */}
            <div>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>BUDGET & COMPENSATION</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelectedBudget(0)}
                  className={`filter-pill ${selectedBudget === 0 ? 'active' : ''}`}
                  style={{ fontSize: 10, padding: '3px 8px' }}
                >
                  ANY BUDGET
                </button>

                {[
                  { min: 150000, label: '$150K+' },
                  { min: 200000, label: '$200K+' },
                  { min: 250000, label: '$250K+' },
                ].map((b) => (
                  <button
                    key={b.min}
                    onClick={() => setSelectedBudget(b.min)}
                    className={`filter-pill ${selectedBudget === b.min ? 'active' : ''}`}
                    style={{ fontSize: 10, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <DollarSign size={10} strokeWidth={2.4} />
                    <span>{b.label}</span>
                  </button>
                ))}

                <button
                  onClick={() => setSalaryOnly(!salaryOnly)}
                  className={`filter-pill ${salaryOnly ? 'active' : ''}`}
                  style={{ fontSize: 10, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Banknote size={10} />
                  <span>SALARY DISCLOSED</span>
                </button>
              </div>
            </div>

            {/* Row 4: Freshness */}
            <div>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>POSTING FRESHNESS</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setFreshnessDays(0)}
                  className={`filter-pill ${freshnessDays === 0 ? 'active' : ''}`}
                  style={{ fontSize: 10, padding: '3px 8px' }}
                >
                  ANY TIME
                </button>

                <button
                  onClick={() => setFreshnessDays(1)}
                  className={`filter-pill ${freshnessDays === 1 ? 'active' : ''}`}
                  style={{ fontSize: 10, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Clock size={10} />
                  <span>&lt; 24H</span>
                </button>

                <button
                  onClick={() => setFreshnessDays(3)}
                  className={`filter-pill ${freshnessDays === 3 ? 'active' : ''}`}
                  style={{ fontSize: 10, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Calendar size={10} />
                  <span>LAST 3 DAYS</span>
                </button>

                <button
                  onClick={() => setFreshnessDays(7)}
                  className={`filter-pill ${freshnessDays === 7 ? 'active' : ''}`}
                  style={{ fontSize: 10, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Calendar size={10} />
                  <span>THIS WEEK</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

        {/* Ultra-thin Status Strip (Height ~22px) */}
        <div style={{
          padding: '4px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 9.5,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-primary)',
          width: '100%',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
              {filteredJobs.length} POSITIONS
            </span>
            {search.trim() && (
              <span style={{ color: 'var(--accent)' }}>
                FOR "{search.trim().toUpperCase()}"
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeRoleFilter === 'all_matching' && (
              <button
                type="button"
                onClick={openTargetModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: 9,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Sliders size={9} />
                <span>{currentTargetRoles.length} TARGET DISCIPLINES</span>
              </button>
            )}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 9,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                RESET ({activeFilterCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Job Cards Stream (Full Width) */}
      <div style={{ padding: '16px 20px', width: '100%' }}>
        {loading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            SCANNING LIVE ATS RADARS...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div style={{
            padding: '36px 20px',
            textAlign: 'center',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            width: '100%',
          }}>
            {search.trim() ? (
              // Edge Case 1: Search returned 0 results
              <>
                <Search size={24} color="var(--accent)" style={{ margin: '0 auto 10px', display: 'block' }} />
                <span className="eyebrow" style={{ fontSize: 9.5, color: 'var(--accent)', display: 'block', marginBottom: 4 }}>
                  0 SEARCH MATCHES
                </span>
                <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  No Positions Match "{search.trim()}"
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14, maxWidth: 360, margin: '6px auto 14px', lineHeight: 1.4 }}>
                  {activeRoleFilter !== 'all'
                    ? `Zero listings found in ${roleTabs.find((t) => t.id === activeRoleFilter)?.label || 'this role'} for "${search.trim()}". Search across all 20,000+ listings or clear your query.`
                    : `Zero listings found matching "${search.trim()}". Try searching by another city (e.g. "Bangalore", "Noida", "Remote"), company name, or tech stack.`}
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setSearch('')}
                    className="btn btn-primary btn-sm"
                    style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                  >
                    <X size={12} />
                    <span>CLEAR SEARCH</span>
                  </button>
                  {activeRoleFilter !== 'all' && (
                    <button
                      onClick={() => setActiveRoleFilter('all')}
                      className="btn btn-secondary btn-sm"
                      style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                    >
                      <Globe size={12} />
                      <span>SEARCH ALL 20,000+ JOBS</span>
                    </button>
                  )}
                  {activeFilterCount > 0 && (
                    <button
                      onClick={resetFilters}
                      className="btn btn-secondary btn-sm"
                      style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                    >
                      <RotateCcw size={12} />
                      <span>RESET FILTERS</span>
                    </button>
                  )}
                </div>
              </>
            ) : activeRoleFilter === 'all_matching' && preferences?.roles && preferences.roles.length === 0 ? (
              // Edge Case 2: Target Matches active, but 0 roles selected
              <>
                <Sliders size={24} color="var(--accent)" style={{ margin: '0 auto 10px', display: 'block' }} />
                <span className="eyebrow" style={{ fontSize: 9.5, color: 'var(--accent)', display: 'block', marginBottom: 4 }}>
                  TARGET RADAR · STANDBY
                </span>
                <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  No Target Disciplines Selected
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14, maxWidth: 360, margin: '6px auto 14px', lineHeight: 1.4 }}>
                  Your Target Matches radar is paused because no disciplines are selected. Select your target roles to begin live automated matching.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={openTargetModal}
                    className="btn btn-primary btn-sm"
                    style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                  >
                    <Sliders size={12} />
                    <span>SELECT TARGET ROLES</span>
                  </button>
                  <button
                    onClick={() => {
                      resetFilters();
                      setActiveRoleFilter('all');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                  >
                    <Globe size={12} />
                    <span>VIEW ALL 20,000+ JOBS</span>
                  </button>
                </div>
              </>
            ) : activeRoleFilter === 'all_matching' ? (
              // Edge Case 3: Target Matches active, but no items match current rules/filters
              <>
                <Sparkles size={24} color="var(--accent)" style={{ margin: '0 auto 10px', display: 'block' }} />
                <span className="eyebrow" style={{ fontSize: 9.5, color: 'var(--accent)', display: 'block', marginBottom: 4 }}>
                  TARGET RADAR ACTIVE
                </span>
                <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  No Positions Match Target Rules
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14, maxWidth: 360, margin: '6px auto 14px', lineHeight: 1.4 }}>
                  Your radar is scanning for {currentTargetRoles.length} target disciplines. No listings currently meet your seniority, hub, or budget criteria.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={openTargetModal}
                    className="btn btn-primary btn-sm"
                    style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                  >
                    <Sliders size={12} />
                    <span>ADJUST TARGET RULES</span>
                  </button>
                  <button
                    onClick={() => {
                      resetFilters();
                      setActiveRoleFilter('all');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                  >
                    <Globe size={12} />
                    <span>VIEW ALL 20,000+ JOBS</span>
                  </button>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={resetFilters}
                      className="btn btn-secondary btn-sm"
                      style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                    >
                      <RotateCcw size={12} />
                      <span>RESET FILTERS</span>
                    </button>
                  )}
                </div>
              </>
            ) : activeFilterCount > 0 ? (
              // Edge Case 4: Active filters excluded all jobs
              <>
                <SlidersHorizontal size={24} color="var(--accent)" style={{ margin: '0 auto 10px', display: 'block' }} />
                <span className="eyebrow" style={{ fontSize: 9.5, color: 'var(--accent)', display: 'block', marginBottom: 4 }}>
                  FILTER EXCLUSION
                </span>
                <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  No Positions Match Active Filters
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14, maxWidth: 360, margin: '6px auto 14px', lineHeight: 1.4 }}>
                  Active hub, budget, or experience filters excluded all listings in {roleTabs.find((t) => t.id === activeRoleFilter)?.label || 'this category'}.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={resetFilters}
                    className="btn btn-primary btn-sm"
                    style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                  >
                    <RotateCcw size={12} />
                    <span>RESET ALL FILTERS</span>
                  </button>
                  <button
                    onClick={() => {
                      resetFilters();
                      setActiveRoleFilter('all');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                  >
                    <Globe size={12} />
                    <span>VIEW ALL 20,000+ JOBS</span>
                  </button>
                </div>
              </>
            ) : (
              // Edge Case 5: Empty category stream
              <>
                <Globe size={24} color="var(--text-muted)" style={{ margin: '0 auto 10px', display: 'block' }} />
                <span className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  FEED STREAM EMPTY
                </span>
                <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  No Positions In Stream
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14, maxWidth: 360, margin: '6px auto 14px', lineHeight: 1.4 }}>
                  No listings found for this category. Expand to view all 20,000+ opportunities across 357 monitored employers.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      resetFilters();
                      setActiveRoleFilter('all');
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                  >
                    <Globe size={12} />
                    <span>VIEW ALL 20,000+ JOBS</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {filteredJobs.slice(0, displayLimit).map((j) => (
              <JobCard key={`${j.source_type}-${j.external_id}`} job={j} onToggleSave={onToggleSave} />
            ))}
            {/* Q-2 FIX: Load More button */}
            {filteredJobs.length > displayLimit && (
              <div style={{ textAlign: 'center', paddingTop: 8 }}>
                <button
                  onClick={() => setDisplayLimit(displayLimit + 30)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontFamily: 'var(--font-mono)', width: '100%' }}
                >
                  LOAD MORE ({filteredJobs.length - displayLimit} REMAINING)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Target Settings Modal / Drawer */}
      {showTargetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
          }}
          onClick={() => setShowTargetModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-strong)',
              width: '100%',
              maxWidth: 360,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color="var(--accent)" />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
                  TARGET ROLES & RULES
                </span>
              </div>
              <button
                onClick={() => setShowTargetModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
              >
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
              Select which disciplines Jobly matches on your radar. Jobs matching these roles will appear under <strong>TARGET MATCHES</strong>.
            </p>

            {/* Target Disciplines */}
            <div>
              <span className="eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 8 }}>
                TARGET DISCIPLINES ({draftRoles.length} SELECTED)
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {AVAILABLE_TARGET_ROLES.map((role) => {
                  const isChecked = draftRoles.includes(role.id);
                  const Icon = role.icon;
                  return (
                    <div
                      key={role.id}
                      onClick={() => toggleDraftRole(role.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: isChecked ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                        border: isChecked ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all var(--t-fast) var(--ease)',
                        borderRadius: 2,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon size={13} color={isChecked ? 'var(--accent)' : 'var(--text-muted)'} />
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {role.label}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                            {role.sub}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        width: 16,
                        height: 16,
                        border: isChecked ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
                        background: isChecked ? 'var(--accent)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 2,
                        flexShrink: 0,
                      }}>
                        {isChecked && <Check size={11} color="#ffffff" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Seniority */}
            <div>
              <span className="eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 8 }}>
                EXPERIENCE LEVEL
              </span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {AVAILABLE_SENIORITIES.map((sen) => {
                  const isChecked = draftSeniorities.includes(sen.id);
                  return (
                    <button
                      key={sen.id}
                      type="button"
                      onClick={() => toggleDraftSeniority(sen.id)}
                      style={{
                        padding: '4px 8px',
                        fontSize: 9,
                        fontFamily: 'var(--font-mono)',
                        fontWeight: isChecked ? 700 : 400,
                        background: isChecked ? 'var(--accent)' : 'var(--bg-tertiary)',
                        color: isChecked ? '#ffffff' : 'var(--text-secondary)',
                        border: '1px solid ' + (isChecked ? 'var(--accent)' : 'var(--border-subtle)'),
                        cursor: 'pointer',
                        borderRadius: 2,
                      }}
                    >
                      {sen.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Remote Only */}
            <div
              onClick={() => setDraftRemoteOnly(!draftRemoteOnly)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                borderRadius: 2,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>REMOTE ONLY</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Only match 100% remote positions</div>
              </div>
              <div style={{
                width: 16,
                height: 16,
                border: draftRemoteOnly ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
                background: draftRemoteOnly ? 'var(--accent)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 2,
              }}>
                {draftRemoteOnly && <Check size={11} color="#ffffff" />}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveTargets}
              disabled={isSavingTargets}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '8px',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {isSavingTargets ? 'SAVING TARGETS...' : 'SAVE & UPDATE RADAR'}
            </button>

            {/* Advanced Rules link */}
            {onConfigureTargets && (
              <button
                type="button"
                onClick={() => {
                  setShowTargetModal(false);
                  onConfigureTargets();
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: '2px 0',
                }}
              >
                OPEN FULL RULES TAB (KEYWORDS & EXCLUSIONS) →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
