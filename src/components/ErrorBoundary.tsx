import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  // @ts-ignore
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetLocal = () => {
    try {
      localStorage.removeItem('bb_v6');
      localStorage.removeItem('bb_formatted_wallet');
      localStorage.removeItem('bb_raw_wallet');
      localStorage.removeItem('bb_sync_id');
    } catch (e) {}
    window.location.reload();
  };

  render() {
    // @ts-ignore
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#060d22] flex items-center justify-center p-6 text-white text-center font-sans">
          <div className="bg-[#0b1026] border border-red-500/30 rounded-2xl p-6 max-w-[360px] space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-400 text-xl font-bold">
              ⚠️
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold font-mono uppercase text-[#00cfff]">Something went wrong</h2>
              <p className="text-slate-400 text-xs">
                The application encountered an error.
              </p>
            </div>
            {/* @ts-ignore */}
            {this.state.error?.message && (
              <div className="bg-black/40 border border-white/10 rounded-lg p-2.5 text-[10px] font-mono text-red-300 text-left overflow-x-auto max-h-24 no-scrollbar">
                {/* @ts-ignore */}
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl text-xs transition-all shadow-lg active:scale-95 cursor-pointer"
              >
                Reload Game
              </button>
              <button
                onClick={this.handleResetLocal}
                className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-xl text-[10.5px] transition-all cursor-pointer"
              >
                Reset Local Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}
