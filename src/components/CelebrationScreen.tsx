import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Camera, Triangle, Users, Check,
  ChartBar, Shuffle, CircleX, Layers, BookOpen,
  Gamepad2, Zap, ThumbsUp, Lightbulb, Star
} from 'lucide-react';
import { GameScore } from '../lib/scoringSystem';
import { playWin } from '../lib/sounds';
import { ColorClashIcon } from './ColorClash';

const GAME_ICONS: Record<string, React.ReactNode> = {
  'odd-man-out': <CircleX className="w-full h-full" />,
  'photo-mystery': <Search className="w-full h-full" />,
  'rank-and-roll': <ChartBar className="w-full h-full" />,
  'snapshot': <Camera className="w-full h-full" />,
  'snap-shot': <Camera className="w-full h-full" />,
  'split-decision': <Layers className="w-full h-full" />,
  'word-rescue': <BookOpen className="w-full h-full" />,
  'shape-sequence': <Triangle className="w-full h-full" />,
  'snake': <Gamepad2 className="w-full h-full" />,
  'gravity-ball': <Zap className="w-full h-full" />,
  'up-yours': <Zap className="w-full h-full" />,
  'fake-out': <CircleX className="w-full h-full" />,
  'hive-mind': <Users className="w-full h-full" />,
  'zen-gravity': <Shuffle className="w-full h-full" />,
  'superlative': <ThumbsUp className="w-full h-full" />,
  'true-false': <Shuffle className="w-full h-full" />,
  'multiple-choice': <Check className="w-full h-full" />,
  'tracer': <Zap className="w-full h-full" />,
  'clutch': <Gamepad2 className="w-full h-full" />,
  'flashbang': <Zap className="w-full h-full" />,
  'double-fake': <Shuffle className="w-full h-full" />,
  'color-clash': <ColorClashIcon size={32} />,
  'recall': <Lightbulb className="w-full h-full" />,
};

// Timing constants extracted for reusability and DRY
const ANIMATION_TIMINGS = {
  TILE_INTERVAL: 350,
  TILE_START: 0,
  NAME_START: 400,
  NAME_HIDE_OFFSET: 1200,
  BONUS_OFFSET: 2000,
  BONUS_DELAY: 500,
  CIRCLE_DELAY: 200,
  DIAL_INTERVAL: 15,
  DIAL_SPEED: 75,
  SOUND_VOLUME: 0.3,
} as const;

const TEXT_SHADOWS = {
  glow: (color: string, blur: string) => `0 0 ${blur} ${color}`,
  bright: '0 0 20px #00ffff',
  score: '0 0 8px #fbbf24',
  timer: '0 0 15px #fbbf24',
} as const;

const NEON_COLORS = {
  cyan: '#00ffff',
  yellow: '#fbbf24',
  red: '#ef4444',
} as const;

interface ScoreTile {
  gameId: string;
  gameName: string;
  score: GameScore;
}

interface CelebrationScreenProps {
  roundScores: ScoreTile[];
  totalSessionScore: number;
  maxSessionScore: number;
  onPlayAgain: () => void;
}

