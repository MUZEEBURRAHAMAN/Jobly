import React from 'react';
import { Check, ExternalLink } from '../lib/icons';
import { AlertItem } from '../types';
import { EmptyState } from './EmptyState';
import { safeHttpUrl } from '../lib/url';
import { timeAgo } from '../lib/format';

interface AlertsViewProps {
  alerts: AlertItem[];
  onMarkAllRead: () => void;
  /** Alerts that were new when this visit opened the tab (already stored as read). */
  newIds?: Set<string>;
  large?: boolean;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ alerts, onMarkAllRead, newIds, large }) => {
  if (alerts.length === 0) {
    return <EmptyState art="alerts" large={large} title="No alerts yet" description="When a new job that matches your preferences is posted, it shows up here and as a desktop notification (if alerts are on). Alerts are checked in the background and stay on this device." />;
  }
  const unread = alerts.filter((n) => !n.is_read).length;
  const isNew = (n: AlertItem) => !n.is_read || !!newIds?.has(n.id);
  const fresh = alerts.filter(isNew).length;
  return (
    <div className="section">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><h2>Alerts</h2><p className="text-sm">{fresh > 0 ? `${fresh} new since your last visit` : 'All caught up'}</p></div>
        {unread > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={onMarkAllRead}><Check size={14} aria-hidden="true" /> Mark all read</button>}
      </div>
      <ul className={large ? 'cols' : 'stack'} style={{ listStyle: 'none', gap: 8 }}>
        {alerts.map((n) => {
          const url = safeHttpUrl(n.application_url);
          return (
            <li key={n.id} className="card row" style={{ padding: 12, gap: 12, borderColor: isNew(n) ? 'var(--brand)' : undefined }}>
              <div className="grow">
                <div className="font-medium break">{isNew(n) && <span className="badge badge-brand" style={{ marginRight: 8 }}>New</span>}{n.title}</div>
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
