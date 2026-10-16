import React, { useCallback, useEffect, useRef, useState } from 'react';

export type NoticeKind = 'error' | 'info';
export interface NoticeState { message: string; kind: NoticeKind }

/** Small transient message for failures that would otherwise be silent (save, report, toggle…). */
export function useNotice(autoDismissMs = 6000) {
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const clear = useCallback(() => setNotice(null), []);
  const show = useCallback((message: string, kind: NoticeKind = 'error') => {
    setNotice({ message, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(null), autoDismissMs);
  }, [autoDismissMs]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { notice, show, clear };
}

export const Notice: React.FC<{ notice: NoticeState | null; onClose: () => void }> = ({ notice, onClose }) => {
  if (!notice) return null;
  const isError = notice.kind === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      style={{
        position: 'fixed', left: 8, right: 8, bottom: 56, zIndex: 100000,
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
        background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
        border: `1px solid ${isError ? 'var(--amber-400)' : 'var(--border-strong)'}`,
        fontSize: 12, lineHeight: 1.35,
      }}
    >
      <span style={{ flex: 1 }}>{notice.message}</span>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Dismiss message" style={{ padding: '2px 8px' }}>
        OK
      </button>
    </div>
  );
};
