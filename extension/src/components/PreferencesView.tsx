import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, Save } from '../lib/icons';
import { Preferences } from '../types';
import { CATEGORIES, EMPLOYMENT_LABELS, ROLES, SENIORITIES } from '../lib/format';
import { SyncSetting } from './SyncSetting';
import { ConnectionsSetting } from './ConnectionsSetting';

const SITE = 'https://joblyextension.netlify.app';
const HELP = [['Guides', '/guides'], ['FAQ', '/faq'], ['Support', '/support'], ['Privacy', '/privacy']] as const;

interface PreferencesViewProps {
  preferences: Preferences;
  onSave: (prefs: Preferences) => Promise<void>;
  /** Re-open the first-run welcome tour. */
  onReplayWelcome?: () => void;
  /** Dashboard: lay the groups out in two columns on wide screens. */
  wide?: boolean;
}

export const PreferencesView: React.FC<PreferencesViewProps> = ({ preferences, onSave, onReplayWelcome, wide }) => {
  const [prefs, setPrefs] = useState<Preferences>(preferences);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Pick up the stored values when they arrive after first paint (don't clobber unsaved edits otherwise)
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setPrefs(preferences); }, [preferences, dirty]);
  const edit = (patch: Partial<Preferences>) => { setDirty(true); setJustSaved(false); setPrefs((p) => ({ ...p, ...patch })); };

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(prefs);
      setJustSaved(true);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={`section${wide ? ' prefs-wide' : ''}`} onSubmit={submit}>
      <div>
        <h2>Preferences</h2>
        <p className="text-sm">Tell Jobly what you're looking for. "For you" in the jobs list uses these.</p>
      </div>

      <fieldset className="stack" style={{ border: 0 }}>
        <legend className="label">Roles you want</legend>
        {ROLES.map((role) => {
          const checked = prefs.roles.includes(role.id);
          return (
            <button key={role.id} type="button" role="checkbox" aria-checked={checked} className="option" onClick={() => edit({ roles: toggle(prefs.roles, role.id) })}>
              <span className="tick" aria-hidden="true"><Check size={14} /></span>
              <span>
                <span className="font-medium" style={{ display: 'block' }}>{role.label}</span>
                <span className="text-xs muted">{role.hint}</span>
              </span>
            </button>
          );
        })}
        <details className="more-roles" open={prefs.roles.some((r) => CATEGORIES.some((c) => c.id === r && c.group !== 'Business & other'))}>
          <summary className="text-sm font-medium">More development, IT and design roles</summary>
          <div className="stack" style={{ marginTop: 8 }}>
            {CATEGORIES.filter((c) => c.group !== 'Business & other').map((c) => {
              const checked = prefs.roles.includes(c.id);
              return (
                <button key={c.id} type="button" role="checkbox" aria-checked={checked} className="option" onClick={() => edit({ roles: toggle(prefs.roles, c.id) })}>
                  <span className="tick" aria-hidden="true"><Check size={14} /></span>
                  <span>
                    <span className="font-medium" style={{ display: 'block' }}>{c.label}</span>
                    <span className="text-xs muted">{c.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </details>
        {prefs.roles.length === 0 && <p className="hint" role="status">No roles selected: "For you" will show every role.</p>}
      </fieldset>

      <fieldset style={{ border: 0 }}>
        <legend className="label">Experience level</legend>
        <div className="row wrap" role="group" aria-label="Experience level">
          {SENIORITIES.map((s) => (
            <button key={s.id} type="button" className="chip" aria-pressed={prefs.seniorities.includes(s.id)} onClick={() => edit({ seniorities: toggle(prefs.seniorities, s.id) })}>{s.label}</button>
          ))}
        </div>
      </fieldset>

      <label className="row card" style={{ padding: 12, justifyContent: 'space-between' }}>
        <span><span className="font-medium" style={{ display: 'block' }}>Remote only</span><span className="text-xs muted">Hide on-site and hybrid jobs</span></span>
        <input type="checkbox" className="switch" role="switch" checked={prefs.remote_only} onChange={(e) => edit({ remote_only: e.target.checked })} />
      </label>

      <div>
        <label className="label" htmlFor="kw-in">Keywords to include</label>
        <input id="kw-in" className="input" maxLength={500} value={prefs.custom_keywords} onChange={(e) => edit({ custom_keywords: e.target.value })} placeholder="e.g. Next.js, PyTorch, Figma" />
        <p className="hint">Separate with commas.</p>
      </div>
      <div>
        <label className="label" htmlFor="kw-out">Keywords to leave out</label>
        <input id="kw-out" className="input" maxLength={500} value={prefs.excluded_keywords} onChange={(e) => edit({ excluded_keywords: e.target.value })} placeholder="e.g. contract, unpaid, sales" />
      </div>

      <fieldset style={{ border: 0 }} className="stack">
        <legend className="label">Dealbreakers</legend>
        <div>
          <span className="text-sm" id="job-types-label">Job types</span>
          <div className="row wrap" role="group" aria-labelledby="job-types-label" style={{ marginTop: 6 }}>
            {Object.entries(EMPLOYMENT_LABELS).map(([id, label]) => (
              <button key={id} type="button" className="chip" aria-pressed={(prefs.employment_types ?? []).includes(id)} onClick={() => edit({ employment_types: toggle(prefs.employment_types ?? [], id) })}>{label}</button>
            ))}
          </div>
          <p className="hint">None selected means any type. Postings that don't say count as full-time.</p>
        </div>
        <div>
          <label className="label" htmlFor="min-salary">Lowest yearly salary</label>
          <input id="min-salary" type="number" inputMode="numeric" min={0} step={5000} className="input" style={{ maxWidth: 220 }}
            value={prefs.min_salary || ''} placeholder="e.g. 120000" onChange={(e) => edit({ min_salary: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
          <p className="hint">Jobs that list less are hidden. Jobs without a salary, and hourly rates, still show.</p>
        </div>
      </fieldset>

      <label className="row card" style={{ padding: 12, justifyContent: 'space-between' }}>
        <span><span className="font-medium" style={{ display: 'block' }}>Desktop alerts</span><span className="text-xs muted">One notification when new jobs match</span></span>
        <input type="checkbox" className="switch" role="switch" checked={prefs.notify_enabled} onChange={(e) => edit({ notify_enabled: e.target.checked })} />
      </label>

      <SyncSetting />
      <ConnectionsSetting />

      <div className="row">
        <button type="submit" className="btn grow" disabled={saving}><Save size={14} aria-hidden="true" /> {saving ? 'Saving…' : 'Save preferences'}</button>
      </div>
      {onReplayWelcome && <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onReplayWelcome}>Show the welcome tour again</button>}
      <p role="status" className="text-sm" style={{ color: 'var(--success)' }}>{justSaved && 'Saved on this device.'}</p>

      <nav aria-label="Help">
        <p className="label">Help</p>
        <div className="row wrap">
          {HELP.map(([label, path]) => (
            <a key={path} className="btn btn-ghost btn-sm" href={SITE + path} target="_blank" rel="noopener noreferrer">{label} <ExternalLink size={12} aria-hidden="true" /></a>
          ))}
        </div>
      </nav>
    </form>
  );
};
