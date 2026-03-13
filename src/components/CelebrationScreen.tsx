import { useState, useEffect, useMemo } from 'react';
import {
  Search, Camera, Triangle, Users, Check,
  ArrowUpDown, Shuffle, CircleX, Layers, BookOpen,
  Gamepad2, Zap, ThumbsUp, Lightbulb, Star
} from 'lucide-react';
import { GameScore } from '../lib/scoringSystem';
import { playWin } from '../lib/sounds';
import { audioManager } from '../lib/audioManager';
import { ColorClashIcon } from './ColorClash';

const GAME_ICONS: Record<string, React.ReactNode> = {
  'odd-man-out': <CircleX className="w-full h-full" />,
  'photo-mystery': <Search className="w-full h-full" />,
  'rank-and-roll': <ArrowUpDown className="w-full h-full" />,
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

const ANIMATION_TIMINGS = {
  TILE_INTERVAL: 600,
  TILE_START: 0,
  NAME_START: 400,
  NAME_HIDE_OFFSET: 1200,
  BONUS_OFFSET: 2000,
  BONUS_DURATION: 2000,
  BONUS_DELAY: 500,
  CIRCLE_DELAY: 200,
  DIAL_INTERVAL: 15,
  DIAL_SPEED: 75,
  SOUND_VOLUME: 0.3,
} as const;

const COLORS = {
  cyan: '#00ffff',
  yellow: '#fbbf24',
  red: '#ef4444',
} as const;

const getTextShadow = (color: string, blur: string) => `0 0 ${blur} ${color}`;

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
  totalRounds?: number;
  levelName?: string;
}

