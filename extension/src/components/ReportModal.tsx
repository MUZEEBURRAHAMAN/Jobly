import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Flag, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Job } from '../types';
import { api } from '../lib/api';

interface ReportModalProps {
  job: Job;
  onClose: () => void;
}

const REPORT_REASONS = [
  { id: 'fake',    label: 'FAKE / SCAM JOB',    description: 'This listing appears fraudulent or deceptive' },
  { id: 'expired', label: 'EXPIRED LISTING',     description: 'This role has already been filled or closed' },
  { id: 'misinfo', label: 'WRONG INFORMATION',   description: 'Salary, location or requirements are incorrect' },
  { id: 'spam',    label: 'SPAM / DUPLICATE',    description: 'This is a repeated or spam posting' },
  { id: 'other',   label: 'OTHER REASON',        description: 'Something else is wrong with this listing' },
];

export const ReportModal: React.FC<ReportModalProps> = ({ job, onClose }) => {
  const [selected, setSelected] = useState<string>('');
  const [details, setDetails]   = useState('');
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
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const active = document.activeElement;
      if (!dialogRef.current?.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); opener?.focus?.(); };
  }, []);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    const ok = await api.reportJob(job.id, selected, details);
    setSubmitting(false);
    if (!ok) {
      setError("Couldn't send your report. Check your connection and try again.");
      return;
    }
    setSubmitted(true);
  };

  const modal = (
    /* ── Full-viewport overlay, portalled into document.body ── */
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.60)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        padding: 20,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Report listing"
        style={{
          background: 'var(--bg-primary)',
          border: '2px solid var(--border-default)',
          borderRadius: 0,
          width: '100%',
          maxWidth: 420,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          boxShadow: '6px 6px 0 var(--accent)',
          fontFamily: 'var(--font-sans)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '2px solid var(--border-default)',
          background: 'var(--bg-secondary)',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flag size={14} color="var(--accent)" strokeWidth={2.5} />
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--text-primary)',
            }}>
              REPORT LISTING
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              lineHeight: 1,
            }}
            aria-label="Close report dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: 16 }}>
          {submitted ? (
            /* ── Success State ── */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: '28px 8px',
              textAlign: 'center',
            }}>
              <CheckCircle2 size={40} color="var(--green)" strokeWidth={2} />
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                REPORT SENT
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Thanks — your report about this listing<br />has been recorded.
              </p>
              <button
                onClick={onClose}
                className="btn btn-primary btn-sm"
                style={{ marginTop: 8, fontFamily: 'var(--font-mono)' }}
              >
                CLOSE
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>

              {/* Job reference pill */}
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                padding: '7px 10px',
                marginBottom: 16,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}>
                <AlertTriangle size={10} color="var(--accent)" />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {job.title.toUpperCase()}
                </span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>{job.company_name.toUpperCase()}</span>
              </div>

              {/* Reason label */}
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                marginBottom: 8,
                marginTop: 0,
              }}>
                SELECT A REASON
              </p>

              {/* Reason radio cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '9px 10px',
                      border: `1.5px solid ${selected === r.id ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      background: selected === r.id ? 'var(--accent-soft)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.id}
                      checked={selected === r.id}
                      onChange={() => setSelected(r.id)}
                      style={{ marginTop: 2, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div>
                      <p style={{
                        margin: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: selected === r.id ? 'var(--accent)' : 'var(--text-primary)',
                        letterSpacing: '0.04em',
                      }}>
                        {r.label}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                        {r.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Optional textarea */}
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                marginBottom: 6,
                marginTop: 0,
              }}>
                ADDITIONAL DETAILS (OPTIONAL)
              </p>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe the issue..."
                aria-label="Additional details (optional)"
                maxLength={500}
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1.5px solid var(--border-subtle)',
                  borderRadius: 0,
                  padding: '8px 10px',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-subtle)')}
              />

              {error && (
                <p role="alert" style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--amber-400)' }}>{error}</p>
              )}

              {/* Footer */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px solid var(--border-subtle)',
              }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary btn-sm"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={!selected || submitting}
                  className="btn btn-primary btn-sm"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    opacity: selected ? 1 : 0.4,
                    cursor: selected ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Flag size={11} />
                  {submitting ? 'SENDING...' : 'SUBMIT REPORT'}
                </button>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );

  // Portal: mount into document.body so position:fixed escapes all overflow/transform contexts
  return createPortal(modal, document.body);
};
