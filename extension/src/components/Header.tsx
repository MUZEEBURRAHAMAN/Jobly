import React from 'react';
import { RefreshCw, ExternalLink, Sun, Moon } from 'lucide-react';
import { RadarStats } from '../types';
import type { ConnectionStatus } from '../lib/api';

export const appVersion = (): string =>
  typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest().version : 'dev';

interface HeaderProps {
  status: ConnectionStatus;
  onRetry?: () => void;
  isSyncing: boolean;
  stats: RadarStats | null;
  onSync: () => void;
  openOptions?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onRetry,
  isSyncing,
  stats,
  onSync,
  openOptions,
  theme,
  onToggleTheme,
}) => {
  const isOnline = status === 'online';
  return (
    <header style={{
      padding: '12px 16px',
      background: 'var(--ds-nav-bg)',
      borderBottom: '1px solid var(--border-subtle)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      {/* Brand & Editorial Brutalist Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28,
          height: 28,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 800,
            fontSize: 10,
            color: 'var(--accent)',
            letterSpacing: '0.04em'
          }}>
            JB
          </span>
          <div
            className={`radar-ping ${status === 'online' ? '' : 'offline'}`}
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
            }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h1 style={{
              margin: 0,
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)'
            }}>
              Jobly
            </h1>
            <span className="badge badge-accent" style={{ fontSize: 10, padding: '1px 5px' }}>
              v{appVersion()}
            </span>
          </div>

          <div
            role="status"
            aria-live="polite"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 1 }}
          >
            {status === 'online' && (
              <>
                <span className="status-dot" />
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>ENGINE LIVE</span>
                {stats && <span style={{ color: 'var(--text-secondary)' }}>· {stats.matched_jobs} MATCHES</span>}
              </>
            )}
            {status === 'connecting' && (
              <>
                <span className="status-dot offline" />
                <span style={{ color: 'var(--amber-400)', fontWeight: 600 }}>CONNECTING · WAKING SERVER</span>
              </>
            )}
            {status === 'offline' && (
              <>
                <span className="status-dot offline" />
                <span style={{ color: 'var(--amber-400)', fontWeight: 600 }}>OFFLINE CACHED</span>
                {onRetry && (
                  <button type="button" onClick={onRetry} className="btn btn-secondary btn-sm" style={{ padding: '1px 6px', fontSize: 10 }}>
                    RETRY
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action controls with Zero-Radius Theme Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Dark/Light Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="btn-icon"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        {/* Sync ATS Boards & Refresh Feed */}
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          className="btn-icon"
          title={isSyncing ? 'Refreshing Radar...' : 'Refresh Radar & Sync ATS Boards'}
          aria-label="Refresh Radar & Sync ATS Boards"
          style={{ cursor: isSyncing ? 'not-allowed' : 'pointer' }}
        >
          <RefreshCw
            size={13}
            style={{
              animation: isSyncing ? 'spin 1s linear infinite' : 'none',
              transformOrigin: 'center',
            }}
          />
        </button>

        {/* Full Screen Dashboard */}
        {openOptions && (
          <button
            type="button"
            onClick={openOptions}
            className="btn-icon"
            title="Open Full Screen Dashboard"
            aria-label="Open Full Screen Dashboard"
          >
            <ExternalLink size={13} />
          </button>
        )}
      </div>

    </header>
  );
};
