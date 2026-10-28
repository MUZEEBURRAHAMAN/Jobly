import React, { useState } from 'react';
import { Calendar } from '../lib/icons';
import { calendarConfigured, CalendarEvent, fetchInterviewEvents } from '../lib/integrations';
import { DEFAULT_CHECKLIST, newId } from '../lib/tracker';
import { TrackerStore } from '../lib/useTracker';
import { formatDateTime } from '../lib/dates';
import { Dialog } from './Dialog';

/** Imports upcoming interviews from Google Calendar (read-only), matched to tracked applications. */
export const CalendarImport: React.FC<{ store: TrackerStore; notify: (m: string, kind?: 'error' | 'info') => void }> = ({ store, notify }) => {
  const [events, setEvents] = useState<(CalendarEvent & { app: string; pick: boolean })[] | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = calendarConfigured();
  const imported = new Set(store.interviews.map((i) => i.source_id).filter(Boolean));

  const load = async () => {
    setBusy(true);
    try {
      const list = await fetchInterviewEvents();
      if (!list) { notify("Couldn't connect to Google Calendar. Allow access when Chrome asks."); return; }
      const fresh = list.filter((e) => !imported.has(e.id));
      if (!fresh.length) { notify(list.length ? 'Those interviews are already imported.' : 'No upcoming events that look like interviews.', 'info'); return; }
      setEvents(fresh.map((e) => {
        const match = store.apps.find((a) => e.title.toLowerCase().includes(a.company_name.toLowerCase()) || e.description.toLowerCase().includes(a.company_name.toLowerCase()));
        return { ...e, app: match?.key ?? '', pick: !!match };
      }));
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't read your calendar.");
    } finally { setBusy(false); }
  };

  const save = async () => {
    let n = 0;
    for (const e of events ?? []) {
      if (!e.pick || !e.app) continue;
      const problem = await store.saveInterview({ id: newId(), app_key: e.app, round: e.title, at: e.start, link: e.link, notes: e.description, rating: null, source_id: e.id,
        checklist: DEFAULT_CHECKLIST.map((text) => ({ id: newId(), text, done: false, due: null })) });
      if (problem) { notify(problem); break; }
      n++;
    }
    setEvents(null);
    if (n) notify(`Imported ${n} interview${n === 1 ? '' : 's'}.`, 'info');
  };

  return (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()} disabled={!configured || busy}
        title={configured ? 'Read upcoming interviews from your Google Calendar' : "Calendar import isn't set up in this version yet"}>
        <Calendar size={14} aria-hidden="true" /> {busy ? 'Reading calendar…' : 'Import from Google Calendar'}
      </button>
      {events && (
        <Dialog wide title="Import interviews" onClose={() => setEvents(null)}
          footer={<><span className="grow" /><button type="button" className="btn btn-outline btn-sm" onClick={() => setEvents(null)}>Cancel</button>
            <button type="button" className="btn btn-sm" onClick={() => void save()} disabled={!events.some((e) => e.pick && e.app)}>Import {events.filter((e) => e.pick && e.app).length}</button></>}>
          <p className="text-sm">Events in the next 45 days that look like interviews. Match each one to an application.</p>
          <ul className="stack" style={{ listStyle: 'none', marginTop: 12 }}>
            {events.map((e, i) => (
              <li key={e.id} className="task-row" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" id={`ce-${e.id}`} checked={e.pick} onChange={(ev) => setEvents((l) => l!.map((x, j) => (j === i ? { ...x, pick: ev.target.checked } : x)))} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <label htmlFor={`ce-${e.id}`} className="font-medium break">{e.title}</label>
                  <div className="text-xs muted">{formatDateTime(e.start)}</div>
                  <select className="select select-sm" style={{ width: '100%', marginTop: 6 }} aria-label={`Application for ${e.title}`} value={e.app}
                    onChange={(ev) => setEvents((l) => l!.map((x, j) => (j === i ? { ...x, app: ev.target.value, pick: !!ev.target.value } : x)))}>
                    <option value="">Choose an application</option>
                    {store.apps.map((a) => <option key={a.key} value={a.key}>{a.company_name} · {a.title}</option>)}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </>
  );
};
