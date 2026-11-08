import React, { useEffect, useMemo, useState } from 'react';
import { Download, Save } from '../lib/icons';
import { Job } from '../types';
import { ProfilesStore } from '../lib/useProfiles';
import { TrackerStore } from '../lib/useTracker';
import { FEATURES } from '../lib/config';
import { bulletList, fullName, Profile, skillList } from '../lib/profile';
import { jobKey } from '../lib/userData';
import { fileSafe } from '../lib/resume';
import { CopyButton } from './CopyButton';
import { Wand } from '../lib/icons';
import { analyzeJob, coverage, relevantBullets } from '../lib/tailor';
import { AiError, AiSettings, loadAi, runAi, AI_KEY } from '../lib/ai';
import { guardLetter, letterTask } from '../lib/aiGuard';
import { onKeysChanged } from '../lib/userData';
import type { LetterContext } from './TailorView';

// Fill-in templates (no AI): every {field} comes from the profile or the chosen job, and the result stays editable.
const TEMPLATES = [
  { id: 'direct', label: 'Short and direct', body: `Dear {company} hiring team,

I'm applying for the {role} role. I'm a {headline} with {years} years of experience, and my strengths are {skills}.

Most recently at {current_company}, I {achievement_lower}. I'd bring the same focus to {company}.

I'd welcome the chance to talk about how I can help your team. Thank you for your time.

Best regards,
{name}
{email} · {phone}` },
  { id: 'story', label: 'Why this company', body: `Dear {company} team,

When I saw the {role} opening, it stood out because of the work {company} is doing. It matches what I've spent the last {years} years getting good at.

A few things I'd bring:
- {achievement}
- {achievement_2}
- Hands-on skill with {skills}

I'd love to learn more about the team and the problems you're solving next. You can reach me at {email} or {phone}.

Thank you,
{name}` },
  { id: 'switch', label: 'Career change', body: `Dear {company} hiring team,

I'm writing about the {role} position. My background is as a {headline}, and I'm moving into this kind of role because it builds directly on what I already do well.

In my current work I {achievement_lower}. Along the way I've built skills in {skills} that carry over to this role.

I'm a fast learner and would bring a fresh perspective to {company}. I'd be glad to talk about how my experience fits.

Sincerely,
{name}
{email}` },
];

const MATCHED = { id: 'matched', label: 'Matches the job description', body: '' };
const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1).replace(/[.;]$/, '') : '');

/** A letter built from the job description: what it asks for, and the profile's own lines that show each. */
function matchedLetter(p: Profile | null, role: string, company: string, description: string): string {
  if (!p) return fill(TEMPLATES[0].body, p, role, company);
  const job = analyzeJob(description, skillList(p));
  const cov = coverage(p, job);
  const shown = cov.matches.filter((m) => m.status !== 'missing' && m.evidence);
  const asks = shown.slice(0, 3).map((m) => lowerFirst(m.requirement.text));
  const list = asks.length > 1 ? `${asks.slice(0, -1).join(', ')} and ${asks[asks.length - 1]}` : asks[0];
  const proof: string[] = [];
  for (const m of shown) {
    const w = p.work.find((x) => bulletList(x.bullets).includes(m.evidence!.text));
    if (!w || proof.some((x) => x.includes(m.evidence!.text.slice(0, 30)))) continue;
    const at = `${w.current ? 'At' : 'Earlier, at'} ${w.company || 'my last company'}`;
    const verb = /^(\w+ed|built|ran|led|cut|grew|made|won|wrote|drove|set|took|began|brought|taught|kept|sold|spent|held|met)\b/i.test(m.evidence!.text);
    proof.push(verb ? `${at}, I ${lowerFirst(m.evidence!.text)}.` : `${at}: ${m.evidence!.text.replace(/[.;]$/, '')}.`);
    if (proof.length === 3) break;
  }
  // Not enough requirement-specific lines: add the bullets most relevant to the job
  for (const r of relevantBullets(p, job, 4)) {
    if (proof.length >= 2) break;
    if (proof.some((x) => x.includes(lowerFirst(r.text).slice(0, 30)) || x.includes(r.text.slice(0, 30)))) continue;
    const at = `${r.work.current ? 'At' : 'Earlier, at'} ${r.work.company || 'my last company'}`;
    const verb = /^(\w+ed|built|ran|led|cut|grew|made|won|wrote|drove|set|took|began|brought|taught|kept|sold|spent|held|met)\b/i.test(r.text);
    proof.push(verb ? `${at}, I ${lowerFirst(r.text)}.` : `${at}: ${r.text.replace(/[.;]$/, '')}.`);
  }
  const skills = cov.keywordsFound.slice(0, 4).join(', ');
  return [
    `Dear ${company || '[company]'} hiring team,`, '',
    `I'm applying for the ${role || '[role]'} role.${list ? ` Your posting asks for ${list}, which is the work I've been doing${p.years_experience ? ` for ${p.years_experience} years` : ''}.` : ''}`, '',
    proof.length ? proof.join(' ') : `In my current work I ${lowerFirst(bulletList(p.work[0]?.bullets ?? '')[0] ?? '[an achievement]')}.`,
    ...(skills ? ['', `I work every day with ${skills}, and I'd bring that to ${company || '[company]'} from the first week.`] : []), '',
    `I'd welcome the chance to talk about the role. Thank you for your time.`, '',
    'Best regards,', fullName(p) || '[name]', [p.email, p.phone].filter(Boolean).join(' · '),
  ].join('\n').trim();
}

