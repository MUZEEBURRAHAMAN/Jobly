import { useMemo, useState, type CSSProperties } from 'react';
import { LetterEditor, ResumeEditor } from '../components/DocEditors';
import { Icon } from '../components/Icon';
import { MatchList } from '../components/MatchList';
import { Area, Busy, Empty, Field, Modal, Tabs, Text, copyText, toast, useJob } from '../components/ui';
import { ask } from '../lib/ask';
import { analyzeTask, draftTask, refineTask } from '../lib/ai/prompts';
import { profileFacts } from '../lib/facts';
import { uid } from '../lib/ids';
import { letterText, resumeText } from '../lib/plain-text';
import { go } from '../lib/router';
import { getState, update, useStudio } from '../lib/store';
import { STATUSES, TONES, type Application, type CoverLetter, type DocVersion, type Status, type TailoredResume, type Tone } from '../lib/types';
import { applyDraft, applyRefine, readAnalysis, restoreVersion, saveEdit, setStatus, type AnalyzeAnswer, type DraftAnswer } from '../lib/workflows';
import { LetterView, ResumeView } from '../resume/ResumeView';
import { fileName, printDocument } from '../resume/print';

type Tab = 'resume' | 'letter' | 'match' | 'posting' | 'notes';

const SUGGESTIONS = {
  resume: ['Fit it on one page', 'Lead with the most relevant results', 'Make the bullets shorter', 'Use the posting’s wording where my facts fit'],
  letter: ['Make it shorter', 'More specific about the company', 'Warmer', 'More formal'],
};

function patch(id: string, fn: (a: Application) => Application) {
  update((s) => ({ ...s, applications: s.applications.map((a) => (a.id === id ? fn(a) : a)) }));
}

const latest = <T,>(list: DocVersion<T>[]) => list[list.length - 1];

/** The fact check of the newest model-written version, limited to warnings whose line is still in the document. */
function currentIssues(list: DocVersion<unknown>[], lines: Set<string>) {
  const ai = [...list].reverse().find((v) => v.issues);
  if (!ai?.issues) return { removed: [], warnings: [] };
  return {
    removed: ai.issues.filter((i) => i.severity === 'removed'),
    warnings: ai.issues.filter((i) => i.severity === 'warning' && lines.has(i.text)),
  };
}

