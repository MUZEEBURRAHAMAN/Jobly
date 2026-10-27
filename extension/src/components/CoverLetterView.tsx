import React, { useEffect, useMemo, useState } from 'react';
import { Download, Save } from '../lib/icons';
import { Job } from '../types';
import { ProfilesStore } from '../lib/useProfiles';
import { TrackerStore } from '../lib/useTracker';
import { bulletList, fullName, Profile, skillList } from '../lib/profile';
import { jobKey } from '../lib/userData';
import { fileSafe } from '../lib/resume';
import { CopyButton } from './CopyButton';

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

export const CoverLetterView: React.FC<{ profiles: ProfilesStore; tracker: TrackerStore; savedJobs: Job[]; notify: (m: string, kind?: 'error' | 'info') => void; onOpenProfile: () => void }> = ({ profiles, tracker, savedJobs, notify, onOpenProfile }) => {
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

  useEffect(() => { const t = targets.find((x) => x.key === target); if (t) { setRole(t.role); setCompany(t.company); } }, [target, targets]);
  useEffect(() => { if (!edited) setText(fill(TEMPLATES.find((t) => t.id === template)!.body, profiles.active, role || '[role]', company || '[company]')); }, [template, role, company, profiles.active, edited]);

  const regenerate = () => { setEdited(false); setText(fill(TEMPLATES.find((t) => t.id === template)!.body, profiles.active, role || '[role]', company || '[company]')); };
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
  const missing = (text.match(/\[[a-z ]+\]/g) ?? []).length;

  return (
    <div className="section">
      <div><h2>Cover letters</h2><p className="text-sm">Start from a template filled with your profile and the job, then make it yours.</p></div>
      {!profiles.active && <p className="banner">Fill in your profile so the letter can use your name, experience and skills. <button type="button" className="link" onClick={onOpenProfile}>Open profile</button></p>}
      <div className="form-grid">
        <div className="wide">
          <label className="label" htmlFor="cl-target">Job</label>
          <select id="cl-target" className="select" value={target} onChange={(e) => { setTarget(e.target.value); setEdited(false); }}>
            <option value="">Type the role and company below</option>
            {targets.map((t) => <option key={t.key} value={t.key}>{t.role} · {t.company}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="cl-role">Role</label><input id="cl-role" className="input" value={role} onChange={(e) => { setRole(e.target.value); setEdited(false); }} /></div>
        <div><label className="label" htmlFor="cl-company">Company</label><input id="cl-company" className="input" value={company} onChange={(e) => { setCompany(e.target.value); setEdited(false); }} /></div>
        <div className="wide">
          <label className="label" htmlFor="cl-template">Template</label>
          <select id="cl-template" className="select" value={template} onChange={(e) => { setTemplate(e.target.value); setEdited(false); }}>
            {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <label className="label" htmlFor="cl-text">Letter</label>
          {missing > 0 && <span className="text-xs" style={{ color: 'var(--warning)' }}>{missing} gap{missing === 1 ? '' : 's'} to fill in [brackets]</span>}
        </div>
        <textarea id="cl-text" className="textarea letter" rows={16} value={text} onChange={(e) => { setText(e.target.value); setEdited(true); }} />
      </div>
      <div className="row wrap">
        <CopyButton value={text} label="cover letter" text />
        <button type="button" className="btn btn-outline btn-sm" onClick={download}><Download size={14} aria-hidden="true" /> Word</button>
        {tracked && <button type="button" className="btn btn-outline btn-sm" onClick={() => void saveToNotes()}><Save size={14} aria-hidden="true" /> Save to application notes</button>}
        {edited && <button type="button" className="btn btn-ghost btn-sm" onClick={regenerate}>Start again from the template</button>}
      </div>
    </div>
  );
};
