import { useState } from 'react';
import { ask } from '../lib/ask';
import { profileImportTask } from '../lib/ai/prompts';
import { readResumeFile } from '../lib/resume-file';
import { update } from '../lib/store';
import { mergeImportedProfile, type ProfileAnswer } from '../lib/workflows';
import { Icon } from './Icon';
import { Area, Busy, toast, useJob } from './ui';

/** Start or extend the profile from an existing resume: upload a PDF or paste the text; the model structures it. */
export function ImportResume({ onDone }: { onDone?: () => void }) {
  const [text, setText] = useState('');
  const job = useJob();

  async function onFile(file: File | undefined) {
    if (!file) return;
    try { setText(await readResumeFile(file)); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  async function run() {
    const answer = await job.run('Reading your resume', (signal) => ask<ProfileAnswer>(profileImportTask(text), signal));
    if (!answer) return;
    update((s) => ({ ...s, profile: mergeImportedProfile(s.profile, answer) }));
    toast('Your resume is in your profile. Check each entry: the import copies, it doesn’t judge.');
    setText('');
    onDone?.();
  }

  return (
    <div className="stack sm">
      <div className="row">
        <label className="btn">
          <Icon name="upload" />Choose a PDF or text file
          <input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <span className="muted small">or paste the text below. The file is read in your browser.</span>
      </div>
      <Area value={text} onChange={setText} rows={8} placeholder="Paste your resume here…" label="Resume text" />
      {job.busy ? <Busy label={job.busy} onStop={job.stop} /> : (
        <div className="row">
          <button className="btn primary" disabled={text.trim().length < 80} onClick={run}><Icon name="sparkle" />Fill my profile from this</button>
          <span className="muted small">Adds to your profile; never removes anything.</span>
        </div>
      )}
    </div>
  );
}
