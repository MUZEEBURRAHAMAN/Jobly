import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Save } from '../lib/icons';
import { Job } from '../types';
import { ProfilesStore } from '../lib/useProfiles';
import { TrackerStore } from '../lib/useTracker';
import { FEATURES } from '../lib/config';
import { fullName, skillList } from '../lib/profile';
import { LENGTHS, Length, letterChecks, LETTER_TEMPLATES, LetterTemplateId, Tone, TONES, writeLetter } from '../lib/coverLetter';
import { readKey, writeKey } from '../lib/userData';
import { jobKey } from '../lib/userData';
import { fileSafe } from '../lib/resume';
import { CopyButton } from './CopyButton';
import { Wand } from '../lib/icons';
import { analyzeJob } from '../lib/tailor';
import { AiError, AiSettings, loadAi, runAi, AI_KEY } from '../lib/ai';
import { guardLetter, letterTask } from '../lib/aiGuard';
import { onKeysChanged } from '../lib/userData';
import type { LetterContext } from './TailorView';

const TONE_SIGN: Record<Tone, string> = { confident: 'Best regards,', warm: 'Warm regards,', formal: 'Yours sincerely,' };

export const CoverLetterView: React.FC<{ profiles: ProfilesStore; tracker: TrackerStore; savedJobs: Job[]; notify: (m: string, kind?: 'error' | 'info') => void; onOpenProfile: () => void; context?: LetterContext | null }> = ({ profiles, tracker, savedJobs, notify, onOpenProfile, context }) => {
  const targets = useMemo(() => {
    const seen = new Set<string>();
    const list: { key: string; role: string; company: string; tracked: boolean }[] = [];
    for (const a of tracker.apps) { seen.add(a.key); list.push({ key: a.key, role: a.title, company: a.company_name, tracked: true }); }
    for (const j of savedJobs) { const k = jobKey(j); if (!seen.has(k)) list.push({ key: k, role: j.title, company: j.company_name, tracked: false }); }
    return list;
  }, [tracker.apps, savedJobs]);
  const [target, setTarget] = useState('');
  const [template, setTemplate] = useState<LetterTemplateId>('achievement');
  const [tone, setTone] = useState<Tone>('confident');
  const [length, setLength] = useState<Length>('standard');
  const [manager, setManager] = useState('');
  const [motivation, setMotivation] = useState('');
  const [referrer, setReferrer] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [text, setText] = useState('');
  const [edited, setEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [ai, setAi] = useState<AiSettings | null>(null);
  const [writing, setWriting] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  useEffect(() => { const load = () => void loadAi().then(setAi); load(); return onKeysChanged([AI_KEY], load); }, []);
  // From Tailor: the job and its description, with the letter built from it
  useEffect(() => { if (context) { setRole(context.role); setCompany(context.company); setDescription(context.description); setTemplate('matched'); setEdited(false); } }, [context]);
  const hasJd = description.trim().length > 80;
  useEffect(() => { void readKey<{ tone?: Tone; length?: Length }>('letterSettings').then((x) => { if (x?.tone) setTone(x.tone); if (x?.length) setLength(x.length); }); }, []);
  const pick = (patch: { tone?: Tone; length?: Length }) => { if (patch.tone) setTone(patch.tone); if (patch.length) setLength(patch.length); setEdited(false); void writeKey('letterSettings', { tone, length, ...patch }); };
  const build = (t: LetterTemplateId) => writeLetter({ profile: profiles.active, role, company, description, template: t === 'matched' && !hasJd ? 'achievement' : t, tone, length, manager, motivation, referrer });
  const writeWithAi = async () => {
    if (!ai || !profiles.active) return;
    setWriting(true); setIssues([]);
    try {
      const p = profiles.active;
      const job = analyzeJob(description, skillList(p));
      const out = await runAi<{ paragraphs?: unknown }>(letterTask(p, job, role, company, description), ai);
      const paras = (Array.isArray(out.paragraphs) ? out.paragraphs : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 6);
      if (!paras.length) { notify('The AI returned no letter. Try again.'); return; }
      const letter = [manager.trim() ? `Dear ${manager.trim()},` : `Dear ${company || '[company]'} hiring team,`, '', paras.join('\n\n'), '', TONE_SIGN[tone], fullName(p) || '[name]', [p.email, p.phone].filter(Boolean).join(' · ')].join('\n').trim();
      setText(letter); setEdited(true); setIssues(guardLetter(p, job, paras.join(' ')));
    } catch (e) { notify(e instanceof AiError ? e.message : 'Something went wrong. Try again.'); }
    finally { setWriting(false); }
  };

  useEffect(() => { const t = targets.find((x) => x.key === target); if (t) { setRole(t.role); setCompany(t.company); } }, [target, targets]);
  useEffect(() => { if (!edited) setText(build(template)); }, [template, role, company, profiles.active, edited, description, tone, length, manager, motivation, referrer]); // eslint-disable-line react-hooks/exhaustive-deps

  const regenerate = () => { setEdited(false); setIssues([]); setText(build(template)); };
  const tracked = targets.find((x) => x.key === target && x.tracked);
  const saveToNotes = async () => {
    if (!tracked) return;
    const app = tracker.byKey.get(tracked.key);
    const problem = await tracker.updateApp(tracked.key, { notes: `${app?.notes ? `${app.notes}\n\n` : ''}Cover letter:\n${text}`.slice(0, 4000) });
    notify(problem ?? 'Saved to the application notes.', problem ? 'error' : 'info');
  };
  const download = () => {
    const html = `<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.5">${text.split('\n').map((l) => `<p style="margin:0 0 6px">${l.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)) || '&nbsp;'}</p>`).join('')}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'application/msword' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `cover-letter-${fileSafe(company || 'company')}.doc` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const printPdf = () => {
    // Same clean-PDF approach as the resume: zero page margin, so Chrome prints no header or footer
    const style = document.createElement('style');
    style.textContent = '@page { size: auto; margin: 0; }';
    document.head.appendChild(style); document.documentElement.classList.add('printing-letter');
    const title = document.title; document.title = fileSafe(`${p ? fullName(p) : 'Cover'} Cover letter ${company}`);
    const done = () => { style.remove(); document.documentElement.classList.remove('printing-letter'); document.title = title; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); window.print();
  };
  const p = profiles.active;
  const checks = letterChecks(text, company, role);
  const gaps = text.match(/\[[a-z ,:'’-]+\]/gi) ?? [];
  const missing = gaps.length;
  const profileGaps = gaps.some((g) => g !== '[role]' && g !== '[company]');

  return (
    <div className="section">
      <div><h2>Cover letters</h2><p className="text-sm">Start from a template filled with your profile and the job, then make it yours.</p></div>
      {!profiles.active && <p className="banner">Fill in your profile so the letter can use your name, experience and skills. <button type="button" className="link" onClick={onOpenProfile}>Open profile</button></p>}
      <div className="workspace aside-left">
        <section className="card panel" aria-labelledby="cl-details-title">
          <div className="panel-head"><h3 id="cl-details-title">Details</h3></div>
          <div className="stack">
            <div>
              <label className="label" htmlFor="cl-target">Job</label>
              <select id="cl-target" className="select" value={target} onChange={(e) => { setTarget(e.target.value); setEdited(false); }}>
                <option value="">Type the role and company below</option>
                {targets.map((t) => <option key={t.key} value={t.key}>{t.role} · {t.company}</option>)}
              </select>
              <p className="hint">{FEATURES.tracker ? 'Pick a job from your tracker or saved jobs, or type it below.' : 'Pick a job you saved or applied to, or type it below.'}</p>
            </div>
            <div><label className="label" htmlFor="cl-role">Role</label><input id="cl-role" className="input" placeholder="e.g. Senior Product Designer" value={role} onChange={(e) => { setRole(e.target.value); setEdited(false); }} /></div>
            <div><label className="label" htmlFor="cl-company">Company</label><input id="cl-company" className="input" placeholder="e.g. Acme" value={company} onChange={(e) => { setCompany(e.target.value); setEdited(false); }} /></div>
            <div>
              <label className="label" htmlFor="cl-desc">Job description (optional)</label>
              <textarea id="cl-desc" className="textarea" rows={4} maxLength={20000} value={description} placeholder="Paste it to write a letter that answers what the job asks for"
                onChange={(e) => { const v = e.target.value; setDescription(v); if (v.trim().length > 80 && !hasJd && !edited) setTemplate('matched'); }} />
            </div>
            <div className="row wrap" style={{ gap: 'var(--space-4)' }}>
              <div><p className="label" id="cl-tone-l">Tone</p><div role="radiogroup" aria-labelledby="cl-tone-l" className="seg">{TONES.map((t) => <button key={t.id} type="button" role="radio" aria-checked={tone === t.id} onClick={() => pick({ tone: t.id })}>{t.label}</button>)}</div></div>
              <div><p className="label" id="cl-len-l">Length</p><div role="radiogroup" aria-labelledby="cl-len-l" className="seg">{LENGTHS.map((l) => <button key={l.id} type="button" role="radio" aria-checked={length === l.id} onClick={() => pick({ length: l.id })}>{l.label}</button>)}</div></div>
            </div>
            <fieldset className="cl-fieldset">
              <legend className="label">Template</legend>
              <div className="cl-templates" role="radiogroup" aria-label="Template">
                {LETTER_TEMPLATES.map((t) => {
                  const off = t.needsJd && !hasJd;
                  return (
                    <button key={t.id} type="button" role="radio" aria-checked={template === t.id} aria-disabled={off} className="cl-tpl" disabled={off}
                      onClick={() => { setTemplate(t.id); setEdited(false); setIssues([]); }}>
                      <span className="font-medium text-sm">{t.label}</span>
                      <span className="text-xs muted">{off ? 'Paste the job description to use this.' : t.hint}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <details className="cl-more" open={template === 'company' || template === 'referral' || undefined}>
              <summary className="text-sm font-medium">Make it personal (optional)</summary>
              <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
                <div><label className="label" htmlFor="cl-manager">Hiring manager's name</label><input id="cl-manager" className="input" value={manager} maxLength={80} placeholder="e.g. Priya Shah" onChange={(e) => { setManager(e.target.value); setEdited(false); }} /></div>
                <div><label className="label" htmlFor="cl-why">Why this company</label><input id="cl-why" className="input" value={motivation} maxLength={240} placeholder="e.g. your design system is used by millions of people" onChange={(e) => { setMotivation(e.target.value); setEdited(false); }} />
                  <p className="hint">One honest line in your own words. It's what makes a letter feel written for them.</p></div>
                <div><label className="label" htmlFor="cl-ref">Referred by</label><input id="cl-ref" className="input" value={referrer} maxLength={80} placeholder="e.g. Rahul Mehta, Design Lead" onChange={(e) => { setReferrer(e.target.value); setEdited(false); }} /></div>
              </div>
            </details>
            {ai && ai.provider !== 'off' && (
              <button type="button" className="btn btn-brand btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => void writeWithAi()} disabled={writing || description.trim().length <= 80 || !profiles.active}
                title={description.trim().length <= 80 ? 'Paste the job description first' : undefined}>
                <Wand size={14} aria-hidden="true" /> {writing ? 'Writing…' : 'Write with AI'}
              </button>
            )}
          </div>
        </section>

        <section className="card panel flush">
          <div className="panel-head">
            <div className="row" style={{ gap: 10 }}>
              <label className="panel-title" htmlFor="cl-text">Letter</label>
              {missing > 0 && <span className="badge badge-warning">{missing} gap{missing === 1 ? '' : 's'} to fill</span>}
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              {edited && <button type="button" className="btn btn-ghost btn-sm" onClick={regenerate}>Start again</button>}
              {tracked && <button type="button" className="btn btn-outline btn-sm" onClick={() => void saveToNotes()}><Save size={14} aria-hidden="true" /> Save to notes</button>}
              <button type="button" className="btn btn-outline btn-sm" onClick={download}><Download size={14} aria-hidden="true" /> Word</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={printPdf}><Download size={14} aria-hidden="true" /> PDF</button>
              <CopyButton value={text} label="cover letter" text />
            </div>
          </div>
          {issues.length > 0 && <div className="banner" role="alert"><p className="font-medium">Check before sending:</p><ul className="tailor-ol">{issues.map((i) => <li key={i}>{i}</li>)}</ul></div>}
          <textarea id="cl-text" className="textarea letter" rows={18} value={text} onChange={(e) => { setText(e.target.value); setEdited(true); }} />
          <ul className="cl-checks" aria-label="Letter check">
            {checks.map((c) => <li key={c.label} className={c.ok ? 'ok' : ''}>{c.ok ? <CheckCircle2 size={14} aria-hidden="true" /> : <span className="cl-dot" aria-hidden="true" />}<span>{c.label}</span><span className="sr-only">{c.ok ? ': done' : ': to do'}</span></li>)}
          </ul>
          <div className="letter-print" aria-hidden="true">
            {p && <header><h1>{fullName(p)}</h1><p>{[p.email, p.phone, p.location].filter(Boolean).join(' · ')}</p></header>}
            {text.split(/\n{2,}/).map((para, i) => <p key={i}>{para.split('\n').map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{l}</React.Fragment>)}</p>)}
          </div>
          {missing > 0 && (
            <p className="panel-foot text-xs muted">
              {profileGaps
                ? <>Words in [brackets] are empty profile fields or job details. Replace them here, or <button type="button" className="link" onClick={onOpenProfile}>fill in your profile</button> once and every letter uses it.</>
                : 'Pick a job or type the role and company to fill in [role] and [company].'}
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
