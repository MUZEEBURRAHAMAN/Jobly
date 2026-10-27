import React, { useState } from 'react';
import { Clock, ListChecks, Plus, Target, Trash } from '../lib/icons';
import { newId, startOfWeek, Task, trackerStats } from '../lib/tracker';
import { TrackerStore } from '../lib/useTracker';
import { dueLabel, fromDateInput, todayInput } from '../lib/dates';

export const TasksView: React.FC<{ store: TrackerStore; notify: (m: string, kind?: 'error' | 'info') => void }> = ({ store, notify }) => {
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [appKey, setAppKey] = useState('');
  const [goalDraft, setGoalDraft] = useState<string | null>(null);
  const stats = trackerStats(store.apps, store.interviews);
  const goal = store.settings.weekly_goal;
  const weekStart = startOfWeek();
  const daysLeft = 7 - Math.floor((Date.now() - weekStart.getTime()) / 86400000);

  const followUps = store.apps
    .filter((a) => a.follow_up_at && !['rejected', 'withdrawn', 'offer'].includes(a.status))
    .sort((a, b) => Date.parse(a.follow_up_at!) - Date.parse(b.follow_up_at!));
  const open = store.tasks.filter((t) => !t.done).sort((a, b) => (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity));
  const done = store.tasks.filter((t) => t.done);

  const add = async () => {
    if (!text.trim()) { notify('Write what the task is first.'); return; }
    const problem = await store.saveTask({ id: newId(), text, due_at: fromDateInput(due), done: false, app_key: appKey || null, created_at: new Date().toISOString() });
    if (problem) notify(problem); else { setText(''); setDue(''); setAppKey(''); }
  };
  const toggle = async (t: Task) => { const p = await store.saveTask({ ...t, done: !t.done }); if (p) notify(p); };
  const saveGoal = async () => {
    if (goalDraft === null) return;
    const p = await store.saveSettings({ ...store.settings, weekly_goal: Number(goalDraft) });
    if (p) notify(p); setGoalDraft(null);
  };

  const row = (t: Task) => {
    const app = t.app_key ? store.byKey.get(t.app_key) : null;
    const d = t.due_at ? dueLabel(t.due_at) : null;
    return (
      <li key={t.id} className="task-row">
        <input id={`task-${t.id}`} type="checkbox" checked={t.done} onChange={() => void toggle(t)} />
        <label htmlFor={`task-${t.id}`} className={`grow break${t.done ? ' done' : ''}`}>{t.text}{app && <span className="text-xs muted"> · {app.company_name}</span>}</label>
        {d && !t.done && <span className={`badge ${d.overdue ? 'badge-warning' : 'badge-outline'}`}>{d.text}</span>}
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => void store.removeTask(t.id)} aria-label={`Delete task: ${t.text}`}><Trash size={14} aria-hidden="true" /></button>
      </li>
    );
  };

  return (
    <div className="section">
      <div><h2>Tasks and goals</h2><p className="text-sm">Follow-ups, to-dos and a weekly target for applications.</p></div>

      <div className="workspace">
        <div className="stack">
          {followUps.length > 0 && (
            <section className="card panel" aria-labelledby="followups-title">
              <div className="panel-head"><h3 id="followups-title">Follow-ups</h3><span className="text-xs muted">{followUps.length} to send</span></div>
              <ul className="panel-list">
                {followUps.map((a) => { const d = dueLabel(a.follow_up_at!); return (
                  <li key={a.key} className="task-row"><Clock size={16} aria-hidden="true" />
                    <span className="grow break text-sm">Follow up with <span className="font-medium">{a.company_name}</span> about {a.title}</span>
                    <span className={`badge ${d.overdue ? 'badge-warning' : 'badge-outline'}`}>{d.text}</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void store.updateApp(a.key, { follow_up_at: null })}>Done</button>
                  </li>); })}
              </ul>
            </section>
          )}

          <section className="card panel" aria-labelledby="todos-title">
            <div className="panel-head">
              <h3 id="todos-title">To-dos</h3>
              {open.length > 0 && <span className="text-xs muted">{open.length} open</span>}
            </div>
            <div className="task-add">
              <label className="sr-only" htmlFor="task-text">New task</label>
              <input id="task-text" className="input task-text" maxLength={300} placeholder="e.g. Send a thank-you note" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
              <label className="sr-only" htmlFor="task-due">Due date</label>
              <input id="task-due" type="date" className="input" min={todayInput()} value={due} onChange={(e) => setDue(e.target.value)} />
              <label className="sr-only" htmlFor="task-app">Linked application</label>
              <select id="task-app" className="select" value={appKey} onChange={(e) => setAppKey(e.target.value)}>
                <option value="">No application</option>
                {store.apps.map((a) => <option key={a.key} value={a.key}>{a.company_name} · {a.title}</option>)}
              </select>
              <button type="button" className="btn" onClick={() => void add()}><Plus size={16} aria-hidden="true" /> Add task</button>
            </div>
            {open.length === 0
              ? <div className="panel-empty"><span className="goal-icon" aria-hidden="true"><ListChecks size={20} /></span><p className="font-medium">No open tasks</p><p className="text-sm muted">Add the next step for an application, like a thank-you note or a portfolio update. Due tasks get a reminder.</p></div>
              : <ul className="panel-list">{open.map(row)}</ul>}
            {done.length > 0 && <details className="task-done"><summary className="text-sm muted">Done ({done.length})</summary><ul className="panel-list">{done.map(row)}</ul></details>}
          </section>
        </div>

        <aside className="stack" aria-label="Weekly goal and reminders">
          <section className="card panel goal" aria-labelledby="goal-title">
            <div className="panel-head">
              <div className="row" style={{ gap: 12 }}>
                <span className="goal-icon" aria-hidden="true"><Target size={20} /></span>
                <h3 id="goal-title">Weekly goal</h3>
              </div>
              {goalDraft === null
                ? <button type="button" className="btn btn-outline btn-sm" onClick={() => setGoalDraft(String(goal))}>Change goal</button>
                : <div className="row"><label className="sr-only" htmlFor="goal-input">Weekly goal</label><input id="goal-input" type="number" min={1} max={200} className="input input-sm" style={{ width: 72 }} value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void saveGoal(); }} /><button type="button" className="btn btn-sm" onClick={() => void saveGoal()}>Save</button></div>}
            </div>
            <div>
              <div className="goal-number" aria-hidden="true"><span>{stats.appliedThisWeek}</span> <span className="muted">/ {goal}</span></div>
              <p className="sr-only">{stats.appliedThisWeek} of {goal} applications this week</p>
              <div className="meter" role="img" aria-label={`${stats.appliedThisWeek} of ${goal}`}><span style={{ width: `${Math.min(100, (stats.appliedThisWeek / goal) * 100)}%` }} /></div>
              <p className="text-sm muted goal-note">{stats.appliedThisWeek >= goal ? 'Goal reached. Nice work.' : `${goal - stats.appliedThisWeek} to go, ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}</p>
              <p className="hint">Applications this week. Weeks start on Monday.</p>
            </div>
          </section>

          <label className="card panel reminder-card">
            <span className="grow"><span className="font-medium" style={{ display: 'block' }}>Reminders</span><span className="text-xs muted">Desktop reminders for follow-ups, tasks that are due and interviews an hour before they start</span></span>
            <input type="checkbox" className="switch" role="switch" checked={store.settings.reminders} onChange={(e) => void store.saveSettings({ ...store.settings, reminders: e.target.checked })} />
          </label>
        </aside>
      </div>
    </div>
  );
};
