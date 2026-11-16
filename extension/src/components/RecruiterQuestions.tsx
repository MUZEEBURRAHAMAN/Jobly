import React, { useState } from 'react';
import { CheckCircle2, Plus } from '../lib/icons';
import { ProfilesStore } from '../lib/useProfiles';
import { addLine, lineTips, onResume, RECRUITER_QUESTIONS, targets, toLine, useAnswers } from '../lib/recruiterQuestions';

/**
 * The Resume page's "Recruiter questions" tab: the questions a recruiter would ask if they had the time. Each answer,
 * in the user's own words, becomes one line on the resume, placed first in the role it belongs to. Nothing is
 * written for the user and no number is added that they didn't type.
 */
export const RecruiterQuestions: React.FC<{ store: ProfilesStore; notify?: (m: string, kind?: 'error' | 'info') => void }> = ({ store, notify }) => {
  const p = store.active;
  const [answers, setAnswers] = useAnswers();
  const [open, setOpen] = useState<string>(RECRUITER_QUESTIONS[0].id);
  const [where, setWhere] = useState<Record<string, string>>({});
  if (!p) return null;
  const mine = answers[p.id] ?? {};
  const added = RECRUITER_QUESTIONS.filter((q) => mine[q.id]?.trim() && onResume(p, toLine(mine[q.id], q.place))).length;
  const setAnswer = (id: string, text: string) => setAnswers({ ...answers, [p.id]: { ...mine, [id]: text } });

  const add = async (id: string, line: string, target: string, label: string) => {
    const problem = await store.save(addLine(p, target, line));
    if (problem) { notify?.(problem); return; }
    notify?.(`Added to ${label}.`, 'info');
  };

  return (
    <section className="card rv-card" aria-labelledby="rq-title">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 id="rq-title">Questions a recruiter would ask</h3>
        <span className="text-xs muted rq-count" aria-live="polite">{added} of {RECRUITER_QUESTIONS.length} on your resume</span>
      </div>
      <p className="hint">A recruiter gives a resume a few seconds and looks for what you built, what you figured out, and why they should call you. Answer in your own words; each answer becomes one line, placed first where it belongs. Jobly only tidies the wording and never adds a fact or a number.</p>
      <ol className="rq-list">
        {RECRUITER_QUESTIONS.map((q, i) => {
          const text = mine[q.id] ?? '';
          const line = toLine(text, q.place);
          const list = targets(p, q.place);
          const target = list.find((t) => t.id === where[q.id]) ?? list[0];
          const done = !!line && onResume(p, line);
          const tips = line ? lineTips(line) : [];
          const expanded = open === q.id;
          return (
            <li key={q.id} className={`rq-item${expanded ? ' rq-open' : ''}`}>
              <button type="button" className="rq-q" aria-expanded={expanded} aria-controls={`rq-${q.id}`} onClick={() => setOpen(expanded ? '' : q.id)}>
                <span className="rq-n" aria-hidden="true">{done ? <CheckCircle2 size={14} /> : i + 1}</span>
                <span className="rq-text">{q.question}</span>
              </button>
              {expanded && (
                <div id={`rq-${q.id}`} className="rq-body">
                  <p className="text-xs muted">{q.why}</p>
                  <label className="sr-only" htmlFor={`rq-a-${q.id}`}>Your answer: {q.question}</label>
                  <textarea id={`rq-a-${q.id}`} className="textarea" rows={2} maxLength={600} value={text} onChange={(e) => setAnswer(q.id, e.target.value)} placeholder={`For example: ${q.example}`} />
                  {line && (
                    <div className="rq-line">
                      <p className="label">On your resume it reads</p>
                      <p className="rq-preview">{line}</p>
                      {tips.length > 0 && <ul className="rq-tips" aria-label="How to make it land">{tips.map((t) => <li key={t}>{t}</li>)}</ul>}
                      {done ? <p className="text-sm rq-done"><CheckCircle2 size={14} aria-hidden="true" /> On your resume</p> : list.length > 0 && (
                        <div className="row wrap">
                          {list.length > 1 && <select className="select select-sm" style={{ width: 'auto' }} aria-label="Add it to" value={target.id} onChange={(e) => setWhere({ ...where, [q.id]: e.target.value })}>
                            {list.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>}
                          <button type="button" className="btn btn-sm" onClick={() => void add(q.id, line, target.id, target.label)}><Plus size={14} aria-hidden="true" /> Add to {list.length > 1 ? 'resume' : target.label.toLowerCase()}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="hint">Answers are kept on this device, per profile. Lines you add go into your profile, so every template, tailored copy and application uses them.</p>
    </section>
  );
};
