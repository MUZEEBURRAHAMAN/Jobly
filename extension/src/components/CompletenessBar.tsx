import React from 'react';
import { Completeness, nextToAdd } from '../lib/completeness';

/** "Profile 64% complete" with a bar and what to add next. */
export const CompletenessBar: React.FC<{ completeness: Completeness; compact?: boolean; action?: React.ReactNode }> = ({ completeness, compact, action }) => {
  const { percent } = completeness;
  const id = React.useId();
  return (
    <div className={`completeness${compact ? ' compact' : ''}`}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <span className="text-sm font-medium" id={id}>Profile {percent}% complete</span>
        {action}
      </div>
      <div className="meter" role="progressbar" aria-labelledby={id} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span style={{ width: `${percent}%` }} />
      </div>
      {!compact && <p className="text-xs muted">{nextToAdd(completeness)}</p>}
    </div>
  );
};
