import { useState } from 'react';
import { Icon } from '../components/Icon';
import { ImportResume } from '../components/ImportResume';
import { Area, Field, Modal, Text } from '../components/ui';
import { profileStrength } from '../lib/facts';
import { uid } from '../lib/ids';
import { update, useStudio } from '../lib/store';
import type { Bullet, Education, Experience, Profile, Project, SectionKey } from '../lib/types';

const setProfile = (fn: (p: Profile) => Profile) => update((s) => ({ ...s, profile: fn(s.profile) }));

function move<T>(list: T[], i: number, by: number): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function Bullets({ bullets, onChange, hint }: { bullets: Bullet[]; onChange: (b: Bullet[]) => void; hint: string }) {
  return (
    <div className="stack sm">
      <span className="label">What you did <span className="muted small" style={{ fontWeight: 400 }}>{hint}</span></span>
      {bullets.map((b, i) => (
        <div className="bullet-row" key={b.id}>
          <Area rows={2} value={b.text} label={`Bullet ${i + 1}`} onChange={(v) => onChange(bullets.map((x) => (x.id === b.id ? { ...x, text: v } : x)))}
            placeholder="e.g. Rebuilt checkout in React, cutting drop-off by 12%" />
          <span className="stack" style={{ gap: 2 }}>
            <button className="btn icon ghost" aria-label="Move bullet up" onClick={() => onChange(move(bullets, i, -1))}>↑</button>
            <button className="btn icon ghost danger" aria-label="Remove bullet" onClick={() => onChange(bullets.filter((x) => x.id !== b.id))}><Icon name="x" /></button>
          </span>
        </div>
      ))}
      <div><button className="btn sm" onClick={() => onChange([...bullets, { id: uid('b'), text: '' }])}><Icon name="plus" />Bullet</button></div>
    </div>
  );
}

function EntryControls({ name, onUp, onDown, onRemove }: { name: string; onUp: () => void; onDown: () => void; onRemove: () => void }) {
  return (
    <span className="row" style={{ gap: 2 }}>
      <button className="btn icon ghost" aria-label={`Move ${name} up`} onClick={onUp}>↑</button>
      <button className="btn icon ghost" aria-label={`Move ${name} down`} onClick={onDown}>↓</button>
      <button className="btn icon ghost danger" aria-label={`Remove ${name}`} onClick={onRemove}><Icon name="trash" /></button>
    </span>
  );
}

const SECTION_LABEL: Record<SectionKey, string> = { summary: 'Summary', experience: 'Experience', projects: 'Projects', education: 'Education', skills: 'Skills', languages: 'Languages' };

