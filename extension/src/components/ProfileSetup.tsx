import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText, Upload, X } from '../lib/icons';
import { cleanProfile, emptyProfile, Profile, saveResumeFile } from '../lib/profile';
import { ProfilesStore } from '../lib/useProfiles';
import { importPdf, ImportResult, mergeImport } from '../lib/resumeImport';
import { SetupStep } from '../lib/completeness';
import { useCompleteness } from '../lib/useCompleteness';
import { EduEditor, WorkEditor } from './ProfileEditors';
import { CompletenessBar } from './CompletenessBar';

const STEPS: { id: SetupStep; label: string }[] = [
  { id: 'import', label: 'Import' }, { id: 'contact', label: 'Contact' }, { id: 'professional', label: 'Professional' },
  { id: 'experience', label: 'Experience' }, { id: 'education', label: 'Education' }, { id: 'done', label: 'Review' },
];

type Text = keyof Pick<Profile, 'first_name' | 'last_name' | 'email' | 'phone' | 'location' | 'linkedin' | 'portfolio' | 'github' | 'website' |
  'headline' | 'years_experience' | 'work_authorization' | 'notice_period' | 'salary_expectation'>;
const CONTACT: [Text, string, string, string][] = [
  ['first_name', 'First name', 'text', ''], ['last_name', 'Last name', 'text', ''], ['email', 'Email', 'email', 'you@example.com'], ['phone', 'Phone', 'tel', '+91 98765 43210'],
  ['location', 'City and country', 'text', 'e.g. Bengaluru, India'], ['linkedin', 'LinkedIn', 'url', 'linkedin.com/in/yourname'],
  ['portfolio', 'Portfolio', 'url', 'behance.net/you or yoursite.com'], ['github', 'GitHub', 'url', 'github.com/yourname'],
];
const PROFESSIONAL: [Text, string, string, string][] = [
  ['headline', 'Headline', 'text', 'e.g. Senior Product Designer'], ['years_experience', 'Years of experience', 'text', 'e.g. 6'],
  ['work_authorization', 'Work authorization', 'text', 'e.g. Indian citizen; US H-1B'], ['notice_period', 'Notice period', 'text', 'e.g. 30 days'],
  ['salary_expectation', 'Salary expectation', 'text', 'e.g. ₹30,00,000 or $140,000'],
];

/**
 * Profile setup: import a LinkedIn or resume PDF, then check contact, professional details, experience and education
 * one step at a time. Each step is saved when you move on, so closing halfway loses nothing.
 */
