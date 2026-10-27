import React, { useEffect, useState } from 'react';
import { onKeysChanged, readKey, writeKey } from '../lib/userData';
import { SYNC_SETTING, SYNC_STATE, SyncState } from '../lib/sync';

/** Opt-in sync across the user's own Chrome browsers. */
export const SyncSetting: React.FC = () => {
  const [on, setOn] = useState(false);
  const [state, setState] = useState<SyncState | null>(null);
  useEffect(() => {
    const load = async () => { setOn((await readKey<boolean>(SYNC_SETTING)) === true); setState((await readKey<SyncState>(SYNC_STATE)) ?? null); };
    void load();
    return onKeysChanged([SYNC_SETTING, SYNC_STATE], () => void load());
  }, []);
  const when = state?.syncedAt ? new Date(state.syncedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
  return (
    <div className="card" style={{ padding: 12 }}>
      <label className="row" style={{ justifyContent: 'space-between', cursor: 'pointer' }}>
        <span><span className="font-medium" style={{ display: 'block' }}>Sync across your Chrome browsers</span>
          <span className="text-xs muted">Preferences, tracker, interviews, tasks and profiles follow you to Chrome on your other computers, through your Google account. Jobly's server never sees them.</span></span>
        <input type="checkbox" className="switch" role="switch" checked={on} onChange={(e) => { setOn(e.target.checked); void writeKey(SYNC_SETTING, e.target.checked); }} />
      </label>
      {on && (
        <p className="hint" role="status">
          {state?.error ? `Sync paused: ${state.error}` : when ? `Last synced ${when}.` : 'Syncing…'}
          {state?.trimmed && !state.error ? ' Chrome allows about 100 KB, so only your newest applications and shorter notes sync. Everything stays complete on this computer.' : ''}
        </p>
      )}
    </div>
  );
};
