import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, ExternalLink, RotateCcw, Trash, Wand, X } from '../lib/icons';
import { ACTIVE, originsOf, QueueItem, QueueState, removeItems, stateLabel, STEPS, updateItem, useApplyQueue, WAITING } from '../lib/applyQueue';
import { isSensitive, rememberAnswers } from '../lib/answerBank';
import { readKey, writeKey } from '../lib/userData';
import { getCompanyLogoUrl } from '../lib/companyLogos';
import { EmptyState } from './EmptyState';

const RUN_KEY = 'applyQueueRunning';
const COLUMNS: { id: string; title: string; hint: string; states: QueueState[] }[] = [
  { id: 'queue', title: 'Queue', hint: 'Jobs you picked. Press Start and Jobly prepares them.', states: ['queued'] },
  { id: 'progress', title: 'In progress', hint: 'Jobly is opening and filling these.', states: ACTIVE },
  { id: 'ready', title: 'Ready for you', hint: 'Answer what’s left, check, press Submit.', states: WAITING },
  { id: 'sent', title: 'Submitted', hint: 'You sent these. They’re in Saved › Applied.', states: ['submitted'] },
  { id: 'stopped', title: 'Not submitted', hint: 'Stopped before they were sent.', states: ['stopped'] },
];

const stepIndex = (s: QueueState) => (s === 'needs-input' ? 3 : s === 'submitted' ? STEPS.length : STEPS.findIndex((x) => x.state === s));

/** One job's place in the five steps, as a small progress row. */
const Steps: React.FC<{ state: QueueState }> = ({ state }) => {
  const at = stepIndex(state);
  return (
    <ol className="aq-steps" aria-label={`Step: ${stateLabel[state]}`}>
      {STEPS.map((s, i) => <li key={s.state} className={i < at ? 'done' : i === at ? 'now' : ''} title={s.label}><span className="sr-only">{s.label}{i < at ? ' (done)' : i === at ? ' (now)' : ''}</span></li>)}
    </ol>
  );
};

const Logo: React.FC<{ company: string }> = ({ company }) => {
  const [failed, setFailed] = useState(false);
  return <span className="logo aq-logo" aria-hidden="true">{failed ? <span className="logo-fallback">{(company || '?').slice(0, 1).toUpperCase()}</span> : <img src={getCompanyLogoUrl(company)} alt="" loading="lazy" onError={() => setFailed(true)} />}</span>;
};

/**
 * Applications: the apply queue as a board. Jobly prepares each queued job in its own tab (opens it, reads the form,
 * fills what it knows) and stops for the user's review; questions it couldn't answer are collected under "Needs your
 * input", and what the user types there is saved for the next form.
 */
