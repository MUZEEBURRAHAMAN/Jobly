import type { CSSProperties } from 'react';
import { Icon } from '../components/Icon';
import { Field, copyText } from '../components/ui';
import { resumeText } from '../lib/plain-text';
import { update, useStudio } from '../lib/store';
import type { ResumeStyle, ThemeId } from '../lib/types';
import { baseResume } from '../lib/workflows';
import { ResumeView } from '../resume/ResumeView';
import { fileName, printDocument } from '../resume/print';

const THEMES: { id: ThemeId; label: string; hint: string }[] = [
  { id: 'modern', label: 'Modern', hint: 'Accent bar and headings' },
  { id: 'classic', label: 'Classic', hint: 'Centred, black and white' },
  { id: 'compact', label: 'Compact', hint: 'Fits a long career on a page' },
  { id: 'serif', label: 'Serif', hint: 'Traditional: law, finance, research' },
];
// Accents dark enough for 4.5:1 contrast on white paper.
const ACCENTS = ['#b83a0a', '#1d4ed8', '#047857', '#7c3aed', '#be123c', '#334155'];

export function ResumePage() {
  const profile = useStudio((s) => s.profile);
  const style = useStudio((s) => s.settings.resumeStyle);
  const set = (patch: Partial<ResumeStyle>) => update((s) => ({ ...s, settings: { ...s.settings, resumeStyle: { ...s.settings.resumeStyle, ...patch } } }));
  const doc = baseResume(profile);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div><h1>Base resume</h1><p>Your whole profile on a page. The look you pick here is used for every tailored resume and letter.</p></div>
        <div className="row">
          <button className="btn" onClick={() => copyText(resumeText(profile, doc), 'Text copied')}><Icon name="copy" />Copy as text</button>
          <button className="btn primary" onClick={() => printDocument(<ResumeView profile={profile} doc={doc} style={style} />, fileName(profile.basics.name, 'Resume'), style.paper)}><Icon name="download" />Download PDF</button>
        </div>
      </div>
      <div className="split" style={{ gridTemplateColumns: 'minmax(260px, 340px) 1fr' }}>
        <div className="card stack">
          <div className="stack sm">
            <span className="label">Theme</span>
            {THEMES.map((t) => (
              <label key={t.id} className="entry check" style={{ padding: 10, borderColor: style.theme === t.id ? 'var(--brand)' : undefined }}>
                <input type="radio" name="theme" checked={style.theme === t.id} onChange={() => set({ theme: t.id })} />
                <span><b>{t.label}</b><br /><span className="small muted">{t.hint}</span></span>
              </label>
            ))}
          </div>
          <div className="stack sm">
            <span className="label">Accent colour</span>
            <div className="row">
              {ACCENTS.map((c) => (
                <button key={c} aria-label={`Accent ${c}`} aria-pressed={style.accent === c} onClick={() => set({ accent: c })}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: style.accent === c ? '3px solid var(--foreground)' : '2px solid var(--border)', cursor: 'pointer' }} />
              ))}
            </div>
            {style.theme === 'classic' && <span className="small muted">Classic is always black and white.</span>}
          </div>
          <Field label="Paper size">
            <select className="select" value={style.paper} onChange={(e) => set({ paper: e.target.value as ResumeStyle['paper'] })}>
              <option value="a4">A4 (most of the world)</option>
              <option value="letter">US Letter</option>
            </select>
          </Field>
          <p className="small muted">“Download PDF” opens your browser’s print dialog: choose “Save as PDF”. The text stays selectable, so applicant tracking systems can read it.</p>
        </div>
        <div className="preview-frame">
          <div style={{ zoom: 0.8 } as CSSProperties}><ResumeView profile={profile} doc={doc} style={style} /></div>
        </div>
      </div>
    </div>
  );
}
