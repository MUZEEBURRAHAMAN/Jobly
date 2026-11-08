import React, { useMemo, useState } from 'react';
import { Download, FileText } from '../lib/icons';
import { ProfilesStore } from '../lib/useProfiles';
import { fileSafe, resumeCss, resumeHtml, resumeWordDoc, TemplateId, TEMPLATES } from '../lib/resume';
import { fullName } from '../lib/profile';
import { readKey, writeKey } from '../lib/userData';
import { removeVersion, useVersions } from '../lib/resumeVersions';
import { Trash } from '../lib/icons';

const TEMPLATE_KEY = 'resumeTemplate';

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Builds a resume from the active profile. PDF uses Chrome's own "Save as PDF"; Word gets a .doc that keeps the layout. */
export const ResumeView: React.FC<{ store: ProfilesStore; onOpenProfile: () => void; initialVersion?: string | null }> = ({ store, onOpenProfile, initialVersion }) => {
  const [template, setTemplate] = useState<TemplateId>('modern');
  const versions = useVersions();
  const [which, setWhich] = useState<string>(initialVersion ?? 'base');
  const version = versions.find((v) => v.id === which) ?? null;
  React.useEffect(() => { void readKey<TemplateId>(TEMPLATE_KEY).then((t) => { if (t && TEMPLATES.some((x) => x.id === t)) setTemplate(t); }); }, []);
  const choose = (t: TemplateId) => { setTemplate(t); void writeKey(TEMPLATE_KEY, t); };
  const p = version?.profile ?? store.active;
  const html = useMemo(() => (p ? resumeHtml(p) : ''), [p]);
  // The extension's security policy blocks inline <style>, so the template's styles go in a constructed stylesheet.
  React.useEffect(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(resumeCss(template));
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return () => { document.adoptedStyleSheets = document.adoptedStyleSheets.filter((x) => x !== sheet); };
  }, [template]);

  if (!p) {
    return (
      <div className="section">
        <div><h2>Resume</h2><p className="text-sm">Build a clean, one-column resume from your profile.</p></div>
        <div className="card empty"><p className="empty-title">Fill in your profile first</p><p className="empty-desc">Your resume is built from the details in your profile: contact, experience, education and skills.</p>
          <div className="empty-actions"><button type="button" className="btn" onClick={onOpenProfile}>Open profile</button></div></div>
      </div>
    );
  }

  const name = fileSafe(`${fullName(p) || 'resume'}${version?.job.company ? ` ${version.job.company}` : ''}`);
  const thin = !p.work.length && !p.education.length;

  return (
    <div className="section resume-view">
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div><h2>Resume</h2><p className="text-sm">{version ? `Tailored for ${version.job.title}${version.job.company ? ` at ${version.job.company}` : ''}. Tailor again to change it.` : `From the profile “${p.label}”. Edit the profile to change what it says.`}</p></div>
        <div className="row wrap">
          <button type="button" className="btn btn-outline btn-sm" onClick={onOpenProfile}><FileText size={14} aria-hidden="true" /> Edit profile</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => download(`${name}.doc`, 'application/msword', resumeWordDoc(p, template))}><Download size={14} aria-hidden="true" /> Word</button>
          <button type="button" className="btn btn-sm" onClick={() => window.print()}><Download size={14} aria-hidden="true" /> PDF</button>
        </div>
      </div>
      {versions.length > 0 && (
        <div className="row wrap resume-version">
          <label className="label" htmlFor="rv-which" style={{ margin: 0 }}>Version</label>
          <select id="rv-which" className="select" style={{ maxWidth: 420 }} value={version ? version.id : 'base'} onChange={(e) => setWhich(e.target.value)}>
            <option value="base">From your profile (not tailored)</option>
            {versions.map((v) => <option key={v.id} value={v.id}>Tailored: {v.job.title}{v.job.company ? ` at ${v.job.company}` : ''}</option>)}
          </select>
          {version && <span className="text-sm muted">Coverage {version.before}% → {version.after}% · {new Date(version.created_at).toLocaleDateString()}</span>}
          {version && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { void removeVersion(version.id); setWhich('base'); }}><Trash size={14} aria-hidden="true" /> Delete this version</button>}
        </div>
      )}
      <fieldset className="templates" aria-label="Template">
        {TEMPLATES.map((t) => (
          <label key={t.id} className="option" data-checked={template === t.id}>
            <input type="radio" name="template" className="sr-only" checked={template === t.id} onChange={() => choose(t.id)} />
            <span className="grow"><span className="font-medium" style={{ display: 'block' }}>{t.label}</span><span className="text-xs muted">{t.hint}</span></span>
          </label>
        ))}
      </fieldset>
      {thin && <p className="banner">Add your experience and education in the profile to fill out the resume.</p>}
      <p className="hint">PDF opens Chrome's print window: choose “Save as PDF” as the destination.</p>
      <div className="resume-frame">
        {/* Our own escaped markup (lib/resume.ts) built from the user's profile. */}
        <div className="resume-print" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
};
