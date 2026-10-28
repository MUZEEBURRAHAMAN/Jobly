import React, { useState } from 'react';
import { Dialog } from './Dialog';
import { Plus, Star, Trash } from '../lib/icons';
import { Application, ChecklistItem, DEFAULT_CHECKLIST, Interview, newId } from '../lib/tracker';
import { fromDateInput, fromDateTimeInput, toDateInput, toDateTimeInput } from '../lib/dates';

interface Props {
  interview: Interview | null;
  apps: Application[];
  /** Preselects the application when adding from its details. */
  appKey?: string;
  onSave: (iv: Interview) => Promise<string | null>;
  onDelete?: (id: string) => Promise<string | null>;
  onClose: () => void;
}

export const InterviewDialog: React.FC<Props> = ({ interview, apps, appKey, onSave, onDelete, onClose }) => {
  const defaultAt = (() => { const d = new Date(Date.now() + 2 * 86400000); d.setHours(10, 0, 0, 0); return d.toISOString(); })();
  const [draft, setDraft] = useState<Interview>(interview ?? {
    id: newId(), app_key: appKey ?? apps[0]?.key ?? '', round: 'Phone screen', at: defaultAt, link: '', notes: '',
    checklist: DEFAULT_CHECKLIST.map((text) => ({ id: newId(), text, done: false, due: null })), rating: null,
  });
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch: Partial<Interview>) => setDraft((d) => ({ ...d, ...patch }));
  const setItem = (id: string, patch: Partial<ChecklistItem>) => set({ checklist: draft.checklist.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const save = async () => {
    if (!draft.app_key) { setError('Choose which application this interview is for.'); return; }
    if (!fromDateTimeInput(toDateTimeInput(draft.at))) { setError('Enter the date and time of the interview.'); return; }
    const problem = await onSave(draft);
    if (problem) setError(problem); else onClose();
  };

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    set({ checklist: [...draft.checklist, { id: newId(), text, done: false, due: null }] });
    setNewItem('');
  };

  return (
    <Dialog wide title={interview ? 'Edit interview' : 'Add interview'} onClose={onClose}
      footer={<>
        {interview && onDelete && (confirmDelete
          ? <button type="button" className="btn btn-outline btn-sm danger" onClick={async () => { const p = await onDelete(interview.id); if (p) setError(p); else onClose(); }}>Confirm delete</button>
          : <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(true)}><Trash size={14} aria-hidden="true" /> Delete</button>)}
        <span className="grow" />
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-sm" onClick={() => void save()}>Save interview</button>
      </>}>
      <div className="form-grid">
        <div className="wide">
          <label className="label" htmlFor="iv-app">Application</label>
          <select id="iv-app" className="select" value={draft.app_key} onChange={(e) => set({ app_key: e.target.value })}>
            {!draft.app_key && <option value="">Choose an application</option>}
            {apps.map((a) => <option key={a.key} value={a.key}>{a.title} · {a.company_name}</option>)}
          </select>
          {apps.length === 0 && <p className="hint">Track an application first, or add one by hand from the Tracker.</p>}
        </div>
        <div>
          <label className="label" htmlFor="iv-round">Round</label>
          <input id="iv-round" className="input" value={draft.round} maxLength={120} onChange={(e) => set({ round: e.target.value })} placeholder="Phone screen, technical, onsite…" />
        </div>
        <div>
          <label className="label" htmlFor="iv-at">Date and time</label>
          <input id="iv-at" type="datetime-local" className="input" value={toDateTimeInput(draft.at)} onChange={(e) => { const v = fromDateTimeInput(e.target.value); if (v) set({ at: v }); }} />
        </div>
        <div className="wide">
          <label className="label" htmlFor="iv-link">Meeting link</label>
          <input id="iv-link" type="url" className="input" value={draft.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://meet.google.com/…" />
        </div>
        <fieldset className="wide checklist">
          <legend className="label">Prep checklist</legend>
          {draft.checklist.map((c) => (
            <div key={c.id} className="check-row">
              <input id={`ck-${c.id}`} type="checkbox" checked={c.done} onChange={(e) => setItem(c.id, { done: e.target.checked })} />
              <label htmlFor={`ck-${c.id}`} className={`grow${c.done ? ' done' : ''}`}>{c.text}</label>
              <input type="date" className="input input-sm" aria-label={`Due date for ${c.text}`} value={toDateInput(c.due)} onChange={(e) => setItem(c.id, { due: fromDateInput(e.target.value) })} />
              <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => set({ checklist: draft.checklist.filter((x) => x.id !== c.id) })} aria-label={`Remove ${c.text}`}><Trash size={14} aria-hidden="true" /></button>
            </div>
          ))}
          <div className="row">
            <input className="input" aria-label="New checklist item" value={newItem} maxLength={300} placeholder="Add a prep step" onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} />
            <button type="button" className="btn btn-outline btn-sm" onClick={addItem}><Plus size={14} aria-hidden="true" /> Add</button>
          </div>
        </fieldset>
        <div className="wide">
          <span className="label" id="iv-rating-label">How did it go?</span>
          <div className="stars" role="radiogroup" aria-labelledby="iv-rating-label">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={draft.rating === n} aria-label={`${n} of 5`}
                className={`star${(draft.rating ?? 0) >= n ? ' on' : ''}`} onClick={() => set({ rating: draft.rating === n ? null : n })}>
                <Star size={20} duo={(draft.rating ?? 0) >= n} aria-hidden="true" />
              </button>
            ))}
          </div>
          <p className="hint">Rate each round after it happens to see what needs work.</p>
        </div>
        <div className="wide">
          <label className="label" htmlFor="iv-notes">Notes</label>
          <textarea id="iv-notes" className="textarea" rows={3} maxLength={4000} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Who you're meeting, questions they asked, what to follow up on" />
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </Dialog>
  );
};
