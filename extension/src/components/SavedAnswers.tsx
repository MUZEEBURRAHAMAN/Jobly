import React, { useEffect, useState } from 'react';
import { Trash } from '../lib/icons';
import { ANSWER_KEY, forgetAnswer, loadAnswers, SavedAnswer } from '../lib/answerBank';
import { onKeysChanged } from '../lib/userData';

/** Answers apply assist remembered from forms, with a way to delete each. */
export const SavedAnswers: React.FC = () => {
  const [list, setList] = useState<SavedAnswer[]>([]);
  useEffect(() => { const load = () => void loadAnswers().then(setList); load(); return onKeysChanged([ANSWER_KEY], load); }, []);
  return (
    <fieldset className="card profile-card span-all"><legend className="label">Saved answers</legend>
      <p className="text-sm">What you typed on application forms that your profile doesn't cover. Apply assist fills these when a form asks the same question. Questions about gender, ethnicity, disability, veteran status or ID numbers are never saved.</p>
      {list.length === 0
        ? <p className="hint">None yet. They're saved as you answer questions marked “Action required”.</p>
        : (
          <ul className="setup-missing" style={{ marginTop: 8 }}>
            {list.map((a) => (
              <li key={a.key} className="row" style={{ alignItems: 'flex-start' }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <p className="text-xs muted break">{a.question}</p>
                  <p className="text-sm break">{a.value}</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => void forgetAnswer(a.key)} aria-label={`Delete the saved answer to: ${a.question}`} title="Delete"><Trash size={14} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
    </fieldset>
  );
};