export default function CelebrationScreen({
  roundScores,
  totalSessionScore,
  maxSessionScore,
  onPlayAgain,
}: CelebrationScreenProps) {
  const [visibleTiles, setVisibleTiles] = useState<number>(0);
  const [visibleNames, setVisibleNames] = useState<Set<number>>(new Set());
  const [showMainCircle, setShowMainCircle] = useState(false);
  const [showTimeBonus, setShowTimeBonus] = useState(false);
  const [dialFill, setDialFill] = useState(0);

  const hasRun = useRef(false);

  const totalPercentage = useMemo(
    () => maxSessionScore > 0 ? (totalSessionScore / maxSessionScore) * 100 : 0,
    [totalSessionScore, maxSessionScore]
  );

  const timeBonus = useMemo(() => {
    return roundScores.reduce((sum, tile) => sum + (tile.score.timeBonus || 0), 0);
  }, [roundScores]);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const timers: NodeJS.Timeout[] = [];
    let fillInterval: NodeJS.Timeout | null = null;

    const tileDelayBase = ANIMATION_TIMINGS.TILE_START;
    const nameDelayBase = ANIMATION_TIMINGS.NAME_START;
    const hideAllNamesAt = roundScores.length * ANIMATION_TIMINGS.TILE_INTERVAL + ANIMATION_TIMINGS.NAME_HIDE_OFFSET;
    const circleStartAt = hideAllNamesAt;
    const bonusStartAt = roundScores.length * ANIMATION_TIMINGS.TILE_INTERVAL + ANIMATION_TIMINGS.BONUS_OFFSET;

    // Animate in tiles and names
    for (let i = 0; i < roundScores.length; i++) {
      const delay = ANIMATION_TIMINGS.TILE_INTERVAL * i;

      timers.push(
        setTimeout(() => setVisibleTiles(i + 1), tileDelayBase + delay)
      );

      timers.push(
        setTimeout(
          () => setVisibleNames((prev) => new Set([...prev, i])),
          nameDelayBase + delay
        )
      );

      timers.push(
        setTimeout(
          () => setVisibleNames((prev) => {
            const next = new Set(prev);
            next.delete(i);
            return next;
          }),
          hideAllNamesAt
        )
      );
    }

    // Show main circle
    timers.push(
      setTimeout(() => setShowMainCircle(true), circleStartAt)
    );

    // Show time bonus if earned
    if (timeBonus > 10) {
      timers.push(
        setTimeout(() => {
          setShowTimeBonus(true);
          playWin(ANIMATION_TIMINGS.SOUND_VOLUME);
        }, bonusStartAt)
      );
    }

    // Animate dial fill
    const dialStartAt = timeBonus > 10
      ? bonusStartAt + ANIMATION_TIMINGS.BONUS_DELAY
      : circleStartAt + ANIMATION_TIMINGS.CIRCLE_DELAY;

    timers.push(
      setTimeout(() => {
        let soundPlayed = false;
        fillInterval = setInterval(() => {
          setDialFill((prev) => {
            const increment = totalPercentage / ANIMATION_TIMINGS.DIAL_SPEED;
            const next = Math.min(prev + increment, totalPercentage);

            if (next >= totalPercentage && !soundPlayed) {
              playWin(ANIMATION_TIMINGS.SOUND_VOLUME);
              soundPlayed = true;
            }

            if (next >= totalPercentage && fillInterval) {
              clearInterval(fillInterval);
              fillInterval = null;
              setShowTimeBonus(false);
            }

            return next;
          });
        }, ANIMATION_TIMINGS.DIAL_INTERVAL);
      }, dialStartAt)
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      if (fillInterval) clearInterval(fillInterval);
    };
  }, [roundScores.length, totalPercentage, timeBonus]);

  const dialRadius = 80;
  const circumference = 2 * Math.PI * dialRadius;
  const strokeDashoffset = circumference - (dialFill / 100) * circumference;

  return (
    <div className="min-h-screen w-screen bg-black flex flex-col items-center justify-between p-4">
      {/* ROWDY BRANDING - TOP */}
      <div className="flex-shrink-0 pt-4 sm:pt-6">
        <p
          className="text-6xl sm:text-8xl font-black text-red-500 uppercase tracking-widest"
          style={{ textShadow: TEXT_SHADOWS.glow(NEON_COLORS.red, '40px') }}
        >
          ROWDY
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 w-full flex-1">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-cyan-400 uppercase tracking-wider animate-fade-in"
          style={{ textShadow: TEXT_SHADOWS.bright }}
        >
          Game Complete!
        </h1>

        <div className={`transition-all duration-500 ${showMainCircle ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          <div className="relative w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center flex-shrink-0">
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ boxShadow: `0 0 60px rgba(0, 255, 255, 0.3)` }}
            />
            <svg className="w-full h-full" viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                r={dialRadius}
                fill="none"
                stroke="rgba(0, 255, 255, 0.1)"
                strokeWidth="12"
              />
              <circle
                cx="100"
                cy="100"
                r={dialRadius}
                fill="none"
                stroke="url(#dialGradient)"
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dashoffset 1500ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  transform: 'rotate(-90deg)',
                  transformOrigin: '100px 100px',
                }}
              />
              <defs>
                <linearGradient id="dialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: NEON_COLORS.cyan, stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: NEON_COLORS.yellow, stopOpacity: 1 }} />
                </linearGradient>
              </defs>
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                className="text-4xl sm:text-6xl font-bold text-yellow-400"
                style={{ textShadow: TEXT_SHADOWS.timer }}
              >
                {Math.round(totalSessionScore)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full flex-shrink-0">
        {showTimeBonus && timeBonus > 10 && (
          <div className="flex justify-center mb-6">
            <div
              className="text-2xl sm:text-3xl font-bold text-yellow-400 transition-opacity duration-1500"
              style={{
                textShadow: TEXT_SHADOWS.timer,
                letterSpacing: '0.05em',
                opacity: showTimeBonus ? 1 : 0,
              }}
            >
              +{Math.round(timeBonus)} Time Bonus
            </div>
          </div>
        )}
        <div className="w-full grid grid-cols-5 gap-2">
          {roundScores.map((tile, index) => {
            const gameKey = tile.gameId.toLowerCase();
            const icon = GAME_ICONS[gameKey] || <Star className="w-full h-full" />;
            const showName = visibleNames.has(index);

            return (
              <div key={`${tile.gameId}-${index}`} className="relative">
                <div
                  className={`transition-all duration-500 ${index < visibleTiles ? 'opacity-100' : 'opacity-0'}`}
                  style={{
                    transform: index < visibleTiles ? 'translateX(0)' : 'translateX(-20px)',
                  }}
                >
                  <div
                    className="aspect-square bg-black rounded-lg border-2 border-cyan-400/50 p-2 sm:p-3 flex flex-col items-center justify-center relative overflow-hidden group hover:border-cyan-400/80 transition-all duration-300 touch-manipulation"
                    style={{
                      boxShadow: index < visibleTiles
                        ? '0 0 20px rgba(0, 255, 255, 0.3), inset 0 0 12px rgba(0, 255, 255, 0.1)'
                        : 'none',
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 to-yellow-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ boxShadow: 'inset 0 0 15px rgba(0, 255, 255, 0.15)' }}
                    />

                    <div className="relative z-10 flex flex-col items-center justify-center h-full w-full gap-1 text-center">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400 flex-shrink-0">
                        {icon}
                      </div>
                      <div
                        className="text-lg sm:text-xl font-bold text-yellow-400 transition-transform duration-300 group-hover:scale-110"
                        style={{ textShadow: TEXT_SHADOWS.score }}
                      >
                        {Math.round(tile.score.totalWithBonus || tile.score.normalizedScore)}
                      </div>
                    </div>
                  </div>
                </div>

                {showName && (
                  <div
                    className="absolute z-20"
                    style={{
                      animation: 'arcFloat 2s ease-in-out forwards',
                      left: '50%',
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <div
                      className="text-sm sm:text-base font-bold text-cyan-300 whitespace-nowrap"
                      style={{ textShadow: TEXT_SHADOWS.glow(NEON_COLORS.cyan, '10px'), letterSpacing: '0.05em' }}
                    >
                      {tile.gameName}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes arcFloat {
          0% {
            opacity: 0;
            top: -60px;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            top: -80px;
          }
        }
      `}</style>

      <div className="w-full flex flex-col items-center gap-3 pt-4 sm:pt-6 border-t border-cyan-400/30 flex-shrink-0">
        <button
          onClick={onPlayAgain}
          className="w-full py-3 sm:py-4 px-6 bg-transparent border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black font-bold rounded-lg text-base sm:text-lg transition-all active:scale-95 touch-manipulation uppercase tracking-wide"
          style={{
            textShadow: TEXT_SHADOWS.glow(NEON_COLORS.cyan, '15px'),
            boxShadow: `0 0 30px rgba(0, 255, 255, 0.3)`,
          }}
        >
          Play Again
        </button>

        <div className="flex items-center gap-2 text-green-400 text-xs sm:text-sm">
          <Check className="w-4 h-4 sm:w-5 sm:h-5" style={{ filter: 'drop-shadow(0 0 8px #22c55e)' }} />
          <span>Progress Saved</span>
        </div>
      </div>
    </div>
  );
}