import React, { useMemo, useState } from 'react';
import { CheckCircle2, FileText, Mail, Save, Target } from '../lib/icons';
import { Job } from '../types';
import { ProfilesStore } from '../lib/useProfiles';
import { TrackerStore } from '../lib/useTracker';
import { jobData } from '../lib/api';
import { jobKey } from '../lib/userData';
import { skillList } from '../lib/profile';
import { analyzeJob, applySuggestions, coverage, defaultAccepted, JobAnalysis, Suggestion, suggestions as makeSuggestions } from '../lib/tailor';
import { saveVersion } from '../lib/resumeVersions';
import { AiRewrite } from './AiRewrite';

export interface LetterContext { role: string; company: string; description: string }
interface Target { key: string; role: string; company: string; jobId: number | null }

const STATUS = { covered: 'Covered', partial: 'Partly', missing: 'Missing' } as const;

/**
 * Tailor the resume for one job: paste its description (or pick a saved job), see which requirements the profile
 * shows, accept suggested changes one by one, and save the tailored version for that job.
 */
export const TailorView: React.FC<{
  profiles: ProfilesStore; tracker: TrackerStore; savedJobs: Job[]; notify: (m: string, kind?: 'error' | 'info') => void;
  onOpenProfile: () => void; onOpenResume: (versionId: string) => void; onWriteLetter: (c: LetterContext) => void;
}> = ({ profiles, tracker, savedJobs, notify, onOpenProfile, onOpenResume, onWriteLetter }) => {
  const targets = useMemo(() => {
    const seen = new Set<string>();
    const list: Target[] = [];
    for (const j of savedJobs) { const k = jobKey(j); seen.add(k); list.push({ key: k, role: j.title, company: j.company_name, jobId: j.id > 0 ? j.id : null }); }
    for (const a of tracker.apps) if (!seen.has(a.key)) list.push({ key: a.key, role: a.title, company: a.company_name, jobId: null });
    return list;
  }, [savedJobs, tracker.apps]);
  const [target, setTarget] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [list, setList] = useState<Suggestion[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [savedId, setSavedId] = useState<string | null>(null);
  const p = profiles.active;

  const pick = async (key: string) => {
    setTarget(key); setAnalysis(null); setSavedId(null);
    const t = targets.find((x) => x.key === key);
    if (!t) return;
    setRole(t.role); setCompany(t.company);
    if (t.jobId) {
      setLoadingDesc(true);
      try { const d = await jobData.description(t.jobId); setDescription(d ?? ''); if (!d) notify("This job's description isn't in Jobly's data. Paste it from the posting."); }
      catch { notify("Couldn't load the description. Paste it from the posting."); }
      finally { setLoadingDesc(false); }
    } else setDescription('');
  };

  const check = () => {
    if (!p) return;
    const a = analyzeJob(description, skillList(p));
    if (!a.requirements.length && !a.keywords.length) { notify("Jobly couldn't find requirements in that text. Paste the full job description, including its requirements."); return; }
    const s = makeSuggestions(p, a);
    setAnalysis(a); setList(s); setAccepted(defaultAccepted(s)); setSavedId(null);
  };

  const before = useMemo(() => (p && analysis ? coverage(p, analysis) : null), [p, analysis]);
  const tailored = useMemo(() => (p && analysis ? applySuggestions(p, list, accepted) : null), [p, analysis, list, accepted]);
  const after = useMemo(() => (tailored && analysis ? coverage(tailored, analysis) : null), [tailored, analysis]);
  const toggle = (id: string, on: boolean) => { setAccepted((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; }); setSavedId(null); };
  const addRewrites = (more: Suggestion[]) => { setList((l) => [...l.filter((x) => !more.some((m) => m.id === x.id)), ...more]); setAccepted((s) => new Set([...s, ...more.map((m) => m.id)])); setSavedId(null); };

  const save = async () => {
    if (!tailored || !before || !after || !p) return;
    const { problem, id } = await saveVersion({ job: { key: target || null, title: role || 'Untitled role', company }, description, before: before.percent, after: after.percent,
      profile: { ...tailored, label: `${p.label} · ${role || 'tailored'}${company ? ` at ${company}` : ''}`.slice(0, 60) } });
    if (problem) notify(problem); else { setSavedId(id); notify('Tailored resume saved for this job.', 'info'); }
  };

  if (!p) {
    return (
      <div className="section">
        <div><h2>Tailor</h2><p className="text-sm">Match your resume to a job description.</p></div>
        <div className="card empty"><p className="empty-title">Set up your profile first</p><p className="empty-desc">Tailoring works from your profile: experience, skills and summary. Import your LinkedIn PDF and it takes a minute.</p>
          <div className="empty-actions"><button type="button" className="btn" onClick={onOpenProfile}>Open profile</button></div></div>
      </div>
    );
  }

  return (
    <div className="section tailor">
      <div><h2>Tailor your resume</h2><p className="text-sm">Paste a job description. Jobly lists what it asks for, shows where your resume covers it, and suggests changes you accept one by one. Nothing is made up, and nothing leaves this browser.</p></div>

      <div className="card tailor-job">
        <div className="form-grid">
          <div className="wide">
            <label className="label" htmlFor="tl-target">Job</label>
            <select id="tl-target" className="select" value={target} onChange={(e) => void pick(e.target.value)}>
              <option value="">Paste a job description below</option>
              {targets.map((t) => <option key={t.key} value={t.key}>{t.role} · {t.company}</option>)}
            </select>
          </div>
          <div><label className="label" htmlFor="tl-role">Role</label><input id="tl-role" className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior Product Designer" /></div>
          <div><label className="label" htmlFor="tl-company">Company</label><input id="tl-company" className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme" /></div>
          <div className="wide">
            <label className="label" htmlFor="tl-desc">Job description</label>
            <textarea id="tl-desc" className="textarea" rows={8} value={description} maxLength={20000} aria-busy={loadingDesc}
              onChange={(e) => { setDescription(e.target.value); setAnalysis(null); }} placeholder={loadingDesc ? 'Loading the description…' : 'Paste the whole posting, including its requirements'} />
          </div>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={check} disabled={description.trim().length < 80 || loadingDesc}><Target size={14} aria-hidden="true" /> Check my resume</button>
          <span className="text-xs muted">Using the profile “{p.label}”.</span>
        </div>
      </div>

      {analysis && before && after && (
        <>
          <div className="tailor-score card" role="status">
            <div><div className="tailor-big">{before.percent}%</div><div className="text-xs muted">coverage now</div></div>
            <div className="text-sm grow">
              <p><span className="font-medium">{before.covered} of {before.matches.length}</span> requirements clearly covered{analysis.yearsAsked ? `; asks for ${analysis.yearsAsked}+ years` : ''}.</p>
              {before.keywordsMissing.length > 0 && <p className="muted">Keywords not in your resume: {before.keywordsMissing.join(', ')}</p>}
            </div>
            {after.percent !== before.percent && <div><div className="tailor-big tailor-after">{after.percent}%</div><div className="text-xs muted">with your changes</div></div>}
          </div>

          <section className="stack" aria-labelledby="tl-req">
            <h3 id="tl-req">What the job asks for</h3>
            <ul className="tailor-list">
              {before.matches.map((m) => (
                <li key={m.requirement.id} className="card">
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <span className={`badge tailor-${m.status}`}>{STATUS[m.status]}</span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <p className="text-sm tailor-req">{m.requirement.text} {!m.requirement.must && <span className="badge badge-outline">Nice to have</span>}</p>
                      {m.evidence ? <p className="text-xs muted break">Shown by {m.evidence.where}: “{m.evidence.text}”</p> : <p className="text-xs muted">Not in your resume. Add it to your profile only if you have it.</p>}
                    </div>
                  </div>
                </li>
              ))}
              {!before.matches.length && <li className="text-sm muted">No requirement list found; the score uses the skills the posting names.</li>}
            </ul>
          </section>

          <section className="stack" aria-labelledby="tl-sug">
            <h3 id="tl-sug">Suggested changes</h3>
            <AiRewrite profile={tailored ?? p} analysis={analysis} role={role} company={company} description={description} notify={notify} onSuggestions={addRewrites} />
            {list.length === 0 ? <p className="text-sm muted">Your resume is already in good order for this job.</p> : (
              <ul className="tailor-list">
                {list.map((s) => (
                  <li key={s.id} className="card">
                    <label className="row" style={{ alignItems: 'flex-start' }}>
                      <input type="checkbox" checked={accepted.has(s.id)} onChange={(e) => toggle(s.id, e.target.checked)} />
                      <span className="grow stack" style={{ gap: 6, minWidth: 0 }}>
                        <span className="text-sm font-medium">{s.title}</span>
                        {s.kind === 'add-skill' && <span className="text-xs muted">The job names it and your resume doesn't. Tick this only if you really have the skill.</span>}
                        {(s.kind === 'skills-order') && <span className="text-xs muted break">{s.after.join(' · ')}</span>}
                        {s.kind === 'bullets-order' && <ol className="text-xs muted tailor-ol">{s.after.map((b) => <li key={b}>{b}</li>)}</ol>}
                        {s.kind === 'rewrite' && (
                          <span className="tailor-diff">
                            <span className="text-xs muted">Before</span><span className="text-sm break tailor-before">{s.before}</span>
                            <span className="text-xs muted">After</span><span className="text-sm break">{s.after}</span>
                            {s.note && <span className="text-xs" style={{ color: 'var(--warning)' }}>{s.note}</span>}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="row wrap save-bar">
            <button type="button" className="btn" onClick={() => void save()} disabled={!!savedId}><Save size={14} aria-hidden="true" /> {savedId ? 'Saved for this job' : 'Save tailored resume'}</button>
            {savedId && <button type="button" className="btn btn-outline" onClick={() => onOpenResume(savedId)}><FileText size={14} aria-hidden="true" /> Open in Resume</button>}
            <button type="button" className="btn btn-outline" onClick={() => onWriteLetter({ role, company, description })}><Mail size={14} aria-hidden="true" /> Write a cover letter for this job</button>
            {savedId && <span className="text-sm row" style={{ color: 'var(--success)' }}><CheckCircle2 size={14} aria-hidden="true" /> Coverage {before.percent}% → {after.percent}%</span>}
          </div>
        </>
      )}
    </div>
  );
};
