import React from 'react';
import { RefreshCw, ExternalLink, Sun, Moon } from 'lucide-react';
import { RadarStats } from '../types';

interface HeaderProps {
  isOnline: boolean;
  isSyncing: boolean;
  stats: RadarStats | null;
  onSync: () => void;
  openOptions?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isOnline,
  isSyncing,
  stats,
  onSync,
  openOptions,
  theme,
  onToggleTheme,
}) => {
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
            className={`radar-ping ${isOnline ? '' : 'offline'}`}
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
            }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)'
            }}>
              Jobly
            </span>
            <span className="badge badge-accent" style={{ fontSize: 9, padding: '1px 5px' }}>
              v2.5
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 1 }}>
            {isOnline ? (
              <>
                <span className="status-dot" />
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>ENGINE LIVE</span>
                {stats && <span style={{ color: 'var(--text-secondary)' }}>· {stats.matched_jobs} MATCHES</span>}
              </>
            ) : (
              <>
                <span className="status-dot offline" />
                <span style={{ color: 'var(--amber-400)', fontWeight: 600 }}>OFFLINE CACHED</span>
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

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </header>
  );
};
