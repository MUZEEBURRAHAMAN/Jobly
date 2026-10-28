import React, { useState } from 'react';
import { Check, Copy } from '../lib/icons';

/** Copies `value` and says so for two seconds. */
export const CopyButton: React.FC<{ value: string; label: string; text?: boolean }> = ({ value, label, text }) => {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setState('copied'); }
    catch { setState('failed'); }
    window.setTimeout(() => setState('idle'), 2000);
  };
  const Icon = state === 'copied' ? Check : Copy;
  return (
    <button type="button" className={`btn btn-sm${text ? ' btn-outline' : ' btn-ghost btn-icon'}`} onClick={() => void copy()} disabled={!value}
      aria-label={state === 'copied' ? `${label} copied` : `Copy ${label}`} title={state === 'failed' ? "Couldn't copy" : `Copy ${label}`}>
      <Icon size={14} aria-hidden="true" />{text && (state === 'copied' ? 'Copied' : 'Copy')}
    </button>
  );
};
