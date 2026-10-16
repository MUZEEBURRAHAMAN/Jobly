import React, { useEffect, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { Preferences } from '../types';
import { ROLES, SENIORITIES } from '../lib/format';

interface PreferencesViewProps {
  preferences: Preferences;
  /** Resolve `false` when the change only reached this device (server unreachable). */
  onSave: (prefs: Preferences) => Promise<boolean | void>;
  /** Re-open the first-run welcome tour. */
  onReplayWelcome?: () => void;
}

export const PreferencesView: React.FC<PreferencesViewProps> = ({ preferences, onSave, onReplayWelcome }) => {
  const [prefs, setPrefs] = useState<Preferences>(preferences);
  const [saving, setSaving] = useState(false);
  const [savedState, setSavedState] = useState<'synced' | 'local' | null>(null);

  // Pick up the server/cached values when they arrive after first paint (don't clobber unsaved edits otherwise)
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setPrefs(preferences); }, [preferences, dirty]);
  const edit = (patch: Partial<Preferences>) => { setDirty(true); setSavedState(null); setPrefs((p) => ({ ...p, ...patch })); };

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const synced = await onSave(prefs);
      setSavedState(synced === false ? 'local' : 'synced');
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="section" onSubmit={submit}>
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

      <label className="row card" style={{ padding: 12, justifyContent: 'space-between' }}>
        <span><span className="font-medium" style={{ display: 'block' }}>Desktop alerts</span><span className="text-xs muted">One notification when new jobs match</span></span>
        <input type="checkbox" className="switch" role="switch" checked={prefs.notify_enabled} onChange={(e) => edit({ notify_enabled: e.target.checked })} />
      </label>

      <div className="row">
        <button type="submit" className="btn grow" disabled={saving}><Save size={14} aria-hidden="true" /> {saving ? 'Saving…' : 'Save preferences'}</button>
      </div>
      {onReplayWelcome && <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onReplayWelcome}>Show the welcome tour again</button>}
      <p role="status" className="text-sm" style={{ color: savedState === 'local' ? 'var(--warning)' : 'var(--success)' }}>
        {savedState === 'synced' && 'Saved.'}
        {savedState === 'local' && "Saved on this device only. We couldn't reach the server."}
      </p>
    </form>
  );
};
