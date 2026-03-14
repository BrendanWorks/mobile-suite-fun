import React, { useState, useEffect } from 'react';
import { Play, LogIn, Coffee } from 'lucide-react';
import TipJar from './TipJar';

interface LandingPageProps {
  onPlayNow: () => void;
  onSignIn: () => void;
  onDebugMode: () => void;
}

const LETTERS = ['R', 'O', 'W', 'D', 'Y'];
const LETTER_STAGGER_MS = 80;
const LETTERS_DONE_AT = LETTERS.length * LETTER_STAGGER_MS + 200;

export default function LandingPage({ onPlayNow, onSignIn, onDebugMode }: LandingPageProps) {
  const [visibleLetters, setVisibleLetters] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);
  const [showTipJar, setShowTipJar] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < LETTERS.length; i++) {
      timers.push(
        setTimeout(() => setVisibleLetters(i + 1), i * LETTER_STAGGER_MS + 120)
      );
    }

    timers.push(setTimeout(() => setPulseActive(true), LETTERS_DONE_AT + 400));

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <>
    {showTipJar && <TipJar onClose={() => setShowTipJar(false)} />}
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-radial from-red-900/20 via-black to-black" />

      <div className="relative z-10 text-center max-w-2xl w-full">
        <div className="mb-8">

          {/* ROWDY title with letter-by-letter reveal + subtle breathing pulse */}
          <div className="inline-flex items-center justify-center mb-4 relative">
            {/* background glow disc that fades in after animation completes */}
            <div
              style={{
                position: 'absolute',
                inset: '-40px -60px',
                borderRadius: '50%',
                background: 'radial-gradient(ellipse at center, rgba(239,68,68,0.28) 0%, rgba(239,68,68,0.10) 40%, transparent 72%)',
                opacity: pulseActive ? 1 : 0,
                transition: 'opacity 1200ms ease',
                pointerEvents: 'none',
                animation: pulseActive ? 'rowdyGlowPulse 4s ease-in-out infinite' : 'none',
              }}
            />
            <h1
              className="text-7xl sm:text-9xl font-black tracking-wider relative"
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              {LETTERS.map((letter, i) => (
                <span
                  key={letter + i}
                  style={{
                    display: 'inline-block',
                    color: '#ef4444',
                    opacity: visibleLetters > i ? 1 : 0,
                    transform: visibleLetters > i ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.85)',
                    transition: 'opacity 320ms cubic-bezier(0.22,1,0.36,1), transform 380ms cubic-bezier(0.22,1,0.36,1)',
                    textShadow: pulseActive
                      ? undefined
                      : visibleLetters > i
                        ? '0 0 30px rgba(239,68,68,0.5), 0 0 60px rgba(239,68,68,0.2)'
                        : 'none',
                    animation: pulseActive ? `rowdyTextPulse 4s ease-in-out infinite ${i * 80}ms` : 'none',
                  }}
                >
                  {letter}
                </span>
              ))}
            </h1>
          </div>

          <p
            className="text-2xl sm:text-3xl text-red-400 font-bold tracking-wide"
            style={{
              textShadow: '0 0 15px rgba(239, 68, 68, 0.6)',
              opacity: visibleLetters >= LETTERS.length ? 1 : 0,
              transform: visibleLetters >= LETTERS.length ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 500ms ease 200ms, transform 500ms ease 200ms',
            }}
          >
            Rated "R" for a reason
          </p>
        </div>

        <div
          className="space-y-4 mb-12"
          style={{
            opacity: visibleLetters >= LETTERS.length ? 1 : 0,
            transform: visibleLetters >= LETTERS.length ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 500ms ease 400ms, transform 500ms ease 400ms',
          }}
        >
          <button
            onClick={onPlayNow}
            className="w-full max-w-md mx-auto flex items-center justify-center gap-3 px-8 py-5 bg-red-600 text-white font-bold text-xl rounded-xl active:scale-[0.97] touch-manipulation shadow-lg landing-play-btn"
            style={{ boxShadow: '0 0 30px rgba(239, 68, 68, 0.5)', transition: 'transform 300ms ease, background-color 300ms ease, box-shadow 300ms ease' }}
          >
            <Play className="w-6 h-6" fill="currentColor" />
            Play Now
          </button>

          <div className="text-center">
            <button
              onClick={onSignIn}
              className="inline-flex flex-col items-center gap-1 px-8 py-4 bg-transparent border-2 border-red-500/50 text-red-400 font-semibold text-lg rounded-xl active:scale-[0.98] touch-manipulation landing-signin-btn"
              style={{ textShadow: '0 0 10px rgba(239, 68, 68, 0.4)', transition: 'transform 300ms ease, border-color 300ms ease, color 300ms ease, box-shadow 300ms ease' }}
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

      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3">
        <button
          onClick={onDebugMode}
          className="px-6 py-3 bg-transparent border-2 border-yellow-400/50 hover:border-yellow-400 text-yellow-400 font-semibold rounded-lg transition-all active:scale-95 text-sm touch-manipulation"
          style={{ textShadow: '0 0 8px rgba(251, 191, 36, 0.4)', boxShadow: '0 0 10px rgba(251, 191, 36, 0.2)' }}
        >
          Debug Mode
        </button>
        <button
          onClick={() => setShowTipJar(true)}
          className="flex items-center gap-1.5 px-4 py-3 bg-transparent border-2 border-red-500/30 hover:border-red-500/60 text-red-400/60 hover:text-red-400 font-semibold rounded-lg transition-all active:scale-95 text-sm touch-manipulation"
          style={{ boxShadow: '0 0 8px rgba(239,68,68,0.1)' }}
        >
          <Coffee className="w-4 h-4" />
          Buy a coffee
        </button>
      </div>

      <style>{`
        @keyframes rowdyTextPulse {
          0%, 100% { text-shadow: 0 0 24px rgba(239,68,68,0.65), 0 0 50px rgba(239,68,68,0.28), 0 0 80px rgba(239,68,68,0.10); }
          50%       { text-shadow: 0 0 14px rgba(239,68,68,0.40), 0 0 30px rgba(239,68,68,0.16), 0 0 55px rgba(239,68,68,0.06); }
        }
        @keyframes rowdyGlowPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.55; }
        }
        .landing-play-btn:hover {
          background-color: #ef4444;
          box-shadow: 0 0 50px rgba(239,68,68,0.75), 0 0 90px rgba(239,68,68,0.3) !important;
          transform: scale(1.03);
        }
        .landing-signin-btn:hover {
          border-color: rgba(239,68,68,0.8);
          color: #fca5a5;
          box-shadow: 0 0 18px rgba(239,68,68,0.2);
          transform: scale(1.02);
        }
      `}</style>
    </div>
    </>
  );
}
