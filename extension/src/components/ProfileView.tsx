import React, { useEffect, useState } from 'react';
import { Copy, File as FileIcon, Plus, Save, Trash } from '../lib/icons';
import { MAX_PROFILES, Profile, PROFILE_KEYS, ResumeFile, saveResumeFile } from '../lib/profile';
import { ProfilesStore } from '../lib/useProfiles';
import { readKey, writeKey } from '../lib/userData';
import { CopyButton } from './CopyButton';
import { EduEditor, WorkEditor } from './ProfileEditors';
import { ProfileSetup } from './ProfileSetup';
import { SavedAnswers } from './SavedAnswers';
import { CompletenessBar } from './CompletenessBar';
import { useCompleteness } from '../lib/useCompleteness';
import { SetupStep } from '../lib/completeness';
import { Download, Upload } from '../lib/icons';
import { toJsonResume } from '../lib/resumeImport';
import { fileSafe } from '../lib/resume';

function downloadJsonResume(p: Profile) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(toJsonResume(p), null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${fileSafe([p.first_name, p.last_name].filter(Boolean).join(' ') || 'resume')}.resume.json` });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type { ResumeFile } from '../lib/profile';

type Field = keyof Pick<Profile, 'first_name' | 'last_name' | 'email' | 'phone' | 'location' | 'headline' | 'linkedin' | 'github' | 'portfolio' | 'website' |
  'work_authorization' | 'years_experience' | 'salary_expectation' | 'notice_period'>;

const CONTACT: [Field, string, string, string?][] = [
  ['first_name', 'First name', 'text'], ['last_name', 'Last name', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'],
  ['location', 'Location', 'text', 'e.g. Austin, TX'], ['headline', 'Headline', 'text', 'e.g. Senior Product Designer'],
];
const LINKS: [Field, string, string, string?][] = [
  ['linkedin', 'LinkedIn', 'url', 'linkedin.com/in/yourname'], ['github', 'GitHub', 'url', 'github.com/yourname'], ['portfolio', 'Portfolio', 'url', 'yourportfolio.com'], ['website', 'Website', 'url', 'yoursite.com'],
];
const WORK_FACTS: [Field, string, string, string?][] = [
  ['years_experience', 'Years of experience', 'text', 'e.g. 6'], ['work_authorization', 'Work authorization', 'text', 'e.g. US citizen, EU work permit'],
  ['salary_expectation', 'Salary expectation', 'text', 'e.g. $150,000'], ['notice_period', 'Notice period', 'text', 'e.g. 2 weeks'],
];

export const ProfileView: React.FC<{ store: ProfilesStore; notify: (m: string, kind?: 'error' | 'info') => void; openSetup?: boolean }> = ({ store, notify, openSetup }) => {
  const [draft, setDraft] = useState<Profile | null>(store.active);
  const [setup, setSetup] = useState<SetupStep | null>(openSetup ? 'import' : null);
  const completeness = useCompleteness(store.active);
  const [dirty, setDirty] = useState(false);
  const [resume, setResume] = useState<ResumeFile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { if (!dirty) setDraft(store.active); }, [store.active, dirty]);
  useEffect(() => {
    if (!store.active) return;
    void readKey<Record<string, ResumeFile>>(PROFILE_KEYS.resume).then((m) => setResume(m?.[store.active!.id] ?? null));
  }, [store.active]);

  if (!store.ready) return <div className="section" aria-busy="true" />;
  if (setup) return <ProfileSetup store={store} notify={notify} startAt={setup} onClose={() => { setSetup(null); setDirty(false); }} />;
  if (!draft) {
    return (
      <div className="section">
        <div><h2>Profile</h2><p className="text-sm">The answers applications ask for, kept on this device.</p></div>
        <div className="card empty"><p className="empty-title">Create your first profile</p>
          <p className="empty-desc">Import your LinkedIn PDF or resume, or fill in a few short steps. Then autofill fills applications for you, and your resume and cover letters start written.</p>
          <div className="empty-actions">
            <button type="button" className="btn" onClick={() => setSetup('import')}><Upload size={14} aria-hidden="true" /> Set up your profile</button>
            <button type="button" className="btn btn-ghost" onClick={() => void store.create().then((r) => r.problem && notify(r.problem))}><Plus size={14} aria-hidden="true" /> Start with an empty profile</button>
          </div>
        </div>
      </div>
    );
  }

  const set = (patch: Partial<Profile>) => { setDirty(true); setDraft((d) => (d ? { ...d, ...patch } : d)); };

  const save = async () => {
    const problem = await store.save(draft);
    if (problem) notify(problem); else { setDirty(false); notify('Profile saved on this device.', 'info'); }
  };

  const pickResume = async (file: File | undefined) => {
    if (!file) return;
    const { problem, entry } = await saveResumeFile(draft.id, file);
    if (problem) notify(problem); else { setResume(entry); notify('Resume file saved. Autofill can attach it.', 'info'); }
  };
  const removeResume = async () => {
    const map = (await readKey<Record<string, ResumeFile>>(PROFILE_KEYS.resume)) ?? {};
    delete map[draft.id]; await writeKey(PROFILE_KEYS.resume, map); setResume(null);
  };

  const input = ([key, label, type, placeholder]: [Field, string, string, string?]) => (
    <div key={key}>
      <label className="label" htmlFor={`pf-${key}`}>{label}</label>
      <div className="row" style={{ gap: 4 }}>
        <input id={`pf-${key}`} className="input" type={type} value={draft[key]} placeholder={placeholder} onChange={(e) => set({ [key]: e.target.value } as Partial<Profile>)} />
        <CopyButton value={draft[key]} label={label} />
      </div>
    </div>
  );

  return (
    <div className="section">
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div><h2>Profile</h2><p className="text-sm">The answers applications ask for, kept on this device. Copy any field with one click.</p></div>
        <div className="row wrap">
          <label className="sr-only" htmlFor="pf-switch">Profile</label>
          <select id="pf-switch" className="select" style={{ width: 200 }} value={draft.id} disabled={dirty} title={dirty ? 'Save or discard changes first' : undefined}
            onChange={(e) => void store.choose(e.target.value)}>
            {store.profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button type="button" className="btn btn-outline btn-sm" disabled={store.profiles.length >= MAX_PROFILES || dirty}
            onClick={() => void store.create(draft.id).then((r) => r.problem && notify(r.problem))}><Copy size={14} aria-hidden="true" /> Duplicate</button>
          <button type="button" className="btn btn-outline btn-sm" disabled={store.profiles.length >= MAX_PROFILES || dirty}
            onClick={() => void store.create().then((r) => r.problem && notify(r.problem))}><Plus size={14} aria-hidden="true" /> New</button>
        </div>
      </div>

      <div className="card profile-progress">
        <CompletenessBar completeness={completeness} action={
          <div className="row" style={{ gap: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm" disabled={dirty} title={dirty ? 'Save or discard changes first' : undefined} onClick={() => setSetup('import')}><Upload size={14} aria-hidden="true" /> Import a file</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadJsonResume(draft)} title="A JSON Resume file other resume tools can read"><Download size={14} aria-hidden="true" /> JSON Resume</button>
            {completeness.missing.length > 0 && <button type="button" className="btn btn-outline btn-sm" disabled={dirty} title={dirty ? 'Save or discard changes first' : undefined}
              onClick={() => setSetup(completeness.missing.find((m) => m.step !== 'done')?.step ?? 'done')}>Continue setup</button>}
          </div>} />
      </div>

      <div className="profile-grid">
      <div className="card profile-card">
        <div className="form-grid">
          <div className="wide"><label className="label" htmlFor="pf-label">Profile name</label>
            <input id="pf-label" className="input" value={draft.label} maxLength={60} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Product design" />
            <p className="hint">Keep one profile per kind of role you apply for.</p></div>
        </div>
      </div>

      <fieldset className="card profile-card"><legend className="label">Contact</legend><div className="form-grid">{CONTACT.map(input)}</div></fieldset>
      <fieldset className="card profile-card"><legend className="label">Links</legend><div className="form-grid">{LINKS.map(input)}</div></fieldset>
      <fieldset className="card profile-card"><legend className="label">Common questions</legend>
        <div className="form-grid">
          {WORK_FACTS.map(input)}
          <div>
            <label className="label" htmlFor="pf-sponsor">Need visa sponsorship?</label>
            <select id="pf-sponsor" className="select" value={draft.needs_sponsorship} onChange={(e) => set({ needs_sponsorship: e.target.value })}>
              <option value="">Not set</option><option value="no">No</option><option value="yes">Yes</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="card profile-card"><legend className="label">Summary and skills</legend>
        <div className="stack">
          <div><div className="row" style={{ justifyContent: 'space-between' }}><label className="label" htmlFor="pf-summary">Summary</label><CopyButton value={draft.summary} label="summary" /></div>
            <textarea id="pf-summary" className="textarea" rows={4} maxLength={3000} value={draft.summary} onChange={(e) => set({ summary: e.target.value })} placeholder="Two or three sentences about what you do and what you're looking for" /></div>
          <div><div className="row" style={{ justifyContent: 'space-between' }}><label className="label" htmlFor="pf-skills">Skills</label><CopyButton value={draft.skills} label="skills" /></div>
            <input id="pf-skills" className="input" maxLength={1500} value={draft.skills} onChange={(e) => set({ skills: e.target.value })} placeholder="e.g. Figma, design systems, React, user research" />
            <p className="hint">Separate with commas. Jobly also uses these for the fit score on job cards.</p></div>
        </div>
      </fieldset>

      <fieldset className="card profile-card"><legend className="label">Resume file</legend>
        {resume
          ? <div className="row"><FileIcon size={16} aria-hidden="true" /><span className="grow text-sm">{resume.name} · {Math.round(resume.size / 1024)} KB</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => void removeResume()}><Trash size={14} aria-hidden="true" /> Remove</button></div>
          : <p className="text-sm">No file yet. Autofill attaches this file to application forms.</p>}
        <label className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start', marginTop: 8 }}>
          <FileIcon size={14} aria-hidden="true" /> {resume ? 'Replace file' : 'Choose a PDF or Word file'}
          <input type="file" accept=".pdf,.doc,.docx,application/pdf" className="sr-only" onChange={(e) => { void pickResume(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <p className="hint">Up to 1 MB. Stays on this device.</p>
      </fieldset>

      <fieldset className="card profile-card span-all"><legend className="label">Experience</legend>
        <WorkEditor work={draft.work} onChange={(work) => set({ work })} />
      </fieldset>

      <fieldset className="card profile-card span-all"><legend className="label">Education</legend>
        <EduEditor education={draft.education} onChange={(education) => set({ education })} />
      </fieldset>

      <SavedAnswers />


      </div>

      <div className="save-bar">
        {confirmDelete
          ? <button type="button" className="btn btn-outline btn-sm danger" onClick={() => void store.remove(draft.id).then((p) => { if (p) notify(p); setConfirmDelete(false); setDirty(false); })}>Confirm delete profile</button>
          : <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(true)}><Trash size={14} aria-hidden="true" /> Delete profile</button>}
        <span className="grow" />
        {dirty && <button type="button" className="btn btn-outline btn-sm" onClick={() => { setDirty(false); setDraft(store.active); }}>Discard changes</button>}
        <button type="button" className="btn btn-sm" onClick={() => void save()} disabled={!dirty}><Save size={14} aria-hidden="true" /> Save profile</button>
      </div>
    </div>
  );
};