export function ApplicationPage({ id }: { id: string }) {
  const app = useStudio((s) => s.applications.find((a) => a.id === id));
  const profile = useStudio((s) => s.profile);
  const style = useStudio((s) => s.settings.resumeStyle);
  const [tab, setTab] = useState<Tab>('resume');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const job = useJob();

  const resume = app ? latest(app.resume).doc : null;
  const letter = app ? latest(app.letter).doc : null;
  const lines = useMemo(() => new Set(
    tab === 'letter' ? (letter?.paragraphs ?? []).map((p) => p.text)
      : resume ? [resume.summary.text, ...resume.experience.flatMap((e) => e.bullets.map((b) => b.text)), ...resume.projects.flatMap((e) => e.bullets.map((b) => b.text))] : [],
  ), [resume, letter, tab]);

  if (!app || !resume || !letter) {
    return <Empty title="This application isn’t here" action={<a className="btn" href="#/applications">All applications</a>}>It may have been deleted, or it was saved in another browser.</Empty>;
  }

  const target = tab === 'letter' ? 'letter' : 'resume';
  const versions = app[target] as DocVersion<unknown>[];
  const issues = currentIssues(versions, lines);
  const flagSet = new Set(issues.warnings.map((w) => w.text));
  const flags = { has: (t: string) => flagSet.has(t) };
  const baseName = (kind: string) => fileName(profile.basics.name, kind, app.posting.company);

  async function redraft() {
    const p = getState().profile;
    const answer = await job.run('Writing your tailored resume and cover letter', (signal) =>
      ask<DraftAnswer>(draftTask(app!.posting, app!.matches, profileFacts(p), app!.tone), signal));
    if (!answer) return;
    const out = applyDraft(getState().applications.find((a) => a.id === id)!, answer, p, 'New AI draft');
    patch(id, () => out.app);
    toast(out.issues.length ? `New draft written. The fact check found ${out.issues.length} thing${out.issues.length > 1 ? 's' : ''} to look at.` : 'New draft written. Everything traces back to your profile.');
  }

  async function refine(instruction: string) {
    if (!instruction.trim()) return;
    const p = getState().profile;
    const current = getState().applications.find((a) => a.id === id)!;
    const doc = target === 'resume' ? latest(current.resume).doc : latest(current.letter).doc;
    const answer = await job.run(target === 'resume' ? 'Revising your resume' : 'Revising your cover letter', (signal) =>
      ask<{ reply: string; resume?: TailoredResume; letter?: CoverLetter }>(
        refineTask(target, doc, instruction, current.posting, profileFacts(p), current.chat.filter((c) => c.target === target)), signal));
    if (!answer) return;
    const out = applyRefine(getState().applications.find((a) => a.id === id)!, target, instruction, answer, p);
    patch(id, () => out.app);
    setMessage('');
  }

  async function rematch() {
    const answer = await job.run('Matching the posting to your profile again', (signal) =>
      ask<AnalyzeAnswer>(analyzeTask(app!.posting.text, profileFacts(getState().profile)), signal));
    if (!answer) return;
    const { posting, matches } = readAnalysis(answer, app!.posting.text, app!.posting.url, getState().profile);
    patch(id, (a) => ({ ...a, matches, posting: { ...a.posting, requirements: posting.requirements } }));
    toast('Match updated from your current profile.');
  }

  const email = (() => {
    const to = /\S+@\S+\.\S+/.test(app.posting.contact) ? app.posting.contact.match(/\S+@\S+\.\S+/)![0] : '';
    const subject = `Application: ${app.posting.title}${profile.basics.name ? ` – ${profile.basics.name}` : ''}`;
    const body = `${letterText(profile, letter)}\n\n(Resume and cover letter attached as PDF.)`;
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  })();

  const chat = app.chat.filter((c) => c.target === target);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <a href="#/applications" className="small muted row" style={{ textDecoration: 'none', gap: 4 }}><Icon name="back" />Applications</a>
          <h1 style={{ marginTop: 6 }}>{app.posting.title || 'Untitled role'}</h1>
          <p>{[app.posting.company, app.posting.location].filter(Boolean).join(' · ')}{app.posting.url && <> · <a href={app.posting.url} target="_blank" rel="noopener noreferrer">Posting</a></>}</p>
        </div>
        <div className="row">
          <select className="select" style={{ width: 160 }} value={app.status} aria-label="Stage"
            onChange={(e) => { patch(id, (a) => setStatus(a, e.target.value as Status)); toast(`Moved to ${STATUSES.find((s) => s.id === e.target.value)!.label}.`); }}>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <a className="btn" href={email}><Icon name="send" />Email it</a>
          <button className="btn ghost danger" onClick={() => setConfirmDelete(true)} aria-label="Delete application"><Icon name="trash" /></button>
        </div>
      </div>

      <Tabs label="Application sections" value={tab} onChange={(t) => { setTab(t); setShowVersions(false); }} items={[
        { id: 'resume', label: 'Resume' }, { id: 'letter', label: 'Cover letter' }, { id: 'match', label: 'Match' },
        { id: 'posting', label: 'Posting' }, { id: 'notes', label: `Notes and interviews${app.interviews.length ? ` (${app.interviews.length})` : ''}` },
      ]} />

      {(tab === 'resume' || tab === 'letter') && (
        <div className="split">
          <div className="stack">
            {job.busy && <Busy label={job.busy} onStop={job.stop} />}

            <div className="card stack">
              <div className="card-head" style={{ marginBottom: 0 }}>
                <h2>Ask for changes</h2>
                <button className="btn sm ghost" onClick={redraft} disabled={!!job.busy}><Icon name="sparkle" />Write a new draft</button>
              </div>
              {chat.length > 0 && (
                <div className="chat" aria-live="polite">
                  {chat.map((c) => <div key={c.id} className={`bubble ${c.role}`}>{c.text}</div>)}
                </div>
              )}
              <div className="row" style={{ gap: 6 }}>
                {SUGGESTIONS[target].map((s) => <button key={s} className="chip" disabled={!!job.busy} onClick={() => refine(s)}>{s}</button>)}
              </div>
              <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); refine(message); }}>
                <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} disabled={!!job.busy}
                  placeholder={target === 'resume' ? 'e.g. Put the design system work first' : 'e.g. Mention that I use their product'} aria-label="Ask for a change" />
                <button className="btn primary" disabled={!message.trim() || !!job.busy}>Send</button>
              </form>
            </div>

            {(issues.removed.length > 0 || issues.warnings.length > 0) && (
              <div className="card stack sm">
                <h3 className="row"><Icon name="shield" />Fact check</h3>
                <p className="small muted">Studio compares every line the model wrote with your profile.</p>
                {issues.warnings.map((w, i) => <div key={`w${i}`} className="issue"><q>{w.text}</q><div>{w.reason}</div></div>)}
                {issues.removed.map((w, i) => <div key={`r${i}`} className="issue removed"><b>Left out:</b> <q>{w.text}</q><div>{w.reason} If it’s true, add it to your <a href="#/profile">profile</a>.</div></div>)}
              </div>
            )}

            <div className="card stack">
              <div className="card-head" style={{ marginBottom: 0 }}>
                <h2>Edit</h2>
                <button className="btn sm ghost" onClick={() => setShowVersions((v) => !v)}><Icon name="undo" />Versions ({versions.length})</button>
              </div>
              {showVersions && (
                <div className="list">
                  {[...versions].reverse().map((v, i) => (
                    <div className="list-item" key={v.id}>
                      <div style={{ flex: 1 }}><b>{v.label}</b><div className="small muted">{new Date(v.at).toLocaleString()}</div></div>
                      {i === 0 ? <span className="badge neutral">Current</span>
                        : <button className="btn sm" onClick={() => { patch(id, (a) => restoreVersion(a, target, v.id)); toast('Restored. The version you had is still in the list.'); }}>Restore</button>}
                    </div>
                  ))}
                </div>
              )}
              {target === 'resume'
                ? <ResumeEditor doc={resume} profile={profile} onChange={(d) => patch(id, (a) => saveEdit(a, 'resume', d))} />
                : <LetterEditor doc={letter} onChange={(d) => patch(id, (a) => saveEdit(a, 'letter', d))} />}
            </div>
          </div>

          <div className="stack sticky">
            <div className="row">
              <button className="btn primary" onClick={() => target === 'resume'
                ? printDocument(<ResumeView profile={profile} doc={resume} style={style} />, baseName('Resume'), style.paper)
                : printDocument(<LetterView profile={profile} letter={letter} style={style} company={app.posting.company} />, baseName('Cover letter'), style.paper)}>
                <Icon name="download" />Download PDF
              </button>
              <button className="btn" onClick={() => copyText(target === 'resume' ? resumeText(profile, resume) : letterText(profile, letter), 'Text copied')}>
                <Icon name="copy" />Copy as text
              </button>
              <span className="small muted">Theme and paper size: <a href="#/resume">Base resume</a></span>
            </div>
            <div className="preview-frame">
              <div style={{ zoom: 0.62 } as CSSProperties}>
                {target === 'resume'
                  ? <ResumeView profile={profile} doc={resume} style={style} flags={flags} />
                  : <LetterView profile={profile} letter={letter} style={style} company={app.posting.company} flags={flags} />}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'match' && (
        <div className="card stack" style={{ maxWidth: 820 }}>
          <div className="card-head"><h2>How you match</h2><button className="btn sm" onClick={rematch} disabled={!!job.busy || !app.posting.text.trim()}><Icon name="sparkle" />Match again</button></div>
          {job.busy && <Busy label={job.busy} onStop={job.stop} />}
          {app.posting.requirements.length
            ? <MatchList posting={app.posting} matches={app.matches} profile={profile} />
            : <p className="muted">No requirements yet. “Match again” reads them from the posting.</p>}
          <p className="small muted">Changed your profile since? Match again to see the difference.</p>
        </div>
      )}

      {tab === 'posting' && <PostingTab app={app} />}
      {tab === 'notes' && <NotesTab app={app} />}

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this application?"
        footer={<>
          <button className="btn ghost" onClick={() => setConfirmDelete(false)}>Keep it</button>
          <button className="btn primary" style={{ background: 'var(--destructive)', borderColor: 'var(--destructive)' }} onClick={() => {
            update((s) => ({ ...s, applications: s.applications.filter((a) => a.id !== id) }));
            go({ page: 'applications' });
            toast('Application deleted.');
          }}>Delete</button>
        </>}>
        <p>Its resume, cover letter, versions, notes and interviews go too. Your profile stays as it is.</p>
      </Modal>
    </div>
  );
}

