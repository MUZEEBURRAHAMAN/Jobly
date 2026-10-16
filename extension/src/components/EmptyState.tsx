import React from 'react';
import { Cabinet, Drawer, Lockers, Loupe, Plug, Router, Sieve, Slow, Stack } from '@lucasmarkes/hairline/react';

// One illustration per situation, so people can tell at a glance what is going on.
const ART = {
  offline: Plug,        // can't reach the server
  error: Stack,         // the server answered with an error
  search: Loupe,        // a search matched nothing
  filters: Sieve,       // filters excluded everything
  nomatch: Cabinet,     // nothing fits the preferences
  saved: Drawer,        // nothing saved yet
  gathering: Slow,      // first-time data load
  companies: Lockers,   // no companies found
  alerts: Router,       // no alerts yet
} as const;

export type ArtName = keyof typeof ART;

interface EmptyStateProps {
  art: ArtName;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  large?: boolean;
  /** Animate on its own (for "something is happening" states). */
  play?: boolean;
  /** Use "alert" for errors so screen readers announce them. */
  role?: 'status' | 'alert';
}

export const EmptyState: React.FC<EmptyStateProps> = ({ art, title, description, actions, large, play, role = 'status' }) => {
  const Art = ART[art];
  return (
    <div className="empty" role={role}>
      {/* decorative: the title and description carry the meaning */}
      <div className={`empty-art${large ? ' large' : ''}`} aria-hidden="true">
        <Art intensity={0.6} play={play} />
      </div>
      <h2 className="empty-title">{title}</h2>
      {description && <p className="empty-desc">{description}</p>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
};
