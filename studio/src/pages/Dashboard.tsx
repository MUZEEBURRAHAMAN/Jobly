import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Empty, Tabs } from '../components/ui';
import { profileStrength } from '../lib/facts';
import { funnel, nudges, weekly } from '../lib/insights';
import { href } from '../lib/router';
import { useStudio } from '../lib/store';
import { matchScore } from '../lib/workflows';

type Range = '30' | '90' | 'all';

export function Dashboard() {
  const apps = useStudio((s) => s.applications);
  const profile = useStudio((s) => s.profile);
  const [range, setRange] = useState<Range>('30');
  const f = useMemo(() => funnel(apps, range === 'all' ? null : Number(range)), [apps, range]);
  const weeks = useMemo(() => weekly(apps), [apps]);
  const next = useMemo(() => nudges(apps), [apps]);
  const strength = profileStrength(profile);
  const maxWeek = Math.max(1, ...weeks.map((w) => w.value));
  const active = apps.filter((a) => a.status !== 'closed' && a.status !== 'draft').length;
  const interviewRate = f[1].value ? Math.round((f[2].value / f[1].value) * 100) : 0;
  const first = profile.basics.name.split(' ')[0];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>{first ? `Hi ${first}` : 'Dashboard'}</h1>
          <p>Your job search at a glance.</p>
        </div>
        <a className="btn primary" href="#/new"><Icon name="plus" />New application</a>
      </div>

      {strength.score < 70 && (
        <div className="card tight row between">
          <div className="stack sm" style={{ flex: 1, minWidth: 220 }}>
            <b>Profile {strength.score}% ready for tailoring</b>
            <div className="meter" aria-hidden="true"><i style={{ width: `${strength.score}%` }} /></div>
            {strength.next && <span className="muted small">Next: {strength.next}</span>}
          </div>
          <a className="btn" href="#/profile">Open profile</a>
        </div>
      )}

      <div className="grid-4">
        <div className="card tight stat"><span className="muted small">In progress</span><b>{active}</b><span className="small muted">applied or interviewing</span></div>
        <div className="card tight stat"><span className="muted small">Applied</span><b>{f[1].value}</b><span className="small muted">{range === 'all' ? 'all time' : `last ${range} days`}</span></div>
        <div className="card tight stat"><span className="muted small">Interview rate</span><b>{interviewRate}%</b><span className="small muted">of applications sent</span></div>
        <div className="card tight stat"><span className="muted small">Offers</span><b>{f[3].value}</b><span className="small muted">{range === 'all' ? 'all time' : `last ${range} days`}</span></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Funnel</h2>
            <Tabs label="Time range" value={range} onChange={setRange} items={[{ id: '30', label: '30 days' }, { id: '90', label: '90 days' }, { id: 'all', label: 'All' }]} />
          </div>
          <div className="funnel">
            {f.map((s) => (
              <div className="funnel-row" key={s.label}>
                <span>{s.label}</span>
                <div className="funnel-bar" aria-hidden="true"><i style={{ width: `${f[0].value ? (s.value / f[0].value) * 100 : 0}%` }} /></div>
                <b style={{ textAlign: 'right' }}>{s.value}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Applications sent per week</h2></div>
          <div className="weeks" role="img" aria-label={`Applications sent per week: ${weeks.map((w) => `${w.label}: ${w.value}`).join(', ')}`}>
            {weeks.map((w) => (
              <div key={w.from} title={`Week of ${w.label}: ${w.value}`}>
                <small>{w.value || ''}</small>
                <i style={{ height: `${(w.value / maxWeek) * 96}px` }} />
                <small>{w.label}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Worth a look</h2></div>
        {next.length === 0 ? (
          apps.length === 0
            ? <Empty title="No applications yet" action={<a className="btn primary" href="#/new">Start your first one</a>}>Paste a job posting and Studio shows how you match, then writes a tailored resume and cover letter.</Empty>
            : <p className="muted">Nothing needs you right now. Interviews this week, follow-ups and waiting drafts show up here.</p>
        ) : (
          <div className="list">
            {next.map((n, i) => {
              const score = matchScore(n.app.posting, n.app.matches);
              return (
                <a key={i} className="list-item" href={href({ page: 'application', id: n.app.id })} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span className={`badge ${n.kind === 'interview' ? 'brand' : n.kind === 'follow-up' ? 'partial' : 'neutral'}`}>
                    {n.kind === 'interview' ? 'Interview' : n.kind === 'follow-up' ? 'Follow up' : 'Draft'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <b>{n.app.posting.title || 'Untitled role'}</b> <span className="muted">· {n.app.posting.company}</span>
                    <div className="small muted">{n.text}</div>
                  </div>
                  {score !== null && <span className="small muted">{score}% match</span>}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
