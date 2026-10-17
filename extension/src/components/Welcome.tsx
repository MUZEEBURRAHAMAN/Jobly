import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Exploded, Padlock, Sieve } from '@lucasmarkes/hairline/react';
import { Preferences } from '../types';
import { DEFAULT_ROLE_IDS, ROLES, SENIORITIES } from '../lib/format';

interface WelcomeProps {
  initial: Preferences | null;
  onFinish: (prefs: Preferences) => Promise<void>;
  /** Leave without choosing (defaults stay). */
  onSkip: () => void;
  compact?: boolean;
}

const FIGURES = [Exploded, Sieve, Padlock]; // decorative only: never a focusable figure (Riffle is), the wrapper is aria-hidden
const DEFAULTS: Preferences = {
  roles: DEFAULT_ROLE_IDS, seniorities: ['intern', 'junior', 'mid', 'senior', 'lead'], locations: [],
  remote_only: false, custom_keywords: '', excluded_keywords: '', notify_enabled: true, sync_interval_mins: 30,
};

export const Welcome: React.FC<WelcomeProps> = ({ initial, onFinish, onSkip, compact }) => {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<Preferences>(initial ?? DEFAULTS);
  const [saving, setSaving] = useState(false);
  const Figure = FIGURES[step];
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const last = step === 2;

  const finish = async () => {
    setSaving(true);
    try {
      await onFinish(prefs);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`welcome${compact ? ' compact' : ''}`} aria-labelledby="welcome-title">
      <p className="text-sm muted" aria-live="polite">Step {step + 1} of 3</p>
      <div className="progress" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>

      <div className="welcome-art" aria-hidden="true"><Figure intensity={0.6} play /></div>

      {step === 0 && (
        <div className="stack">
          <h1 id="welcome-title" className="text-2xl">Welcome to Jobly</h1>
          <p>Stop checking dozens of career pages. Jobly reads hundreds of company job boards for you and keeps the good matches in one calm list.</p>
          <ul className="steps">
            <li><strong>Read for you.</strong> New roles are collected from Greenhouse, Lever, Ashby and more.</li>
            <li><strong>Matched to you.</strong> Tell us what you want and your list is filtered to it.</li>
            <li><strong>Apply directly.</strong> Every job links to the company's own application page.</li>
          </ul>
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          <h1 id="welcome-title" className="text-2xl">What are you looking for?</h1>
          <p className="text-sm">Pick as many as you like. You can change this any time in Preferences.</p>
          <fieldset className="stack" style={{ border: 0, gap: 8 }}>
            <legend className="label">Roles</legend>
            {ROLES.map((r) => {
              const checked = prefs.roles.includes(r.id);
              return (
                <button key={r.id} type="button" role="checkbox" aria-checked={checked} className="option" onClick={() => setPrefs({ ...prefs, roles: toggle(prefs.roles, r.id) })}>
                  <span className="tick" aria-hidden="true"><Check size={14} /></span>
                  <span><span className="font-medium" style={{ display: 'block' }}>{r.label}</span><span className="text-xs muted">{r.hint}</span></span>
                </button>
              );
            })}
          </fieldset>
          <fieldset style={{ border: 0 }}>
            <legend className="label">Experience</legend>
            <div className="row wrap" role="group" aria-label="Experience level">
              {SENIORITIES.map((s) => <button key={s.id} type="button" className="chip" aria-pressed={prefs.seniorities.includes(s.id)} onClick={() => setPrefs({ ...prefs, seniorities: toggle(prefs.seniorities, s.id) })}>{s.label}</button>)}
            </div>
          </fieldset>
          <label className="row card" style={{ padding: 12, justifyContent: 'space-between' }}>
            <span><span className="font-medium" style={{ display: 'block' }}>Remote only</span><span className="text-xs muted">Hide on-site and hybrid jobs</span></span>
            <input type="checkbox" className="switch" role="switch" checked={prefs.remote_only} onChange={(e) => setPrefs({ ...prefs, remote_only: e.target.checked })} />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <h1 id="welcome-title" className="text-2xl">Stay in the loop</h1>
          <label className="row card" style={{ padding: 12, justifyContent: 'space-between' }}>
            <span><span className="font-medium" style={{ display: 'block' }}>Desktop alerts</span><span className="text-xs muted">One notification when new jobs match. No spam.</span></span>
            <input type="checkbox" className="switch" role="switch" checked={prefs.notify_enabled} onChange={(e) => setPrefs({ ...prefs, notify_enabled: e.target.checked })} />
          </label>
          <div className="card" style={{ padding: 12 }}>
            <h2 className="text-lg">Your privacy</h2>
            <p className="text-sm" style={{ marginTop: 4 }}>No account, no email, no tracking, no ads. Your preferences, saved jobs and alerts stay on this device. Your preferences and search words are sent with each request only to pick matching jobs; the server doesn't keep them. Company logos come from Google's favicon service.</p>
          </div>
        </div>
      )}

      <div className="welcome-actions">
        {step > 0 ? <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={14} aria-hidden="true" /> Back</button> : <button type="button" className="btn btn-ghost" onClick={onSkip}>Skip for now</button>}
        {last ? (
          <button type="button" className="btn btn-brand" onClick={finish} disabled={saving}>{saving ? 'Saving…' : 'Start exploring'} <ArrowRight size={14} aria-hidden="true" /></button>
        ) : (
          <button type="button" className="btn" onClick={() => setStep(step + 1)}>{step === 0 ? 'Get started' : 'Next'} <ArrowRight size={14} aria-hidden="true" /></button>
        )}
      </div>
    </section>
  );
};
