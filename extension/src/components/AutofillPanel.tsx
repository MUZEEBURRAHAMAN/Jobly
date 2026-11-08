import React, { useState } from 'react';
import { ExternalLink, Wand } from '../lib/icons';
import { scanForm, ScanResult } from '../lib/autofill';
import { Profile } from '../lib/profile';
import { safeHttpUrl } from '../lib/url';

/**
 * "Start apply assist": opens Jobly's panel on the application page (the tab Jobly was opened on, activeTab). The panel
 * fills each step of the form from the profile after the user approves the answers. Jobly never presses Submit.
 */
export const AutofillPanel: React.FC<{ tabId: number; profile: Profile | null; onFilled?: () => void; openProfile: () => void }> = ({ tabId, profile, openProfile }) => {
  const [state, setState] = useState<{ name: 'idle' | 'starting' } | { name: 'frames'; frames: string[] } | { name: 'error'; message: string }>({ name: 'idle' });

  const start = async () => {
    setState({ name: 'starting' });
    try {
      // A form embedded from a hiring system in a frame can't be filled from the career page: offer to open it
      const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: scanForm });
      const scan = res?.result as ScanResult | undefined;
      if (scan && !scan.fields.length && scan.frames.length) { setState({ name: 'frames', frames: scan.frames }); return; }
      await chrome.scripting.executeScript({ target: { tabId }, files: ['assist.js'] });
      window.close(); // the panel is on the page now
    } catch {
      setState({ name: 'error', message: "Chrome doesn't let extensions work on this page. Open the application form on its own page and try again." });
    }
  };

  if (!profile) {
    return <div className="card autofill"><p className="text-sm">Apply assist fills forms from your profile. <button type="button" className="link" onClick={openProfile}>Set up your profile</button> first: import your LinkedIn PDF and it takes a minute.</p></div>;
  }

  return (
    <div className="card autofill stack" aria-live="polite">
      <p className="text-sm">Open Jobly's panel on this application. It fills each step from “{profile.label}” after you approve the answers, and marks the questions only you can answer. You press Submit yourself.</p>
      <button type="button" className="btn btn-brand btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => void start()} disabled={state.name === 'starting'}>
        <Wand size={14} aria-hidden="true" /> {state.name === 'starting' ? 'Opening…' : 'Start apply assist'}
      </button>
      {state.name === 'error' && <p className="text-sm" role="alert">{state.message}</p>}
      {state.name === 'frames' && (
        <div className="stack">
          <p className="text-sm">The form on this page comes from a hiring system in a frame. Open it on its own page, then start apply assist there.</p>
          {state.frames.map((src) => { const href = safeHttpUrl(src); return href && <a key={src} className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} href={href} target="_blank" rel="noopener noreferrer">Open the application form <ExternalLink size={14} aria-hidden="true" /></a>; })}
        </div>
      )}
    </div>
  );
};
