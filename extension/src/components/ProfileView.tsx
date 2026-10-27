import React, { useEffect, useState } from 'react';
import { Copy, File as FileIcon, Plus, Save, Trash } from '../lib/icons';
import { EduItem, MAX_PROFILES, newProfileId, Profile, PROFILE_KEYS, WorkItem } from '../lib/profile';
import { ProfilesStore } from '../lib/useProfiles';
import { readKey, writeKey } from '../lib/userData';
import { CopyButton } from './CopyButton';

/** A resume file kept for autofill, one per profile. */
export interface ResumeFile { name: string; type: string; size: number; data: string }
const MAX_RESUME_BYTES = 1_000_000;

type Field = keyof Pick<Profile, 'first_name' | 'last_name' | 'email' | 'phone' | 'location' | 'headline' | 'linkedin' | 'github' | 'portfolio' | 'website' |
  'work_authorization' | 'years_experience' | 'salary_expectation' | 'notice_period'>;

const CONTACT: [Field, string, string, string?][] = [
  ['first_name', 'First name', 'text'], ['last_name', 'Last name', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'],
  ['location', 'Location', 'text', 'City, country'], ['headline', 'Headline', 'text', 'Senior Product Designer'],
];
const LINKS: [Field, string, string, string?][] = [
  ['linkedin', 'LinkedIn', 'url', 'linkedin.com/in/…'], ['github', 'GitHub', 'url', 'github.com/…'], ['portfolio', 'Portfolio', 'url'], ['website', 'Website', 'url'],
];
const WORK_FACTS: [Field, string, string, string?][] = [
  ['years_experience', 'Years of experience', 'text', '6'], ['work_authorization', 'Work authorization', 'text', 'US citizen, EU work permit…'],
  ['salary_expectation', 'Salary expectation', 'text', '$150,000'], ['notice_period', 'Notice period', 'text', '2 weeks'],
];

export const ProfileView: React.FC<{ store: ProfilesStore; notify: (m: string, kind?: 'error' | 'info') => void }> = ({ store, notify }) => {
  const [draft, setDraft] = useState<Profile | null>(store.active);
  const [dirty, setDirty] = useState(false);
  const [resume, setResume] = useState<ResumeFile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { if (!dirty) setDraft(store.active); }, [store.active, dirty]);
  useEffect(() => {
    if (!store.active) return;
    void readKey<Record<string, ResumeFile>>(PROFILE_KEYS.resume).then((m) => setResume(m?.[store.active!.id] ?? null));
  }, [store.active]);

  if (!store.ready) return <div className="section" aria-busy="true" />;
  if (!draft) {
    return (
      <div className="section">
        <div><h2>Profile</h2><p className="text-sm">The answers applications ask for, kept on this device.</p></div>
        <div className="card empty"><p className="empty-title">Create your first profile</p>
          <p className="empty-desc">Add your contact details, links, experience and skills once. Then copy them into any application, build a resume, and write cover letters faster.</p>
          <div className="empty-actions"><button type="button" className="btn" onClick={() => void store.create().then((r) => r.problem && notify(r.problem))}><Plus size={14} aria-hidden="true" /> Create profile</button></div>
        </div>
      </div>
    );
  }

  const set = (patch: Partial<Profile>) => { setDirty(true); setDraft((d) => (d ? { ...d, ...patch } : d)); };
  const setWork = (id: string, patch: Partial<WorkItem>) => set({ work: draft.work.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
  const setEdu = (id: string, patch: Partial<EduItem>) => set({ education: draft.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  const save = async () => {
    const problem = await store.save(draft);
    if (problem) notify(problem); else { setDirty(false); notify('Profile saved on this device.', 'info'); }
  };

  const pickResume = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_RESUME_BYTES) { notify('Keep the resume file under 1 MB.'); return; }
    if (!/pdf|msword|officedocument/.test(file.type) && !/\.(pdf|docx?)$/i.test(file.name)) { notify('Use a PDF or Word file.'); return; }
    const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
    const entry: ResumeFile = { name: file.name.slice(0, 120), type: file.type || 'application/pdf', size: file.size, data };
    const map = (await readKey<Record<string, ResumeFile>>(PROFILE_KEYS.resume)) ?? {};
    if (await writeKey(PROFILE_KEYS.resume, { ...map, [draft.id]: entry })) { setResume(entry); notify('Resume file saved. Autofill can attach it.', 'info'); }
    else notify("Couldn't store the file. Your browser storage may be full.");
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

      <div className="card profile-card">
        <div className="form-grid">
          <div className="wide"><label className="label" htmlFor="pf-label">Profile name</label>
            <input id="pf-label" className="input" value={draft.label} maxLength={60} onChange={(e) => set({ label: e.target.value })} placeholder="Product design, Frontend…" />
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
            <input id="pf-skills" className="input" maxLength={1500} value={draft.skills} onChange={(e) => set({ skills: e.target.value })} placeholder="Figma, design systems, React, user research" />
            <p className="hint">Separate with commas. Jobly also uses these for the fit score on job cards.</p></div>
        </div>
      </fieldset>

      <fieldset className="card profile-card"><legend className="label">Experience</legend>
        <div className="stack">
          {draft.work.map((w, i) => (
            <div key={w.id} className="sub-card">
              <div className="form-grid">
                <div><label className="label" htmlFor={`w-title-${w.id}`}>Title</label><input id={`w-title-${w.id}`} className="input" value={w.title} onChange={(e) => setWork(w.id, { title: e.target.value })} /></div>
                <div><label className="label" htmlFor={`w-co-${w.id}`}>Company</label><input id={`w-co-${w.id}`} className="input" value={w.company} onChange={(e) => setWork(w.id, { company: e.target.value })} /></div>
                <div><label className="label" htmlFor={`w-start-${w.id}`}>Start</label><input id={`w-start-${w.id}`} type="month" className="input" value={w.start} onChange={(e) => setWork(w.id, { start: e.target.value })} /></div>
                <div><label className="label" htmlFor={`w-end-${w.id}`}>End</label><input id={`w-end-${w.id}`} type="month" className="input" value={w.end} disabled={w.current} onChange={(e) => setWork(w.id, { end: e.target.value })} />
                  <label className="row text-xs" style={{ marginTop: 6 }}><input type="checkbox" checked={w.current} onChange={(e) => setWork(w.id, { current: e.target.checked, end: e.target.checked ? '' : w.end })} /> I work here now</label></div>
                <div className="wide"><label className="label" htmlFor={`w-loc-${w.id}`}>Location</label><input id={`w-loc-${w.id}`} className="input" value={w.location} onChange={(e) => setWork(w.id, { location: e.target.value })} /></div>
                <div className="wide"><div className="row" style={{ justifyContent: 'space-between' }}><label className="label" htmlFor={`w-b-${w.id}`}>What you did (one point per line)</label><CopyButton value={w.bullets} label={`points for ${w.title || 'this role'}`} /></div>
                  <textarea id={`w-b-${w.id}`} className="textarea" rows={4} value={w.bullets} onChange={(e) => setWork(w.id, { bullets: e.target.value })} placeholder={'Led the redesign of checkout, lifting conversion 12%\nBuilt the design system used by 40 engineers'} /></div>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                {i > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { const list = [...draft.work]; [list[i - 1], list[i]] = [list[i], list[i - 1]]; set({ work: list }); }}>Move up</button>}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ work: draft.work.filter((x) => x.id !== w.id) })}><Trash size={14} aria-hidden="true" /> Remove</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} disabled={draft.work.length >= 15}
            onClick={() => set({ work: [...draft.work, { id: newProfileId(), company: '', title: '', location: '', start: '', end: '', current: draft.work.length === 0, bullets: '' }] })}>
            <Plus size={14} aria-hidden="true" /> Add a role</button>
        </div>
      </fieldset>

      <fieldset className="card profile-card"><legend className="label">Education</legend>
        <div className="stack">
          {draft.education.map((e) => (
            <div key={e.id} className="sub-card">
              <div className="form-grid">
                <div className="wide"><label className="label" htmlFor={`e-s-${e.id}`}>School</label><input id={`e-s-${e.id}`} className="input" value={e.school} onChange={(ev) => setEdu(e.id, { school: ev.target.value })} /></div>
                <div><label className="label" htmlFor={`e-d-${e.id}`}>Degree</label><input id={`e-d-${e.id}`} className="input" value={e.degree} onChange={(ev) => setEdu(e.id, { degree: ev.target.value })} placeholder="BSc, MA…" /></div>
                <div><label className="label" htmlFor={`e-f-${e.id}`}>Field of study</label><input id={`e-f-${e.id}`} className="input" value={e.field} onChange={(ev) => setEdu(e.id, { field: ev.target.value })} /></div>
                <div><label className="label" htmlFor={`e-st-${e.id}`}>Start</label><input id={`e-st-${e.id}`} type="month" className="input" value={e.start} onChange={(ev) => setEdu(e.id, { start: ev.target.value })} /></div>
                <div><label className="label" htmlFor={`e-en-${e.id}`}>End</label><input id={`e-en-${e.id}`} type="month" className="input" value={e.end} onChange={(ev) => setEdu(e.id, { end: ev.target.value })} /></div>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}><button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ education: draft.education.filter((x) => x.id !== e.id) })}><Trash size={14} aria-hidden="true" /> Remove</button></div>
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} disabled={draft.education.length >= 8}
            onClick={() => set({ education: [...draft.education, { id: newProfileId(), school: '', degree: '', field: '', start: '', end: '' }] })}><Plus size={14} aria-hidden="true" /> Add education</button>
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
