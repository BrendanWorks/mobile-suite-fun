import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2, VolumeX, MoveVertical as MoreVertical, SkipForward,
  Search, Camera, Triangle, Users, Check, ArrowUpDown, Shuffle,
  CircleX, Layers, BookOpen, Gamepad2, Zap, ThumbsUp, Brain,
  Target, Grid3x3, Eye,
} from 'lucide-react';

const GAME_ICONS: Record<string, React.ReactNode> = {
  'odd-man-out':     <CircleX className="w-full h-full" />,
  'photo-mystery':   <Search className="w-full h-full" />,
  'rank-and-roll':   <ArrowUpDown className="w-full h-full" />,
  'snapshot':        <Camera className="w-full h-full" />,
  'split-decision':  <Layers className="w-full h-full" />,
  'word-rescue':     <BookOpen className="w-full h-full" />,
  'shape-sequence':  <Triangle className="w-full h-full" />,
  'snake':           <Gamepad2 className="w-full h-full" />,
  'gravity-ball':    <Zap className="w-full h-full" />,
  'fake-out':        <Eye className="w-full h-full" />,
  'hive-mind':       <Users className="w-full h-full" />,
  'double-fake':     <Shuffle className="w-full h-full" />,
  'zen-gravity':     <Target className="w-full h-full" />,
  'superlative':     <ThumbsUp className="w-full h-full" />,
  'true-false':      <Check className="w-full h-full" />,
  'multiple-choice': <Brain className="w-full h-full" />,
  'tracer':          <Grid3x3 className="w-full h-full" />,
  'clutch':          <Target className="w-full h-full" />,
  'flashbang':       <Zap className="w-full h-full" />,
  'slope-rider':     <Zap className="w-full h-full" />,
  'neural-pulse':    <Brain className="w-full h-full" />,
  'color-clash':     <Layers className="w-full h-full" />,
  'recall':          <Eye className="w-full h-full" />,
};

interface GameplayHeaderProps {
  gameName: string;
  gameId?: string;
  score: number;
  currentRound: number;
  totalRounds: number;
  onQuit: () => void;
  soundEnabled: boolean;
  onSoundToggle: (enabled: boolean) => void;
  debugMode?: boolean;
  onSkipRound?: () => void;
}

function useIsLandscapeSmallPhone() {
  const [isLandscapeSmall, setIsLandscapeSmallPhone] = useState(() => {
    return window.innerHeight < 500 && window.innerWidth > window.innerHeight && window.innerWidth < 900;
  });

  useEffect(() => {
    const check = () => {
      setIsLandscapeSmallPhone(
        window.innerHeight < 500 && window.innerWidth > window.innerHeight && window.innerWidth < 900
      );
    };
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  return isLandscapeSmall;
}

export default function GameplayHeader({
  gameName,
  gameId,
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
  const isLandscapeSmall = useIsLandscapeSmallPhone();

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

  if (isLandscapeSmall) {
    return (
      <div
        className="flex-shrink-0 flex items-center gap-3 px-3 bg-black/95 border-b border-cyan-500/40"
        style={{ height: '28px', boxShadow: '0 1px 8px rgba(0,255,255,0.1)' }}
      >
        <div
          className="flex-1 h-1 rounded-full overflow-hidden"
          style={{ background: 'rgba(0,255,255,0.15)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: '#00ffff',
              boxShadow: '0 0 4px rgba(0,255,255,0.6)',
            }}
          />
        </div>
        <span
          className="text-[11px] font-black tabular-nums whitespace-nowrap"
          style={{ color: '#facc15', textShadow: '0 0 6px rgba(251,191,36,0.5)' }}
        >
          {score.toLocaleString()}
        </span>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(v => !v)}
            className="flex items-center justify-center w-5 h-5 rounded border border-cyan-400/50 text-cyan-400 transition-all active:scale-90 touch-manipulation"
            aria-label="Game menu"
          >
            <MoreVertical className="w-3 h-3" />
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 bg-black border-2 border-cyan-500 rounded-lg z-50 overflow-hidden min-w-[130px]"
              style={{ boxShadow: '0 0 20px rgba(0,255,255,0.3)' }}
            >
              <button
                onClick={() => onSoundToggle(!soundEnabled)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-500/10 transition-colors whitespace-nowrap"
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-cyan-400/50 flex-shrink-0" />
                )}
                Sound: {soundEnabled ? 'On' : 'Off'}
              </button>
              {debugMode && (
                <button
                  onClick={() => { onSkipRound?.(); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 text-yellow-400 hover:bg-yellow-500/20 flex items-center gap-2 transition-colors text-xs border-t border-yellow-500/30"
                >
                  <SkipForward size={14} />
                  Skip Round
                </button>
              )}
              <div className="border-t border-cyan-500/30" />
              <button
                onClick={() => { setShowMenu(false); onQuit(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors whitespace-nowrap"
              >
                <span className="text-red-400 text-sm leading-none flex-shrink-0">✕</span>
                Quit & Save
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

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
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-cyan-500/70">
            Round {currentRound}/{totalRounds}
          </span>
          <div className="flex items-center gap-1">
            {gameId && GAME_ICONS[gameId] && (
              <span
                className="flex-shrink-0 w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-500/60"
              >
                {GAME_ICONS[gameId]}
              </span>
            )}
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-cyan-700/60">
              {gameName}
            </span>
          </div>
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
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-gray-500">
              Level
            </span>
            <p
              className="text-sm sm:text-base font-black text-white tabular-nums"
              style={{ textShadow: '0 0 6px rgba(255,255,255,0.3)' }}
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
                    onClick={() => { onSkipRound?.(); setShowMenu(false); }}
                    className="w-full text-left px-3 py-2 text-yellow-400 hover:bg-yellow-500/20 rounded flex items-center gap-2 transition-colors text-sm border-t border-yellow-500/30"
                  >
                    <SkipForward size={16} />
                    <span>Skip Round</span>
                  </button>
                )}

                <div className="border-t border-cyan-500/30" />

                <button
                  onClick={() => { setShowMenu(false); onQuit(); }}
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
