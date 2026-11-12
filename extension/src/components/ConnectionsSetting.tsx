import React, { useEffect, useState } from 'react';
import { calendarConfigured, disconnectGoogle, HUNTER_KEY } from '../lib/integrations';
import { APOLLO_KEY, BRAVE_KEY, loadKey, saveKey } from '../lib/profileSearch';
import { FEATURES } from '../lib/config';

const SERVICES = [
  { key: BRAVE_KEY, id: 'brave-key', name: 'Brave Search', what: 'finds public profile pages (LinkedIn, Behance, Dribbble, GitHub) for a company and role', site: 'api-dashboard.search.brave.com', url: 'https://api-dashboard.search.brave.com/' },
  { key: APOLLO_KEY, id: 'apollo-key', name: 'Apollo', what: 'shows who works at a company in which role', site: 'apollo.io', url: 'https://www.apollo.io/' },
  { key: HUNTER_KEY, id: 'hunter-key', name: 'Hunter', what: 'finds work email addresses at a company', site: 'hunter.io', url: 'https://hunter.io/' },
] as const;

const KeyRow: React.FC<{ s: (typeof SERVICES)[number]; onSaved: (msg: string) => void }> = ({ s, onSaved }) => {
  const [value, setValue] = useState('');
  const [stored, setStored] = useState(false);
  useEffect(() => { void loadKey(s.key).then((k) => setStored(!!k)); }, [s.key]);
  const save = async () => {
    if (await saveKey(s.key, value)) { setStored(!!value.trim()); onSaved(value.trim() ? `${s.name} key saved on this device.` : `${s.name} key removed.`); setValue(''); }
  };
  return (
    <div>
      <label className="label" htmlFor={s.id}>{s.name} API key</label>
      <div className="row">
        <input id={s.id} type="password" autoComplete="off" className="input" value={value} placeholder={stored ? 'Saved. Paste a new key to replace it' : `Paste your key from ${s.site}`} onChange={(e) => setValue(e.target.value)} />
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void save()} disabled={!value.trim() && !stored}>{value.trim() || !stored ? 'Save' : 'Remove'}</button>
      </div>
      <p className="hint">{s.name} {s.what}. <a href={s.url} target="_blank" rel="noopener noreferrer">Get a key</a></p>
    </div>
  );
};

/** Optional services with the user's own keys (People page), and Google Calendar for interviews. */
export const ConnectionsSetting: React.FC<{ onChange?: () => void }> = ({ onChange }) => {
  const [note, setNote] = useState('');
  const saved = (m: string) => { setNote(m); onChange?.(); };
  return (
    <fieldset className="card stack" style={{ padding: 12, border: '1px solid var(--border)' }}>
      <legend className="label" style={{ padding: '0 4px' }}>Connections</legend>
      <p className="text-sm muted">Each is optional and uses your own account, straight from this browser. Jobly never sees the keys or the searches.</p>
      {SERVICES.map((s) => <KeyRow key={s.key} s={s} onSaved={saved} />)}
      {FEATURES.tracker && <div className="row" style={{ justifyContent: 'space-between' }}>
        <span><span className="font-medium" style={{ display: 'block' }}>Google Calendar</span>
          <span className="text-xs muted">{calendarConfigured() ? 'Import interviews from the Interviews page. Read-only.' : "Calendar import isn't set up in this version yet."}</span></span>
        {calendarConfigured() && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void disconnectGoogle().then(() => setNote('Google Calendar disconnected.'))}>Disconnect</button>}
      </div>}
      <p className="hint" role="status">{note}</p>
    </fieldset>
  );
};
