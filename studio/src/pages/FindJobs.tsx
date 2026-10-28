import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Busy, Empty, Field, Text } from '../components/ui';
import { ROLES, ageLabel, jobAsPostingText, searchJobs, withDescription, type JobQuery, type JoblyJob } from '../lib/jobs';
import { startFromPosting } from './NewApplication';

const DEFAULT: JobQuery = { role: 'design_it', search: '', location: '', days: 14, remote: false, yc: false };

export function FindJobs() {
  const [q, setQ] = useState<JobQuery>(DEFAULT);
  const [items, setItems] = useState<JoblyJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  async function load(query: JobQuery, offset = 0) {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    setError('');
    try {
      const res = await searchJobs(query, offset, c.signal);
      setItems((prev) => (offset ? [...prev, ...res.items] : res.items));
      setTotal(res.total);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      if (ctrl.current === c) setLoading(false);
    }
  }

  useEffect(() => { load(DEFAULT); return () => ctrl.current?.abort(); }, []);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div><h1>Find jobs</h1><p>Fresh jobs from company career pages, with the date each was really posted. From Jobly’s job index.</p></div>
      </div>
      <form className="card" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <div className="grid-4" style={{ alignItems: 'end' }}>
          <Field label="Role">
            <select className="select" value={q.role} onChange={(e) => setQ({ ...q, role: e.target.value })}>
              {['Design & IT', 'More roles'].map((g) => (
                <optgroup key={g} label={g}>
                  {ROLES.filter((r) => r.group === g).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Keywords"><Text value={q.search} onChange={(v) => setQ({ ...q, search: v })} placeholder="e.g. React, Figma" /></Field>
          <Field label="Location"><Text value={q.location} onChange={(v) => setQ({ ...q, location: v })} placeholder="e.g. London" /></Field>
          <Field label="Posted">
            <select className="select" value={q.days} onChange={(e) => setQ({ ...q, days: Number(e.target.value) })}>
              <option value={1}>In the last day</option>
              <option value={3}>Last 3 days</option>
              <option value={7}>Last week</option>
              <option value={14}>Last 2 weeks</option>
              <option value={30}>Last 30 days</option>
            </select>
          </Field>
        </div>
        <div className="row between" style={{ marginTop: 14 }}>
          <div className="row" style={{ gap: 16 }}>
            <label className="check"><input type="checkbox" checked={q.remote} onChange={(e) => setQ({ ...q, remote: e.target.checked })} />Remote only</label>
            <label className="check"><input type="checkbox" checked={q.yc} onChange={(e) => setQ({ ...q, yc: e.target.checked })} />Y Combinator startups</label>
          </div>
          <button className="btn primary"><Icon name="search" />Search</button>
        </div>
      </form>

      {error && <div className="banner" role="alert">{error}</div>}
      {loading && items.length === 0 && <Busy label="Finding jobs" />}
      {!loading && !error && items.length === 0 && <Empty title="No jobs match">Try a longer time range, fewer keywords, or another role.</Empty>}

      {items.length > 0 && (
        <div className="stack sm">
          <span className="muted small">{total.toLocaleString()} job{total === 1 ? '' : 's'}</span>
          {items.map((j) => (
            <article className="card tight job" key={j.id}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div className="stack sm" style={{ gap: 2, flex: 1, minWidth: 220 }}>
                  <b style={{ fontSize: 15 }}>{j.title}</b>
                  <div className="job-meta">
                    <span>{j.company_name}{j.yc_batch && <span className="badge brand" style={{ marginLeft: 6 }}>YC {j.yc_batch}</span>}</span>
                    {j.location && <span>{j.location}</span>}
                    {j.work_mode && <span style={{ textTransform: 'capitalize' }}>{j.work_mode}</span>}
                    {j.salary_summary && <span>{j.salary_summary}</span>}
                    <span title={j.posted_at ? `Posted ${new Date(j.posted_at).toLocaleDateString()}` : 'First seen by Jobly'}>
                      {j.posted_at ? `Posted ${ageLabel(j.posted_at).toLowerCase()}` : `Seen ${ageLabel(j.first_seen_at).toLowerCase()}`}
                    </span>
                  </div>
                </div>
                <div className="row">
                  <button className="btn sm ghost" aria-expanded={open === j.id} onClick={async () => {
                    if (open === j.id) { setOpen(null); return; }
                    const full = await withDescription(j);
                    setItems((list) => list.map((x) => (x.id === j.id ? full : x)));
                    setOpen(j.id);
                  }}>{open === j.id ? 'Hide' : 'Details'}</button>
                  <a className="btn sm" href={j.application_url} target="_blank" rel="noopener noreferrer"><Icon name="external" />Open</a>
                  <button className="btn sm primary" onClick={async () => { const full = await withDescription(j); startFromPosting(jobAsPostingText(full), j.application_url); }}><Icon name="sparkle" />Tailor for this</button>
                </div>
              </div>
              {open === j.id && <div className="posting-text">{jobAsPostingText(j)}</div>}
            </article>
          ))}
          {items.length < total && (
            <div><button className="btn" disabled={loading} onClick={() => load(q, items.length)}>{loading ? 'Loading…' : 'Show more'}</button></div>
          )}
        </div>
      )}
      <p className="small muted">Jobs are read from Jobly’s public job files and filtered in your browser. Nothing from your profile is sent.</p>
    </div>
  );
}
