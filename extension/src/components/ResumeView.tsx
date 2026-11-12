import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, FileText, Save, Target, Trash, Wand } from '../lib/icons';
import { ProfilesStore } from '../lib/useProfiles';
import { AccentId, ACCENTS, allResumeCss, defaultPage, fileSafe, PageId, PAGES, resumeHtml, resumeWordDoc, TemplateId, TEMPLATES } from '../lib/resume';
import { fullName, Profile, skillList } from '../lib/profile';
import { readKey, writeKey } from '../lib/userData';
import { removeVersion, saveVersion, useVersions } from '../lib/resumeVersions';
import { analyzeJob, applySuggestions, coverage, defaultAccepted, JobAnalysis, suggestions } from '../lib/tailor';
import { resumeScore } from '../lib/resumeScore';
import { AiError, AI_KEY, AiSettings, loadAi, runAi } from '../lib/ai';
import { guardRewrite, rewriteTask } from '../lib/aiGuard';
import { onKeysChanged } from '../lib/userData';

const SETTINGS_KEY = 'resumeSettings';
interface Settings { template: TemplateId; accent: AccentId; page: PageId; fit: boolean }
const MIN_FIT = 0.75;

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The resume: pick a template and accent, tailor it to a pasted job description, see its score, and save a clean
 * PDF (no browser headers or footers, one page when it fits) or a Word file.
 */
