import React from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { NotificationItem } from '../types';
import { EmptyState } from './EmptyState';
import { safeHttpUrl } from '../lib/url';
import { timeAgo } from '../lib/format';

interface AlertsViewProps {
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  large?: boolean;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ notifications, onMarkAllRead, large }) => {
  if (notifications.length === 0) {
    return <EmptyState art="alerts" large={large} title="No alerts yet" description="When a new job matches your preferences, it shows up here and as a desktop notification (if alerts are on)." />;
  }
  const unread = notifications.filter((n) => !n.is_read).length;
  return (
    <div className="section">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><h2>Alerts</h2><p className="text-sm">{unread > 0 ? `${unread} new` : 'All caught up'}</p></div>
        {unread > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={onMarkAllRead}><Check size={14} aria-hidden="true" /> Mark all read</button>}
      </div>
      <ul className="stack" style={{ listStyle: 'none', gap: 8 }}>
        {notifications.map((n) => {
          const url = safeHttpUrl(n.application_url);
          return (
            <li key={n.id} className="card row" style={{ padding: 12, gap: 12, borderColor: n.is_read ? undefined : 'var(--brand)' }}>
              <div className="grow">
                <div className="font-medium break">{n.title}</div>
                <div className="text-xs muted">{n.company_name}{n.location ? ` · ${n.location}` : ''} · {timeAgo(n.sent_at)}</div>
              </div>
              {url && <a className="btn btn-outline btn-sm" href={url} target="_blank" rel="noopener noreferrer" aria-label={`View ${n.title} at ${n.company_name}`}>View <ExternalLink size={14} aria-hidden="true" /></a>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
