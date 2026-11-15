import React, { useEffect, useState } from 'react';
import { CheckCircle2, Save, Trash } from '../lib/icons';
import { ANSWER_KEY, loadAnswers, questionKey, rememberAnswers, SavedAnswer } from '../lib/answerBank';
import { COMMON_QUESTIONS, forgetQuestion, openQuestions, profileDraft, stuckDraft, useQuestionLog } from '../lib/questionBank';
import { Profile } from '../lib/profile';
import { onKeysChanged } from '../lib/userData';

/**
 * Questions employers ask: the common ones to answer once, and every question a form asked that Jobly couldn't answer
 * (most asked first). An answer saved here fills the same question on every later form.
 */
export const QuestionBank: React.FC<{ notify: (m: string, kind?: 'error' | 'info') => void; profile: Profile | null }> = ({ notify, profile }) => {
  const [saved, setSaved] = useState<SavedAnswer[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const log = useQuestionLog();
  useEffect(() => { const load = () => void loadAnswers().then(setSaved); load(); return onKeysChanged([ANSWER_KEY], load); }, []);
  const savedFor = (q: string) => saved.find((a) => a.key === questionKey(q));
  const stuck = openQuestions(log, saved).slice(0, 25);
  const askedFor = (match: RegExp) => log.filter((x) => match.test(x.question)).reduce((n, x) => n + x.count, 0);

  const value = (id: string, fallback = '') => draft[id] ?? fallback;
  const saveValue = async (question: string, id: string, text: string) => {
    if (!text.trim()) return;
    const n = await rememberAnswers([{ question, value: text.trim(), kind: 'textarea' }]);
    if (!n) { notify("That question can't be saved."); return; }
    setDraft((d) => { const { [id]: _, ...rest } = d; return rest; });
    notify('Saved. Jobly fills it the next time a form asks.', 'info');
  };

  return (
    <fieldset className="card profile-card span-all qb">
      <legend className="label">Questions employers ask</legend>
      <p className="text-sm muted">Answer once and Jobly fills these on every form. Write {'{company}'} or {'{role}'} and they’re filled in for each job. Answers drafted from your profile are filled as suggestions until you save them.</p>

      {stuck.length > 0 && (
        <section className="qb-section" aria-labelledby="qb-stuck">
          <h3 id="qb-stuck">Questions you got stuck on <span className="aq-count">{stuck.length}</span></h3>
          <p className="text-xs muted">Forms asked these and Jobly had no answer. Most asked first.</p>
          <ul className="qb-list">
            {stuck.map((q) => (
              <li key={q.key}>
                <div className="qb-q"><label className="font-medium text-sm" htmlFor={`qb-${q.key}`}>{q.question}</label>
                  <span className="text-xs muted">Asked {q.count}×{q.companies.length ? ` · ${q.companies.slice(0, 3).join(', ')}` : ''}</span></div>
                {(() => { const sd = stuckDraft(q.question, q.kind, profile); const v = value(q.key, sd); return (<>
                <textarea id={`qb-${q.key}`} className="textarea" rows={3} maxLength={3000} value={v} onChange={(e) => setDraft({ ...draft, [q.key]: e.target.value })} placeholder="Your answer" />
                {sd && v === sd && <span className="text-xs muted">Drafted from your profile</span>}
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn btn-sm" disabled={!v.trim()} onClick={() => void saveValue(q.question, q.key, v)}><Save size={14} aria-hidden="true" /> Save answer</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void forgetQuestion(q.key)} aria-label={`Dismiss: ${q.question}`}><Trash size={14} aria-hidden="true" /> Dismiss</button>
                </div></>); })()}
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
            const pDraft = have ? '' : profileDraft(c.id, profile);
            const shown = value(`c-${c.id}`, have?.value ?? pDraft);
            return (
              <li key={c.id}>
                <div className="qb-q"><label className="font-medium text-sm" htmlFor={`qb-c-${c.id}`}>{c.question}</label>
                  <span className="text-xs muted">{have ? <><CheckCircle2 size={12} aria-hidden="true" /> Answered</> : pDraft ? 'Drafted from your profile' : asked ? `Forms asked this ${asked}×` : ''}</span></div>
                <textarea id={`qb-c-${c.id}`} className="textarea" rows={4} maxLength={3000} value={shown} onChange={(e) => setDraft({ ...draft, [`c-${c.id}`]: e.target.value })} placeholder={c.hint} />
                {(((draft[`c-${c.id}`] ?? null) !== null && draft[`c-${c.id}`] !== (have?.value ?? '')) || (!have && !!shown.trim())) && (
                  <div className="row"><button type="button" className="btn btn-sm" disabled={!shown.trim()} onClick={() => { setDraft((d) => ({ ...d, [`c-${c.id}`]: shown })); void saveValue(c.question, `c-${c.id}`, shown); }}><Save size={14} aria-hidden="true" /> {pDraft && !have && pDraft === shown ? 'Use this answer' : 'Save answer'}</button></div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </fieldset>
  );
};