export function ProfilePage() {
  const p = useStudio((s) => s.profile);
  const [importing, setImporting] = useState(false);
  const [skill, setSkill] = useState('');
  const [group, setGroup] = useState('');
  const strength = profileStrength(p);
  const b = p.basics;
  const setBasics = (k: keyof typeof b, v: string) => setProfile((x) => ({ ...x, basics: { ...x.basics, [k]: v } }));

  const setExp = (id: string, patch: Partial<Experience>) => setProfile((x) => ({ ...x, experience: x.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const setPrj = (id: string, patch: Partial<Project>) => setProfile((x) => ({ ...x, projects: x.projects.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const setEdu = (id: string, patch: Partial<Education>) => setProfile((x) => ({ ...x, education: x.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const groups = [...new Set(p.skills.map((s) => s.group).filter(Boolean))];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div><h1>Profile</h1><p>Every resume and letter is written from this, and only this. Saved as you type.</p></div>
        <button className="btn" onClick={() => setImporting(true)}><Icon name="upload" />Import a resume</button>
      </div>

      <div className="card tight row between">
        <div className="stack sm" style={{ flex: 1, minWidth: 220 }}>
          <b>{strength.score}% ready for tailoring</b>
          <div className="meter" aria-hidden="true"><i style={{ width: `${strength.score}%` }} /></div>
          <span className="muted small">{strength.next ? `Next: ${strength.next}` : 'Everything a strong draft needs is here.'}</span>
        </div>
        <span className="small muted" style={{ maxWidth: 360 }}>Tip: write every result you can prove, with numbers. A draft can only use what’s here, and nothing else.</span>
      </div>

      <div className="grid-2">
        <div className="card stack">
          <h2>About you</h2>
          <div className="grid-2">
            <Field label="Full name"><Text value={b.name} onChange={(v) => setBasics('name', v)} placeholder="e.g. Sam Rivera" /></Field>
            <Field label="Headline"><Text value={b.headline} onChange={(v) => setBasics('headline', v)} placeholder="e.g. Frontend engineer" /></Field>
            <Field label="Email"><Text type="email" value={b.email} onChange={(v) => setBasics('email', v)} /></Field>
            <Field label="Phone"><Text type="tel" value={b.phone} onChange={(v) => setBasics('phone', v)} /></Field>
            <Field label="Location"><Text value={b.location} onChange={(v) => setBasics('location', v)} placeholder="e.g. Austin, TX" /></Field>
          </div>
          <Field label="Summary" hint="Two or three sentences: what you do, for how long, what you’re best at.">
            <Area rows={4} value={b.summary} onChange={(v) => setBasics('summary', v)} />
          </Field>
          <div className="stack sm">
            <span className="label">Links</span>
            {b.links.map((l) => (
              <div className="row" key={l.id} style={{ flexWrap: 'nowrap' }}>
                <input className="input" style={{ maxWidth: 160 }} value={l.label} placeholder="Label" aria-label="Link label"
                  onChange={(e) => setProfile((x) => ({ ...x, basics: { ...x.basics, links: x.basics.links.map((y) => (y.id === l.id ? { ...y, label: e.target.value } : y)) } }))} />
                <input className="input" value={l.url} placeholder="https://…" aria-label="Link address" type="url"
                  onChange={(e) => setProfile((x) => ({ ...x, basics: { ...x.basics, links: x.basics.links.map((y) => (y.id === l.id ? { ...y, url: e.target.value } : y)) } }))} />
                <button className="btn icon ghost danger" aria-label="Remove link" onClick={() => setProfile((x) => ({ ...x, basics: { ...x.basics, links: x.basics.links.filter((y) => y.id !== l.id) } }))}><Icon name="x" /></button>
              </div>
            ))}
            <div><button className="btn sm" onClick={() => setProfile((x) => ({ ...x, basics: { ...x.basics, links: [...x.basics.links, { id: uid('ln'), label: '', url: '' }] } }))}><Icon name="plus" />Link</button></div>
          </div>
        </div>

        <div className="stack">
          <div className="card stack">
            <h2>Skills</h2>
            <div className="row" style={{ gap: 6 }}>
              {p.skills.length === 0 && <span className="muted small">No skills yet.</span>}
              {p.skills.map((s) => (
                <span className="chip" key={s.id} title={s.group || undefined}>
                  {s.name}{s.group && <span className="muted">· {s.group}</span>}
                  <button aria-label={`Remove ${s.name}`} onClick={() => setProfile((x) => ({ ...x, skills: x.skills.filter((y) => y.id !== s.id) }))}>×</button>
                </span>
              ))}
            </div>
            <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => {
              e.preventDefault();
              const names = skill.split(',').map((x) => x.trim()).filter(Boolean);
              if (!names.length) return;
              setProfile((x) => ({ ...x, skills: [...x.skills, ...names.filter((n) => !x.skills.some((s) => s.name.toLowerCase() === n.toLowerCase())).map((name) => ({ id: uid('sk'), name, group: group.trim() }))] }));
              setSkill('');
            }}>
              <input className="input" value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="Add skills, separated by commas" aria-label="New skill" />
              <input className="input" style={{ maxWidth: 140 }} value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Group (optional)" aria-label="Skill group" list="skill-groups" />
              <datalist id="skill-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
              <button className="btn">Add</button>
            </form>
          </div>

          <div className="card stack">
            <h2>Languages</h2>
            {p.languages.map((l) => (
              <div className="row" key={l.id} style={{ flexWrap: 'nowrap' }}>
                <input className="input" value={l.name} placeholder="Language" aria-label="Language" onChange={(e) => setProfile((x) => ({ ...x, languages: x.languages.map((y) => (y.id === l.id ? { ...y, name: e.target.value } : y)) }))} />
                <input className="input" value={l.level} placeholder="Level, e.g. Fluent" aria-label="Level" onChange={(e) => setProfile((x) => ({ ...x, languages: x.languages.map((y) => (y.id === l.id ? { ...y, level: e.target.value } : y)) }))} />
                <button className="btn icon ghost danger" aria-label={`Remove ${l.name}`} onClick={() => setProfile((x) => ({ ...x, languages: x.languages.filter((y) => y.id !== l.id) }))}><Icon name="x" /></button>
              </div>
            ))}
            <div><button className="btn sm" onClick={() => setProfile((x) => ({ ...x, languages: [...x.languages, { id: uid('lang'), name: '', level: '' }] }))}><Icon name="plus" />Language</button></div>
          </div>

          <div className="card stack sm">
            <h2>Section order on resumes</h2>
            {p.order.map((k, i) => (
              <div className="row between" key={k}>
                <span>{i + 1}. {SECTION_LABEL[k]}</span>
                <span className="row" style={{ gap: 2 }}>
                  <button className="btn icon ghost" aria-label={`Move ${SECTION_LABEL[k]} up`} onClick={() => setProfile((x) => ({ ...x, order: move(x.order, i, -1) }))}>↑</button>
                  <button className="btn icon ghost" aria-label={`Move ${SECTION_LABEL[k]} down`} onClick={() => setProfile((x) => ({ ...x, order: move(x.order, i, 1) }))}>↓</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card stack">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <h2>Experience</h2>
          <button className="btn sm" onClick={() => setProfile((x) => ({ ...x, experience: [{ id: uid('exp'), title: '', company: '', location: '', start: '', end: '', bullets: [{ id: uid('b'), text: '' }] }, ...x.experience] }))}><Icon name="plus" />Job</button>
        </div>
        {p.experience.length === 0 && <p className="muted">Add your jobs, most recent first.</p>}
        {p.experience.map((e, i) => (
          <div className="entry" key={e.id}>
            <div className="entry-head">
              <b>{e.title || e.company ? `${e.title || 'Job'}${e.company ? `, ${e.company}` : ''}` : 'New job'}</b>
              <EntryControls name={e.title || 'job'}
                onUp={() => setProfile((x) => ({ ...x, experience: move(x.experience, i, -1) }))}
                onDown={() => setProfile((x) => ({ ...x, experience: move(x.experience, i, 1) }))}
                onRemove={() => setProfile((x) => ({ ...x, experience: x.experience.filter((y) => y.id !== e.id) }))} />
            </div>
            <div className="grid-3">
              <Field label="Title"><Text value={e.title} onChange={(v) => setExp(e.id, { title: v })} /></Field>
              <Field label="Company"><Text value={e.company} onChange={(v) => setExp(e.id, { company: v })} /></Field>
              <Field label="Location"><Text value={e.location} onChange={(v) => setExp(e.id, { location: v })} /></Field>
              <Field label="Start"><Text value={e.start} onChange={(v) => setExp(e.id, { start: v })} placeholder="e.g. Mar 2022" /></Field>
              <Field label="End" hint="Empty means Present."><Text value={e.end} onChange={(v) => setExp(e.id, { end: v })} placeholder="Present" /></Field>
            </div>
            <Bullets bullets={e.bullets} onChange={(bl) => setExp(e.id, { bullets: bl })} hint="One result per line. Drafts pick from these and reword them; they never add new ones." />
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card stack">
          <div className="card-head" style={{ marginBottom: 0 }}>
            <h2>Projects</h2>
            <button className="btn sm" onClick={() => setProfile((x) => ({ ...x, projects: [...x.projects, { id: uid('prj'), name: '', role: '', url: '', start: '', end: '', bullets: [] }] }))}><Icon name="plus" />Project</button>
          </div>
          {p.projects.length === 0 && <p className="muted small">Side, open-source or course projects show what you can do where job titles don’t.</p>}
          {p.projects.map((pr, i) => (
            <div className="entry" key={pr.id}>
              <div className="entry-head">
                <b>{pr.name || 'New project'}</b>
                <EntryControls name={pr.name || 'project'}
                  onUp={() => setProfile((x) => ({ ...x, projects: move(x.projects, i, -1) }))}
                  onDown={() => setProfile((x) => ({ ...x, projects: move(x.projects, i, 1) }))}
                  onRemove={() => setProfile((x) => ({ ...x, projects: x.projects.filter((y) => y.id !== pr.id) }))} />
              </div>
              <div className="grid-2">
                <Field label="Name"><Text value={pr.name} onChange={(v) => setPrj(pr.id, { name: v })} /></Field>
                <Field label="Your role"><Text value={pr.role} onChange={(v) => setPrj(pr.id, { role: v })} /></Field>
                <Field label="Link"><Text value={pr.url} onChange={(v) => setPrj(pr.id, { url: v })} type="url" /></Field>
                <Field label="When"><Text value={pr.start} onChange={(v) => setPrj(pr.id, { start: v })} placeholder="e.g. 2023" /></Field>
              </div>
              <Bullets bullets={pr.bullets} onChange={(bl) => setPrj(pr.id, { bullets: bl })} hint="What it does, what you built, who uses it." />
            </div>
          ))}
        </div>

        <div className="card stack">
          <div className="card-head" style={{ marginBottom: 0 }}>
            <h2>Education</h2>
            <button className="btn sm" onClick={() => setProfile((x) => ({ ...x, education: [...x.education, { id: uid('edu'), school: '', degree: '', start: '', end: '', details: '' }] }))}><Icon name="plus" />Education</button>
          </div>
          {p.education.map((ed, i) => (
            <div className="entry" key={ed.id}>
              <div className="entry-head">
                <b>{ed.degree || ed.school || 'New entry'}</b>
                <EntryControls name={ed.school || 'education'}
                  onUp={() => setProfile((x) => ({ ...x, education: move(x.education, i, -1) }))}
                  onDown={() => setProfile((x) => ({ ...x, education: move(x.education, i, 1) }))}
                  onRemove={() => setProfile((x) => ({ ...x, education: x.education.filter((y) => y.id !== ed.id) }))} />
              </div>
              <div className="grid-2">
                <Field label="School"><Text value={ed.school} onChange={(v) => setEdu(ed.id, { school: v })} /></Field>
                <Field label="Degree"><Text value={ed.degree} onChange={(v) => setEdu(ed.id, { degree: v })} placeholder="e.g. BS Computer Science" /></Field>
                <Field label="Start"><Text value={ed.start} onChange={(v) => setEdu(ed.id, { start: v })} /></Field>
                <Field label="End"><Text value={ed.end} onChange={(v) => setEdu(ed.id, { end: v })} /></Field>
              </div>
              <Field label="Details (optional)"><Text value={ed.details} onChange={(v) => setEdu(ed.id, { details: v })} placeholder="e.g. Thesis, honours, GPA" /></Field>
            </div>
          ))}
        </div>
      </div>

      <Modal open={importing} onClose={() => setImporting(false)} title="Import a resume"
        footer={<button className="btn ghost" onClick={() => setImporting(false)}>Close</button>}>
        <p className="muted">Adds what your resume says to this profile: new jobs, projects, education and skills, and any empty basics. Nothing here is overwritten.</p>
        <ImportResume onDone={() => setImporting(false)} />
      </Modal>
    </div>
  );
}