export const ApplicationsView: React.FC<{ notify: (m: string, kind?: 'error' | 'info') => void; onBrowseJobs: () => void }> = ({ notify, onBrowseJobs }) => {
  const queue = useApplyQueue();
  const [running, setRunning] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  React.useEffect(() => { void readKey<boolean>(RUN_KEY).then((v) => setRunning(!!v)); }, [queue]);

  const queued = queue.filter((x) => x.state === 'queued');
  const needInput = queue.filter((x) => x.state === 'needs-input');

  const start = async () => {
    // Access to just the sites in the queue, asked for here (a click is required for the browser to ask)
    const origins = originsOf(queued);
    let granted = true;
    try { granted = origins.length === 0 || await chrome.permissions.contains({ origins }) || await chrome.permissions.request({ origins }); } catch { granted = false; }
    if (!granted) { notify('Jobly needs your OK to open those job sites. Nothing was started.'); return; }
    await writeKey(RUN_KEY, true); setRunning(true);
    await chrome.runtime.sendMessage({ type: 'QUEUE_PUMP' }).catch(() => null);
    notify(`Preparing ${queued.length} application${queued.length === 1 ? '' : 's'}. Jobly opens them in background tabs and stops before Submit.`, 'info');
  };
  const pause = async () => { await writeKey(RUN_KEY, false); setRunning(false); notify('Paused. Applications already open stay as they are.', 'info'); };

  const focus = async (x: QueueItem) => {
    if (x.tabId == null) { window.open(x.url, '_blank', 'noopener'); return; }
    try { const tab = await chrome.tabs.update(x.tabId, { active: true }); if (tab?.windowId != null) await chrome.windows.update(tab.windowId, { focused: true }); }
    catch { window.open(x.url, '_blank', 'noopener'); }
  };
  const retry = async (x: QueueItem) => { await updateItem(x.id, { state: 'queued', note: '', needs: [], filled: 0, tabId: null }); };
  const remove = async (x: QueueItem) => {
    // Out of the list first, so closing its tab doesn't bring it back as "stopped"
    await removeItems([x.id]);
    if (x.tabId != null && x.state !== 'submitted') { try { await chrome.tabs.remove(x.tabId); } catch { /* already closed */ } }
  };
  const fillAgain = async (x: QueueItem) => {
    const items = x.needs.filter((q) => answers[`${x.id}:${q}`]?.trim() && !isSensitive(q) && q !== 'Sign in to the site').map((q) => ({ question: q, value: answers[`${x.id}:${q}`].trim(), kind: 'text' }));
    const saved = items.length ? await rememberAnswers(items) : 0;
    if (x.tabId != null) { try { await chrome.tabs.sendMessage(x.tabId, { type: 'JOBLY_REFILL', id: x.id }); } catch { notify('That tab is no longer open. Use Try again.'); return; } }
    notify(saved ? `Saved ${saved} answer${saved === 1 ? '' : 's'} and filled the form again.` : 'Reading the form again.', 'info');
  };

  if (!queue.length) {
    return (
      <div className="section">
        <Header running={false} queued={0} onStart={start} onPause={pause} />
        <HowItWorks />
        <EmptyState art="saved" large title="Your apply queue is empty" description="On the Jobs page, press “Add to queue” on the jobs you want. Jobly opens each one, fills in what it knows and leaves Submit to you."
          actions={<button type="button" className="btn" onClick={onBrowseJobs}>Find jobs <ArrowRight size={14} aria-hidden="true" /></button>} />
      </div>
    );
  }

  return (
    <div className="section">
      <Header running={running} queued={queued.length} onStart={start} onPause={pause} />
      <HowItWorks />
      <div className="aq-layout">
        <aside className="card aq-input" aria-labelledby="aq-input-t">
          <h3 id="aq-input-t" className="row" style={{ justifyContent: 'space-between' }}>Needs your input <span className="aq-count">{needInput.reduce((n, x) => n + x.needs.length, 0)}</span></h3>
          {needInput.length === 0 ? <p className="text-sm muted">All caught up. Questions Jobly can’t answer from your profile show up here.</p> : needInput.map((x) => (
            <div key={x.id} className="aq-need">
              <p className="font-medium text-sm">{x.title} <span className="muted">· {x.company}</span></p>
              {x.needs.map((q) => q === 'Sign in to the site'
                ? <p key={q} className="text-sm">This site asks you to sign in. Open the tab, sign in, then press Fill again.</p>
                : (
                  <div key={q}>
                    <label className="label" htmlFor={`aq-${x.id}-${q}`}>{q}</label>
                    <input id={`aq-${x.id}-${q}`} className="input" value={answers[`${x.id}:${q}`] ?? ''} maxLength={3000} onChange={(e) => setAnswers({ ...answers, [`${x.id}:${q}`]: e.target.value })}
                      placeholder={isSensitive(q) ? 'Answer on the page (never saved)' : 'Your answer'} disabled={isSensitive(q)} />
                  </div>
                ))}
              <div className="row wrap" style={{ gap: 4 }}>
                <button type="button" className="btn btn-sm" onClick={() => void fillAgain(x)}><Wand size={14} aria-hidden="true" /> Save and fill again</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void focus(x)}>Answer on the page</button>
              </div>
            </div>
          ))}
          <p className="hint">Jobly saves these answers for the next form that asks. Questions about gender, ethnicity, disability, veteran status or ID numbers are never saved.</p>
        </aside>
        <div className="aq-board" role="list" aria-label="Applications by stage">
          {COLUMNS.map((c) => {
            const items = queue.filter((x) => c.states.includes(x.state));
            return (
              <section key={c.id} className={`aq-col aq-${c.id}`} role="listitem" aria-labelledby={`aq-${c.id}-t`}>
                <header><h3 id={`aq-${c.id}-t`}><span className="aq-dot" aria-hidden="true" />{c.title} <span className="aq-count">{items.length}</span></h3><p className="text-xs muted">{c.hint}</p></header>
                {items.length === 0 ? <p className="text-xs muted aq-none">Nothing here.</p> : (
                  <ul className="aq-cards" aria-label={c.title}>
                    {items.map((x) => (
                      <li key={x.id} className="aq-card">
                        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                          <Logo company={x.company} />
                          <div className="grow" style={{ minWidth: 0 }}>
                            <p className="aq-title">{x.title}</p>
                            <p className="text-xs muted aq-sub">{[x.company, x.location].filter(Boolean).join(' · ')}</p>
                          </div>
                        </div>
                        {x.state !== 'queued' && x.state !== 'stopped' && <Steps state={x.state} />}
                        <p className={`text-xs aq-state aq-s-${x.state}`}>{stateLabel[x.state]}{x.state === 'needs-input' ? ` · ${x.needs.length} question${x.needs.length === 1 ? '' : 's'}` : ''}{x.filled ? ` · ${x.filled} filled` : ''}</p>
                        {x.note && <p className="text-xs muted">{x.note}</p>}
                        <div className="row wrap" style={{ gap: 4 }}>
                          {(WAITING.includes(x.state) || ACTIVE.includes(x.state)) && <button type="button" className="btn btn-sm" onClick={() => void focus(x)}>{x.state === 'review' ? 'Review and submit' : 'Open tab'}</button>}
                          {x.state === 'stopped' && <><button type="button" className="btn btn-outline btn-sm" onClick={() => void retry(x)}><RotateCcw size={14} aria-hidden="true" /> Try again</button>
                            <a className="btn btn-ghost btn-sm" href={x.url} target="_blank" rel="noopener noreferrer">Open job <ExternalLink size={12} aria-hidden="true" /></a></>}
                          {x.state === 'submitted' && <span className="text-xs aq-sent"><CheckCircle2 size={14} aria-hidden="true" /> Added to Applied</span>}
                          <span className="grow" />
                          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => void remove(x)} aria-label={`Remove ${x.title} at ${x.company}`} title="Remove"><Trash size={14} aria-hidden="true" /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

      </div>
    </div>
  );
};

const Header: React.FC<{ running: boolean; queued: number; onStart: () => void; onPause: () => void }> = ({ running, queued, onStart, onPause }) => (
  <div className="row wrap" style={{ justifyContent: 'space-between' }}>
    <div><h2>Applications</h2><p className="text-sm">Jobly opens each queued job, fills in what it knows and stops for your review. You always press Submit.</p></div>
    <div className="row" style={{ gap: 8 }}>
      {running && <span className="text-sm muted row" style={{ gap: 6 }} role="status"><Clock size={14} aria-hidden="true" /> Running</span>}
      {running
        ? <button type="button" className="btn btn-outline" onClick={onPause}><X size={14} aria-hidden="true" /> Pause</button>
        : <button type="button" className="btn" onClick={onStart} disabled={!queued}><Wand size={14} aria-hidden="true" /> {queued ? `Start ${queued} application${queued === 1 ? '' : 's'}` : 'Start'}</button>}
    </div>
  </div>
);

const HowItWorks: React.FC = () => (
  <ol className="aq-how" aria-label="How the apply queue works">
    {['Opens the job in a background tab', 'Reads the form, even across steps', 'Fills your profile, resume and saved answers', 'Asks you what it couldn’t answer', 'You check and press Submit'].map((t, i) => (
      <li key={t}><span className="aq-n" aria-hidden="true">{i + 1}</span>{t}</li>
    ))}
  </ol>
);
