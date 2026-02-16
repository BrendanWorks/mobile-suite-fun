import React from 'react';
import { Play, LogIn } from 'lucide-react';

interface LandingPageProps {
  onPlayNow: () => void;
  onSignIn: () => void;
  onDebugMode: () => void;
}

export default function LandingPage({ onPlayNow, onSignIn, onDebugMode }: LandingPageProps) {
  return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-radial from-red-900/20 via-black to-black"></div>

      <div className="relative z-10 text-center max-w-2xl w-full">
        <div className="mb-8">
          <h1
            className="text-7xl sm:text-9xl font-black text-red-500 mb-4 tracking-wider"
            style={{
              textShadow: '0 0 30px rgba(239, 68, 68, 0.8), 0 0 60px rgba(239, 68, 68, 0.4)',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            ROWDY
          </h1>
          <p
            className="text-2xl sm:text-3xl text-red-400 font-bold tracking-wide"
            style={{ textShadow: '0 0 15px rgba(239, 68, 68, 0.6)' }}
          >
            Rated "R" for a reason
          </p>
        </div>

        <div className="space-y-4 mb-12">
          <button
            onClick={onPlayNow}
            className="w-full max-w-md mx-auto flex items-center justify-center gap-3 px-8 py-5 bg-red-600 hover:bg-red-500 text-white font-bold text-xl rounded-xl transition-all active:scale-[0.98] touch-manipulation shadow-lg"
            style={{ boxShadow: '0 0 30px rgba(239, 68, 68, 0.5)' }}
          >
            <Play className="w-6 h-6" fill="currentColor" />
            Play Now
          </button>

          <div className="text-center">
            <button
              onClick={onSignIn}
              className="inline-flex flex-col items-center gap-1 px-8 py-4 bg-transparent border-2 border-red-500/50 hover:border-red-500 text-red-400 hover:text-red-300 font-semibold text-lg rounded-xl transition-all active:scale-[0.98] touch-manipulation"
              style={{ textShadow: '0 0 10px rgba(239, 68, 68, 0.4)' }}
            >
              <span className="flex items-center gap-2">
                <LogIn className="w-5 h-5" />
                Sign In
              </span>
              <span className="text-sm text-red-500/70">
                (to see less of the same crap)
              </span>
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={onDebugMode}
        className="absolute bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-transparent border-2 border-yellow-400/50 hover:border-yellow-400 text-yellow-400 font-semibold rounded-lg transition-all active:scale-95 text-sm touch-manipulation"
        style={{ textShadow: '0 0 8px rgba(251, 191, 36, 0.4)', boxShadow: '0 0 10px rgba(251, 191, 36, 0.2)' }}
      >
        Debug Mode
      </button>
    </div>
  );
}
