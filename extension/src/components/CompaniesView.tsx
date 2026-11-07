import React, { useEffect, useMemo, useState } from 'react';
import { Bell, ExternalLink, Plus, Search } from '../lib/icons';
import { useFollowedCompanies } from '../lib/followedCompanies';
import { Company } from '../types';
import { getCompanyLogoUrl } from '../lib/companyLogos';
import { safeHttpUrl } from '../lib/url';
import { EmptyState } from './EmptyState';
import { supportMailto } from '../lib/mail';
import { timeAgo } from '../lib/format';

const PAGE = 50; // render in pages: 600+ rows at once is slow

type Sort = 'az' | 'za' | 'jobs' | 'newest';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'az', label: 'Name A–Z' }, { id: 'za', label: 'Name Z–A' }, { id: 'jobs', label: 'Most open jobs' }, { id: 'newest', label: 'Newest jobs' },
];
// Short names keep a row's country list on one line
const SHORT: Record<string, string> = { 'United States': 'US', 'United Kingdom': 'UK', 'United Arab Emirates': 'UAE' };
const short = (c: string) => SHORT[c] ?? c;

interface CompaniesViewProps {
  companies: Company[];
  mutedCompanyIds: number[];
  onToggleMuted: (id: number) => void;
  large?: boolean;
  /** Connection state: lets an empty list say "can't reach Jobly" instead of "no companies". */
  offline?: boolean;
  loading?: boolean;
}

const Row: React.FC<{ company: Company; muted: boolean; onToggle: () => void; following: boolean; onFollow: () => void; large?: boolean }> = ({ company, muted, onToggle, following, onFollow, large }) => {
  const [failed, setFailed] = useState(false);
  const careers = safeHttpUrl(company.careers_url);
  return (
    <li className="card row co-row" style={{ padding: 12, gap: 12, opacity: muted ? 0.6 : 1 }}>
      <div className="logo" aria-hidden="true">
        {!failed ? <img src={getCompanyLogoUrl(company.name, company.careers_url)} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="logo-fallback">{company.name.slice(0, 1).toUpperCase()}</span>}
      </div>
      <div className="grow">
        <div className="font-medium truncate">{company.name}</div>
        <div className="text-xs muted truncate">
          {company.job_count} open role{company.job_count === 1 ? '' : 's'}
          {company.latest_posted && company.job_count > 0 ? ` · newest ${timeAgo(company.latest_posted).toLowerCase()}` : ''}
        </div>
        {(!!company.countries?.length || !!company.industry) && (
          <div className="text-xs muted truncate" title={company.countries?.length ? company.countries.join(', ') : company.industry ?? undefined}>
            {company.countries?.length ? company.countries.map(short).join(' · ') : company.industry}
          </div>
        )}
      </div>
      {careers && (
        <a className="btn btn-ghost btn-icon btn-sm" href={careers} target="_blank" rel="noopener noreferrer" aria-label={`${company.name} careers page`} title="Careers page"><ExternalLink size={14} aria-hidden="true" /></a>
      )}
      <button type="button" className={`btn btn-sm ${following ? 'btn-toggled' : 'btn-outline'}${large ? '' : ' btn-icon'}`} aria-pressed={following} onClick={onFollow}
        aria-label={`${following ? 'Following' : 'Follow'} ${company.name}`} title={following ? 'Following: alerts for every new job here' : 'Follow: get an alert for every new job here'}>
        <Bell size={14} duo={following} aria-hidden="true" />{large && (following ? 'Following' : 'Follow')}
      </button>
      <label className="row text-xs muted" style={{ gap: 6 }}>
        <input type="checkbox" className="switch" role="switch" checked={!muted} onChange={onToggle} aria-label={`Show jobs from ${company.name}`} />
        <span className="switch-label">{muted ? 'Hidden' : 'Showing'}</span>
      </label>
    </li>
  );
};

