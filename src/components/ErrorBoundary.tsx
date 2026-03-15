import React, { Component, ErrorInfo, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  context?: Record<string, unknown>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  logged: boolean;
}

async function logErrorBoundaryError(
  error: Error,
  componentStack: string | null,
  context?: Record<string, unknown>
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('client_errors').insert({
      user_id: session?.user?.id ?? null,
      error_message: error.message || String(error),
      error_stack: error.stack ?? null,
      component_stack: componentStack ?? null,
      context: context ?? null,
      url: typeof window !== 'undefined' ? window.location.href : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch {
  }
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, logged: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);

    const isStaleChunk =
      error.message?.includes('MIME type') ||
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Importing a module script failed') ||
      (error as any)?.name === 'ChunkLoadError';

    if (isStaleChunk) {
      window.location.reload();
      return;
    }

    if (!this.state.logged) {
      this.setState({ logged: true });
      logErrorBoundaryError(error, info.componentStack ?? null, this.props.context);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, logged: false });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message;

    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <p
            className="text-5xl font-black text-red-500 mb-6"
            style={{ textShadow: '0 0 30px #ef4444', letterSpacing: '0.1em' }}
          >
            ROWDY
          </p>
          <div
            className="border-2 border-red-500/50 rounded-xl p-6 mb-6"
            style={{ boxShadow: '0 0 20px rgba(239,68,68,0.2)' }}
          >
            <p className="text-red-400 text-lg font-semibold mb-2">Something went wrong</p>
            {msg ? (
              <p className="text-red-300/90 text-sm font-mono break-all mb-2">{msg}</p>
            ) : null}
            <p className="text-red-300/50 text-xs mt-2">
              This error has been logged automatically.
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="px-8 py-3 bg-transparent border-2 border-red-500 text-red-400 hover:bg-red-500 hover:text-black font-semibold rounded-lg transition-all active:scale-95"
            style={{ textShadow: '0 0 8px rgba(239,68,68,0.5)', boxShadow: '0 0 15px rgba(239,68,68,0.3)' }}
          >
            Return to Menu
          </button>
        </div>
      </div>
    );
  }
}