function fill(body: string, p: Profile | null, role: string, company: string): string {
  const latest = p?.work[0];
  const bullets = latest ? bulletList(latest.bullets) : [];
  const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1).replace(/\.$/, '') : '');
  const values: Record<string, string> = {
    name: p ? fullName(p) : '', email: p?.email ?? '', phone: p?.phone ?? '', headline: (p?.headline || latest?.title || '').toLowerCase(),
    years: p?.years_experience || '', skills: p ? skillList(p).slice(0, 4).join(', ') : '', current_company: latest?.company ?? '',
    achievement: bullets[0] ?? '', achievement_2: bullets[1] ?? '', achievement_lower: lower(bullets[0] ?? ''), role, company,
  };
  // A field with no value stays visible as [field] so it is easy to spot and fill in.
  return body.replace(/\{(\w+)\}/g, (_, k: string) => values[k] || `[${k.replace(/_/g, ' ')}]`);
}

export const CoverLetterView: React.FC<{ profiles: ProfilesStore; tracker: TrackerStore; savedJobs: Job[]; notify: (m: string, kind?: 'error' | 'info') => void; onOpenProfile: () => void; context?: LetterContext | null }> = ({ profiles, tracker, savedJobs, notify, onOpenProfile, context }) => {
  const targets = useMemo(() => {
    const seen = new Set<string>();
    const list: { key: string; role: string; company: string; tracked: boolean }[] = [];
    for (const a of tracker.apps) { seen.add(a.key); list.push({ key: a.key, role: a.title, company: a.company_name, tracked: true }); }
    for (const j of savedJobs) { const k = jobKey(j); if (!seen.has(k)) list.push({ key: k, role: j.title, company: j.company_name, tracked: false }); }
    return list;
  }, [tracker.apps, savedJobs]);
  const [target, setTarget] = useState('');
  const [template, setTemplate] = useState(TEMPLATES[0].id);
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
  const build = (t: string) => (t === 'matched' && description.trim().length > 80 ? matchedLetter(profiles.active, role, company, description) : fill((TEMPLATES.find((x) => x.id === t) ?? TEMPLATES[0]).body, profiles.active, role || '[role]', company || '[company]'));
  const writeWithAi = async () => {
    if (!ai || !profiles.active) return;
    setWriting(true); setIssues([]);
    try {
      const p = profiles.active;
      const job = analyzeJob(description, skillList(p));
      const out = await runAi<{ paragraphs?: unknown }>(letterTask(p, job, role, company, description), ai);
      const paras = (Array.isArray(out.paragraphs) ? out.paragraphs : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 6);
      if (!paras.length) { notify('The AI returned no letter. Try again.'); return; }
      const letter = [`Dear ${company || '[company]'} hiring team,`, '', paras.join('\n\n'), '', 'Best regards,', fullName(p) || '[name]', [p.email, p.phone].filter(Boolean).join(' · ')].join('\n').trim();
      setText(letter); setEdited(true); setIssues(guardLetter(p, job, paras.join(' ')));
    } catch (e) { notify(e instanceof AiError ? e.message : 'Something went wrong. Try again.'); }
    finally { setWriting(false); }
  };

  useEffect(() => { const t = targets.find((x) => x.key === target); if (t) { setRole(t.role); setCompany(t.company); } }, [target, targets]);
  useEffect(() => { if (!edited) setText(build(template)); }, [template, role, company, profiles.active, edited, description]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const gaps = text.match(/\[[a-z ]+\]/g) ?? [];
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
                onChange={(e) => { const v = e.target.value; setDescription(v); if (v.trim().length > 80 && template !== 'matched' && !edited) setTemplate('matched'); }} />
            </div>
            <div>
              <label className="label" htmlFor="cl-template">Template</label>
              <select id="cl-template" className="select" value={template} onChange={(e) => { setTemplate(e.target.value); setEdited(false); setIssues([]); }}>
                {[MATCHED, ...TEMPLATES].map((t) => <option key={t.id} value={t.id} disabled={t.id === 'matched' && description.trim().length <= 80}>{t.label}{t.id === 'matched' && description.trim().length <= 80 ? ' (paste the job description)' : ''}</option>)}
              </select>
            </div>
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
              <CopyButton value={text} label="cover letter" text />
            </div>
          </div>
          {issues.length > 0 && <div className="banner" role="alert"><p className="font-medium">Check before sending:</p><ul className="tailor-ol">{issues.map((i) => <li key={i}>{i}</li>)}</ul></div>}
          <textarea id="cl-text" className="textarea letter" rows={18} value={text} onChange={(e) => { setText(e.target.value); setEdited(true); }} />
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
