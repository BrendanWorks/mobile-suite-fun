import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

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
            <p className="text-red-300/70 text-sm">
              An unexpected error occurred. Your progress may not have been saved.
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
