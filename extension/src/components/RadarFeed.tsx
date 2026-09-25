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
} from 'lucide-react';
import { Job, Preferences } from '../types';
import { JobCard } from './JobCard';

interface RadarFeedProps {
  jobs: Job[];
  loading: boolean;
  preferences?: Preferences | null;
  onToggleSave: (job: Job) => void;
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

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = job.title.toLowerCase().includes(q);
        const matchesComp = job.company_name.toLowerCase().includes(q);
        const matchesLoc = (job.location || '').toLowerCase().includes(q);
        const matchesSal = (job.salary_summary || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesComp && !matchesLoc && !matchesSal) return false;
      }

      return true;
    });
  }, [jobs, activeRoleFilter, preferences, remoteOnly, selectedHub, selectedExp, selectedBudget, salaryOnly, freshnessDays, search]);

  return (
    <div style={{ width: '100%' }}>
      {/* Top Search & Filter Bar */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
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
            return (
              <button
                key={tab.id}
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
                  borderRadius: 2,
                }}
              >
                <Icon size={11} />
                <span>{tab.label}</span>
              </button>
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

      {/* Subheader: Results count */}
      <div style={{
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-primary)',
        width: '100%',
      }}>
        <span>SHOWING {filteredJobs.length} VERIFIED POSITIONS</span>
        {activeFilterCount > 0 && (
          <span style={{ color: 'var(--accent)' }}>
            {activeFilterCount} ACTIVE FILTER{activeFilterCount > 1 ? 'S' : ''}
          </span>
        )}
      </div>

      {/* Job Cards Stream (Full Width) */}
      <div style={{ padding: '12px 16px', width: '100%' }}>
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
            <Sparkles size={24} color="var(--accent)" style={{ margin: '0 auto 10px', display: 'block' }} />
            <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              No Positions Match Current Filters
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginBottom: 12 }}>
              Try broadening your location hub, budget tier, or search keywords.
            </p>
            <button
              onClick={resetFilters}
              className="btn btn-secondary btn-sm"
              style={{ margin: '0 auto' }}
            >
              RESET ALL FILTERS
            </button>
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
    </div>
  );
};
