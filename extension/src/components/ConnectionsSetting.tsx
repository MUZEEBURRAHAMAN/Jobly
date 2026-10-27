import React, { useEffect, useState } from 'react';
import { calendarConfigured, disconnectGoogle, loadHunterKey, saveHunterKey } from '../lib/integrations';

/** Optional services: the user's own Hunter key for contacts, and Google Calendar for interviews. */
export const ConnectionsSetting: React.FC<{ onChange?: () => void }> = ({ onChange }) => {
  const [key, setKey] = useState('');
  const [stored, setStored] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { void loadHunterKey().then((k) => { setStored(!!k); }); }, []);
  const save = async () => { if (await saveHunterKey(key)) { setStored(!!key.trim()); setKey(''); setNote(key.trim() ? 'Hunter key saved on this device.' : 'Hunter key removed.'); onChange?.(); } };
  return (
    <fieldset className="card stack" style={{ padding: 12, border: '1px solid var(--border)' }}>
      <legend className="label" style={{ padding: '0 4px' }}>Connections</legend>
      <div>
        <label className="label" htmlFor="hunter-key">Hunter API key (for finding contacts)</label>
        <div className="row">
          <input id="hunter-key" type="password" autoComplete="off" className="input" value={key} placeholder={stored ? 'Saved. Paste a new key to replace it' : 'Paste your key from hunter.io'} onChange={(e) => setKey(e.target.value)} />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void save()} disabled={!key.trim() && !stored}>{key.trim() || !stored ? 'Save' : 'Remove'}</button>
        </div>
        <p className="hint">Your own Hunter account, used straight from this browser. Jobly's server never sees the key or the searches.</p>
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span><span className="font-medium" style={{ display: 'block' }}>Google Calendar</span>
          <span className="text-xs muted">{calendarConfigured() ? 'Import interviews from the Interviews page. Read-only.' : "Calendar import isn't set up in this version yet."}</span></span>
        {calendarConfigured() && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void disconnectGoogle().then(() => setNote('Google Calendar disconnected.'))}>Disconnect</button>}
      </div>
      <p className="hint" role="status">{note}</p>
    </fieldset>
  );
};
