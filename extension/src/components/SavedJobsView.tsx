import React, { useMemo, useState } from 'react';
import { Check, ExternalLink, Search, Trash } from '../lib/icons';
import { Job } from '../types';
import { JobCard } from './JobCard';
import { EmptyState } from './EmptyState';
import { FEATURES } from '../lib/config';
import { useTrackerContext } from '../lib/trackerContext';
import { Application, APPLIED_STATUSES, statusLabel } from '../lib/tracker';
import { jobKey } from '../lib/userData';
import { formatDate } from '../lib/dates';
import { safeHttpUrl } from '../lib/url';
import { followUp, followUpDraft, logFollowUp } from '../lib/followUp';
import { useMatch } from '../lib/matchScore';
import { CopyButton } from './CopyButton';

interface SavedJobsViewProps {
  savedJobs: Job[];
  onToggleSave: (job: Job) => void;
  onBrowseJobs: () => void;
  notify?: (message: string, kind?: 'error' | 'info') => void;
  large?: boolean;
}

type List = 'saved' | 'applied';

/**
 * Saved jobs, and (while the tracker is switched off) the jobs you applied to. Jobs saved from a careers page with the
 * right-click menu or the popup are listed under Saved too, as short rows.
 */
export const SavedJobsView: React.FC<SavedJobsViewProps> = ({ savedJobs, onToggleSave, onBrowseJobs, notify, large }) => {
  const [query, setQuery] = useState('');
  const [list, setList] = useState<List>('saved');
  const tracker = useTrackerContext()?.store;
  const showApplied = !FEATURES.tracker && !!tracker;

  const q = query.trim().toLowerCase();
  const hit = (...parts: (string | null | undefined)[]) => !q || parts.join(' ').toLowerCase().includes(q);

  const { fromPages, applied } = useMemo(() => {
    if (!showApplied || !tracker) return { fromPages: [] as Application[], applied: [] as Application[] };
    const savedKeys = new Set(savedJobs.map(jobKey));
    return {
      fromPages: tracker.apps.filter((a) => a.status === 'saved' && !savedKeys.has(a.key)),
      applied: tracker.apps.filter((a) => APPLIED_STATUSES.includes(a.status))
        .sort((a, b) => (b.applied_at ?? b.updated_at).localeCompare(a.applied_at ?? a.updated_at)),
    };
  }, [showApplied, tracker, savedJobs]);

  const savedCount = savedJobs.length + fromPages.length;
  const shownJobs = savedJobs.filter((j) => hit(j.title, j.company_name, j.location));
  const shownPages = fromPages.filter((a) => hit(a.title, a.company_name, a.location));
  const shownApplied = applied.filter((a) => hit(a.title, a.company_name, a.location));

  const report = (problem: string | null, done: string) => notify?.(problem ?? done, problem ? 'error' : 'info');
  const markApplied = async (a: Application) => tracker && report(await tracker.updateApp(a.key, { status: 'applied' }), `Moved to Applied: ${a.title}`);
  const remove = async (a: Application) => tracker && report(await tracker.removeApp(a.key), `Removed: ${a.title}`);

  if (savedCount === 0 && applied.length === 0) {
    return <EmptyState art="saved" large={large} title="Nothing saved yet"
      description={showApplied
        ? 'Tap Save on any job to keep it here for later. Jobs you mark as applied are listed here too. Everything stays on this device.'
        : 'Tap Save on any job to keep it here for later. Saved jobs stay on this device.'}
      actions={<button type="button" className="btn" onClick={onBrowseJobs}>Browse jobs</button>} />;
  }

  const empty = list === 'saved' ? shownJobs.length + shownPages.length === 0 : shownApplied.length === 0;
  const total = list === 'saved' ? savedCount : applied.length;

  return (
    <div className="section">
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2>{showApplied ? 'Saved and applied' : 'Saved jobs'}</h2>
          <p className="text-sm">{showApplied ? `${savedCount} saved · ${applied.length} applied` : `${savedJobs.length} saved`}</p>
        </div>
        {showApplied && (
          <div className="segmented" role="tablist" aria-label="Which jobs">
            {(['saved', 'applied'] as const).map((id) => (
              <button key={id} type="button" role="tab" aria-selected={list === id} className={list === id ? 'active' : ''} onClick={() => setList(id)}>
                {id === 'saved' ? 'Saved' : 'Applied'} <span className="muted">{id === 'saved' ? savedCount : applied.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="search"><Search size={16} aria-hidden="true" />
          <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={list === 'saved' ? 'Search saved jobs…' : 'Search jobs you applied to…'} aria-label={list === 'saved' ? 'Search saved jobs' : 'Search jobs you applied to'} />
        </div>
      )}

      {total === 0 ? (
        list === 'applied'
          ? <EmptyState art="saved" large={large} title="No applications yet" description="Mark a job as Applied on its card, or answer “Yes, I applied” when Jobly asks after you open a job." />
          : <EmptyState art="saved" large={large} title="Nothing saved yet" description="Tap Save on any job to keep it here for later." actions={<button type="button" className="btn" onClick={onBrowseJobs}>Browse jobs</button>} />
      ) : empty ? (
        <EmptyState art="search" large={large} title={`Nothing matches "${query}"`} actions={<button type="button" className="btn" onClick={() => setQuery('')}>Clear search</button>} />
      ) : list === 'saved' ? (
        <>
          {shownJobs.length > 0 && (
            <div className={large ? 'list grid' : undefined} style={large ? { padding: 0 } : undefined}>
              {shownJobs.map((job) => <JobCard key={job.id} job={job} onToggleSave={onToggleSave} />)}
            </div>
          )}
          {shownPages.length > 0 && (
            <section className="stack" aria-labelledby="from-pages">
              <h3 id="from-pages" className="text-sm muted font-medium">Saved from careers pages</h3>
              <ul className="app-rows">
                {shownPages.map((a) => <AppRow key={a.key} app={a} onMarkApplied={() => void markApplied(a)} onRemove={() => void remove(a)} />)}
              </ul>
            </section>
          )}
        </>
      ) : (
        <>
          <FollowUps apps={shownApplied} onFollowed={async (a) => tracker && report(await tracker.updateApp(a.key, logFollowUp(a)), `Logged a follow-up for ${a.title}. Next reminder in 7 days.`)} />
          <ul className="app-rows">
            {shownApplied.map((a) => <AppRow key={a.key} app={a} onRemove={() => void remove(a)} />)}
          </ul>
        </>
      )}
    </div>
  );
};

const AppRow: React.FC<{ app: Application; onMarkApplied?: () => void; onRemove: () => void }> = ({ app, onMarkApplied, onRemove }) => {
  const link = safeHttpUrl(app.application_url);
  const label = `${app.title} at ${app.company_name}`;
  return (
    <li className="app-row card">
      <div className="grow" style={{ minWidth: 0 }}>
        <p className="font-medium break app-title">{app.title}</p>
        <p className="text-sm muted break">{[app.company_name, app.location].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="row wrap app-row-meta">
        {app.applied_at && <span className="badge badge-outline">Applied {formatDate(app.applied_at)}</span>}
        {app.status !== 'saved' && app.status !== 'applied' && <span className="badge badge-outline">{statusLabel(app.status)}</span>}
        {(() => { const f = followUp(app); if (!f) return null;
          return f.state === 'due' ? <span className="badge badge-warning">Follow up now</span>
            : f.state === 'cold' ? <span className="badge badge-outline">Followed up {f.count}×, no reply</span>
            : <span className="badge badge-outline">{f.count ? `Followed up ${f.count}× · ` : ''}Follow up {formatDate(f.due!.toISOString())}</span>; })()}
      </div>
      <div className="row app-row-actions">
        {onMarkApplied && (
          <button type="button" className="btn btn-outline btn-sm" onClick={onMarkApplied} aria-label={`Mark as applied: ${label}`}>
            <Check size={14} aria-hidden="true" /> Applied
          </button>
        )}
        {link && (
          <a className="btn btn-ghost btn-sm btn-icon" href={link} target="_blank" rel="noopener noreferrer" title="Open the posting" aria-label={`Open the posting: ${label}`}>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onRemove} title="Remove" aria-label={`Remove: ${label}`}>
          <Trash size={14} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
};

/** Applications that are due a follow-up, each with a short message to copy. */
const FollowUps: React.FC<{ apps: Application[]; onFollowed: (a: Application) => void }> = ({ apps, onFollowed }) => {
  const { profile } = useMatch();
  const [open, setOpen] = useState<string | null>(null);
  const due = apps.filter((a) => followUp(a)?.state === 'due');
  if (!due.length) return null;
  return (
    <section className="card fu-card" aria-labelledby="fu-title">
      <div><h3 id="fu-title">Follow-ups due <span className="aq-count">{due.length}</span></h3>
        <p className="text-sm muted">A week has passed with no reply. A short note keeps you in mind; after two, it’s usually time to move on.</p></div>
      <ul className="fu-list">
        {due.map((a) => {
          const d = followUpDraft(a, profile ?? null);
          const f = followUp(a)!;
          return (
            <li key={a.key}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                <span><span className="font-medium">{a.title}</span> <span className="muted">· {a.company_name} · applied {f.days} days ago{f.count ? ` · followed up ${f.count}×` : ''}</span></span>
                <span className="row" style={{ gap: 4 }}>
                  <button type="button" className="btn btn-outline btn-sm" aria-expanded={open === a.key} onClick={() => setOpen(open === a.key ? null : a.key)}>{open === a.key ? 'Hide message' : 'Write follow-up'}</button>
                  <button type="button" className="btn btn-sm" onClick={() => onFollowed(a)} aria-label={`I followed up: ${a.title} at ${a.company_name}`}>I followed up</button>
                </span>
              </div>
              {open === a.key && (
                <div className="fu-draft">
                  <p className="text-xs muted">Subject: {d.subject}</p>
                  <pre className="fu-text">{d.body}</pre>
                  <CopyButton value={`Subject: ${d.subject}\n\n${d.body}`} label="follow-up message" text />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
