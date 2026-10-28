import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

// ---------- Toasts ----------
interface ToastItem { id: number; text: string; kind: 'info' | 'error'; action?: { label: string; run: () => void } }
let toasts: ToastItem[] = [];
let toastId = 0;
const toastListeners = new Set<() => void>();
const emitToasts = () => toastListeners.forEach((l) => l());

export function toast(text: string, kind: ToastItem['kind'] = 'info', action?: ToastItem['action']): void {
  const id = ++toastId;
  toasts = [...toasts, { id, text, kind, action }];
  emitToasts();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emitToasts(); }, kind === 'error' ? 8000 : 4500);
}

export function Toasts() {
  const list = useSyncExternalStore((l) => { toastListeners.add(l); return () => toastListeners.delete(l); }, () => toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>
          <span>{t.text}</span>
          {t.action && <button onClick={() => { t.action!.run(); toasts = toasts.filter((x) => x.id !== t.id); emitToasts(); }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}

// ---------- Dialog ----------
export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby="modal-title">
      {open && (
        <>
          <div className="modal-body">
            <h2 id="modal-title">{title}</h2>
            {children}
          </div>
          {footer && <div className="modal-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

// ---------- Form fields ----------
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

/** A text input that edits a value in the store. */
export function Text({ value, onChange, placeholder, type = 'text', label }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; label?: string }) {
  return <input className="input" type={type} value={value} placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)} />;
}

export function Area({ value, onChange, placeholder, rows = 3, label }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; label?: string }) {
  return <textarea className="textarea" rows={rows} value={value} placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)} />;
}

export function Busy({ label, onStop }: { label: string; onStop?: () => void }) {
  return (
    <div className="busy" role="status">
      <span className="spinner" aria-hidden="true" />
      <span style={{ flex: 1 }}>{label}…</span>
      {onStop && <button className="btn sm ghost" onClick={onStop}>Stop</button>}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty"><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((i) => (
        <button key={i.id} role="tab" aria-selected={value === i.id} onClick={() => onChange(i.id)}>{i.label}</button>
      ))}
    </div>
  );
}

/** Run an async job with a busy state and a Stop button. */
export function useJob() {
  const [label, setLabel] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  async function run<T>(name: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLabel(name);
    try {
      return await fn(c.signal);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code !== 'aborted' && err.name !== 'AbortError') toast(err.message || 'Something went wrong.', 'error');
      return undefined;
    } finally {
      if (ctrl.current === c) { setLabel(null); ctrl.current = null; }
    }
  }
  return { busy: label, run, stop: () => ctrl.current?.abort() };
}

export async function copyText(text: string, what = 'Copied'): Promise<void> {
  try { await navigator.clipboard.writeText(text); toast(`${what} to the clipboard.`); }
  catch { toast('Your browser blocked the clipboard. Select the text and copy it instead.', 'error'); }
}