export const CompaniesView: React.FC<CompaniesViewProps> = ({ companies, mutedCompanyIds, onToggleMuted, large, offline, loading }) => {
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [error, setError] = useState<string | null>(null);
  const { followed, toggle: toggleFollow } = useFollowedCompanies();
  const [onlyFollowing, setOnlyFollowing] = useState(false);
  const [hiringOnly, setHiringOnly] = useState(true);
  const [country, setCountry] = useState('');
  const [sort, setSort] = useState<Sort>('az');
  const follow = async (id: number) => { const problem = await toggleFollow(id); if (problem) setError(problem); };

  // Countries to filter by, the ones with the most hiring companies first
  const countries = useMemo(() => {
    const n = new Map<string, number>();
    for (const c of companies) for (const k of c.countries ?? []) n.set(k, (n.get(k) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [companies]);

  useEffect(() => setVisible(PAGE), [query, hiringOnly, country, sort, onlyFollowing]);
  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    const out = companies.filter((c) => (!onlyFollowing || followed.includes(c.id)) && (!hiringOnly || c.job_count > 0)
      && (!country || (c.countries ?? []).includes(country))
      && (!q || c.name.toLowerCase().includes(q) || (c.industry || '').toLowerCase().includes(q)));
    const byName = (a: Company, b: Company) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    const cmp: Record<Sort, (a: Company, b: Company) => number> = {
      az: byName,
      za: (a, b) => byName(b, a),
      jobs: (a, b) => b.job_count - a.job_count || byName(a, b),
      newest: (a, b) => (b.latest_posted ?? '').localeCompare(a.latest_posted ?? '') || byName(a, b),
    };
    return out.sort(cmp[sort]);
  }, [companies, onlyFollowing, followed, hiringOnly, country, q, sort]);
  const filtered = onlyFollowing || hiringOnly || !!country;

  const suggest = supportMailto('Suggest a company for Jobly', ['Company name:', 'Careers page link:', '']);

  return (
    <div className="section">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Companies</h2>
          <p className="text-sm">Jobly checks {companies.length} employers. Turn a company off to hide its jobs from your list.</p>
        </div>
        <a className="btn btn-outline btn-sm" href={suggest} target="_blank" rel="noopener" title="Opens your email app"><Plus size={14} aria-hidden="true" /> Suggest a company</a>
      </div>

      {mutedCompanyIds.length > 0 && <p className="text-sm" role="status">{mutedCompanyIds.length} compan{mutedCompanyIds.length === 1 ? 'y is' : 'ies are'} hidden from your jobs.</p>}

      <div className="search">
        <Search size={16} aria-hidden="true" />
        <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${companies.length} companies…`} aria-label="Search companies" />
      </div>
      <div className="row wrap co-filters">
        <button type="button" className="chip" aria-pressed={hiringOnly} onClick={() => setHiringOnly((v) => !v)}>Hiring now</button>
        <button type="button" className="chip" aria-pressed={onlyFollowing} onClick={() => setOnlyFollowing((v) => !v)}>Following <span className="count">{followed.length}</span></button>
        {countries.length > 0 && (
          <select className={`chip chip-select${country ? ' active' : ''}`} value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country">
            <option value="">Any country</option>
            {countries.map(([name, n]) => <option key={name} value={name}>{name} ({n})</option>)}
          </select>
        )}
        <select className="chip chip-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort companies">
          {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
      <p className="text-xs muted" role="status">
        {list.length === companies.length ? `${companies.length} companies` : `${list.length} of ${companies.length} companies`}
        {country ? ` hiring in ${country}` : ''}. Follow a company to get an alert for every new job there.
      </p>
      {error && <p role="alert" className="text-sm" style={{ color: 'var(--warning)' }}>{error}</p>}

      {companies.length === 0 && loading ? (
        <ul className="stack" style={{ listStyle: 'none', gap: 8 }} aria-busy="true" aria-label="Loading companies">
          {[0, 1, 2, 3, 4].map((i) => <li key={i} className="card row" style={{ padding: 12 }}><div className="skeleton" style={{ width: 40, height: 40 }} /><div className="grow stack" style={{ gap: 6 }}><div className="skeleton" style={{ height: 14, width: '50%' }} /><div className="skeleton" style={{ height: 12, width: '30%' }} /></div></li>)}
        </ul>
      ) : companies.length === 0 && offline ? (
        <EmptyState art="offline" large={large} title="Can't load companies" description="Jobly can't reach its job list right now. The companies appear as soon as it reconnects." />
      ) : list.length === 0 ? (
        <EmptyState art="companies" large={large} title={companies.length === 0 ? 'No companies yet' : q ? `No companies match "${query}"` : 'No companies match these filters'}
          description={companies.length === 0 ? 'The company list loads when Jobly connects.' : 'Try another name, or clear the filters.'}
          actions={q || filtered ? <button type="button" className="btn" onClick={() => { setQuery(''); setOnlyFollowing(false); setHiringOnly(false); setCountry(''); }}>Clear search and filters</button> : undefined} />
      ) : (
        <>
          <ul className={large ? 'cols' : 'stack'} style={{ listStyle: 'none', gap: 8 }}>
            {list.slice(0, visible).map((c) => <Row key={c.id} company={c} muted={mutedCompanyIds.includes(c.id)} onToggle={() => onToggleMuted(c.id)} following={followed.includes(c.id)} onFollow={() => void follow(c.id)} large={large} />)}
          </ul>
          {list.length > visible && <button type="button" className="btn btn-outline" onClick={() => setVisible(visible + PAGE)}>Show more ({list.length - visible} left)</button>}
        </>
      )}
    </div>
  );
};
