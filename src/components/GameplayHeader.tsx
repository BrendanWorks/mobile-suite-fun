import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, MoveVertical as MoreVertical, SkipForward } from 'lucide-react';

interface GameplayHeaderProps {
  gameName: string;
  score: number;
  currentRound: number;
  totalRounds: number;
  onQuit: () => void;
  soundEnabled: boolean;
  onSoundToggle: (enabled: boolean) => void;
  debugMode?: boolean;
  onSkipRound?: () => void;
}

export default function GameplayHeader({
  gameName,
  score,
  currentRound,
  totalRounds,
  onQuit,
  soundEnabled,
  onSoundToggle,
  debugMode,
  onSkipRound,
}: GameplayHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const progressPct = Math.round(((currentRound - 1) / totalRounds) * 100);

  return (
    <div
      className="flex-shrink-0 bg-black border-b-2 border-cyan-500/40"
      style={{ boxShadow: '0 2px 15px rgba(0, 255, 255, 0.15)' }}
    >
      {/* Progress bar */}
      <div
        className="h-1 bg-cyan-500/20"
        role="progressbar"
        aria-valuenow={currentRound - 1}
        aria-valuemin={0}
        aria-valuemax={totalRounds}
      >
        <div
          className="h-full bg-cyan-400 transition-all duration-500"
          style={{
            width: `${progressPct}%`,
            boxShadow: '0 0 6px rgba(0, 255, 255, 0.6)',
          }}
        />
      </div>

      {/* Main header row */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2">
        {/* Left: Round info */}
        <div className="flex flex-col leading-tight min-w-0">
          <span
            className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-cyan-500/70"
          >
            Round {currentRound}/{totalRounds}
          </span>
          <span
            className="text-sm sm:text-base font-bold text-cyan-300 truncate"
            style={{ textShadow: '0 0 8px rgba(0, 255, 255, 0.5)' }}
          >
            {gameName}
          </span>
        </div>

        {/* Center: ROWDY branding */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <p
            className="text-xl sm:text-3xl font-black text-red-500"
            style={{ textShadow: '0 0 20px #ef4444', letterSpacing: '0.08em' }}
          >
            ROWDY
          </p>
        </div>

        {/* Right: Score + menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right leading-tight">
            <span
              className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-yellow-500/70"
            >
              Score
            </span>
            <p
              className="text-sm sm:text-base font-black text-yellow-400 tabular-nums"
              style={{ textShadow: '0 0 8px rgba(251, 191, 36, 0.6)' }}
            >
              {score.toLocaleString()}
            </p>
          </div>

          {/* Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(v => !v)}
              className="flex items-center justify-center w-8 h-8 rounded border-2 border-cyan-400/60 hover:border-cyan-400 text-cyan-400 transition-all active:scale-90 touch-manipulation"
              style={{ boxShadow: showMenu ? '0 0 10px rgba(0,255,255,0.4)' : undefined }}
              aria-label="Game menu"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div
                className="absolute right-0 mt-1.5 bg-black border-2 border-cyan-500 rounded-lg z-50 overflow-hidden min-w-[140px]"
                style={{ boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)' }}
              >
                {/* Sound toggle */}
                <button
                  onClick={() => onSoundToggle(!soundEnabled)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs sm:text-sm font-medium text-cyan-300 hover:bg-cyan-500/10 transition-colors whitespace-nowrap"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-cyan-400/50 flex-shrink-0" />
                  )}
                  Sound: {soundEnabled ? 'On' : 'Off'}
                </button>

                {debugMode && (
                  <button
                    onClick={() => {
                      onSkipRound?.();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-yellow-400 hover:bg-yellow-500/20 rounded flex items-center gap-2 transition-colors text-sm border-t border-yellow-500/30"
                  >
                    <SkipForward size={16} />
                    <span>Skip Round</span>
                  </button>
                )}

                <div className="border-t border-cyan-500/30" />

                {/* Quit */}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onQuit();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs sm:text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors whitespace-nowrap"
                >
                  <span className="text-red-400 text-base leading-none flex-shrink-0">✕</span>
                  Quit & Save
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
