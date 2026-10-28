import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from '../lib/icons';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Buttons along the bottom edge. */
  footer?: React.ReactNode;
  wide?: boolean;
}

/** Modal dialog: focus moves in, Tab stays inside, Escape closes, focus returns to the opener on close. */
export const Dialog: React.FC<DialogProps> = ({ title, onClose, children, footer, wide }) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, a[href], [tabindex]:not([tabindex="-1"])') ?? []);
    (focusables().find((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1], active = document.activeElement;
      if (!ref.current?.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); opener?.focus?.(); };
  }, []);

  return createPortal(
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={`dialog${wide ? ' dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close"><X size={16} aria-hidden="true" /></button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};
