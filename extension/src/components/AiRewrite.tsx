import React, { useEffect, useState } from 'react';
import { Wand } from '../lib/icons';
import { AiError, AiSettings, chromeAiStatus, loadAi, runAi } from '../lib/ai';
import { guardRewrite, rewriteTask } from '../lib/aiGuard';
import { onKeysChanged } from '../lib/userData';
import { AI_KEY } from '../lib/ai';
import { Profile } from '../lib/profile';
import { JobAnalysis, Suggestion } from '../lib/tailor';

/** "Reword with AI": adds checked rewrite suggestions (summary and bullets) that passed the fact check. */
export const AiRewrite: React.FC<{ profile: Profile; analysis: JobAnalysis; role: string; company: string; description: string; notify: (m: string, kind?: 'error' | 'info') => void; onSuggestions: (s: Suggestion[]) => void }> =
  ({ profile, analysis, role, company, description, notify, onSuggestions }) => {
    const [ai, setAi] = useState<AiSettings | null>(null);
    const [busy, setBusy] = useState(false);
    const [dropped, setDropped] = useState<string[]>([]);
    useEffect(() => { const load = () => void loadAi().then(setAi); load(); return onKeysChanged([AI_KEY], load); }, []);
    if (!ai) return null;
    if (ai.provider === 'off') return <p className="hint">Want a reworded summary and bullets too? Turn on AI in Settings › AI: Chrome's built-in model (on this computer) or Claude with your own key.</p>;

    const run = async () => {
      setBusy(true); setDropped([]);
      try {
        if (ai.provider === 'chrome' && (await chromeAiStatus()) === 'downloadable') notify("Chrome is downloading its built-in AI model the first time. This can take a few minutes.", 'info');
        const answer = await runAi<{ summary?: unknown; bullets?: unknown }>(rewriteTask(profile, analysis, role, company, description), ai);
        const { suggestions, dropped: d } = guardRewrite(profile, analysis, answer);
        setDropped(d);
        if (suggestions.length) { onSuggestions(suggestions); notify(`Added ${suggestions.length} reworded line${suggestions.length === 1 ? '' : 's'}. Check each before saving.`, 'info'); }
        else notify(d.length ? 'Every reworded line failed the fact check, so none were added.' : 'The AI had no better wording to suggest.', 'info');
      } catch (e) {
        notify(e instanceof AiError ? e.message : 'Something went wrong. Try again.');
      } finally { setBusy(false); }
    };
    return (
      <div className="card ai-box stack">
        <div className="row wrap" style={{ justifyContent: 'space-between' }}>
          <span className="text-sm">{ai.provider === 'chrome' ? "Reword with Chrome's built-in AI, on this computer." : 'Reword with Claude, using your own API key.'} Every line is checked against your profile first.</span>
          <button type="button" className="btn btn-brand btn-sm" onClick={() => void run()} disabled={busy} aria-busy={busy}><Wand size={14} aria-hidden="true" /> {busy ? 'Rewording…' : 'Reword with AI'}</button>
        </div>
        {dropped.length > 0 && <div className="text-xs muted"><p>Left out because they failed the fact check:</p><ul className="tailor-ol">{dropped.map((d) => <li key={d}>{d}</li>)}</ul></div>}
      </div>
    );
  };
