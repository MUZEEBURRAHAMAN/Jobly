import React, { useState } from 'react';
import { Clock, Plus, Target, Trash } from '../lib/icons';
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

      <div className="split">
      <div className="stack">
      <div className="card goal">
        <div className="row" style={{ gap: 12 }}>
          <span className="goal-icon" aria-hidden="true"><Target size={20} /></span>
          <div className="grow">
            <div className="font-medium">{stats.appliedThisWeek} of {goal} applications this week</div>
            <div className="text-sm muted">{stats.appliedThisWeek >= goal ? 'Goal reached. Nice work.' : `${goal - stats.appliedThisWeek} to go, ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}</div>
          </div>
          {goalDraft === null
            ? <button type="button" className="btn btn-outline btn-sm" onClick={() => setGoalDraft(String(goal))}>Change goal</button>
            : <div className="row"><label className="sr-only" htmlFor="goal-input">Weekly goal</label><input id="goal-input" type="number" min={1} max={200} className="input input-sm" style={{ width: 80 }} value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} /><button type="button" className="btn btn-sm" onClick={() => void saveGoal()}>Save</button></div>}
        </div>
        <div className="meter" role="img" aria-label={`${stats.appliedThisWeek} of ${goal}`}><span style={{ width: `${Math.min(100, (stats.appliedThisWeek / goal) * 100)}%` }} /></div>
      </div>

      <label className="option" style={{ cursor: 'pointer' }}>
        <span className="grow"><span className="font-medium" style={{ display: 'block' }}>Reminders</span><span className="text-xs muted">Desktop reminders for follow-ups, tasks that are due and interviews an hour before they start</span></span>
        <input type="checkbox" className="switch" role="switch" checked={store.settings.reminders} onChange={(e) => void store.saveSettings({ ...store.settings, reminders: e.target.checked })} />
      </label>

      {followUps.length > 0 && (
        <div className="stack">
          <h3>Follow-ups</h3>
          <ul className="stack" style={{ listStyle: 'none' }}>
            {followUps.map((a) => { const d = dueLabel(a.follow_up_at!); return (
              <li key={a.key} className="task-row"><Clock size={16} aria-hidden="true" />
                <span className="grow break">Follow up with <span className="font-medium">{a.company_name}</span> about {a.title}</span>
                <span className={`badge ${d.overdue ? 'badge-warning' : 'badge-outline'}`}>{d.text}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void store.updateApp(a.key, { follow_up_at: null })}>Done</button>
              </li>); })}
          </ul>
        </div>
      )}

      </div>

      <div className="stack">
        <h3>To-dos</h3>
        <div className="task-add">
          <label className="sr-only" htmlFor="task-text">New task</label>
          <input id="task-text" className="input" maxLength={300} placeholder="e.g. Send a thank-you note" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
          <label className="sr-only" htmlFor="task-due">Due date</label>
          <input id="task-due" type="date" className="input" min={todayInput()} value={due} onChange={(e) => setDue(e.target.value)} />
          <label className="sr-only" htmlFor="task-app">Linked application</label>
          <select id="task-app" className="select" value={appKey} onChange={(e) => setAppKey(e.target.value)}>
            <option value="">No application</option>
            {store.apps.map((a) => <option key={a.key} value={a.key}>{a.company_name} · {a.title}</option>)}
          </select>
          <button type="button" className="btn btn-sm" onClick={() => void add()}><Plus size={14} aria-hidden="true" /> Add task</button>
        </div>
        {open.length === 0 ? <p className="text-sm">No open tasks.</p> : <ul className="stack" style={{ listStyle: 'none' }}>{open.map(row)}</ul>}
        {done.length > 0 && <details><summary className="text-sm muted" style={{ cursor: 'pointer' }}>Done ({done.length})</summary><ul className="stack" style={{ listStyle: 'none', marginTop: 8 }}>{done.map(row)}</ul></details>}
        <p className="hint">Weeks start on Monday.</p>
      </div>
    </div>
    </div>
  );
};
