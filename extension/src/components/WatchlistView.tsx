import React, { useState } from 'react';
import { Plus, Search, ExternalLink, X, Bot, Sparkles, Building2 } from 'lucide-react';
import { Company } from '../types';
import { getCompanyLogoUrl } from '../lib/companyLogos';

interface WatchlistViewProps {
  companies: Company[];
  onToggleCompany: (id: number) => Promise<void>;
  onAddCompany: (data: {
    name: string;
    careers_url?: string;
    source_type: string;
    source_identifier: string;
    industry?: string;
  }) => Promise<void>;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  companies,
  onToggleCompany,
  onAddCompany,
}) => {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'ai' | 'unicorn' | 'enterprise'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [careersUrl, setCareersUrl] = useState('');
  const [sourceType, setSourceType] = useState('greenhouse');
  const [sourceId, setSourceId] = useState('');
  const [industry, setIndustry] = useState('');
  const [adding, setAdding] = useState(false);

  const filtered = companies.filter((c) => {
    // Search query
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.industry || '').toLowerCase().includes(search.toLowerCase()) ||
      c.source_type.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;

    // Tier filter
    if (tierFilter === 'ai') {
      const isAi = (c.industry || '').toLowerCase().includes('ai') || (c.industry || '').toLowerCase().includes('intelligence');
      if (!isAi) return false;
    } else if (tierFilter === 'enterprise') {
      const isEnt = c.source_type === 'workday' || c.source_type === 'amazon' || ['nvidia', 'adobe', 'salesforce', 'amazon'].includes(c.slug);
      if (!isEnt) return false;
    } else if (tierFilter === 'unicorn') {
      const isUnicorn = c.source_type === 'lever' || ['stripe', 'figma', 'linear', 'ramp', 'notion', 'meesho', 'paytm', 'cred', 'razorpay'].includes(c.slug);
      if (!isUnicorn) return false;
    }

    return true;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sourceId.trim()) return;
    setAdding(true);
    try {
      await onAddCompany({
        name: name.trim(),
        careers_url: careersUrl.trim() || undefined,
        source_type: sourceType,
        source_identifier: sourceId.trim(),
        industry: industry.trim() || undefined,
      });
      setName('');
      setCareersUrl('');
      setSourceId('');
      setIndustry('');
      setShowAddForm(false);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={{ padding: '16px', width: '100%' }}>
      {/* Header and Add Action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <span className="eyebrow">COMPANY WATCHLIST</span>
          <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em', marginTop: 2, color: 'var(--text-primary)' }}>
            Monitored Employers ({companies.length})
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Toggle tracking or connect custom company ATS boards
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`btn btn-sm ${showAddForm ? 'btn-secondary' : 'btn-primary'}`}
          style={{ gap: 4 }}
        >
          {showAddForm ? <X size={12} /> : <Plus size={12} />}
          <span>{showAddForm ? 'CANCEL' : 'ADD ATS BOARD'}</span>
        </button>
      </div>

      {/* Add Company Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            padding: 14,
            marginBottom: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            width: '100%',
          }}
        >
          <span className="eyebrow">CONNECT NEW EMPLOYER ATS</span>

          <input
            type="text"
            className="input-text"
            placeholder="Company Name (e.g. Supabase)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="input-text"
              style={{ width: '45%' }}
            >
              <option value="greenhouse">Greenhouse</option>
              <option value="lever">Lever</option>
              <option value="ashby">Ashby</option>
              <option value="workday">Workday</option>
            </select>

            <input
              type="text"
              className="input-text"
              placeholder="Board Token (e.g. supabase)"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              required
              style={{ width: '55%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="input-text"
              placeholder="Industry (e.g. Developer Tools)"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              style={{ width: '50%' }}
            />
            <input
              type="url"
              className="input-text"
              placeholder="Careers URL (optional)"
              value={careersUrl}
              onChange={(e) => setCareersUrl(e.target.value)}
              style={{ width: '50%' }}
            />
          </div>

          <button
            type="submit"
            disabled={adding}
            className="btn btn-primary btn-sm"
            style={{ width: '100%', height: 34 }}
          >
            {adding ? 'CONNECTING ATS BOARD...' : 'CONFIRM & START TRACKING'}
          </button>
        </form>
      )}

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: 10, width: '100%' }}>
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
          placeholder={`Search ${companies.length} monitored employers...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 30, paddingRight: search ? 30 : 12, fontSize: 12, height: 34, width: '100%' }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            style={{
              position: 'absolute',
              right: 8,
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
            <X size={13} />
          </button>
        )}
      </div>

      {/* Tier Filter Pills (Zero Emojis, Real Lucide Icons) */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, scrollbarWidth: 'none', width: '100%' }}>
        <button
          onClick={() => setTierFilter('all')}
          className={`filter-pill ${tierFilter === 'all' ? 'active' : ''}`}
          style={{ fontSize: 10, padding: '4px 9px' }}
        >
          ALL ({companies.length})
        </button>

        <button
          onClick={() => setTierFilter('ai')}
          className={`filter-pill ${tierFilter === 'ai' ? 'active' : ''}`}
          style={{ fontSize: 10, padding: '4px 9px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Bot size={11} />
          <span>AI LABS</span>
        </button>

        <button
          onClick={() => setTierFilter('unicorn')}
          className={`filter-pill ${tierFilter === 'unicorn' ? 'active' : ''}`}
          style={{ fontSize: 10, padding: '4px 9px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Sparkles size={11} />
          <span>UNICORNS</span>
        </button>

        <button
          onClick={() => setTierFilter('enterprise')}
          className={`filter-pill ${tierFilter === 'enterprise' ? 'active' : ''}`}
          style={{ fontSize: 10, padding: '4px 9px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Building2 size={11} />
          <span>BIG TECH</span>
        </button>
      </div>

      {/* Company List with Real Logos or Contextual Empty States */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: '36px 20px',
            textAlign: 'center',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            width: '100%',
          }}>
            {search.trim() ? (
              // Edge Case 1: Search returned 0 companies
              <>
                <Building2 size={24} color="var(--accent)" style={{ margin: '0 auto 10px', display: 'block' }} />
                <span className="eyebrow" style={{ fontSize: 9.5, color: 'var(--accent)', display: 'block', marginBottom: 4 }}>
                  UNMONITORED EMPLOYER
                </span>
                <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  No Employers Matching "{search.trim()}"
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14, maxWidth: 360, margin: '6px auto 14px', lineHeight: 1.4 }}>
                  We are not tracking "{search.trim()}" in your local directory yet. You can connect their Greenhouse, Lever, Ashby, or Workday ATS board right now.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setName(search.trim());
                      setShowAddForm(true);
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                  >
                    <Plus size={12} />
                    <span>CONNECT "{search.trim().toUpperCase()}" ATS</span>
                  </button>
                  <button
                    onClick={() => setSearch('')}
                    className="btn btn-secondary btn-sm"
                    style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                  >
                    <X size={12} />
                    <span>CLEAR SEARCH</span>
                  </button>
                </div>
              </>
            ) : tierFilter !== 'all' ? (
              // Edge Case 2: Tier filter returned 0 companies
              <>
                <Building2 size={24} color="var(--accent)" style={{ margin: '0 auto 10px', display: 'block' }} />
                <span className="eyebrow" style={{ fontSize: 9.5, color: 'var(--accent)', display: 'block', marginBottom: 4 }}>
                  CATEGORY EMPTY
                </span>
                <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  No Employers in this Category
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14, maxWidth: 360, margin: '6px auto 14px', lineHeight: 1.4 }}>
                  No monitored employers found under the {tierFilter.toUpperCase()} tier filter.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setTierFilter('all')}
                    className="btn btn-secondary btn-sm"
                    style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                  >
                    <span>VIEW ALL {companies.length} MONITORED EMPLOYERS</span>
                  </button>
                </div>
              </>
            ) : (
              // Edge Case 3: Zero companies in directory
              <>
                <Building2 size={24} color="var(--text-muted)" style={{ margin: '0 auto 10px', display: 'block' }} />
                <span className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  WATCHLIST EMPTY
                </span>
                <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  No Monitored Employers
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14, maxWidth: 360, margin: '6px auto 14px', lineHeight: 1.4 }}>
                  Your employer watchlist is empty. Connect an ATS board to begin tracking postings directly.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="btn btn-primary btn-sm"
                    style={{ gap: 6, fontFamily: 'var(--font-mono)' }}
                  >
                    <Plus size={12} />
                    <span>CONNECT ATS BOARD</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          filtered.map((company) => {
            const logo = getCompanyLogoUrl(company.name, company.careers_url);
            return (
              <div
                key={company.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  opacity: company.is_active ? 1 : 0.45,
                  transition: 'all var(--t-fast) var(--ease)',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Real Company Website Logo */}
                  <div style={{
                    width: 32,
                    height: 32,
                    minWidth: 32,
                    background: '#ffffff',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    padding: 2,
                  }}>
                    <img
                      src={logo}
                      alt={company.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                      loading="lazy"
                    />
                    <div style={{
                      display: 'none',
                      width: '100%',
                      height: '100%',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      fontSize: 12,
                      color: 'var(--accent)',
                      background: 'var(--bg-tertiary)',
                    }}>
                      {company.name.slice(0, 1).toUpperCase()}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                        {company.name}
                      </span>
                      <span className="badge badge-gray" style={{ fontSize: 8, padding: '1px 4px' }}>
                        {company.source_type}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>
                      {company.industry || 'Tech'} · {company.job_count} LIVE OPENINGS
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {company.careers_url && (
                    <a
                      href={company.careers_url}
                      target="_blank"
                      rel="noreferrer"
                      title="Official Career Page"
                      style={{ color: 'var(--text-muted)', display: 'inline-flex' }}
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}

                  <button
                    onClick={() => onToggleCompany(company.id)}
                    className={`filter-pill ${company.is_active ? 'active' : ''}`}
                    style={{ fontSize: 9, padding: '3px 8px' }}
                  >
                    {company.is_active ? 'TRACKING' : 'MUTED'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
