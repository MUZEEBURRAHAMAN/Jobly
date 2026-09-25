import React, { useState, useMemo, useRef } from 'react';
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

  const roleTabs = [
    { id: 'all_matching', label: 'TARGET MATCHES', icon: Sparkles },
    { id: 'product_design', label: 'DESIGN', icon: Palette },
    { id: 'frontend_engineering', label: 'FRONTEND', icon: Code2 },
    { id: 'product_management', label: 'PRODUCT', icon: Layers },
    { id: 'ai_ml', label: 'AI / ML', icon: Bot },
    { id: 'fullstack_engineering', label: 'FULLSTACK', icon: Zap },
    { id: 'all', label: 'ALL ROLES', icon: Globe },
  ];

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
        {/* Top Search & Filter Bar */}
        <div style={{
          padding: '12px 20px',
          width: '100%',
        }}>
        {/* Search Bar + Toggle Filter Drawer */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="input-text"
              placeholder="Search title, company, skills, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 30, fontSize: 12, height: 34 }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn btn-sm ${activeFilterCount > 0 ? 'btn-accent' : 'btn-secondary'}`}
            style={{
              padding: '0 12px',
              fontFamily: 'var(--font-mono)',
              gap: 6,
              height: 34,
              border: activeFilterCount > 0 ? '1px solid var(--accent)' : '1px solid var(--border-subtle)'
            }}
          >
            <SlidersHorizontal size={13} />
            <span>FILTERS{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
          </button>
        </div>

        {/* Role Pills — Clean, elegant flex row without arrows */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {roleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeRoleFilter === tab.id;
            const isTargetTab = tab.id === 'all_matching';
            return (
              <div key={tab.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <button
                  onClick={() => setActiveRoleFilter(tab.id)}
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    padding: '4px 10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    borderRadius: isTargetTab && onConfigureTargets ? '2px 0 0 2px' : 2,
                  }}
                >
                  <Icon size={11} />
                  <span>{tab.label}</span>
                </button>
                {isTargetTab && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openTargetModal();
                    }}
                    title="Configure Target Roles & Matching Rules"
                    style={{
                      background: isActive ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: isActive ? '#ffffff' : 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)',
                      borderLeft: 'none',
                      padding: '4px 6px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 24,
                      borderRadius: '0 2px 2px 0',
                    }}
                  >
                    <Sliders size={10} />
                  </button>
                )}
              </div>
            );
          })}
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

      {/* Subheader: Results count & Target Roles indicator */}
      <div style={{
        padding: '8px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-primary)',
        width: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, letterSpacing: '0.04em' }}>
              {activeRoleFilter === 'all_matching' ? `TARGET MATCHES (${filteredJobs.length})` : `SHOWING ${filteredJobs.length} POSITIONS`}
            </span>
            {activeRoleFilter === 'all_matching' && (
              <button
                onClick={openTargetModal}
                style={{
                  background: 'var(--accent)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                  padding: '2px 7px',
                  borderRadius: 2,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Sliders size={9} />
                <span>EDIT TARGETS</span>
              </button>
            )}
          </div>
          {activeFilterCount > 0 && (
            <span style={{ color: 'var(--accent)' }}>
              {activeFilterCount} ACTIVE FILTER{activeFilterCount > 1 ? 'S' : ''}
            </span>
          )}
        </div>

        {/* Target role tags indicator when on target matches tab */}
        {activeRoleFilter === 'all_matching' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>MATCHING:</span>
            {currentTargetRoles.length === 0 ? (
              <span
                style={{ color: 'var(--accent)', fontSize: 9, cursor: 'pointer', fontWeight: 700 }}
                onClick={openTargetModal}
              >
                NO ROLES SET — CLICK TO CONFIGURE
              </span>
            ) : (
              currentTargetRoles.map((r) => {
                const matchedDef = AVAILABLE_TARGET_ROLES.find((d) => d.id === r);
                const label = matchedDef
                  ? matchedDef.label.replace(' ENGINEERING', '').replace(' & MACHINE LEARNING', '/ML')
                  : r;
                return (
                  <span
                    key={r}
                    onClick={openTargetModal}
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-subtle)',
                      padding: '1px 5px',
                      fontSize: 9,
                      borderRadius: 2,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                    title="Click to edit target roles"
                  >
                    {label}
                  </span>
                );
              })
            )}
          </div>
        )}
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
