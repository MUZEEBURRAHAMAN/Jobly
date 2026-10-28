import React from 'react';
import { useTrackerContext } from '../lib/trackerContext';

/** After the user opens a job's application, ask whether they applied, and track it if so. */
export const ApplyPrompt: React.FC<{ onProblem: (message: string) => void }> = ({ onProblem }) => {
  const tracker = useTrackerContext();
  const job = tracker?.pending;
  if (!tracker || !job) return null;
  const answer = async (applied: boolean) => {
    const problem = await tracker.answerPending(applied);
    if (problem) onProblem(problem);
  };
  return (
    <div className="prompt" role="region" aria-label="Did you apply?">
      <p className="grow"><span className="font-medium">Did you apply to {job.title}</span> at {job.company_name}?</p>
      <div className="row">
        <button type="button" className="btn btn-brand btn-sm" onClick={() => void answer(true)}>Yes, track it</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void answer(false)}>Not yet</button>
      </div>
    </div>
  );
};
