import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, X } from '../lib/icons';
import { Job } from '../types';
import { api } from '../lib/api';

interface ReportModalProps {
  job: Job;
  onClose: () => void;
}

const REASONS = [
  { id: 'fake', label: 'Fake or scam', hint: 'This listing looks fraudulent or misleading' },
  { id: 'expired', label: 'No longer open', hint: 'The role has been filled or closed' },
  { id: 'misinfo', label: 'Wrong information', hint: 'Salary, location or requirements are incorrect' },
  { id: 'spam', label: 'Spam or duplicate', hint: 'A repeated or low-quality posting' },
  { id: 'other', label: 'Something else', hint: 'Another problem with this listing' },
];

export const ReportModal: React.FC<ReportModalProps> = ({ job, onClose }) => {
  const [selected, setSelected] = useState('');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus management: move focus into the dialog, keep Tab inside it, and restore focus to the trigger on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, a[href], [tabindex]:not([tabindex="-1"])') ?? []);
    (focusables().find((el) => el.tagName === 'INPUT') ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1], active = document.activeElement;
      if (!dialogRef.current?.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; opener?.focus?.(); };
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || submitting) return;
    setSubmitting(true); setError(null);
    const ok = await api.reportJob(job.id, selected, details);
    setSubmitting(false);
    if (!ok) { setError("Couldn't send your report. Check your connection and try again."); return; }
    setSubmitted(true);
  };

  return createPortal(
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div className="row" style={{ justifyContent: 'space-between', padding: '16px 16px 0' }}>
          <h2 id="report-title">Report this listing</h2>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><X size={16} aria-hidden="true" /></button>
        </div>

        {submitted ? (
          <div className="empty">
            <CheckCircle2 size={32} color="var(--success)" aria-hidden="true" />
            <p className="empty-title" role="status">Report sent</p>
            <p className="empty-desc">Thanks. Your report about this listing has been recorded.</p>
            <button type="button" className="btn" style={{ marginTop: 8 }} onClick={onClose}>Close</button>
          </div>
        ) : (
          <form className="stack" style={{ padding: 16 }} onSubmit={submit}>
            <p className="text-sm break">{job.title} · {job.company_name}</p>
            <fieldset className="stack" style={{ border: 0, gap: 8 }}>
              <legend className="label">What's wrong?</legend>
              {REASONS.map((r) => (
                <label key={r.id} className="option" data-checked={selected === r.id}>
                  <input type="radio" name="reason" value={r.id} checked={selected === r.id} onChange={() => setSelected(r.id)} style={{ accentColor: 'var(--brand)' }} />
                  <span><span className="font-medium" style={{ display: 'block' }}>{r.label}</span><span className="text-xs muted">{r.hint}</span></span>
                </label>
              ))}
            </fieldset>
            <div>
              <label className="label" htmlFor="report-details">More details (optional)</label>
              <textarea id="report-details" className="textarea" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm" style={{ color: 'var(--warning)' }}>{error}</p>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn" disabled={!selected || submitting}>{submitting ? 'Sending…' : 'Send report'}</button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};
