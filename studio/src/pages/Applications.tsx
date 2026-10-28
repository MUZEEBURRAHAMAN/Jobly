import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Empty, Tabs, toast } from '../components/ui';
import { href } from '../lib/router';
import { update, useStudio } from '../lib/store';
import { STATUSES, type Application, type Status } from '../lib/types';
import { matchScore, setStatus } from '../lib/workflows';

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function moveTo(id: string, status: Status) {
  update((s) => ({ ...s, applications: s.applications.map((a) => (a.id === id ? setStatus(a, status) : a)) }));
}

function Card({ app }: { app: Application }) {
  const score = matchScore(app.posting, app.matches);
  return (
    <a
      className="app-card"
      href={href({ page: 'application', id: app.id })}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', app.id); e.dataTransfer.effectAllowed = 'move'; }}
    >
      <strong>{app.posting.title || 'Untitled role'}</strong>
      <span className="muted small">{app.posting.company || 'Unknown company'}</span>
      <span className="row small">
        {score !== null && <span className={`badge ${score >= 75 ? 'met' : score >= 50 ? 'partial' : 'gap'}`}>{score}%</span>}
        <span className="muted">Updated {fmt(app.updatedAt)}</span>
      </span>
    </a>
  );
}

export function Applications() {
  const apps = useStudio((s) => s.applications);
  const [view, setView] = useState<'board' | 'table'>('board');
  const [q, setQ] = useState('');
  const [over, setOver] = useState<Status | null>(null);
  const [sort, setSort] = useState<'updated' | 'company' | 'score'>('updated');

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? apps.filter((a) => `${a.posting.title} ${a.posting.company} ${a.notes}`.toLowerCase().includes(needle)) : apps;
    return [...list].sort((a, b) =>
      sort === 'company' ? a.posting.company.localeCompare(b.posting.company)
        : sort === 'score' ? (matchScore(b.posting, b.matches) ?? -1) - (matchScore(a.posting, a.matches) ?? -1)
          : b.updatedAt.localeCompare(a.updatedAt));
  }, [apps, q, sort]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div><h1>Applications</h1><p>Drag a card to change its stage, or open it to change it there.</p></div>
        <div className="row">
          <input className="input" style={{ width: 220 }} placeholder="Search role, company, notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search applications" />
          <Tabs label="View" value={view} onChange={setView} items={[{ id: 'board', label: 'Board' }, { id: 'table', label: 'Table' }]} />
          <a className="btn primary" href="#/new"><Icon name="plus" />New</a>
        </div>
      </div>

      {apps.length === 0 ? (
        <Empty title="No applications yet" action={<a className="btn primary" href="#/new">New application</a>}>Each application keeps its posting, how you match, a tailored resume and cover letter, notes and interviews.</Empty>
      ) : view === 'board' ? (
        <div className="board">
          {STATUSES.map((st) => {
            const list = shown.filter((a) => a.status === st.id);
            return (
              <section
                key={st.id}
                className={`column ${over === st.id ? 'over' : ''}`}
                aria-label={st.label}
                onDragOver={(e) => { e.preventDefault(); setOver(st.id); }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = e.dataTransfer.getData('text/plain');
                  const app = apps.find((a) => a.id === id);
                  if (!app || app.status === st.id) return;
                  const before = app.status;
                  moveTo(id, st.id);
                  toast(`Moved to ${st.label}.`, 'info', { label: 'Undo', run: () => moveTo(id, before) });
                }}
              >
                <div className="column-head"><span>{st.label}</span><span className="muted">{list.length}</span></div>
                {list.map((a) => <Card key={a.id} app={a} />)}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th><button onClick={() => setSort('company')}>Role and company{sort === 'company' ? ' ↓' : ''}</button></th>
                <th>Stage</th>
                <th><button onClick={() => setSort('score')}>Match{sort === 'score' ? ' ↓' : ''}</button></th>
                <th><button onClick={() => setSort('updated')}>Updated{sort === 'updated' ? ' ↓' : ''}</button></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => {
                const score = matchScore(a.posting, a.matches);
                return (
                  <tr key={a.id}>
                    <td><a href={href({ page: 'application', id: a.id })}><b>{a.posting.title || 'Untitled role'}</b></a><div className="small muted">{a.posting.company}</div></td>
                    <td>
                      <select className="select" style={{ width: 150 }} value={a.status} onChange={(e) => moveTo(a.id, e.target.value as Status)} aria-label={`Stage of ${a.posting.title}`}>
                        {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </td>
                    <td>{score === null ? '–' : `${score}%`}</td>
                    <td className="muted">{fmt(a.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
