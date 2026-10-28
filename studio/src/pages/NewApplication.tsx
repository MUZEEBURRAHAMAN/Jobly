import { useState } from 'react';
import { Icon } from '../components/Icon';
import { MatchList } from '../components/MatchList';
import { Area, Busy, Field, Text, toast, useJob } from '../components/ui';
import { ask } from '../lib/ask';
import { analyzeTask, draftTask } from '../lib/ai/prompts';
import { aiConfigured } from '../lib/ai/run';
import { profileFacts } from '../lib/facts';
import { go } from '../lib/router';
import { getState, update, useStudio } from '../lib/store';
import { TONES, type Application, type Posting, type RequirementMatch, type Tone } from '../lib/types';
import { applyDraft, newApplication, readAnalysis, type AnalyzeAnswer, type DraftAnswer } from '../lib/workflows';

/** Find jobs hands a posting over through here. */
let handover: { text: string; url: string } | null = null;
export function startFromPosting(text: string, url: string) { handover = { text, url }; go({ page: 'new' }); }

export function NewApplication() {
  const profile = useStudio((s) => s.profile);
  const ai = useStudio((s) => s.settings.ai);
  const [text, setText] = useState(() => handover?.text ?? '');
  const [url, setUrl] = useState(() => { const u = handover?.url ?? ''; handover = null; return u; });
  const [tone, setTone] = useState<Tone>('direct');
  const [result, setResult] = useState<{ posting: Posting; matches: RequirementMatch[] } | null>(null);
  const job = useJob();
  const noProfile = profile.experience.length === 0 && !profile.basics.summary;

  async function analyze() {
    const answer = await job.run('Reading the posting and matching it to your profile', (signal) =>
      ask<AnalyzeAnswer>(analyzeTask(text, profileFacts(getState().profile)), signal));
    if (answer) setResult(readAnalysis(answer, text, url.trim(), getState().profile));
  }

  function save(app: Application) {
    update((s) => ({ ...s, applications: [app, ...s.applications] }));
    go({ page: 'application', id: app.id });
  }

  async function write() {
    if (!result) return;
    const p = getState().profile;
    let app = newApplication(result.posting, result.matches, tone, p);
    const answer = await job.run('Writing your tailored resume and cover letter', (signal) =>
      ask<DraftAnswer>(draftTask(result.posting, result.matches, profileFacts(p), tone), signal));
    if (!answer) return;
    const out = applyDraft(app, answer, p);
    app = out.app;
    const removed = out.issues.filter((i) => i.severity === 'removed').length;
    const flagged = out.issues.length - removed;
    save(app);
    if (out.issues.length) {
      toast(`The fact check removed ${removed} line${removed === 1 ? '' : 's'} and flagged ${flagged}. See “Fact check” on the resume tab.`);
    }
  }

  function skipAi() {
    const posting: Posting = result?.posting ?? {
      title: '', company: '', location: '', url: url.trim(), contact: '', language: 'English', text, requirements: [],
    };
    save(newApplication(posting, result?.matches ?? [], tone, getState().profile));
  }

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 980 }}>
      <div className="page-head">
        <div>
          <h1>New application</h1>
          <div className="steps" style={{ marginTop: 6 }}>
            {result ? <span>1. Paste the posting</span> : <b>1. Paste the posting</b>}<i />
            {result ? <b>2. Check the match</b> : <span>2. Check the match</span>}<i />
            <span>3. Refine and send</span>
          </div>
        </div>
      </div>

      {noProfile && (
        <div className="banner">Your profile is empty, so there’s nothing to match or write from yet. <a href="#/profile">Fill in your profile</a> first.</div>
      )}

      {!result ? (
        <div className="card stack">
          <Field label="Job posting" hint="Paste the whole posting: the more it says, the better the match. Studio reads it in your browser.">
            <Area value={text} onChange={setText} rows={14} placeholder="Copy everything from the job page and paste it here…" />
          </Field>
          <div className="grid-2">
            <Field label="Link to the posting (optional)"><Text value={url} onChange={setUrl} placeholder="https://…" type="url" /></Field>
            <Field label="Cover letter tone">
              <select className="select" value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
                {TONES.map((t) => <option key={t.id} value={t.id}>{t.label}: {t.hint}</option>)}
              </select>
            </Field>
          </div>
          {job.busy ? <Busy label={job.busy} onStop={job.stop} /> : (
            <div className="row">
              <button className="btn primary" disabled={text.trim().length < 120 || noProfile} onClick={analyze}>
                <Icon name="sparkle" />{aiConfigured(ai) ? 'Read and match' : 'Read and match with Claude'}
              </button>
              <button className="btn ghost" disabled={!text.trim()} onClick={skipAi}>Skip: save it with my base resume</button>
            </div>
          )}
        </div>
      ) : (
        <div className="split">
          <div className="card stack">
            <h2>The role</h2>
            <div className="grid-2">
              <Field label="Title"><Text value={result.posting.title} onChange={(v) => setResult({ ...result, posting: { ...result.posting, title: v } })} /></Field>
              <Field label="Company"><Text value={result.posting.company} onChange={(v) => setResult({ ...result, posting: { ...result.posting, company: v } })} /></Field>
              <Field label="Location"><Text value={result.posting.location} onChange={(v) => setResult({ ...result, posting: { ...result.posting, location: v } })} /></Field>
              <Field label="Apply to" hint="Where the posting says to send it."><Text value={result.posting.contact} onChange={(v) => setResult({ ...result, posting: { ...result.posting, contact: v } })} /></Field>
            </div>
            <Field label="Cover letter tone">
              <select className="select" value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
                {TONES.map((t) => <option key={t.id} value={t.id}>{t.label}: {t.hint}</option>)}
              </select>
            </Field>
            {job.busy ? <Busy label={job.busy} onStop={job.stop} /> : (
              <div className="row">
                <button className="btn primary" onClick={write}><Icon name="sparkle" />Write resume and cover letter</button>
                <button className="btn" onClick={skipAi}>Save without writing</button>
                <button className="btn ghost" onClick={() => setResult(null)}>Back</button>
              </div>
            )}
          </div>
          <div className="card"><h2 style={{ marginBottom: 14 }}>How you match</h2><MatchList posting={result.posting} matches={result.matches} profile={profile} /></div>
        </div>
      )}
    </div>
  );
}
