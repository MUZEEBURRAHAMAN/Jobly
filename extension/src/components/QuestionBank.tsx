import React, { useEffect, useState } from 'react';
import { CheckCircle2, Save, Trash } from '../lib/icons';
import { ANSWER_KEY, loadAnswers, questionKey, rememberAnswers, SavedAnswer } from '../lib/answerBank';
import { COMMON_QUESTIONS, forgetQuestion, openQuestions, useQuestionLog } from '../lib/questionBank';
import { onKeysChanged } from '../lib/userData';

/**
 * Questions employers ask: the common ones to answer once, and every question a form asked that Jobly couldn't answer
 * (most asked first). An answer saved here fills the same question on every later form.
 */
export const QuestionBank: React.FC<{ notify: (m: string, kind?: 'error' | 'info') => void }> = ({ notify }) => {
  const [saved, setSaved] = useState<SavedAnswer[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const log = useQuestionLog();
  useEffect(() => { const load = () => void loadAnswers().then(setSaved); load(); return onKeysChanged([ANSWER_KEY], load); }, []);
  const savedFor = (q: string) => saved.find((a) => a.key === questionKey(q));
  const stuck = openQuestions(log, saved).slice(0, 25);
  const askedFor = (match: RegExp) => log.filter((x) => match.test(x.question)).reduce((n, x) => n + x.count, 0);

  const save = async (question: string, id: string) => {
    const value = (draft[id] ?? '').trim();
    if (!value) return;
    const n = await rememberAnswers([{ question, value, kind: 'textarea' }]);
    if (!n) { notify("That question can't be saved (questions about gender, ethnicity, disability or ID are never stored)."); return; }
    setDraft((d) => { const { [id]: _, ...rest } = d; return rest; });
    notify('Saved. Jobly fills it the next time a form asks.', 'info');
  };
  const value = (id: string, fallback = '') => draft[id] ?? fallback;

  return (
    <fieldset className="card profile-card span-all qb">
      <legend className="label">Questions employers ask</legend>
      <p className="text-sm muted">Answer once and Jobly fills these on every form. Write {'{company}'} or {'{role}'} and they’re filled in for each job.</p>

      {stuck.length > 0 && (
        <section className="qb-section" aria-labelledby="qb-stuck">
          <h3 id="qb-stuck">Questions you got stuck on <span className="aq-count">{stuck.length}</span></h3>
          <p className="text-xs muted">Forms asked these and Jobly had no answer. Most asked first.</p>
          <ul className="qb-list">
            {stuck.map((q) => (
              <li key={q.key}>
                <div className="qb-q"><label className="font-medium text-sm" htmlFor={`qb-${q.key}`}>{q.question}</label>
                  <span className="text-xs muted">Asked {q.count}×{q.companies.length ? ` · ${q.companies.slice(0, 3).join(', ')}` : ''}</span></div>
                <textarea id={`qb-${q.key}`} className="textarea" rows={2} maxLength={3000} value={value(q.key)} onChange={(e) => setDraft({ ...draft, [q.key]: e.target.value })} placeholder="Your answer" />
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn btn-sm" disabled={!value(q.key).trim()} onClick={() => void save(q.question, q.key)}><Save size={14} aria-hidden="true" /> Save answer</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void forgetQuestion(q.key)} aria-label={`Dismiss: ${q.question}`}><Trash size={14} aria-hidden="true" /> Dismiss</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="qb-section" aria-labelledby="qb-common">
        <h3 id="qb-common">Common questions</h3>
        <ul className="qb-list">
          {COMMON_QUESTIONS.map((c) => {
            const have = savedFor(c.question);
            const asked = askedFor(c.match);
            return (
              <li key={c.id}>
                <div className="qb-q"><label className="font-medium text-sm" htmlFor={`qb-c-${c.id}`}>{c.question}</label>
                  <span className="text-xs muted">{have ? <><CheckCircle2 size={12} aria-hidden="true" /> Answered</> : asked ? `Forms asked this ${asked}×` : ''}</span></div>
                <textarea id={`qb-c-${c.id}`} className="textarea" rows={2} maxLength={3000} value={value(`c-${c.id}`, have?.value ?? '')} onChange={(e) => setDraft({ ...draft, [`c-${c.id}`]: e.target.value })} placeholder={c.hint} />
                {(draft[`c-${c.id}`] ?? null) !== null && draft[`c-${c.id}`] !== (have?.value ?? '') && (
                  <div className="row"><button type="button" className="btn btn-sm" disabled={!value(`c-${c.id}`).trim()} onClick={() => void save(c.question, `c-${c.id}`)}><Save size={14} aria-hidden="true" /> Save answer</button></div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </fieldset>
  );
};
