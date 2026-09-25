import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State { hasError: boolean; message: string }

// Q-1 FIX: React Error Boundary — prevents full white-screen crash on component errors
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; label?: string }, State> {
  constructor(props: { children: React.ReactNode; label?: string }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Hiring Radar] Boundary caught error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        padding: '32px 24px',
        textAlign: 'center',
        background: 'var(--bg-secondary)',
        border: '2px solid var(--accent)',
        boxShadow: '4px 4px 0 var(--accent)',
        margin: 16,
      }}>
        <AlertTriangle size={28} color="var(--accent)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: 'var(--text-primary)',
          margin: '0 0 6px',
        }}>
          {(this.props.label || 'VIEW').toUpperCase()} CRASHED
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px', fontFamily: 'var(--font-mono)' }}>
          {this.state.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={() => this.setState({ hasError: false, message: '' })}
          className="btn btn-secondary btn-sm"
          style={{ fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <RotateCcw size={12} />
          RETRY
        </button>
      </div>
    );
  }
}
