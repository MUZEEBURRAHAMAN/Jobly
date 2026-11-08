import React, { useEffect, useState } from 'react';
import { AiProvider, AiSettings, chromeAiStatus, CLAUDE_MODELS, loadAi, loadAnthropicKey, saveAi, saveAnthropicKey } from '../lib/ai';

const STATUS: Record<string, string> = { available: 'ready on this computer', downloadable: 'downloads the first time you use it', downloading: 'downloading', unavailable: "not available in this Chrome" };

/** Settings › AI: off, Chrome's built-in model, or Claude with the user's own key. */
export const AiSetting: React.FC = () => {
  const [ai, setAi] = useState<AiSettings | null>(null);
  const [chrome, setChrome] = useState('unavailable');
  const [key, setKey] = useState('');
  const [stored, setStored] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { void loadAi().then(setAi); void chromeAiStatus().then(setChrome); void loadAnthropicKey().then((k) => setStored(!!k)); }, []);
  if (!ai) return null;
  const update = async (patch: Partial<AiSettings>) => { const next = { ...ai, ...patch }; setAi(next); await saveAi(next); };
  const choose = async (provider: AiProvider) => { await update({ provider }); setNote(''); };
  const saveKey = async () => { if (await saveAnthropicKey(key)) { setStored(!!key.trim()); setKey(''); setNote(key.trim() ? 'API key saved on this device.' : 'API key removed.'); } };
  return (
    <fieldset className="card stack" style={{ padding: 12, border: '1px solid var(--border)' }}>
      <legend className="label" style={{ padding: '0 4px' }}>AI</legend>
      <p className="text-sm">Optional. Used to reword your resume and draft cover letters for a job. Tailoring works without it.</p>
      <div className="stack" role="radiogroup" aria-label="AI">
        {([['off', 'Off', 'Only suggestions that reorder what you wrote'], ['chrome', "Chrome's built-in AI", `Runs on this computer, nothing leaves it. Status: ${STATUS[chrome] ?? chrome}`], ['anthropic', 'Claude, with your own API key', 'Sent from this browser to Anthropic with your key; Jobly never sees it. Anthropic charges your account.']] as const).map(([id, label, hint]) => (
          <label key={id} className="option" data-checked={ai.provider === id}>
            <input type="radio" name="ai-provider" className="sr-only" checked={ai.provider === id} disabled={id === 'chrome' && chrome === 'unavailable'} onChange={() => void choose(id)} />
            <span className="grow"><span className="font-medium" style={{ display: 'block' }}>{label}</span><span className="text-xs muted">{hint}</span></span>
          </label>
        ))}
      </div>
      {ai.provider === 'anthropic' && (
        <div className="stack">
          <div>
            <label className="label" htmlFor="anthropic-key">Anthropic API key</label>
            <div className="row">
              <input id="anthropic-key" type="password" autoComplete="off" className="input" value={key} placeholder={stored ? 'Saved. Paste a new key to replace it' : 'sk-ant-…'} onChange={(e) => setKey(e.target.value)} />
              <button type="button" className="btn btn-outline btn-sm" onClick={() => void saveKey()} disabled={!key.trim() && !stored}>{key.trim() || !stored ? 'Save' : 'Remove'}</button>
            </div>
            <p className="hint">Kept on this device only, never in backups or sync. Get one at console.anthropic.com.</p>
          </div>
          <div>
            <label className="label" htmlFor="ai-model">Model</label>
            <select id="ai-model" className="select" value={ai.model} onChange={(e) => void update({ model: e.target.value })}>
              {CLAUDE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
        </div>
      )}
      <p className="hint" role="status">{note}</p>
    </fieldset>
  );
};