export default function CelebrationScreen({
  roundScores,
  totalSessionScore,
  maxSessionScore,
  onPlayAgain,
  totalRounds,
  levelName,
}: CelebrationScreenProps) {
  const [visibleTiles, setVisibleTiles] = useState<number>(0);
  const [visibleScores, setVisibleScores] = useState<Set<number>>(new Set());
  const [currentNameIndex, setCurrentNameIndex] = useState<number>(-1);
  const [showMainCircle, setShowMainCircle] = useState(false);
  const [showTimeBonus, setShowTimeBonus] = useState(false);
  const [showPerfectBonus, setShowPerfectBonus] = useState(false);
  const [dialFill, setDialFill] = useState(0);

  const totalPercentage = useMemo(
    () => maxSessionScore > 0 ? (totalSessionScore / maxSessionScore) * 100 : 0,
    [totalSessionScore, maxSessionScore]
  );

  const timeBonus = useMemo(() => {
    return roundScores.reduce((sum, tile) => sum + (tile.score.timeBonus || 0), 0);
  }, [roundScores]);

  const perfectBonus = useMemo(() => {
    return roundScores.reduce((sum, tile) => sum + (tile.score.perfectScoreBonus || 0), 0);
  }, [roundScores]);

  const dialFillWithoutBonus = useMemo(() => {
    if (maxSessionScore <= 0) return totalPercentage;
    const totalBonusPercentage = ((timeBonus + perfectBonus) / maxSessionScore) * 100;
    return Math.max(0, totalPercentage - totalBonusPercentage);
  }, [totalPercentage, timeBonus, perfectBonus, maxSessionScore]);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    const intervals: NodeJS.Timeout[] = [];

    // Load celebration sounds on first mount
    (async () => {
      await audioManager.loadSound('tile-chink', '/sounds/global/SoundBlowClub.mp3', 3);
      await audioManager.loadSound('bonus-pizzaz', '/sounds/global/round-complete.mp3', 2);
    })();

    const hideAllNamesAt = roundScores.length * ANIMATION_TIMINGS.TILE_INTERVAL + ANIMATION_TIMINGS.NAME_HIDE_OFFSET;
    const bonusStartAt = roundScores.length * ANIMATION_TIMINGS.TILE_INTERVAL + ANIMATION_TIMINGS.BONUS_OFFSET;

    // Show main circle first
    timers.push(
      setTimeout(() => {
        setShowMainCircle(true);
      }, 100)
    );

    // Animate in tiles and scores, one name at a time
    for (let i = 0; i < roundScores.length; i++) {
      const delay = ANIMATION_TIMINGS.TILE_INTERVAL * i;

      timers.push(
        setTimeout(
          () => {
            setVisibleTiles(i + 1);
            audioManager.play('tile-chink', 0.4);
          },
          ANIMATION_TIMINGS.TILE_START + delay
        )
      );

      timers.push(
        setTimeout(
          () => {
            setVisibleScores((prev) => new Set([...prev, i]));
            setCurrentNameIndex(i);
          },
          ANIMATION_TIMINGS.NAME_START + delay
        )
      );

      timers.push(
        setTimeout(
          () => {
            setCurrentNameIndex(-1);
          },
          hideAllNamesAt
        )
      );

      // Fill dial proportionally as each tile's score appears
      timers.push(
        setTimeout(
          () => {
            const tilePercentage = (roundScores[i].score.normalizedScore / maxSessionScore) * 100;
            setDialFill((prev) => Math.min(prev + tilePercentage, dialFillWithoutBonus));
          },
          ANIMATION_TIMINGS.NAME_START + delay
        )
      );
    }

    // Bonus phase with explicit timing
    const totalBonus = timeBonus + perfectBonus;

    if (totalBonus > 10) {
      // Perfect bonus first if it exists
      if (perfectBonus > 10) {
        const perfectDuration = ANIMATION_TIMINGS.BONUS_DURATION;
        const perfectPercentage = (perfectBonus / maxSessionScore) * 100;

        timers.push(
          setTimeout(() => {
            setShowPerfectBonus(true);
            audioManager.play('bonus-pizzaz', 0.5);

            let fillInterval = setInterval(() => {
              setDialFill((prev) => {
                const increment = perfectPercentage / ANIMATION_TIMINGS.DIAL_SPEED;
                const next = Math.min(prev + increment, dialFillWithoutBonus + perfectPercentage);
                return next;
              });
            }, ANIMATION_TIMINGS.DIAL_INTERVAL);
            intervals.push(fillInterval);

            // Stop perfect bonus and hide it after duration
            timers.push(
              setTimeout(() => {
                clearInterval(fillInterval);
                setShowPerfectBonus(false);
              }, perfectDuration)
            );
          }, bonusStartAt)
        );

        // Show speed bonus after perfect bonus completes
        if (timeBonus > 10) {
          const speedStartAt = bonusStartAt + ANIMATION_TIMINGS.BONUS_DURATION + ANIMATION_TIMINGS.BONUS_DELAY;
          const speedPercentage = (timeBonus / maxSessionScore) * 100;
          const speedDuration = ANIMATION_TIMINGS.BONUS_DURATION;

          timers.push(
            setTimeout(() => {
              setShowTimeBonus(true);
              audioManager.play('bonus-pizzaz', 0.5);

              let fillInterval = setInterval(() => {
                setDialFill((prev) => {
                  const increment = speedPercentage / ANIMATION_TIMINGS.DIAL_SPEED;
                  const next = Math.min(prev + increment, totalPercentage);
                  return next;
                });
              }, ANIMATION_TIMINGS.DIAL_INTERVAL);
              intervals.push(fillInterval);

              // Stop speed bonus after duration
              timers.push(
                setTimeout(() => {
                  clearInterval(fillInterval);
                  setShowTimeBonus(false);
                }, speedDuration)
              );
            }, speedStartAt)
          );
        }
      } else if (timeBonus > 10) {
        // Only speed bonus
        const speedPercentage = (timeBonus / maxSessionScore) * 100;
        const speedDuration = ANIMATION_TIMINGS.BONUS_DURATION;

        timers.push(
          setTimeout(() => {
            setShowTimeBonus(true);
            audioManager.play('bonus-pizzaz', 0.5);

            let fillInterval = setInterval(() => {
              setDialFill((prev) => {
                const increment = speedPercentage / ANIMATION_TIMINGS.DIAL_SPEED;
                const next = Math.min(prev + increment, totalPercentage);
                return next;
              });
            }, ANIMATION_TIMINGS.DIAL_INTERVAL);
            intervals.push(fillInterval);

            timers.push(
              setTimeout(() => {
                clearInterval(fillInterval);
                setShowTimeBonus(false);
              }, speedDuration)
            );
          }, bonusStartAt)
        );
      }
    } else {
      // No bonus - play final sound
      timers.push(
        setTimeout(() => {
          playWin(ANIMATION_TIMINGS.SOUND_VOLUME);
        }, hideAllNamesAt + 500)
      );
    }


    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      intervals.forEach((interval) => clearInterval(interval));
    };
  }, [roundScores.length, totalPercentage, timeBonus, perfectBonus, dialFillWithoutBonus, maxSessionScore]);

  const dialRadius = 80;
  const circumference = 2 * Math.PI * dialRadius;
  const clampedDialFill = Math.min(dialFill, 100);
  const strokeDashoffset = circumference - (clampedDialFill / 100) * circumference;

  return (
    <div className="min-h-screen w-screen bg-black flex flex-col items-center justify-between p-4">
      {/* ROWDY BRANDING */}
      <div className="flex-shrink-0 pt-4 sm:pt-6">
        <p
          className="text-6xl sm:text-8xl font-black text-red-500 uppercase tracking-widest"
          style={{ textShadow: getTextShadow(COLORS.red, '40px') }}
        >
          ROWDY
        </p>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-col items-center gap-6 w-full flex-1">
        {levelName && (
          <div className="text-cyan-400 text-sm sm:text-base" style={{ textShadow: '0 0 8px #00ffff' }}>
            Level {levelName} Complete!
          </div>
        )}
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-cyan-400 uppercase tracking-wider animate-fade-in"
          style={{ textShadow: getTextShadow(COLORS.cyan, '20px') }}
        >
          Game Complete!
        </h1>

        {/* DIAL CIRCLE */}
        <div className={showMainCircle ? 'block' : 'hidden'}>
          <div className="relative w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center flex-shrink-0">
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ boxShadow: '0 0 60px rgba(0, 255, 255, 0.3)' }}
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
                  <stop offset="0%" style={{ stopColor: COLORS.cyan, stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: COLORS.yellow, stopOpacity: 1 }} />
                </linearGradient>
              </defs>
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                className="text-4xl sm:text-6xl font-bold text-yellow-400"
                style={{ textShadow: getTextShadow(COLORS.yellow, '20px') }}
              >
                {Math.round(totalSessionScore)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SCORE TILES AND BONUSES */}
      <div className="w-full flex-shrink-0">
        <div className="flex flex-col gap-3 mb-6">
          {showPerfectBonus && perfectBonus > 10 && (
            <div className="flex justify-center">
              <div
                className="text-2xl sm:text-3xl font-bold text-pink-400"
                style={{
                  textShadow: getTextShadow('#ec4899', '15px'),
                  letterSpacing: '0.05em',
                  animation: 'depositBonus 2s ease-in forwards',
                }}
              >
                +{Math.round(perfectBonus)} Perfect Scores
              </div>
            </div>
          )}
          {showTimeBonus && timeBonus > 10 && (
            <div className="flex justify-center">
              <div
                className="text-2xl sm:text-3xl font-bold text-yellow-400"
                style={{
                  textShadow: getTextShadow(COLORS.yellow, '15px'),
                  letterSpacing: '0.05em',
                  animation: 'depositBonus 2s ease-in forwards',
                }}
              >
                +{Math.round(timeBonus)} Speed Bonus
              </div>
            </div>
          )}
        </div>

        <div className="w-full grid grid-cols-5 gap-2">
          {roundScores.map((tile, index) => {
            const gameKey = tile.gameId.toLowerCase();
            const icon = GAME_ICONS[gameKey] || <Star className="w-full h-full" />;
            const isVisible = index < visibleTiles;
            const showScore = visibleScores.has(index);
            const showName = currentNameIndex === index;

            return (
              <div key={`${tile.gameId}-${index}`} className="relative">
                {isVisible && showName && (
                  <div
                    className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 z-20 transition-opacity duration-500"
                    style={{
                      opacity: 1,
                    }}
                  >
                    <div
                      className="text-xs sm:text-sm font-bold text-cyan-300 whitespace-nowrap"
                      style={{
                        textShadow: getTextShadow(COLORS.cyan, '8px'),
                        letterSpacing: '0.05em',
                      }}
                    >
                      {tile.gameName}
                    </div>
                  </div>
                )}

                <div
                  className={`transition-all duration-500 ${
                    isVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{
                    transform: isVisible ? 'translateX(0)' : 'translateX(-20px)',
                  }}
                >
                  <div
                    className="aspect-square bg-black rounded-lg border-2 border-cyan-400/50 p-2 sm:p-3 flex flex-col items-center justify-center relative overflow-hidden group hover:border-cyan-400/80 transition-all duration-300 touch-manipulation"
                    style={{
                      boxShadow: isVisible
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
                        className={`text-lg sm:text-xl font-bold text-yellow-400 transition-all duration-500 group-hover:scale-110 ${
                          showScore ? 'opacity-100' : 'opacity-0'
                        }`}
                        style={{ textShadow: getTextShadow(COLORS.yellow, '8px') }}
                      >
                        {Math.round(
                          tile.score.totalWithBonus || tile.score.normalizedScore
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ANIMATIONS */}
      <style>{`
        @keyframes depositBonus {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          70% {
            opacity: 1;
            transform: translateY(-120px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-150px) scale(0.8);
          }
        }
      `}</style>

      {/* ACTION BUTTON AND CONFIRMATION */}
      <div className="w-full flex flex-col items-center gap-3 pt-4 sm:pt-6 border-t border-cyan-400/30 flex-shrink-0">
        <button
          onClick={onPlayAgain}
          className="w-full py-3 sm:py-4 px-6 bg-transparent border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black font-bold rounded-lg text-base sm:text-lg transition-all active:scale-95 touch-manipulation uppercase tracking-wide"
          style={{
            textShadow: getTextShadow(COLORS.cyan, '15px'),
            boxShadow: '0 0 30px rgba(0, 255, 255, 0.3)',
          }}
        >
          Play Again
        </button>

        <div className="flex items-center gap-2 text-green-400 text-xs sm:text-sm">
          <Check
            className="w-4 h-4 sm:w-5 sm:h-5"
            style={{ filter: 'drop-shadow(0 0 8px #22c55e)' }}
          />
          <span>Progress Saved</span>
        </div>
      </div>
    </div>
  );
}