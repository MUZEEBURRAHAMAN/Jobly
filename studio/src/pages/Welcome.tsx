import { useState } from 'react';
import { Icon } from '../components/Icon';
import { ImportResume } from '../components/ImportResume';
import { demoData } from '../lib/demo';
import { go } from '../lib/router';
import { replaceAll, update } from '../lib/store';

const FEATURES = [
  { icon: 'shield', title: 'Never invents experience', text: 'Every line a draft writes points at a fact in your profile, and Studio checks those pointers before showing it. Gaps stay gaps.' },
  { icon: 'lock', title: 'Private by design', text: 'No account, no server. Your profile and applications stay in this browser; export them as one file whenever you like.' },
  { icon: 'sparkle', title: 'Use the AI you have', text: 'Your own Claude or OpenAI key, a local model with Ollama or LM Studio, or no key at all: copy each step into Claude on your own plan.' },
];

export function Welcome() {
  const [mode, setMode] = useState<'pick' | 'import'>('pick');
  const finish = (page: 'profile' | 'dashboard') => {
    update((s) => ({ ...s, settings: { ...s.settings, onboarded: true } }));
    go({ page });
  };

  return (
    <main className="main welcome">
      <div className="stack" style={{ gap: 28 }}>
        <div className="row" style={{ gap: 12 }}>
          <img src="/icon-128.png" alt="" width={44} height={44} style={{ borderRadius: 10 }} />
          <div>
            <h1>Jobly Studio</h1>
            <p className="muted">A tailored resume and cover letter for every job, from one profile. Every application tracked from draft to offer.</p>
          </div>
        </div>

        <div className="grid-3">
          {FEATURES.map((f) => (
            <div className="card tight feature" key={f.title}>
              <Icon name={f.icon} />
              <div className="stack sm"><h3>{f.title}</h3><p className="muted small">{f.text}</p></div>
            </div>
          ))}
        </div>

        {mode === 'pick' ? (
          <div className="card stack">
            <h2>How do you want to start?</h2>
            <div className="grid-3">
              <button className="btn primary" style={{ height: 44 }} onClick={() => setMode('import')}><Icon name="upload" />From my resume</button>
              <button className="btn" style={{ height: 44 }} onClick={() => finish('profile')}><Icon name="user" />Start from scratch</button>
              <button className="btn" style={{ height: 44 }} onClick={() => { replaceAll(demoData()); go({ page: 'dashboard' }); }}><Icon name="sparkle" />Explore with demo data</button>
            </div>
            <p className="small muted">Demo data shows a made-up person, Sam Rivera. Settings → Delete everything clears it.</p>
          </div>
        ) : (
          <div className="card stack">
            <div className="row between"><h2>Start from your resume</h2><button className="btn ghost sm" onClick={() => setMode('pick')}>Back</button></div>
            <ImportResume onDone={() => finish('profile')} />
          </div>
        )}
      </div>
    </main>
  );
}