function PostingTab({ app }: { app: Application }) {
  const p = app.posting;
  const set = (k: keyof typeof p, v: string) => patch(app.id, (a) => ({ ...a, posting: { ...a.posting, [k]: v } }));
  return (
    <div className="split">
      <div className="card stack">
        <h2>Details</h2>
        <div className="grid-2">
          <Field label="Title"><Text value={p.title} onChange={(v) => set('title', v)} /></Field>
          <Field label="Company"><Text value={p.company} onChange={(v) => set('company', v)} /></Field>
          <Field label="Location"><Text value={p.location} onChange={(v) => set('location', v)} /></Field>
          <Field label="Apply to" hint="An email address here fills in “Email it”."><Text value={p.contact} onChange={(v) => set('contact', v)} /></Field>
        </div>
        <Field label="Link"><Text value={p.url} onChange={(v) => set('url', v)} type="url" /></Field>
        <Field label="Cover letter tone">
          <select className="select" value={app.tone} onChange={(e) => patch(app.id, (a) => ({ ...a, tone: e.target.value as Tone }))}>
            {TONES.map((t) => <option key={t.id} value={t.id}>{t.label}: {t.hint}</option>)}
          </select>
        </Field>
      </div>
      <div className="card stack">
        <h2>Posting text</h2>
        <Area rows={18} value={p.text} onChange={(v) => set('text', v)} label="Posting text" />
      </div>
    </div>
  );
}

