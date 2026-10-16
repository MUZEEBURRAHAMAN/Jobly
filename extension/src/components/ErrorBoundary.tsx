import React from 'react';
import { EmptyState } from './EmptyState';

interface State { hasError: boolean }

// Keeps one broken component from blanking the whole page.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Jobly] UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <EmptyState
        art="error"
        role="alert"
        title="Something went wrong"
        description="This part of Jobly hit an unexpected problem. Reloading usually fixes it."
        actions={<button type="button" className="btn" onClick={() => window.location.reload()}>Reload</button>}
      />
    );
  }
}
