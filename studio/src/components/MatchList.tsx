import { useMemo } from 'react';
import { profileFacts } from '../lib/facts';
import type { Posting, Profile, RequirementMatch } from '../lib/types';
import { matchScore } from '../lib/workflows';

const LEVEL = { met: 'Met', partial: 'Partly', gap: 'Gap' } as const;

export function MatchList({ posting, matches, profile }: { posting: Posting; matches: RequirementMatch[]; profile: Profile }) {
  const facts = useMemo(() => new Map(profileFacts(profile).map((f) => [f.id, f])), [profile]);
  const score = matchScore(posting, matches);
  const gaps = matches.filter((m) => m.level === 'gap').length;
  return (
    <div className="stack">
      <div className="row" style={{ gap: 14 }}>
        {score !== null && <div className="score" style={{ ['--v' as string]: score }}><span>{score}%</span></div>}
        <div className="stack sm" style={{ flex: 1 }}>
          <b>{score === null ? 'No requirements found' : score >= 75 ? 'Strong match' : score >= 50 ? 'Worth applying' : 'A stretch'}</b>
          <span className="muted small">
            Required items count double. {gaps ? `${gaps} gap${gaps > 1 ? 's' : ''}: drafts leave ${gaps > 1 ? 'them' : 'it'} out rather than make ${gaps > 1 ? 'them' : 'it'} up.` : 'No gaps.'}
          </span>
        </div>
      </div>
      <div className="list">
        {posting.requirements.map((r) => {
          const m = matches.find((x) => x.requirementId === r.id);
          const level = m?.level ?? 'gap';
          return (
            <div className="list-item" key={r.id}>
              <span className={`badge ${level}`} style={{ width: 58, justifyContent: 'center' }}>{LEVEL[level]}</span>
              <div style={{ flex: 1 }}>
                <div>{r.text} {!r.must && <span className="muted small">(nice to have)</span>}</div>
                {m?.note && <div className="small muted">{m.note}</div>}
                {!!m?.sources.length && (
                  <div className="cite">
                    {m.sources.map((id) => facts.get(id)).filter(Boolean).map((f) => (
                      <span key={f!.id} title={f!.text}>{f!.text.length > 42 ? `${f!.text.slice(0, 40)}…` : f!.text}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