function NotesTab({ app }: { app: Application }) {
  const [kind, setKind] = useState('');
  const [at, setAt] = useState('');
  return (
    <div className="split">
      <div className="stack">
        <div className="card stack">
          <h2>Notes</h2>
          <Area rows={8} value={app.notes} onChange={(v) => patch(app.id, (a) => ({ ...a, notes: v }))} placeholder="Who you spoke to, what they asked, salary range…" label="Notes" />
          <Field label="Follow up on" hint="It shows on the dashboard on that day.">
            <input className="input" type="date" value={app.followUp.slice(0, 10)} onChange={(e) => patch(app.id, (a) => ({ ...a, followUp: e.target.value }))} />
          </Field>
        </div>
        <div className="card stack sm">
          <h2>History</h2>
          <div className="list">
            {[...app.statusHistory].reverse().map((h, i) => (
              <div className="list-item" key={i}><span className="badge neutral">{STATUSES.find((s) => s.id === h.status)?.label}</span><span className="muted small">{new Date(h.at).toLocaleString()}</span></div>
            ))}
          </div>
        </div>
      </div>
      <div className="card stack">
        <h2>Interviews</h2>
        {app.interviews.length === 0 && <p className="muted">None yet. Add one and it shows on the dashboard the week it happens.</p>}
        {[...app.interviews].sort((a, b) => a.at.localeCompare(b.at)).map((iv) => (
          <div className="entry" key={iv.id}>
            <div className="entry-head">
              <b>{iv.kind || 'Interview'}</b>
              <span className="row">
                <span className="muted small">{iv.at ? new Date(iv.at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                <button className="btn icon ghost danger" aria-label="Remove interview" onClick={() => patch(app.id, (a) => ({ ...a, interviews: a.interviews.filter((x) => x.id !== iv.id) }))}><Icon name="x" /></button>
              </span>
            </div>
            <Area rows={3} value={iv.notes} placeholder="Prep notes, questions to ask, how it went" label="Interview notes"
              onChange={(v) => patch(app.id, (a) => ({ ...a, interviews: a.interviews.map((x) => (x.id === iv.id ? { ...x, notes: v } : x)) }))} />
          </div>
        ))}
        <form className="grid-2" onSubmit={(e) => {
          e.preventDefault();
          if (!at) return;
          patch(app.id, (a) => {
            const next = { ...a, interviews: [...a.interviews, { id: uid('int'), at, kind: kind.trim() || 'Interview', notes: '' }] };
            return a.status === 'applied' || a.status === 'draft' ? setStatus(next, 'interviewing') : next;
          });
          setKind(''); setAt('');
        }}>
          <Field label="Kind"><Text value={kind} onChange={setKind} placeholder="e.g. Recruiter call" /></Field>
          <Field label="When"><input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} required /></Field>
          <div><button className="btn"><Icon name="calendar" />Add interview</button></div>
        </form>
      </div>
    </div>
  );
}
