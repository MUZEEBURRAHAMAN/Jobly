import type { CoverLetter, Profile, TailoredResume } from '../lib/types';
import { Icon } from './Icon';
import { Area, Field, Text } from './ui';

function move<T>(list: T[], i: number, by: number): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Edit a tailored resume by hand: entries in or out, order, bullet wording, skills. Facts (titles, dates) stay in the profile. */
export function ResumeEditor({ doc, profile, onChange }: { doc: TailoredResume; profile: Profile; onChange: (d: TailoredResume) => void }) {
  const missingExp = profile.experience.filter((e) => !doc.experience.some((d) => d.id === e.id));
  const missingPrj = profile.projects.filter((p) => !doc.projects.some((d) => d.id === p.id));

  const entryList = (kind: 'experience' | 'projects') => {
    const list = doc[kind];
    return list.map((d, i) => {
      const real = kind === 'experience' ? profile.experience.find((e) => e.id === d.id) : profile.projects.find((p) => p.id === d.id);
      if (!real) return null;
      const name = 'title' in real ? `${real.title}, ${real.company}` : real.name;
      const setBullets = (bullets: typeof d.bullets) => onChange({ ...doc, [kind]: list.map((x, k) => (k === i ? { ...x, bullets } : x)) });
      return (
        <div className="entry" key={d.id}>
          <div className="entry-head">
            <b>{name}</b>
            <span className="row" style={{ gap: 2 }}>
              <button className="btn icon ghost" aria-label={`Move ${name} up`} onClick={() => onChange({ ...doc, [kind]: move(list, i, -1) })}>↑</button>
              <button className="btn icon ghost" aria-label={`Move ${name} down`} onClick={() => onChange({ ...doc, [kind]: move(list, i, 1) })}>↓</button>
              <button className="btn icon ghost danger" aria-label={`Leave ${name} out`} onClick={() => onChange({ ...doc, [kind]: list.filter((_, k) => k !== i) })}><Icon name="x" /></button>
            </span>
          </div>
          {d.bullets.map((b, k) => (
            <div className="bullet-row" key={k}>
              <Area rows={2} value={b.text} label={`Bullet ${k + 1} of ${name}`} onChange={(v) => setBullets(d.bullets.map((x, n) => (n === k ? { ...x, text: v } : x)))} />
              <span className="stack" style={{ gap: 2 }}>
                <button className="btn icon ghost" aria-label="Move bullet up" onClick={() => setBullets(move(d.bullets, k, -1))}>↑</button>
                <button className="btn icon ghost danger" aria-label="Remove bullet" onClick={() => setBullets(d.bullets.filter((_, n) => n !== k))}><Icon name="x" /></button>
              </span>
            </div>
          ))}
          <AddBullet
            options={real.bullets.filter((b) => !d.bullets.some((x) => x.sources.includes(b.id)))}
            onAdd={(b) => setBullets([...d.bullets, { text: b.text, sources: [b.id] }])}
          />
        </div>
      );
    });
  };

  return (
    <div className="stack">
      <Field label="Headline"><Text value={doc.headline} onChange={(v) => onChange({ ...doc, headline: v })} /></Field>
      <Field label="Summary"><Area rows={4} value={doc.summary.text} onChange={(v) => onChange({ ...doc, summary: { ...doc.summary, text: v } })} /></Field>
      <div className="stack sm">
        <span className="label">Experience</span>
        {entryList('experience')}
        {missingExp.length > 0 && (
          <select className="select" value="" aria-label="Add a job" onChange={(e) => {
            const e2 = profile.experience.find((x) => x.id === e.target.value);
            if (e2) onChange({ ...doc, experience: [...doc.experience, { id: e2.id, bullets: e2.bullets.map((b) => ({ text: b.text, sources: [b.id] })) }] });
          }}>
            <option value="">+ Add a job from your profile…</option>
            {missingExp.map((e) => <option key={e.id} value={e.id}>{e.title}, {e.company}</option>)}
          </select>
        )}
      </div>
      {(doc.projects.length > 0 || missingPrj.length > 0) && (
        <div className="stack sm">
          <span className="label">Projects</span>
          {entryList('projects')}
          {missingPrj.length > 0 && (
            <select className="select" value="" aria-label="Add a project" onChange={(e) => {
              const p = profile.projects.find((x) => x.id === e.target.value);
              if (p) onChange({ ...doc, projects: [...doc.projects, { id: p.id, bullets: p.bullets.map((b) => ({ text: b.text, sources: [b.id] })) }] });
            }}>
              <option value="">+ Add a project from your profile…</option>
              {missingPrj.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
      )}
      <div className="stack sm">
        <span className="label">Skills (click to include or leave out)</span>
        <div className="row" style={{ gap: 6 }}>
          {profile.skills.map((s) => {
            const on = doc.skills.includes(s.id);
            return (
              <button key={s.id} className={`chip`} aria-pressed={on} style={on ? { background: 'var(--brand-soft)', color: 'var(--brand)', borderColor: 'transparent' } : { opacity: 0.7 }}
                onClick={() => onChange({ ...doc, skills: on ? doc.skills.filter((x) => x !== s.id) : [...doc.skills, s.id] })}>
                {on ? '✓ ' : '+ '}{s.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AddBullet({ options, onAdd }: { options: { id: string; text: string }[]; onAdd: (b: { id: string; text: string }) => void }) {
  if (!options.length) return null;
  return (
    <select className="select" value="" aria-label="Add a bullet from your profile" onChange={(e) => {
      const b = options.find((x) => x.id === e.target.value);
      if (b) onAdd(b);
    }}>
      <option value="">+ Add a bullet from your profile…</option>
      {options.map((b) => <option key={b.id} value={b.id}>{b.text.length > 90 ? `${b.text.slice(0, 88)}…` : b.text}</option>)}
    </select>
  );
}

export function LetterEditor({ doc, onChange }: { doc: CoverLetter; onChange: (d: CoverLetter) => void }) {
  return (
    <div className="stack">
      <div className="grid-2">
        <Field label="To"><Text value={doc.recipient} onChange={(v) => onChange({ ...doc, recipient: v })} /></Field>
        <Field label="Greeting"><Text value={doc.greeting} onChange={(v) => onChange({ ...doc, greeting: v })} /></Field>
      </div>
      {doc.paragraphs.map((p, i) => (
        <div className="bullet-row" key={i}>
          <Area rows={5} value={p.text} label={`Paragraph ${i + 1}`} onChange={(v) => onChange({ ...doc, paragraphs: doc.paragraphs.map((x, k) => (k === i ? { ...x, text: v } : x)) })} />
          <span className="stack" style={{ gap: 2 }}>
            <button className="btn icon ghost" aria-label="Move paragraph up" onClick={() => onChange({ ...doc, paragraphs: move(doc.paragraphs, i, -1) })}>↑</button>
            <button className="btn icon ghost danger" aria-label="Remove paragraph" onClick={() => onChange({ ...doc, paragraphs: doc.paragraphs.filter((_, k) => k !== i) })}><Icon name="x" /></button>
          </span>
        </div>
      ))}
      <div><button className="btn sm" onClick={() => onChange({ ...doc, paragraphs: [...doc.paragraphs, { text: '', sources: [] }] })}><Icon name="plus" />Paragraph</button></div>
      <Field label="Sign-off"><Text value={doc.closing} onChange={(v) => onChange({ ...doc, closing: v })} /></Field>
    </div>
  );
}
