import { useEffect, useState } from 'react';
import { finishHandoff, useHandoff } from '../lib/ask';
import { parseJsonAnswer } from '../lib/ai/run';
import { Icon } from './Icon';
import { Modal, copyText } from './ui';

export function HandoffModal() {
  const h = useHandoff();
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setAnswer(''); setError(''); }, [h]);
  if (!h) return null;

  function submit() {
    try {
      parseJsonAnswer(answer);
      finishHandoff(answer);
    } catch (e) {
      setError((e as Error).message + ' Paste Claude’s whole answer, starting with {.');
    }
  }

  return (
    <Modal
      open
      onClose={() => finishHandoff(null)}
      title={`${h.task.label}: write it with Claude`}
      footer={<>
        <button className="btn ghost" onClick={() => finishHandoff(null)}>Cancel</button>
        <button className="btn primary" disabled={!answer.trim()} onClick={submit}>Use this answer</button>
      </>}
    >
      <p className="muted">No AI model is set up in Studio, so this step runs in Claude on your own plan. Nothing is sent from here.</p>
      <ol className="stack sm" style={{ margin: 0, paddingLeft: 18 }}>
        <li>
          <div className="row">
            <span>Copy the prompt.</span>
            <button className="btn sm" onClick={() => copyText(h.prompt, 'Prompt copied')}><Icon name="copy" />Copy prompt</button>
            <span className="muted small">{Math.round(h.prompt.length / 1000)}k characters, includes your profile</span>
          </div>
        </li>
        <li>
          <div className="row">
            <span>Paste it into a new chat.</span>
            <a className="btn sm" href="https://claude.ai/new" target="_blank" rel="noopener noreferrer"><Icon name="external" />Open Claude</a>
          </div>
        </li>
        <li>
          <span>Paste Claude’s answer here.</span>
          <textarea className="textarea mono" rows={8} value={answer} onChange={(e) => { setAnswer(e.target.value); setError(''); }}
            placeholder='{"title": "…", …}' aria-label="Claude’s answer" style={{ marginTop: 6 }} />
          {error && <p className="small" style={{ color: 'var(--destructive)', marginTop: 4 }}>{error}</p>}
        </li>
      </ol>
      <p className="small muted">Studio checks the answer like its own drafts: lines that don’t trace back to your profile are removed or flagged.</p>
    </Modal>
  );
}
