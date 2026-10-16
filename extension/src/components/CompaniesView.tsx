import React, { useEffect, useState } from 'react';
import { ExternalLink, Plus, Search, X } from 'lucide-react';
import { Company } from '../types';
import { getCompanyLogoUrl } from '../lib/companyLogos';
import { safeHttpUrl } from '../lib/url';
import { EmptyState } from './EmptyState';

const PAGE = 50; // render in pages: 600+ rows at once is slow

interface CompaniesViewProps {
  companies: Company[];
  mutedCompanyIds: number[];
  onToggleMuted: (id: number) => void;
  /** Adding companies changes the shared list, so only owners/dev builds get the form. */
  canManage: boolean;
  onAddCompany: (data: { name: string; careers_url?: string; source_type: string; source_identifier: string; industry?: string }) => Promise<void>;
  large?: boolean;
  /** Connection state: lets an empty list say "can't reach Jobly" instead of "no companies". */
  offline?: boolean;
  loading?: boolean;
}

const Row: React.FC<{ company: Company; muted: boolean; onToggle: () => void }> = ({ company, muted, onToggle }) => {
  const [failed, setFailed] = useState(false);
  const careers = safeHttpUrl(company.careers_url);
  return (
    <li className="card row" style={{ padding: 12, gap: 12, opacity: muted ? 0.6 : 1 }}>
      <div className="logo" aria-hidden="true">
        {!failed ? <img src={getCompanyLogoUrl(company.name, company.careers_url)} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="logo-fallback">{company.name.slice(0, 1).toUpperCase()}</span>}
      </div>
      <div className="grow">
        <div className="font-medium truncate">{company.name}</div>
        <div className="text-xs muted">{company.job_count} open role{company.job_count === 1 ? '' : 's'}{company.industry ? ` · ${company.industry}` : ''}</div>
      </div>
      {careers && (
        <a className="btn btn-ghost btn-icon btn-sm" href={careers} target="_blank" rel="noopener noreferrer" aria-label={`${company.name} careers page`} title="Careers page"><ExternalLink size={14} aria-hidden="true" /></a>
      )}
      <label className="row text-xs muted" style={{ gap: 6 }}>
        <input type="checkbox" className="switch" role="switch" checked={!muted} onChange={onToggle} aria-label={`Show jobs from ${company.name}`} />
        <span>{muted ? 'Hidden' : 'Showing'}</span>
      </label>
    </li>
  );
};

export const CompaniesView: React.FC<CompaniesViewProps> = ({ companies, mutedCompanyIds, onToggleMuted, canManage, onAddCompany, large, offline, loading }) => {
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', source_type: 'greenhouse', source_identifier: '', industry: '', careers_url: '' });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setVisible(PAGE), [query]);
  const q = query.trim().toLowerCase();
  const list = companies.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.industry || '').toLowerCase().includes(q));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.careers_url.trim() && !safeHttpUrl(form.careers_url)) { setError('The careers URL must start with http:// or https://'); return; }
    setAdding(true); setError(null);
    try {
      await onAddCompany({ name: form.name.trim(), source_type: form.source_type, source_identifier: form.source_identifier.trim(), industry: form.industry.trim() || undefined, careers_url: form.careers_url.trim() || undefined });
      setForm({ name: '', source_type: 'greenhouse', source_identifier: '', industry: '', careers_url: '' });
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the company. Please try again.");
    } finally { setAdding(false); }
  };

  return (
    <div className="section">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Companies</h2>
          <p className="text-sm">Jobly checks {companies.length} employers. Turn a company off to hide its jobs from your list.</p>
        </div>
        {canManage && <button type="button" className="btn btn-outline btn-sm" onClick={() => { setShowAdd((v) => !v); setError(null); }}>{showAdd ? <><X size={14} aria-hidden="true" /> Cancel</> : <><Plus size={14} aria-hidden="true" /> Add</>}</button>}
      </div>

      {canManage && showAdd && (
        <form className="card stack" style={{ padding: 16 }} onSubmit={submit}>
          <div><label className="label" htmlFor="c-name">Company name</label><input id="c-name" className="input" required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="row">
            <div className="grow"><label className="label" htmlFor="c-src">Job board</label>
              <select id="c-src" className="select" value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}>
                {['greenhouse', 'lever', 'ashby', 'workday'].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select></div>
            <div className="grow"><label className="label" htmlFor="c-id">Board id</label><input id="c-id" className="input" required maxLength={120} value={form.source_identifier} onChange={(e) => setForm({ ...form, source_identifier: e.target.value })} placeholder="e.g. supabase" /></div>
          </div>
          <div><label className="label" htmlFor="c-ind">Industry (optional)</label><input id="c-ind" className="input" maxLength={80} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
          <div><label className="label" htmlFor="c-url">Careers page (optional)</label><input id="c-url" className="input" value={form.careers_url} onChange={(e) => setForm({ ...form, careers_url: e.target.value })} placeholder="https://" /></div>
          {error && <p role="alert" className="text-sm" style={{ color: 'var(--warning)' }}>{error}</p>}
          <button type="submit" className="btn" disabled={adding}>{adding ? 'Adding…' : 'Add company'}</button>
        </form>
      )}

      {mutedCompanyIds.length > 0 && <p className="text-sm" role="status">{mutedCompanyIds.length} compan{mutedCompanyIds.length === 1 ? 'y is' : 'ies are'} hidden from your jobs.</p>}

      <div className="search">
        <Search size={16} aria-hidden="true" />
        <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${companies.length} companies…`} aria-label="Search companies" />
      </div>

      {companies.length === 0 && loading ? (
        <ul className="stack" style={{ listStyle: 'none', gap: 8 }} aria-busy="true" aria-label="Loading companies">
          {[0, 1, 2, 3, 4].map((i) => <li key={i} className="card row" style={{ padding: 12 }}><div className="skeleton" style={{ width: 40, height: 40 }} /><div className="grow stack" style={{ gap: 6 }}><div className="skeleton" style={{ height: 14, width: '50%' }} /><div className="skeleton" style={{ height: 12, width: '30%' }} /></div></li>)}
        </ul>
      ) : companies.length === 0 && offline ? (
        <EmptyState art="offline" large={large} title="Can't load companies" description="Jobly can't reach the server right now. The company list appears as soon as it reconnects." />
      ) : list.length === 0 ? (
        <EmptyState art="companies" large={large} title={companies.length === 0 ? 'No companies yet' : `No companies match "${query}"`} description={companies.length === 0 ? 'The company list loads when Jobly connects.' : 'Try another name or industry.'}
          actions={q ? <button type="button" className="btn" onClick={() => setQuery('')}>Clear search</button> : undefined} />
      ) : (
        <>
          <ul className={large ? 'cols' : 'stack'} style={{ listStyle: 'none', gap: 8 }}>
            {list.slice(0, visible).map((c) => <Row key={c.id} company={c} muted={mutedCompanyIds.includes(c.id)} onToggle={() => onToggleMuted(c.id)} />)}
          </ul>
          {list.length > visible && <button type="button" className="btn btn-outline" onClick={() => setVisible(visible + PAGE)}>Show more ({list.length - visible} left)</button>}
        </>
      )}
    </div>
  );
};
