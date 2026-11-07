import React from 'react';
import { Plus, Trash } from '../lib/icons';
import { EduItem, newProfileId, WorkItem } from '../lib/profile';
import { CopyButton } from './CopyButton';

/** The experience list, shared by the Profile page and profile setup. */
export const WorkEditor: React.FC<{ work: WorkItem[]; onChange: (work: WorkItem[]) => void }> = ({ work, onChange }) => {
  const setWork = (id: string, patch: Partial<WorkItem>) => onChange(work.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  return (
        <div className="stack">
          {work.map((w, i) => (
            <div key={w.id} className="sub-card">
              <div className="form-grid">
                <div><label className="label" htmlFor={`w-title-${w.id}`}>Title</label><input id={`w-title-${w.id}`} className="input" value={w.title} onChange={(e) => setWork(w.id, { title: e.target.value })} /></div>
                <div><label className="label" htmlFor={`w-co-${w.id}`}>Company</label><input id={`w-co-${w.id}`} className="input" value={w.company} onChange={(e) => setWork(w.id, { company: e.target.value })} /></div>
                <div><label className="label" htmlFor={`w-start-${w.id}`}>Start</label><input id={`w-start-${w.id}`} type="month" className="input" value={w.start} onChange={(e) => setWork(w.id, { start: e.target.value })} /></div>
                <div><label className="label" htmlFor={`w-end-${w.id}`}>End</label>{w.current ? <input id={`w-end-${w.id}`} className="input" value="Present" disabled /> : <input id={`w-end-${w.id}`} type="month" className="input" value={w.end} onChange={(e) => setWork(w.id, { end: e.target.value })} />}
                  <label className="row text-xs" style={{ marginTop: 6 }}><input type="checkbox" checked={w.current} onChange={(e) => setWork(w.id, { current: e.target.checked, end: e.target.checked ? '' : w.end })} /> I work here now</label></div>
                <div className="wide"><label className="label" htmlFor={`w-loc-${w.id}`}>Location</label><input id={`w-loc-${w.id}`} className="input" value={w.location} onChange={(e) => setWork(w.id, { location: e.target.value })} /></div>
                <div className="wide"><div className="row" style={{ justifyContent: 'space-between' }}><label className="label" htmlFor={`w-b-${w.id}`}>What you did (one point per line)</label><CopyButton value={w.bullets} label={`points for ${w.title || 'this role'}`} /></div>
                  <textarea id={`w-b-${w.id}`} className="textarea" rows={4} value={w.bullets} onChange={(e) => setWork(w.id, { bullets: e.target.value })} placeholder={'Led the redesign of checkout, lifting conversion 12%\nBuilt the design system used by 40 engineers'} /></div>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                {i > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { const list = [...work]; [list[i - 1], list[i]] = [list[i], list[i - 1]]; onChange(list); }}>Move up</button>}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(work.filter((x) => x.id !== w.id))}><Trash size={14} aria-hidden="true" /> Remove</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} disabled={work.length >= 15}
            onClick={() => onChange([...work, { id: newProfileId(), company: '', title: '', location: '', start: '', end: '', current: work.length === 0, bullets: '' }])}>
            <Plus size={14} aria-hidden="true" /> Add a role</button>
        </div>
  );
};

/** The education list, shared by the Profile page and profile setup. */
export const EduEditor: React.FC<{ education: EduItem[]; onChange: (education: EduItem[]) => void }> = ({ education, onChange }) => {
  const setEdu = (id: string, patch: Partial<EduItem>) => onChange(education.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  return (
        <div className="stack">
          {education.map((e) => (
            <div key={e.id} className="sub-card">
              <div className="form-grid">
                <div className="wide"><label className="label" htmlFor={`e-s-${e.id}`}>School</label><input id={`e-s-${e.id}`} className="input" value={e.school} onChange={(ev) => setEdu(e.id, { school: ev.target.value })} /></div>
                <div><label className="label" htmlFor={`e-d-${e.id}`}>Degree</label><input id={`e-d-${e.id}`} className="input" value={e.degree} onChange={(ev) => setEdu(e.id, { degree: ev.target.value })} placeholder="e.g. BSc" /></div>
                <div><label className="label" htmlFor={`e-f-${e.id}`}>Field of study</label><input id={`e-f-${e.id}`} className="input" value={e.field} onChange={(ev) => setEdu(e.id, { field: ev.target.value })} /></div>
                <div><label className="label" htmlFor={`e-st-${e.id}`}>Start</label><input id={`e-st-${e.id}`} type="month" className="input" value={e.start} onChange={(ev) => setEdu(e.id, { start: ev.target.value })} /></div>
                <div><label className="label" htmlFor={`e-en-${e.id}`}>End</label><input id={`e-en-${e.id}`} type="month" className="input" value={e.end} onChange={(ev) => setEdu(e.id, { end: ev.target.value })} /></div>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}><button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(education.filter((x) => x.id !== e.id))}><Trash size={14} aria-hidden="true" /> Remove</button></div>
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} disabled={education.length >= 8}
            onClick={() => onChange([...education, { id: newProfileId(), school: '', degree: '', field: '', start: '', end: '' }])}><Plus size={14} aria-hidden="true" /> Add education</button>
        </div>
  );
};
