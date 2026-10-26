import React, { useMemo, useRef, useState } from 'react';
import { Clock, Download, ExternalLink, Pencil, Plus, Search, Upload } from '../lib/icons';
import { Job } from '../types';
import { Application, AppStatus, Interview, STATUSES, trackerStats } from '../lib/tracker';
import { TrackerStore } from '../lib/useTracker';
import { jobKey } from '../lib/userData';
import { dueLabel, formatDate } from '../lib/dates';
import { exportBackup, exportCsv, importFile } from '../lib/backup';
import { safeHttpUrl } from '../lib/url';
import { ApplicationDialog, AddApplicationDialog } from './ApplicationDialog';
import { InterviewDialog } from './InterviewDialog';
import { EmptyState } from './EmptyState';

interface Props {
  store: TrackerStore;
  /** Saved jobs not tracked yet show in the Saved column. */
  savedJobs: Job[];
  notify: (message: string, kind?: 'error' | 'info') => void;
  onBrowseJobs: () => void;
}

// Rejected and withdrawn share the last column: both are finished.
const COLUMNS: { id: string; label: string; statuses: AppStatus[] }[] = [
  { id: 'saved', label: 'Saved', statuses: ['saved'] },
  { id: 'applied', label: 'Applied', statuses: ['applied'] },
  { id: 'interview', label: 'Interviewing', statuses: ['interview'] },
  { id: 'offer', label: 'Offer', statuses: ['offer'] },
  { id: 'closed', label: 'Closed', statuses: ['rejected', 'withdrawn'] },
];