export const ProfileSetup: React.FC<{ store: ProfilesStore; notify: (m: string, kind?: 'error' | 'info') => void; startAt?: SetupStep; onClose: () => void }> = ({ store, notify, startAt = 'import', onClose }) => {
  const [draft, setDraft] = useState<Profile>(() => store.active ?? emptyProfile('My profile'));
  const [step, setStep] = useState<SetupStep>(startAt);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<(ImportResult & { file: File }) | null>(null);
  const [replace, setReplace] = useState({ work: false, education: false });
  const [keepFile, setKeepFile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const completeness = useCompleteness(draft);
  const index = STEPS.findIndex((s) => s.id === step);
  const set = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }));

  const persist = async (p: Profile) => {
    const isNew = !store.profiles.some((x) => x.id === p.id);
    const problem = await store.save(p);
    if (problem) { notify(problem); return false; }
    if (isNew) await store.choose(p.id);
    return true;
  };

  const go = async (to: SetupStep) => {
    let next = draft;
    if (step === 'import' && result && to !== 'import') {
      next = cleanProfile({ ...mergeImport(draft, result.profile, replace), id: draft.id, label: draft.label });
      if (keepFile) {
        const { problem } = await saveResumeFile(next.id, result.file);
        if (problem) notify(problem);
      }
      setResult(null);
    }
    if (step !== 'import' || next !== draft) { if (!(await persist(next))) return; }
    setDraft(next); setStep(to); setError(null);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const attachResume = async (file: File) => {
    if (!(await persist(draft))) return;
    const { problem } = await saveResumeFile(draft.id, file);
    notify(problem ?? 'Resume file saved. Autofill can attach it.', problem ? 'error' : 'info');
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true); setError(null);
    try {
      const r = await importPdf(file);
      if (!r.found.length) { setError("Jobly couldn't find profile details in that PDF. Fill in the steps by hand."); return; }
      setResult({ ...r, file });
      // Saved roles and schools are kept unless you tick Replace
      setReplace({ work: false, education: false });
      setKeepFile(r.source === 'resume');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that PDF.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const field = ([key, label, type, placeholder]: [Text, string, string, string]) => (
    <div key={key}>
      <label className="label" htmlFor={`ps-${key}`}>{label}</label>
      <input id={`ps-${key}`} className="input" type={type} value={draft[key]} placeholder={placeholder}
        autoComplete={key === 'email' ? 'email' : key === 'phone' ? 'tel' : key === 'first_name' ? 'given-name' : key === 'last_name' ? 'family-name' : 'off'}
        onChange={(e) => set({ [key]: e.target.value } as Partial<Profile>)} />
    </div>
  );

  return (
    <div className="section setup">
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div><h2>Set up your profile</h2><p className="text-sm">Applications ask for these details. Jobly keeps them on this device and fills them in for you.</p></div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} aria-hidden="true" /> Close</button>
      </div>

      <ol className="setup-steps" aria-label="Setup steps">
        {STEPS.map((s, i) => (
          <li key={s.id} aria-current={s.id === step ? 'step' : undefined} className={i < index ? 'done' : ''}>
            <button type="button" onClick={() => void go(s.id)} disabled={reading}>
              <span className="setup-dot" aria-hidden="true">{i < index ? <Check size={12} /> : i + 1}</span>{s.label}
            </button>
          </li>
        ))}
      </ol>
      <CompletenessBar completeness={completeness} compact />

      <div className="card setup-card">
        <h3 ref={headingRef} tabIndex={-1} className="setup-title">{STEPS[index].label === 'Review' ? 'Review' : `Step ${index + 1} of ${STEPS.length}: ${STEPS[index].label}`}</h3>

        {step === 'import' && (
          <div className="stack">
            <p className="text-sm">The fastest way: import the PDF LinkedIn makes of your profile, or your resume. Jobly reads it here in your browser; the file isn't uploaded anywhere.</p>
            <div className="setup-choices">
              <div className="sub-card stack">
                <p className="font-medium">From LinkedIn</p>
                <ol className="text-sm setup-howto">
                  <li>Open your profile on LinkedIn.</li>
                  <li>Click <strong>Resources</strong> (or <strong>More</strong>), then <strong>Save to PDF</strong>.</li>
                  <li>Choose the downloaded file below.</li>
                </ol>
              </div>
              <div className="sub-card stack">
                <p className="font-medium">From your resume</p>
                <p className="text-sm">A PDF resume works too. Jobly looks for your contact details, experience, education and skills.</p>
              </div>
            </div>
            <div className="row wrap">
              <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={reading} aria-busy={reading}>
                <Upload size={14} aria-hidden="true" /> {reading ? 'Reading…' : 'Choose a PDF'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => void go('contact')}>Fill in by hand</button>
              <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="sr-only" aria-label="Choose a LinkedIn or resume PDF" onChange={(e) => void onFile(e.target.files?.[0])} />
            </div>
            {error && <p role="alert" className="text-sm" style={{ color: 'var(--warning)' }}>{error}</p>}
            {result && (
              <div className="sub-card stack" role="status">
                <p className="font-medium row"><FileText size={16} aria-hidden="true" /> {result.source === 'linkedin' ? 'LinkedIn profile' : 'Resume'} read: {result.file.name}</p>
                <p className="text-sm">Found {result.found.join(', ')}. You can check and change everything in the next steps.</p>
                {!!result.profile.work?.length && draft.work.length > 0 && (
                  <label className="row text-sm"><input type="checkbox" checked={replace.work} onChange={(e) => setReplace((r) => ({ ...r, work: e.target.checked }))} />
                    Replace your {draft.work.length} saved role{draft.work.length === 1 ? '' : 's'} with the {result.profile.work.length} from the PDF</label>
                )}
                {!!result.profile.education?.length && draft.education.length > 0 && (
                  <label className="row text-sm"><input type="checkbox" checked={replace.education} onChange={(e) => setReplace((r) => ({ ...r, education: e.target.checked }))} />
                    Replace your saved education with the PDF's</label>
                )}
                <label className="row text-sm"><input type="checkbox" checked={keepFile} onChange={(e) => setKeepFile(e.target.checked)} disabled={result.file.size > 1_000_000} />
                  Attach this PDF as my resume when autofill fills applications</label>
                <p className="hint">Details already in your profile are kept; the PDF only fills what's empty.</p>
              </div>
            )}
          </div>
        )}

        {step === 'contact' && (
          <div className="form-grid">{CONTACT.map(field)}</div>
        )}

        {step === 'professional' && (
          <div className="stack">
            <div className="form-grid">
              {PROFESSIONAL.map(field)}
              <div>
                <label className="label" htmlFor="ps-sponsor">Need visa sponsorship?</label>
                <select id="ps-sponsor" className="select" value={draft.needs_sponsorship} onChange={(e) => set({ needs_sponsorship: e.target.value })}>
                  <option value="">Not set</option><option value="no">No</option><option value="yes">Yes</option>
                </select>
              </div>
            </div>
            <div><label className="label" htmlFor="ps-skills">Skills</label>
              <input id="ps-skills" className="input" value={draft.skills} maxLength={1500} onChange={(e) => set({ skills: e.target.value })} placeholder="e.g. Figma, design systems, user research" />
              <p className="hint">Separate with commas. Jobly also uses these for the fit check.</p></div>
            <div><label className="label" htmlFor="ps-summary">Summary</label>
              <textarea id="ps-summary" className="textarea" rows={4} maxLength={3000} value={draft.summary} onChange={(e) => set({ summary: e.target.value })}
                placeholder="Two or three sentences about what you do and what you're looking for" /></div>
          </div>
        )}

        {step === 'experience' && (
          <div className="stack">
            <p className="text-sm">Newest role first. One point per line under each role; forms and your resume use them.</p>
            <WorkEditor work={draft.work} onChange={(work) => set({ work })} />
          </div>
        )}

        {step === 'education' && <EduEditor education={draft.education} onChange={(education) => set({ education })} />}

        {step === 'done' && (
          <div className="stack">
            <p className="text-sm">{completeness.missing.length ? 'Your profile is saved. These would help applications most:' : 'Your profile has everything applications usually ask for.'}</p>
            {completeness.missing.length > 0 && (
              <ul className="setup-missing">
                {completeness.missing.slice(0, 6).map((m) => (
                  <li key={m.id} className="row">
                    <span className="grow text-sm">Add {m.label}</span>
                    {m.step !== 'done' && <button type="button" className="btn btn-outline btn-sm" onClick={() => void go(m.step)}>Add</button>}
                    {m.id === 'resume' && (
                      <label className="btn btn-outline btn-sm">Choose a file
                        <input type="file" accept=".pdf,.doc,.docx,application/pdf" className="sr-only" aria-label="Choose your resume file (PDF or Word)"
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void attachResume(f); }} />
                      </label>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {completeness.missing.some((m) => m.id === 'resume') && <p className="hint">The resume file is attached when autofill fills an application. PDF or Word, up to 1 MB.</p>}
          </div>
        )}
      </div>

      <div className="row setup-nav">
        {index > 0 && <button type="button" className="btn btn-outline" onClick={() => void go(STEPS[index - 1].id)} disabled={reading}><ArrowLeft size={14} aria-hidden="true" /> Back</button>}
        <span className="grow" />
        {step !== 'done'
          ? <button type="button" className="btn" onClick={() => void go(STEPS[index + 1].id)} disabled={reading || (step === 'import' && !result)}
              title={step === 'import' && !result ? 'Choose a PDF, or fill in by hand' : undefined}>
              {step === 'import' ? 'Use these details' : step === 'education' ? 'Save and review' : 'Save and continue'} <ArrowRight size={14} aria-hidden="true" />
            </button>
          : <button type="button" className="btn" onClick={() => { void persist(draft).then((ok) => { if (ok) { notify('Profile saved on this device.', 'info'); onClose(); } }); }}>Finish</button>}
      </div>
    </div>
  );
};
