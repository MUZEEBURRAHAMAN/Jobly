import React, { useState } from 'react';
import { Dialog } from './Dialog';
import { Calendar, ExternalLink, Plus, Trash } from '../lib/icons';
import { Application, AppStatus, Interview, STATUSES } from '../lib/tracker';
import { formatDateTime, fromDateInput, toDateInput, todayInput } from '../lib/dates';
import { safeHttpUrl } from '../lib/url';

interface DetailsProps {
  app: Application;
  interviews: Interview[];
  onSave: (key: string, patch: Partial<Application>) => Promise<string | null>;
  onDelete: (key: string) => Promise<string | null>;
  onAddInterview: () => void;
  onOpenInterview: (iv: Interview) => void;
  onClose: () => void;
}

/** One application: status, dates, notes and its interviews. */
export const ApplicationDialog: React.FC<DetailsProps> = ({ app, interviews, onSave, onDelete, onAddInterview, onOpenInterview, onClose }) => {
  const [draft, setDraft] = useState(app);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch: Partial<Application>) => setDraft((d) => ({ ...d, ...patch }));
  const link = safeHttpUrl(draft.application_url);

  const save = async () => {
    const problem = await onSave(app.key, {
      title: draft.title, company_name: draft.company_name, status: draft.status, location: draft.location, application_url: draft.application_url,
      applied_at: draft.applied_at, follow_up_at: draft.follow_up_at, notes: draft.notes,
    });
    if (problem) setError(problem); else onClose();
  };

  return (
    <Dialog wide title={`${app.title} · ${app.company_name}`} onClose={onClose}
      footer={<>
        {confirmDelete
          ? <button type="button" className="btn btn-outline btn-sm danger" onClick={async () => { const p = await onDelete(app.key); if (p) setError(p); else onClose(); }}>Confirm remove</button>
          : <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(true)}><Trash size={14} aria-hidden="true" /> Remove from tracker</button>}
        <span className="grow" />
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-sm" onClick={() => void save()}>Save changes</button>
      </>}>
      <div className="form-grid">
        <div>
          <label className="label" htmlFor="app-status">Status</label>
          <select id="app-status" className="select" value={draft.status} onChange={(e) => set({ status: e.target.value as AppStatus })}>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="app-applied">Applied on</label>
          <input id="app-applied" type="date" className="input" value={toDateInput(draft.applied_at)} onChange={(e) => set({ applied_at: fromDateInput(e.target.value) })} />
        </div>
        <div>
          <label className="label" htmlFor="app-follow">Follow up on</label>
          <input id="app-follow" type="date" className="input" min={todayInput()} value={toDateInput(draft.follow_up_at)} onChange={(e) => set({ follow_up_at: fromDateInput(e.target.value) })} />
          <p className="hint">Jobly reminds you that day.</p>
        </div>
        <div>
          <label className="label" htmlFor="app-location">Location</label>
          <input id="app-location" className="input" value={draft.location ?? ''} maxLength={160} onChange={(e) => set({ location: e.target.value || null })} />
        </div>
        <div>
          <label className="label" htmlFor="app-title">Role</label>
          <input id="app-title" className="input" value={draft.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="app-company">Company</label>
          <input id="app-company" className="input" value={draft.company_name} maxLength={120} onChange={(e) => set({ company_name: e.target.value })} />
        </div>
        <div className="wide">
          <label className="label" htmlFor="app-link">Job link</label>
          <div className="row">
            <input id="app-link" type="url" className="input" value={draft.application_url} onChange={(e) => set({ application_url: e.target.value })} placeholder="https://" />
            {link && <a className="btn btn-outline btn-sm" href={link} target="_blank" rel="noopener noreferrer" aria-label="Open the job posting">Open <ExternalLink size={14} aria-hidden="true" /></a>}
          </div>
        </div>
        <div className="wide">
          <label className="label" htmlFor="app-notes">Notes</label>
          <textarea id="app-notes" className="textarea" rows={4} maxLength={4000} value={draft.notes} onChange={(e) => set({ notes: e.target.value })}
            placeholder="Recruiter's name, salary talk, questions to ask, how you heard about it" />
        </div>
        <div className="wide">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="label" style={{ marginBottom: 0 }}>Interviews</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={onAddInterview}><Plus size={14} aria-hidden="true" /> Add interview</button>
          </div>
          {interviews.length === 0
            ? <p className="hint">No interviews yet.</p>
            : <ul className="mini-list">{interviews.map((iv) => (
                <li key={iv.id}><button type="button" className="mini-item" onClick={() => onOpenInterview(iv)}>
                  <Calendar size={14} aria-hidden="true" /><span className="grow"><span className="font-medium">{iv.round}</span> · {formatDateTime(iv.at)}</span>
                  <span className="text-xs muted">{iv.checklist.filter((c) => c.done).length}/{iv.checklist.length} prepped</span>
                </button></li>))}</ul>}
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </Dialog>
  );
};

interface AddProps { onAdd: (draft: Partial<Application>) => Promise<{ problem: string | null; key: string | null }>; onClose: () => void }

/** Track a job found somewhere else (a referral, LinkedIn, an email). */
export const AddApplicationDialog: React.FC<AddProps> = ({ onAdd, onClose }) => {
  const [draft, setDraft] = useState<Partial<Application>>({ status: 'applied', applied_at: fromDateInput(todayInput()) });
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Application>) => setDraft((d) => ({ ...d, ...patch }));
  const add = async () => {
    if (!draft.company_name?.trim() || !draft.title?.trim()) { setError('Enter the company and the role.'); return; }
    if (draft.application_url && !safeHttpUrl(draft.application_url)) { setError('The job link must start with http:// or https://.'); return; }
    const { problem } = await onAdd(draft);
    if (problem) setError(problem); else onClose();
  };
  return (
    <Dialog title="Add an application" onClose={onClose}
      footer={<><span className="grow" /><button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button><button type="button" className="btn btn-sm" onClick={() => void add()}>Add to tracker</button></>}>
      <div className="form-grid">
        <div className="wide"><label className="label" htmlFor="add-company">Company</label><input id="add-company" className="input" maxLength={120} value={draft.company_name ?? ''} onChange={(e) => set({ company_name: e.target.value })} /></div>
        <div className="wide"><label className="label" htmlFor="add-title">Role</label><input id="add-title" className="input" maxLength={200} value={draft.title ?? ''} onChange={(e) => set({ title: e.target.value })} /></div>
        <div className="wide"><label className="label" htmlFor="add-link">Job link (optional)</label><input id="add-link" type="url" className="input" placeholder="https://" value={draft.application_url ?? ''} onChange={(e) => set({ application_url: e.target.value })} /></div>
        <div>
          <label className="label" htmlFor="add-status">Status</label>
          <select id="add-status" className="select" value={draft.status} onChange={(e) => set({ status: e.target.value as AppStatus })}>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="add-applied">Applied on</label><input id="add-applied" type="date" className="input" value={toDateInput(draft.applied_at)} onChange={(e) => set({ applied_at: fromDateInput(e.target.value) })} /></div>
        <div className="wide"><label className="label" htmlFor="add-location">Location (optional)</label><input id="add-location" className="input" maxLength={160} value={draft.location ?? ''} onChange={(e) => set({ location: e.target.value || null })} /></div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </Dialog>
  );
};