export const ResumeView: React.FC<{ store: ProfilesStore; onOpenProfile: () => void; initialVersion?: string | null; notify?: (m: string, kind?: 'error' | 'info') => void }> = ({ store, onOpenProfile, initialVersion, notify }) => {
  const [settings, setSettings] = useState<Settings>({ template: 'modern', accent: 'black', page: defaultPage(), fit: true });
  const versions = useVersions();
  const [which, setWhich] = useState<string>(initialVersion ?? 'base');
  const version = versions.find((v) => v.id === which) ?? null;
  // Tailoring on this page: a job description, the tailored copy it produced (not saved until asked)
  const [jd, setJd] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [jobCompany, setJobCompany] = useState('');
  const [tailored, setTailored] = useState<{ profile: Profile; analysis: JobAnalysis; before: number; after: number; skipped: string[] } | null>(null);
  const [ai, setAi] = useState<AiSettings | null>(null);
  const [rewording, setRewording] = useState(false);
  const [fit, setFit] = useState<{ scale: number; over: boolean }>({ scale: 1, over: false });
  const resumeRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void readKey<Partial<Settings>>(SETTINGS_KEY).then((s) => {
    if (!s) { void readKey<TemplateId>('resumeTemplate').then((t) => { if (t && TEMPLATES.some((x) => x.id === t)) setSettings((x) => ({ ...x, template: t })); }); return; }
    setSettings((x) => ({ ...x, ...s, template: TEMPLATES.some((t) => t.id === s.template) ? s.template! : x.template }));
  }); }, []);
  useEffect(() => { const load = () => void loadAi().then(setAi); load(); return onKeysChanged([AI_KEY], load); }, []);
  const update = (patch: Partial<Settings>) => setSettings((s) => { const n = { ...s, ...patch }; void writeKey(SETTINGS_KEY, n); if (patch.template) void writeKey('resumeTemplate', patch.template); return n; });

  const base = version?.profile ?? store.active;
  const p = tailored?.profile ?? base;
  const page = PAGES[settings.page];
  const html = useMemo(() => (p ? resumeHtml(p, settings.template) : ''), [p, settings.template]);
  const cov = useMemo(() => (p && tailored ? coverage(p, tailored.analysis) : null), [p, tailored]);
  const single = TEMPLATES.find((t) => t.id === settings.template)?.ats ?? true;
  const score = useMemo(() => (p ? resumeScore(p, { coverage: cov, singleColumn: single, overflows: fit.over }) : null), [p, cov, single, fit.over]);

  // Template styles live in a constructed stylesheet (the extension's security policy blocks inline <style>)
  useEffect(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(allResumeCss(settings.accent));
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return () => { document.adoptedStyleSheets = document.adoptedStyleSheets.filter((x) => x !== sheet); };
  }, [settings.accent]);

  // Fit to one page: shrink the resume (not below 75%) so it ends within the page
  useLayoutEffect(() => {
    const el = resumeRef.current?.querySelector<HTMLElement>('.resume');
    if (!el) return;
    el.style.zoom = '1';
    el.style.minHeight = settings.template === 'sidebar' ? `${page.h}px` : '';
    const h = el.scrollHeight;
    const need = page.h / h;
    const scale = settings.fit && h > page.h ? Math.max(MIN_FIT, need) : 1;
    el.style.zoom = String(scale);
    if (settings.template === 'sidebar') el.style.minHeight = `${page.h / scale}px`;
    setFit({ scale, over: h * scale > page.h + 1 });
  }, [html, settings.fit, settings.page, settings.template, settings.accent, page.h]);

  if (!base || !p) {
    return (
      <div className="section">
        <div><h2>Resume</h2><p className="text-sm">Build a resume from your profile, tailor it to a job, and save a clean PDF.</p></div>
        <div className="card empty"><p className="empty-title">Fill in your profile first</p><p className="empty-desc">Your resume is built from your profile: contact, experience, education and skills. Import your LinkedIn PDF to start in a minute.</p>
          <div className="empty-actions"><button type="button" className="btn" onClick={onOpenProfile}>Open profile</button></div></div>
      </div>
    );
  }

  const name = fileSafe(`${fullName(p) || 'Resume'} Resume${(tailored ? jobCompany : version?.job.company) ? ` ${tailored ? jobCompany : version?.job.company}` : ''}`);

  const applyJd = () => {
    const analysis = analyzeJob(jd, skillList(base));
    if (!analysis.requirements.length && !analysis.keywords.length) { notify?.("Jobly couldn't find requirements in that text. Paste the full job description, including its requirements."); return; }
    const list = suggestions(base, analysis);
    const next = applySuggestions(base, list, defaultAccepted(list));
    setTailored({ profile: next, analysis, before: coverage(base, analysis).percent, after: coverage(next, analysis).percent, skipped: [] });
  };
  const reword = async () => {
    if (!tailored || !ai) return;
    setRewording(true);
    try {
      const answer = await runAi<{ summary?: unknown; bullets?: unknown }>(rewriteTask(tailored.profile, tailored.analysis, jobRole, jobCompany, jd), ai);
      const { suggestions: rw, dropped } = guardRewrite(tailored.profile, tailored.analysis, answer);
      const next = applySuggestions(tailored.profile, rw, new Set(rw.map((s) => s.id)));
      setTailored({ ...tailored, profile: next, after: coverage(next, tailored.analysis).percent });
      notify?.(`${rw.length} line${rw.length === 1 ? '' : 's'} reworded${dropped.length ? `; ${dropped.length} left out by the fact check` : ''}. Check them in the preview.`, 'info');
    } catch (e) { notify?.(e instanceof AiError ? e.message : 'Something went wrong. Try again.'); }
    finally { setRewording(false); }
  };
  const saveTailored = async () => {
    if (!tailored) return;
    const { problem, id } = await saveVersion({ job: { key: null, title: jobRole || 'Untitled role', company: jobCompany }, description: jd, before: tailored.before, after: tailored.after,
      profile: { ...tailored.profile, label: `${base.label} · ${jobRole || 'tailored'}`.slice(0, 60) } });
    if (problem) { notify?.(problem); return; }
    notify?.('Tailored resume saved for this job.', 'info');
    setTailored(null); if (id) setWhich(id);
  };

  const printPdf = () => {
    // Zero page margin makes Chrome leave out its header and footer (address, date, title); the template's own
    // padding is the margin. One page: the page box is clipped to a single sheet.
    const style = document.createElement('style');
    const onePage = settings.fit && !fit.over;
    style.textContent = `@page { size: ${page.css}; margin: 0; }
@media print { .resume-print { width: ${page.w}px !important; ${onePage ? `height: ${page.h}px; overflow: hidden;` : ''} } }`;
    document.head.appendChild(style);
    const title = document.title;
    document.title = name;  // the PDF's file name
    const done = () => { style.remove(); document.title = title; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  };

  // Keyword targeting: add a missing keyword to the skills only when the user says they have it
  const haveKeyword = (k: string) => {
    if (!tailored) return;
    const next = { ...tailored.profile, skills: [...skillList(tailored.profile), k].join(', ') };
    setTailored({ ...tailored, profile: next, after: coverage(next, tailored.analysis).percent });
  };
  const missing = cov ? cov.keywordsMissing.filter((k) => !tailored?.skipped.includes(k)) : [];

  return (
    <div className="section resume-view">
      <div className="row wrap rv-head" style={{ justifyContent: 'space-between' }}>
        <div><h2>Resume</h2><p className="text-sm">{tailored ? `Tailored to the job description below (not saved yet).` : version ? `Tailored for ${version.job.title}${version.job.company ? ` at ${version.job.company}` : ''}.` : `From your profile “${base.label}”.`}</p></div>
        <div className="row wrap">
          <button type="button" className="btn btn-outline btn-sm" onClick={onOpenProfile}><FileText size={14} aria-hidden="true" /> Edit profile</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => download(`${name}.doc`, 'application/msword', resumeWordDoc(p, settings.template, settings.accent))}><Download size={14} aria-hidden="true" /> Word</button>
          <button type="button" className="btn btn-sm" onClick={printPdf}><Download size={14} aria-hidden="true" /> Download PDF</button>
        </div>
      </div>

      <div className="rv-layout">
        <div className="rv-controls">
          {versions.length > 0 && !tailored && (
            <div className="card rv-card">
              <label className="label" htmlFor="rv-which">Version</label>
              <select id="rv-which" className="select" value={version ? version.id : 'base'} onChange={(e) => setWhich(e.target.value)}>
                <option value="base">From your profile (not tailored)</option>
                {versions.map((v) => <option key={v.id} value={v.id}>Tailored: {v.job.title}{v.job.company ? ` at ${v.job.company}` : ''}</option>)}
              </select>
              {version && <div className="row wrap" style={{ justifyContent: 'space-between' }}><span className="text-xs muted">Coverage {version.before}% → {version.after}%</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { void removeVersion(version.id); setWhich('base'); }}><Trash size={14} aria-hidden="true" /> Delete</button></div>}
            </div>
          )}

          <section className="card rv-card" aria-labelledby="rv-jd-title">
            <h3 id="rv-jd-title" className="row"><Target size={16} aria-hidden="true" /> Tailor to a job description</h3>
            {!tailored ? (
              <>
                <div className="form-grid">
                  <div><label className="label" htmlFor="rv-role">Role</label><input id="rv-role" className="input" value={jobRole} onChange={(e) => setJobRole(e.target.value)} placeholder="e.g. Product Designer" /></div>
                  <div><label className="label" htmlFor="rv-co">Company</label><input id="rv-co" className="input" value={jobCompany} onChange={(e) => setJobCompany(e.target.value)} placeholder="e.g. Acme" /></div>
                </div>
                <div><label className="label" htmlFor="rv-jd">Job description</label>
                  <textarea id="rv-jd" className="textarea" rows={5} maxLength={20000} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job description" /></div>
                <button type="button" className="btn btn-sm" onClick={applyJd} disabled={jd.trim().length < 80}><Wand size={14} aria-hidden="true" /> Apply to my resume</button>
                <p className="hint">Puts the skills and points the job asks for first. Nothing is made up; your profile stays as it is.</p>
              </>
            ) : (
              <div className="stack">
                <p className="text-sm rv-coverage"><CheckCircle2 size={16} aria-hidden="true" /> <span>{`Coverage ${tailored.before}% → `}<b>{tailored.after}%</b> of what the job asks for</span></p>
                <div className="row wrap">
                  <button type="button" className="btn btn-sm" onClick={() => void saveTailored()}><Save size={14} aria-hidden="true" /> Save for this job</button>
                  {ai && ai.provider !== 'off' && <button type="button" className="btn btn-outline btn-sm" onClick={() => void reword()} disabled={rewording}><Wand size={14} aria-hidden="true" /> {rewording ? 'Rewording…' : 'Reword with AI'}</button>}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTailored(null)}>Undo</button>
                </div>
                {cov && (cov.keywordsFound.length + cov.keywordsMissing.length) > 0 && (
                  <div className="rv-keywords">
                    {cov.keywordsFound.length > 0 && <div><p className="label">In your resume ({cov.keywordsFound.length})</p>
                      <ul className="chips-list" aria-label="Keywords in your resume">{cov.keywordsFound.map((k) => <li key={k} className="kw kw-found"><CheckCircle2 size={12} aria-hidden="true" /> {k}</li>)}</ul></div>}
                    {missing.length > 0 && <div><p className="label">Missing ({missing.length}): do you have these?</p>
                      <ul className="rv-missing" aria-label="Missing keywords">{missing.map((k) => (
                        <li key={k}><span className="kw">{k}</span>
                          <span className="row"><button type="button" className="btn btn-outline btn-xs" onClick={() => haveKeyword(k)} aria-label={`I have ${k}: add it to skills`}>I have this</button>
                          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setTailored({ ...tailored, skipped: [...tailored.skipped, k] })} aria-label={`Skip ${k}`}>Skip</button></span></li>))}</ul>
                      <p className="hint">Only add what you really have; an interviewer will ask about it.</p></div>}
                  </div>
                )}
                <p className="hint">For requirement-by-requirement detail and changes one at a time, use Tailor for a job.</p>
              </div>
            )}
          </section>

          {score && (
            <section className="card rv-card" aria-labelledby="rv-score-title">
              <h3 id="rv-score-title">Resume score</h3>
              <div className="rv-gauge-row">
                <div className={`rv-gauge rv-${score.grade.replace(' ', '-').toLowerCase()}`} role="img" aria-label={`Score ${score.score} out of 100, ${score.grade}`}
                  style={{ ['--p' as string]: score.score }}>
                  <span><b>{score.score}</b><small>/100</small></span>
                </div>
                <div className="rv-cats">
                  <p className="font-medium">{score.grade}{cov ? ' for this job' : ''}</p>
                  {score.categories.map((c) => (
                    <div key={c.name} className="rv-cat">
                      <span className="text-xs">{c.name}</span>
                      <span className="meter" role="progressbar" aria-label={c.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.percent}><span style={{ width: `${c.percent}%` }} /></span>
                    </div>
                  ))}
                </div>
              </div>
              {score.fixes.length === 0 ? <p className="text-sm">Everything checks out.</p> : (
                <ul className="rv-checks" aria-label="Top fixes">
                  {score.fixes.slice(0, 5).map((c) => <li key={c.id} className={`fix-${c.impact}`}><span className="row" style={{ justifyContent: 'space-between' }}><span className="text-sm font-medium">{c.label}</span><span className={`imp imp-${c.impact}`}>{c.impact === 'high' ? 'High impact' : c.impact === 'medium' ? 'Medium' : 'Low'}</span></span><span className="text-xs muted">{c.tip}</span></li>)}
                </ul>
              )}
              {!cov && <p className="hint">Paste a job description above to add the job match to your score.</p>}
              <details className="text-sm"><summary>All {score.checks.length} checks</summary>
                {score.categories.map((cat) => <div key={cat.name}><p className="label" style={{ marginTop: 8 }}>{cat.name} · {cat.percent}%</p>
                  <ul className="rv-all">{score.checks.filter((c) => c.category === cat.name).map((c) => <li key={c.id} className={c.ok ? 'ok' : ''}>{c.ok ? '✓' : '○'} {c.label} <span className="muted">{c.got}/{c.max}</span></li>)}</ul></div>)}</details>
            </section>
          )}

          <section className="card rv-card" aria-labelledby="rv-tpl-title">
            <h3 id="rv-tpl-title">Template</h3>
            <div className="rv-templates" role="radiogroup" aria-label="Template">
              {TEMPLATES.map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={settings.template === t.id} className="rv-tpl" onClick={() => update({ template: t.id })} title={t.hint}>
                  <span className="rv-thumb" aria-hidden="true" dangerouslySetInnerHTML={{ __html: resumeHtml(p, t.id) }} />
                  <span className="rv-tpl-name">{t.label}{!t.ats && <span className="text-xs muted"> · 2 columns</span>}</span>
                </button>
              ))}
            </div>
            <p className="hint">{TEMPLATES.find((t) => t.id === settings.template)?.hint}{settings.template === 'sidebar' ? ' Some older applicant tracking systems read single-column resumes more reliably.' : ''}</p>
            <div className="row wrap" role="radiogroup" aria-label="Accent colour">
              {ACCENTS.map((a) => <button key={a.id} type="button" role="radio" aria-checked={settings.accent === a.id} aria-label={a.label} title={a.label} className="rv-swatch" style={{ background: a.color }} onClick={() => update({ accent: a.id })} />)}
            </div>
          </section>

          <section className="card rv-card" aria-labelledby="rv-page-title">
            <h3 id="rv-page-title">Page</h3>
            <div className="row wrap">
              <select className="select" style={{ width: 'auto' }} value={settings.page} onChange={(e) => update({ page: e.target.value as PageId })} aria-label="Page size">
                {Object.entries(PAGES).map(([id, v]) => <option key={id} value={id}>{v.label}</option>)}
              </select>
              <label className="row text-sm"><input type="checkbox" className="switch" role="switch" checked={settings.fit} onChange={(e) => update({ fit: e.target.checked })} /> Fit to one page</label>
            </div>
            <p className="hint" role="status">{fit.over ? 'Longer than one page even at 75%. Remove older points, or try Compact.' : fit.scale < 1 ? `Fits on one page at ${Math.round(fit.scale * 100)}%.` : 'Fits on one page.'}</p>
          </section>
        </div>

        <div className="resume-frame" role="region" aria-label="Resume preview" tabIndex={0}>
          <div className="resume-page" style={{ width: page.w, minHeight: page.h }}>
            {/* Our own escaped markup (lib/resume.ts) built from the user's profile. */}
            <div ref={resumeRef} className="resume-print" dangerouslySetInnerHTML={{ __html: html }} />
            {!settings.fit && <span className="page-line" style={{ top: page.h }} aria-hidden="true">End of page 1</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
