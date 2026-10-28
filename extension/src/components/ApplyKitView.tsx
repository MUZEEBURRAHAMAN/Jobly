import React, { useEffect, useState } from 'react';
import { BookmarkCheck, Plus, User } from '../lib/icons';
import { answerFields } from '../lib/profile';
import { ProfilesStore } from '../lib/useProfiles';
import { TrackerStore } from '../lib/useTracker';
import { appFromPageJob, PageJob, readJobInTab } from '../lib/pageJob';
import { CopyButton } from './CopyButton';
import { fitCheck } from '../lib/fit';
import { AutofillPanel } from './AutofillPanel';
import { TRACKER_KEYS } from '../lib/tracker';
import { writeKey } from '../lib/userData';

/**
 * The popup's Apply tab: save the job on the current page to the tracker, and copy profile answers into its form.
 * Reading the page works only for the tab Jobly was opened on (activeTab), so nothing is read in the background.
 */
export const ApplyKitView: React.FC<{ profiles: ProfilesStore; tracker: TrackerStore; openDashboard: (hash: string) => void; notify: (m: string, kind?: 'error' | 'info') => void }> = ({ profiles, tracker, openDashboard, notify }) => {
  const [page, setPage] = useState<PageJob | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [tabId, setTabId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !/^https?:/.test(tab.url ?? '')) { if (alive) setPage(null); return; }
        if (alive) setTabId(tab.id);
        const job = await readJobInTab(tab.id);
        if (alive) setPage(job);
      } catch { if (alive) setPage(null); }
    })();
    return () => { alive = false; };
  }, []);

  const key = page?.url.split('#')[0];
  const already = key ? tracker.byKey.get(key) : undefined;

  const save = async () => {
    if (!page) return;
    const { problem } = await tracker.addApp(appFromPageJob(page));
    if (problem) notify(problem); else { setSaved(true); notify('Saved to your tracker.', 'info'); }
  };

  const fields = profiles.active ? answerFields(profiles.active) : [];
  const fit = page?.found ? fitCheck(profiles.active, page.description) : null;
  const FIT_LABEL = { strong: 'Strong fit', good: 'Partial fit', low: 'Low fit', unknown: 'Fit check' } as const;

  return (
    <div className="section">
      {page === undefined ? <div className="skeleton" style={{ height: 72 }} aria-label="Reading this page" /> : page ? (
        <div className="page-job">
          <p className="text-xs muted">{page.found ? 'Job on this page' : 'This page'}</p>
          <p className="font-medium break">{page.title || 'Untitled page'}</p>
          <p className="text-sm break">{[page.company, page.location].filter(Boolean).join(' · ')}</p>
          {already || saved
            ? <p className="text-sm row" style={{ color: 'var(--success)' }}><BookmarkCheck size={14} aria-hidden="true" /> In your tracker{already ? ` as ${already.status}` : ''}</p>
            : <button type="button" className="btn btn-brand btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => void save()}><Plus size={14} aria-hidden="true" /> Save to tracker</button>}
        </div>
      ) : <p className="text-sm">Open a job posting, then open Jobly to save it to your tracker.</p>}

      {tabId !== null && page !== undefined && (
        <AutofillPanel tabId={tabId} profile={profiles.active} openProfile={() => openDashboard('profile')} onFilled={() => {
          // After filling, ask "Did you apply?" next time Jobly opens, like after clicking Apply on a job card.
          if (!page || already) return;
          const url = page.url.split('#')[0];
          void writeKey(TRACKER_KEYS.pending, { at: Date.now(), job: { id: 0, company_id: 0, company_name: page.company, source_type: 'page', external_id: url, title: page.title, normalized_role: null, seniority: null, work_mode: null, location: page.location || null, description: null, application_url: url, first_seen_at: '', last_seen_at: '', status: 'active', is_saved: false, is_match: false } });
        }} />
      )}

      {fit && (
        <div className="card fit" style={{ padding: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2>{FIT_LABEL[fit.level]}</h2>
            {fit.level !== 'unknown' && <span className={`badge ${fit.level === 'strong' ? 'badge-success' : fit.level === 'good' ? 'badge-warning' : 'badge-outline'}`}>{fit.found.length} of your skills mentioned</span>}
          </div>
          {fit.level === 'unknown' ? (
            <p className="text-sm">{profiles.active ? 'Add skills to your profile to see how this posting matches them.' : 'Set up your profile to compare it with this posting.'}</p>
          ) : (
            <ul className="fit-list text-sm">
              {fit.found.length > 0 && <li><span className="font-medium">Mentions:</span> {fit.found.join(', ')}</li>}
              {fit.yearsAsked !== null && <li><span className="font-medium">Asks for:</span> {fit.yearsAsked}+ years{fit.yearsHave !== null ? ` (you have ${fit.yearsHave})` : ''}</li>}
              {fit.suggestions.length > 0 && <li><span className="font-medium">Also asks for:</span> {fit.suggestions.join(', ')}. Add any you have to your profile and resume.</li>}
            </ul>
          )}
          <p className="hint">Worked out from the posting's own text, on this device.</p>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Copy kit</h2>
        {profiles.profiles.length > 1 && (
          <><label className="sr-only" htmlFor="kit-profile">Profile</label>
          <select id="kit-profile" className="select select-sm" value={profiles.active?.id} onChange={(e) => void profiles.choose(e.target.value)}>
            {profiles.profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select></>
        )}
      </div>
      {fields.length === 0 ? (
        <div className="card empty" style={{ padding: 16 }}>
          <p className="empty-desc">Add your details once in your profile, then copy them into any application form from here.</p>
          <div className="empty-actions"><button type="button" className="btn btn-sm" onClick={() => openDashboard('profile')}><User size={14} aria-hidden="true" /> Set up profile</button></div>
        </div>
      ) : (
        <ul className="kit-list">
          {fields.map((f) => (
            <li key={f.id} className="kit-row"><span className="kit-label">{f.label}</span><span className="kit-value truncate" title={f.value}>{f.value}</span><CopyButton value={f.value} label={f.label} /></li>
          ))}
        </ul>
      )}
      {fields.length > 0 && <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => openDashboard('profile')}>Edit profile</button>}
    </div>
  );
};