export const TrackerView: React.FC<Props> = ({ store, savedJobs, notify, onBrowseJobs }) => {
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [interview, setInterview] = useState<{ iv: Interview | null; appKey?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Saved jobs that aren't tracked yet appear as Saved entries; moving one adds it to the tracker.
  const virtual = useMemo(() => {
    const tracked = new Set(store.apps.map((a) => a.key));
    return savedJobs.filter((j) => !tracked.has(jobKey(j)));
  }, [store.apps, savedJobs]);
  const savedByKey = useMemo(() => new Map(savedJobs.map((j) => [jobKey(j), j])), [savedJobs]);

  const q = query.trim().toLowerCase();
  const match = (title: string, company: string) => !q || `${title} ${company}`.toLowerCase().includes(q);
  const stats = trackerStats(store.apps, store.interviews);
  const goal = store.settings.weekly_goal;
  const total = store.apps.length + virtual.length;

  const move = async (key: string, status: AppStatus) => {
    const job = savedByKey.get(key);
    const problem = store.byKey.has(key) ? await store.updateApp(key, { status }) : job ? await store.setStatus(job, status) : 'This job is no longer saved.';
    if (problem) notify(problem);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = await importFile(file);
      if (result.kind === 'backup') { notify(`Backup restored: ${result.apps} applications and the rest of your Jobly data.`, 'info'); return; }
      if (!result.apps.length) { notify('No rows with a company and a role were found in that file.'); return; }
      const { problem, added } = await store.addMany(result.apps);
      notify(problem ?? `Imported ${added} application${added === 1 ? '' : 's'}.`, problem ? 'error' : 'info');
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const open = openKey ? store.byKey.get(openKey) ?? null : null;

  return (
    <div className="section tracker">
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div><h2>Tracker</h2><p className="text-sm">{total ? `${total} job${total === 1 ? '' : 's'} on your board` : 'Keep every application in one place'}</p></div>
        <div className="row wrap">
          <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}><Plus size={14} aria-hidden="true" /> Add application</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}><Upload size={14} aria-hidden="true" /> Import</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => exportCsv(store.apps)} disabled={!store.apps.length}><Download size={14} aria-hidden="true" /> Export CSV</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void exportBackup()}><Download size={14} aria-hidden="true" /> Backup</button>
          <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" hidden aria-label="Import a CSV or a Jobly backup" onChange={(e) => void onImport(e.target.files?.[0])} />
        </div>
      </div>

      <div className="stats">
        <div className="card stat"><div className="text-sm muted">Applied this week</div><div className="value">{stats.appliedThisWeek}<span className="text-sm muted"> / {goal}</span></div>
          <div className="meter" role="img" aria-label={`${stats.appliedThisWeek} of ${goal} weekly goal`}><span style={{ width: `${Math.min(100, (stats.appliedThisWeek / goal) * 100)}%` }} /></div></div>
        <div className="card stat"><div className="text-sm muted">Applied in total</div><div className="value">{stats.applied}</div></div>
        <div className="card stat"><div className="text-sm muted">Interviewing</div><div className="value">{stats.interviewing}</div></div>
        <div className="card stat"><div className="text-sm muted">Offers</div><div className="value">{stats.offers}</div></div>
        <div className="card stat"><div className="text-sm muted">Response rate</div><div className="value">{stats.responseRate}%</div></div>
      </div>

      {total === 0 ? (
        <EmptyState art="saved" large title="Nothing tracked yet" description="Use Track on any job card, answer “Did you apply?” after opening a job, add a job by hand, or import a CSV from a spreadsheet. Your tracker stays on this device."
          actions={<><button type="button" className="btn" onClick={onBrowseJobs}>Browse jobs</button><button type="button" className="btn btn-outline" onClick={() => setAdding(true)}>Add by hand</button></>} />
      ) : (
        <>
          <div className="search" style={{ maxWidth: 360 }}><Search size={16} aria-hidden="true" /><input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the tracker…" aria-label="Search the tracker" /></div>
          <div className="board">
            {COLUMNS.map((col) => {
              const items = store.apps.filter((a) => col.statuses.includes(a.status) && match(a.title, a.company_name));
              const extra = col.id === 'saved' ? virtual.filter((j) => match(j.title, j.company_name)) : [];
              const count = items.length + extra.length;
              return (
                <section key={col.id} className="board-col" aria-labelledby={`col-${col.id}`}>
                  <h3 id={`col-${col.id}`} className="board-head">{col.label} <span className="text-xs muted">{count}</span></h3>
                  <ul className="board-list">
                    {items.map((a) => <AppCard key={a.key} app={a} interviews={store.interviews.filter((i) => i.app_key === a.key)} onOpen={() => setOpenKey(a.key)} onMove={(s) => void move(a.key, s)} />)}
                    {extra.map((j) => <AppCard key={jobKey(j)} app={{ key: jobKey(j), title: j.title, company_name: j.company_name, location: j.location, application_url: j.application_url, source: 'jobly', status: 'saved', notes: '', applied_at: null, follow_up_at: null, created_at: '', updated_at: '' }}
                      interviews={[]} onMove={(s) => void move(jobKey(j), s)} />)}
                    {count === 0 && <li className="board-empty text-xs muted">Nothing here</li>}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}

      {open && <ApplicationDialog app={open} interviews={store.interviews.filter((i) => i.app_key === open.key)} onSave={store.updateApp} onDelete={store.removeApp}
        onAddInterview={() => setInterview({ iv: null, appKey: open.key })} onOpenInterview={(iv) => setInterview({ iv })} onClose={() => setOpenKey(null)} />}
      {adding && <AddApplicationDialog onAdd={store.addApp} onClose={() => setAdding(false)} />}
      {interview && <InterviewDialog interview={interview.iv} appKey={interview.appKey} apps={store.apps} onSave={store.saveInterview} onDelete={store.removeInterview} onClose={() => setInterview(null)} />}
    </div>
  );
};

const AppCard: React.FC<{ app: Application; interviews: Interview[]; onOpen?: () => void; onMove: (s: AppStatus) => void }> = ({ app, interviews, onOpen, onMove }) => {
  const link = safeHttpUrl(app.application_url);
  const due = app.follow_up_at ? dueLabel(app.follow_up_at) : null;
  const next = interviews.find((i) => Date.parse(i.at) >= Date.now());
  return (
    <li className="board-card">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="font-medium break grow">{app.title}</div>
        {link && <a className="btn btn-ghost btn-sm btn-icon card-link" href={link} target="_blank" rel="noopener noreferrer" aria-label={`Open the posting for ${app.title}`} title="Open the posting"><ExternalLink size={14} aria-hidden="true" /></a>}
      </div>
      <div className="text-xs muted break">{app.company_name}{app.location ? ` · ${app.location}` : ''}</div>
      <div className="row wrap" style={{ gap: 6 }}>
        {app.applied_at && <span className="badge badge-outline">Applied {formatDate(app.applied_at)}</span>}
        {due && app.status !== 'rejected' && app.status !== 'withdrawn' && <span className={`badge ${due.overdue ? 'badge-warning' : 'badge-outline'}`}><Clock size={12} aria-hidden="true" /> Follow up {due.text}</span>}
        {next && <span className="badge badge-brand">Interview {formatDate(next.at)}</span>}
        {app.source !== 'jobly' && <span className="badge badge-outline">{app.source === 'import' ? 'Imported' : 'Added by hand'}</span>}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <select className="select select-sm grow" value={app.status} aria-label={`Status of ${app.title} at ${app.company_name}`} onChange={(e) => onMove(e.target.value as AppStatus)}>
          {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        {onOpen && <button type="button" className="btn btn-outline btn-sm btn-icon" onClick={onOpen} aria-label={`Details for ${app.title} at ${app.company_name}`} title="Details, notes and interviews"><Pencil size={14} aria-hidden="true" /></button>}
      </div>
    </li>
  );
};
