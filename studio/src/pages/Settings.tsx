import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Field, Modal, Text, toast, useJob, Busy } from '../components/ui';
import { clearData } from '../lib/db';
import { download, exportData, parseImport } from '../lib/data-file';
import { ANTHROPIC_MODELS, OPENAI_PRESETS, emptyData } from '../lib/defaults';
import { runTask } from '../lib/ai/run';
import { getState, replaceAll, update, useStudio } from '../lib/store';
import type { AiSettings, Settings } from '../lib/types';

const setSettings = (fn: (s: Settings) => Settings) => update((d) => ({ ...d, settings: fn(d.settings) }));
const setAi = (patch: Partial<AiSettings>) => setSettings((s) => ({ ...s, ai: { ...s.ai, ...patch } }));

export function SettingsPage() {
  const settings = useStudio((s) => s.settings);
  const ai = settings.ai;
  const [showKey, setShowKey] = useState(false);
  const [includeKey, setIncludeKey] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const job = useJob();

  async function test() {
    const ok = await job.run('Testing the connection', (signal) => runTask<{ ok: boolean }>({
      label: 'Test', system: 'You answer with JSON only.', prompt: 'Reply with {"ok": true}.',
      schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
    }, getState().settings.ai, signal));
    if (ok) toast('Connected. Studio can use this model.');
  }

  async function onImport(f: File | undefined) {
    if (!f) return;
    try {
      const next = parseImport(await f.text(), getState());
      replaceAll(next);
      toast(`Imported: ${next.applications.length} application${next.applications.length === 1 ? '' : 's'} and your profile.`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      if (file.current) file.current.value = '';
    }
  }

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 900 }}>
      <div className="page-head"><div><h1>Settings</h1><p>Saved in this browser, like everything else.</p></div></div>

      <div className="card stack">
        <h2>AI model</h2>
        <p className="muted small">Studio has no server: it talks to the model you choose straight from this browser. Your key stays here and is only sent to that provider.</p>
        <div className="grid-3">
          {([
            { id: 'none', title: 'Claude, by hand', text: 'No key. Each step gives you a prompt to paste into Claude on your own plan.' },
            { id: 'anthropic', title: 'Anthropic API', text: 'Your own Claude API key. Steps run in one click.' },
            { id: 'openai', title: 'OpenAI-compatible', text: 'OpenAI, OpenRouter, or a local model in Ollama or LM Studio.' },
          ] as const).map((o) => (
            <label key={o.id} className="entry check" style={{ alignItems: 'flex-start', borderColor: ai.provider === o.id ? 'var(--brand)' : undefined }}>
              <input type="radio" name="provider" checked={ai.provider === o.id} style={{ marginTop: 3 }}
                onChange={() => setAi(o.id === 'anthropic' ? { provider: o.id, model: ai.model.startsWith('claude') ? ai.model : 'claude-opus-5-5', baseUrl: '' }
                  : o.id === 'openai' ? { provider: o.id, model: ai.model.startsWith('claude') ? '' : ai.model, baseUrl: ai.baseUrl || OPENAI_PRESETS[0].baseUrl }
                    : { provider: o.id })} />
              <span><b>{o.title}</b><br /><span className="small muted">{o.text}</span></span>
            </label>
          ))}
        </div>

        {ai.provider === 'anthropic' && (
          <div className="grid-2">
            <Field label="API key" hint={<>Create one at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>. Use a key with a spending limit.</>}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" type={showKey ? 'text' : 'password'} value={ai.apiKey} onChange={(e) => setAi({ apiKey: e.target.value.trim() })} placeholder="sk-ant-…" autoComplete="off" spellCheck={false} />
                <button className="btn" type="button" onClick={() => setShowKey((v) => !v)}>{showKey ? 'Hide' : 'Show'}</button>
              </div>
            </Field>
            <Field label="Model">
              <select className="select" value={ai.model} onChange={(e) => setAi({ model: e.target.value })}>
                {ANTHROPIC_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}: {m.hint}</option>)}
              </select>
            </Field>
          </div>
        )}

        {ai.provider === 'openai' && (
          <div className="stack">
            <div className="row">
              {OPENAI_PRESETS.map((p) => <button key={p.label} className="chip" onClick={() => setAi({ baseUrl: p.baseUrl, model: p.model || ai.model })}>{p.label}</button>)}
            </div>
            <div className="grid-3">
              <Field label="Server address"><Text value={ai.baseUrl} onChange={(v) => setAi({ baseUrl: v.trim() })} placeholder="https://api.openai.com/v1" /></Field>
              <Field label="Model"><Text value={ai.model} onChange={(v) => setAi({ model: v.trim() })} placeholder="e.g. gpt-5 or llama3.1" /></Field>
              <Field label="API key" hint="Not needed for Ollama or LM Studio.">
                <input className="input" type="password" value={ai.apiKey} onChange={(e) => setAi({ apiKey: e.target.value.trim() })} autoComplete="off" />
              </Field>
            </div>
            {/localhost|127\.0\.0\.1/.test(ai.baseUrl) && (
              <p className="small muted">Local models keep everything on your computer. Ollama must allow this site: start it with <code>OLLAMA_ORIGINS={location.origin}</code>. In LM Studio, turn on CORS in the server settings.</p>
            )}
          </div>
        )}

        {ai.provider !== 'none' && (job.busy ? <Busy label={job.busy} onStop={job.stop} /> : <div><button className="btn" onClick={test}>Test the connection</button></div>)}
      </div>

      <div className="card stack">
        <h2>Appearance</h2>
        <Field label="Theme">
          <select className="select" style={{ maxWidth: 240 }} value={settings.theme} onChange={(e) => setSettings((s) => ({ ...s, theme: e.target.value as Settings['theme'] }))}>
            <option value="system">Same as my device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Field>
      </div>

      <div className="card stack">
        <h2>Your data</h2>
        <p className="muted small">Everything lives in this browser’s storage on this device. Clearing your browser data deletes it, so keep a backup. A backup also moves Studio to another browser or computer.</p>
        <label className="check"><input type="checkbox" checked={includeKey} onChange={(e) => setIncludeKey(e.target.checked)} />Include my API key in the backup</label>
        <div className="row">
          <button className="btn primary" onClick={() => download(`jobly-studio-backup-${new Date().toISOString().slice(0, 10)}.json`, exportData(getState(), includeKey))}><Icon name="download" />Download backup</button>
          <label className="btn"><Icon name="upload" />Restore from a backup
            <input ref={file} type="file" accept=".json,application/json" className="sr-only" onChange={(e) => onImport(e.target.files?.[0])} />
          </label>
          <button className="btn danger" onClick={() => setConfirm(true)}><Icon name="trash" />Delete everything</button>
        </div>
        <p className="small muted">Restoring replaces what’s here now. Download a backup first if you want to keep it.</p>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Delete everything?"
        footer={<>
          <button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
          <button className="btn primary" style={{ background: 'var(--destructive)', borderColor: 'var(--destructive)' }} onClick={async () => {
            await clearData().catch(() => undefined);
            replaceAll(emptyData());
            setConfirm(false);
            location.hash = '#/';
          }}>Delete everything</button>
        </>}>
        <p>Your profile, every application, and your settings and API key are removed from this browser. This can’t be undone.</p>
      </Modal>
    </div>
  );
}
