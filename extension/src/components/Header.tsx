import React from 'react';
import { RefreshCw, ExternalLink, Sun, Moon } from 'lucide-react';
import type { ConnectionStatus } from '../lib/api';

export const appVersion = (): string =>
  typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest().version : 'dev';

interface HeaderProps {
  status: ConnectionStatus;
  onRetry?: () => void;
  isSyncing: boolean;
  onSync: () => void;
  openOptions?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  /** First-run screens: only the theme switch. */
  minimal?: boolean;
}

export const StatusPill: React.FC<{ status: ConnectionStatus; onRetry?: () => void }> = ({ status, onRetry }) => (
  <span role="status" aria-live="polite" className="row text-xs muted" style={{ gap: 6 }}>
    <span className={`dot ${status === 'online' ? 'dot-live' : 'dot-warn'}`} aria-hidden="true" />
    {status === 'online' && <span>Live</span>}
    {status === 'connecting' && <span>Connecting… the server may be waking up</span>}
    {status === 'offline' && (
      <>
        <span>Offline</span>
        {onRetry && <button type="button" className="btn btn-outline btn-sm" style={{ height: 24, padding: '0 8px' }} onClick={onRetry}>Retry</button>}
      </>
    )}
  </span>
);

export const Header: React.FC<HeaderProps> = ({ status, onRetry, isSyncing, onSync, openOptions, theme, onToggleTheme, minimal }) => (
  <header className="topbar">
    <div className="row" style={{ gap: 10, minWidth: 0 }}>
      <div className="brand-mark" aria-hidden="true">J</div>
      <div style={{ minWidth: 0 }}>
        <h1>Jobly</h1>
        <StatusPill status={status} onRetry={onRetry} />
      </div>
    </div>
    <div className="row" style={{ gap: 2 }}>
      <button type="button" className="btn btn-ghost btn-icon" onClick={onToggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      {!minimal && <button type="button" className="btn btn-ghost btn-icon" onClick={onSync} disabled={isSyncing} title="Refresh jobs" aria-label="Refresh jobs">
        <RefreshCw size={16} className={isSyncing ? 'spin' : ''} />
      </button>}
      {!minimal && openOptions && (
        <button type="button" className="btn btn-ghost btn-icon" onClick={openOptions} title="Open full dashboard" aria-label="Open full dashboard">
          <ExternalLink size={16} />
        </button>
      )}
    </div>
  </header>
);
