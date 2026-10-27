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
  return (
    <div className={`notice ${notice.kind === 'info' ? 'info' : ''}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      <span className="grow">{notice.message}</span>
      <button type="button" className="btn btn-outline btn-sm" onClick={onClose} aria-label="OK, dismiss this message">OK</button>
    </div>
  );
};
