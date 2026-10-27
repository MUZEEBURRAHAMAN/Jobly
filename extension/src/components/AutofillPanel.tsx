import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, Wand } from '../lib/icons';
import { fillForm, FillItem, Proposal, proposeAnswers, ResumePayload, scanForm, ScanResult } from '../lib/autofill';
import { Profile, PROFILE_KEYS } from '../lib/profile';
import { readKey } from '../lib/userData';
import { safeHttpUrl } from '../lib/url';
import type { ResumeFile } from './ProfileView';

type Phase = { name: 'idle' } | { name: 'scanning' } | { name: 'review'; proposals: Proposal[]; frames: string[] } | { name: 'done'; filled: number; failed: number } | { name: 'error'; message: string };

/**
 * "Autofill this page": scan the form, show every proposed answer for review, fill only what the user keeps checked.
 * It works on the tab Jobly was opened on (activeTab); Jobly never presses Submit.
 */
export const AutofillPanel: React.FC<{ tabId: number; profile: Profile | null; onFilled: () => void; openProfile: () => void }> = ({ tabId, profile, onFilled, openProfile }) => {
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });

  const scan = async () => {
    if (!profile) return;
    setPhase({ name: 'scanning' });
    try {
      const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: scanForm });
      const result = res?.result as ScanResult | undefined;
      const resumes = (await readKey<Record<string, ResumeFile>>(PROFILE_KEYS.resume)) ?? {};
      const fields = result?.fields ?? [];
      if (!fields.length) { setPhase({ name: 'review', proposals: [], frames: result?.frames ?? [] }); return; }
      setPhase({ name: 'review', proposals: proposeAnswers(fields, profile, !!resumes[profile.id]), frames: result?.frames ?? [] });
    } catch {
      setPhase({ name: 'error', message: "Chrome doesn't let extensions read this page. Open the application form on its own page and try again." });
    }
  };

  const update = (i: number, patch: Partial<Proposal>) => setPhase((p) => (p.name === 'review' ? { ...p, proposals: p.proposals.map((x, j) => (j === i ? { ...x, ...patch } : x)) } : p));

  const fill = async () => {
    if (phase.name !== 'review' || !profile) return;
    const items: FillItem[] = phase.proposals.filter((p) => p.include && p.value).map((p) => ({ id: p.field.id, kind: p.field.kind, value: p.value }));
    const resumes = (await readKey<Record<string, ResumeFile>>(PROFILE_KEYS.resume)) ?? {};
    const r = resumes[profile.id];
    const resume: ResumePayload | null = r ? { name: r.name, type: r.type, data: r.data } : null;
    try {
      const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: fillForm, args: [items, resume] });
      const out = res?.result as { filled: number; failed: string[] } | undefined;
      setPhase({ name: 'done', filled: out?.filled ?? 0, failed: out?.failed.length ?? 0 });
      onFilled();
    } catch {
      setPhase({ name: 'error', message: "Couldn't fill this page. It may have changed; scan it again." });
    }
  };

  if (!profile) {
    return <div className="card autofill"><p className="text-sm">Autofill uses your profile. <button type="button" className="link" onClick={openProfile}>Set up your profile</button> first.</p></div>;
  }

  return (
    <div className="card autofill" aria-live="polite">
      {phase.name === 'idle' && (
        <div className="stack">
          <p className="text-sm">Fill this application form from your profile “{profile.label}”. You'll check every answer first, and you press Submit yourself.</p>
          <button type="button" className="btn btn-brand btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => void scan()}><Wand size={14} aria-hidden="true" /> Autofill this page</button>
        </div>
      )}
      {phase.name === 'scanning' && <p className="text-sm">Reading the form…</p>}
      {phase.name === 'error' && <div className="stack"><p className="text-sm" role="alert">{phase.message}</p><button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => void scan()}>Try again</button></div>}
      {phase.name === 'review' && phase.proposals.length === 0 && (
        <div className="stack">
          <p className="text-sm">No form fields found on this page.</p>
          {phase.frames.map((src) => { const href = safeHttpUrl(src); return href && <a key={src} className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} href={href} target="_blank" rel="noopener noreferrer">Open the application form <ExternalLink size={14} aria-hidden="true" /></a>; })}
          {phase.frames.length > 0 && <p className="hint">The form is embedded from a hiring system. Open it, then use Autofill there.</p>}
        </div>
      )}
      {phase.name === 'review' && phase.proposals.length > 0 && (
        <div className="stack">
          <p className="text-sm"><span className="font-medium">{phase.proposals.filter((p) => p.include).length} answers ready.</span> Uncheck or edit any before filling.</p>
          <ul className="af-list">
            {phase.proposals.map((p, i) => (
              <li key={p.field.id} className={`af-row${p.answerId ? '' : ' af-empty'}`}>
                <input type="checkbox" id={`af-${p.field.id}`} checked={p.include} disabled={!p.value} onChange={(e) => update(i, { include: e.target.checked })} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <label htmlFor={`af-${p.field.id}`} className="text-xs muted break">{p.field.label || 'Unlabelled field'}{p.field.required ? ' (required)' : ''}{p.field.filled ? ' · already filled' : ''}</label>
                  {p.field.kind === 'file' ? <div className="text-sm">{p.value || 'No resume file in your profile'}</div>
                    : (p.field.kind === 'select' || p.field.kind === 'radio') ? (
                      <select className="select select-sm" style={{ width: '100%' }} aria-label={`Answer for ${p.field.label}`} value={p.value} onChange={(e) => update(i, { value: e.target.value, include: !!e.target.value })}>
                        <option value="">Leave as is</option>
                        {p.field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : p.field.kind === 'checkbox' ? <div className="text-xs muted">Tick this one yourself on the page</div>
                    : p.field.kind === 'textarea'
                      ? <textarea className="textarea" rows={3} aria-label={`Answer for ${p.field.label}`} value={p.value} placeholder="Leave empty" onChange={(e) => update(i, { value: e.target.value, include: !!e.target.value })} />
                      : <input className="input input-sm" aria-label={`Answer for ${p.field.label}`} value={p.value} placeholder="Leave empty" onChange={(e) => update(i, { value: e.target.value, include: !!e.target.value })} />}
                </div>
              </li>
            ))}
          </ul>
          <div className="row">
            <button type="button" className="btn btn-brand btn-sm" onClick={() => void fill()} disabled={!phase.proposals.some((p) => p.include)}>Fill {phase.proposals.filter((p) => p.include).length} fields</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhase({ name: 'idle' })}>Cancel</button>
          </div>
        </div>
      )}
      {phase.name === 'done' && (
        <div className="stack">
          <p className="text-sm row" style={{ color: 'var(--success)' }}><CheckCircle2 size={16} aria-hidden="true" /> Filled {phase.filled} field{phase.filled === 1 ? '' : 's'}{phase.failed ? `, ${phase.failed} couldn't be filled` : ''}.</p>
          <p className="text-sm">Filled fields are outlined in orange. Check the page, answer anything left, then submit it yourself.</p>
          <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => void scan()}>Scan again</button>
        </div>
      )}
    </div>
  );
};
