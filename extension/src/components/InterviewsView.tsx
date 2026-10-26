import React, { useState } from 'react';
import { Calendar, ExternalLink, Plus, Star } from '../lib/icons';
import { Interview } from '../lib/tracker';
import { TrackerStore } from '../lib/useTracker';
import { formatDateTime } from '../lib/dates';
import { safeHttpUrl } from '../lib/url';
import { InterviewDialog } from './InterviewDialog';
import { EmptyState } from './EmptyState';

export const InterviewsView: React.FC<{ store: TrackerStore; onOpenTracker: () => void; calendarImport?: React.ReactNode }> = ({ store, onOpenTracker, calendarImport }) => {
  const [editing, setEditing] = useState<{ iv: Interview | null } | null>(null);
  const now = Date.now();
  const upcoming = store.interviews.filter((i) => Date.parse(i.at) >= now - 3600000).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const past = store.interviews.filter((i) => Date.parse(i.at) < now - 3600000).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const rated = past.filter((i) => i.rating);
  const avg = rated.length ? (rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length).toFixed(1) : null;

  const item = (iv: Interview) => {
    const app = store.byKey.get(iv.app_key);
    const link = safeHttpUrl(iv.link);
    const done = iv.checklist.filter((c) => c.done).length;
    return (
      <li key={iv.id} className="card iv-card">
        <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
          <span className="iv-date" aria-hidden="true"><Calendar size={18} /></span>
          <div className="grow">
            <div className="font-medium break">{iv.round} · {app ? `${app.title} at ${app.company_name}` : 'Application removed'}</div>
            <div className="text-sm muted">{formatDateTime(iv.at)}</div>
            <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
              <span className={`badge ${done === iv.checklist.length && iv.checklist.length ? 'badge-success' : 'badge-outline'}`}>{done}/{iv.checklist.length} prep steps done</span>
              {iv.rating && <span className="badge badge-outline" aria-label={`Rated ${iv.rating} of 5`}><Star size={12} duo aria-hidden="true" /> {iv.rating}/5</span>}
            </div>
          </div>
          <div className="row">
            {link && <a className="btn btn-outline btn-sm" href={link} target="_blank" rel="noopener noreferrer" aria-label={`Join ${iv.round}`}>Join <ExternalLink size={14} aria-hidden="true" /></a>}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing({ iv })} aria-label={`Open ${iv.round}${app ? ` for ${app.company_name}` : ''}`}>Open</button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="section">
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div><h2>Interviews</h2><p className="text-sm">{upcoming.length} upcoming{avg ? ` · past rounds average ${avg}/5` : ''}</p></div>
        <div className="row wrap">
          {calendarImport}
          <button type="button" className="btn btn-sm" onClick={() => setEditing({ iv: null })} disabled={!store.apps.length}><Plus size={14} aria-hidden="true" /> Add interview</button>
        </div>
      </div>
      {store.interviews.length === 0 ? (
        <EmptyState art="alerts" large title="No interviews yet" description={store.apps.length ? 'Add an interview to get a prep checklist and a reminder an hour before it starts.' : 'Track an application first, then add its interviews here.'}
          actions={!store.apps.length ? <button type="button" className="btn" onClick={onOpenTracker}>Open the tracker</button> : undefined} />
      ) : (
        <>
          {upcoming.length > 0 && <><h3>Upcoming</h3><ul className="stack" style={{ listStyle: 'none' }}>{upcoming.map(item)}</ul></>}
          {past.length > 0 && <><h3>Past</h3><ul className="stack" style={{ listStyle: 'none' }}>{past.map(item)}</ul></>}
        </>
      )}
      {editing && <InterviewDialog interview={editing.iv} apps={store.apps} onSave={store.saveInterview} onDelete={store.removeInterview} onClose={() => setEditing(null)} />}
    </div>
  );
};
