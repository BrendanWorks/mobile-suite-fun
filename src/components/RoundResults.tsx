import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Trophy, ChevronRight, Search, Camera, Triangle, Users, Check, ArrowUpDown, Shuffle, CircleX, Layers, BookOpen, Gamepad2, Zap, ThumbsUp } from 'lucide-react';
import { GameScore, getScoreLabel } from '../lib/scoringSystem';
import { useCountUp } from '../hooks/useCountUp';
import ReactGA from 'react-ga4';

const GAME_ICONS: Record<string, React.ReactNode> = {
  'odd-man-out': <CircleX className="w-6 h-6 sm:w-7 sm:h-7" />,
  'photo-mystery': <Search className="w-6 h-6 sm:w-7 sm:h-7" />,
  'rank-and-roll': <ArrowUpDown className="w-6 h-6 sm:w-7 sm:h-7" />,
  'snapshot': <Camera className="w-6 h-6 sm:w-7 sm:h-7" />,
  'split-decision': <Layers className="w-6 h-6 sm:w-7 sm:h-7" />,
  'word-rescue': <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" />,
  'shape-sequence': <Triangle className="w-6 h-6 sm:w-7 sm:h-7" />,
  'snake': <Gamepad2 className="w-6 h-6 sm:w-7 sm:h-7" />,
  'gravity-ball': <Zap className="w-6 h-6 sm:w-7 sm:h-7" />,
  'fake-out': <CircleX className="w-6 h-6 sm:w-7 sm:h-7" />,
  'hive-mind': <Users className="w-6 h-6 sm:w-7 sm:h-7" />,
  'zen-gravity': <Shuffle className="w-6 h-6 sm:w-7 sm:h-7" />,
  'superlative': <ThumbsUp className="w-6 h-6 sm:w-7 sm:h-7" />,
  'true-false': <Shuffle className="w-6 h-6 sm:w-7 sm:h-7" />,
  'multiple-choice': <Check className="w-6 h-6 sm:w-7 sm:h-7" />,
  'tracer': <Zap className="w-6 h-6 sm:w-7 sm:h-7" />,
  'clutch': <Gamepad2 className="w-6 h-6 sm:w-7 sm:h-7" />,
  'flashbang': <Zap className="w-6 h-6 sm:w-7 sm:h-7" />,
  'double-fake': <Shuffle className="w-6 h-6 sm:w-7 sm:h-7" />,
};

interface RoundResultsProps {
  roundNumber: number;
  gameName: string;
  gameScore: GameScore;
  gameId?: string;
  allRoundScores: Array<{ gameId: string; gameName: string; score: GameScore }>;
  totalSessionScore: number;
  maxSessionScore: number;
  onContinue: () => void;
  isLastRound: boolean;
}

export default function RoundResults({
  roundNumber,
  gameName,
  gameScore,
  gameId,
  allRoundScores,
  totalSessionScore,
  maxSessionScore,
  onContinue,
  isLastRound
}: RoundResultsProps) {
  const [showContent, setShowContent] = useState(false);
  const [showSpeedBonus, setShowSpeedBonus] = useState(false);
  const [showPerfectBonus, setShowPerfectBonus] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const showContentTimerRef = useRef<number | null>(null);
  const showSpeedBonusTimerRef = useRef<number | null>(null);
  const showPerfectBonusTimerRef = useRef<number | null>(null);
  const hideBonusesTimerRef = useRef<number | null>(null);
  const showButtonTimerRef = useRef<number | null>(null);

  const totalPercentage = useMemo(
    () => maxSessionScore > 0 ? (totalSessionScore / maxSessionScore) * 100 : 0,
    [totalSessionScore, maxSessionScore]
  );

  const isTimedGame = gameScore.timeBonus !== undefined;
  const hasTimeBonus = !!gameScore.timeBonus && gameScore.timeBonus > 0;
  const timeBonus = gameScore.timeBonus || 0;
  const hasPerfectScoreBonus = !!gameScore.perfectScoreBonus && gameScore.perfectScoreBonus > 0;
  const perfectBonus = gameScore.perfectScoreBonus || 0;

  const animatedBonus = useCountUp(hasTimeBonus ? timeBonus : 0, 900, showSpeedBonus);
  const animatedPerfectBonus = useCountUp(hasPerfectScoreBonus ? perfectBonus : 0, 1200, showPerfectBonus);

  const getGradeLabel = useCallback((score: number): string => {
    return getScoreLabel(score);
  }, []);

  const gameIcon = gameId ? GAME_ICONS[gameId.toLowerCase()] : null;

  useEffect(() => {
    const finalScore = gameScore.totalWithBonus || gameScore.normalizedScore;
    ReactGA.event({
      category: 'Game',
      action: 'results_shown',
      label: `${gameName} - Round ${roundNumber}`,
      game_name: gameName,
      round_number: roundNumber,
      score: Math.round(finalScore),
      is_last_round: isLastRound,
    });

    showContentTimerRef.current = window.setTimeout(() => {
      setShowContent(true);
    }, 200);

    if (hasTimeBonus) {
      showSpeedBonusTimerRef.current = window.setTimeout(() => setShowSpeedBonus(true), 800);
    }

    if (hasPerfectScoreBonus) {
      showPerfectBonusTimerRef.current = window.setTimeout(() => setShowPerfectBonus(true), hasTimeBonus ? 1300 : 800);
    }

    const bonusDisplayDuration = hasTimeBonus && hasPerfectScoreBonus ? 3500 : hasPerfectScoreBonus || hasTimeBonus ? 2800 : 0;

    if (bonusDisplayDuration > 0) {
      hideBonusesTimerRef.current = window.setTimeout(() => {
        setShowSpeedBonus(false);
        setShowPerfectBonus(false);
      }, bonusDisplayDuration);

      showButtonTimerRef.current = window.setTimeout(() => {
        setShowButton(true);
      }, bonusDisplayDuration + 400);
    } else {
      showButtonTimerRef.current = window.setTimeout(() => {
        setShowButton(true);
      }, 800);
    }

    return () => {
      if (showContentTimerRef.current) clearTimeout(showContentTimerRef.current);
      if (showSpeedBonusTimerRef.current) clearTimeout(showSpeedBonusTimerRef.current);
      if (showPerfectBonusTimerRef.current) clearTimeout(showPerfectBonusTimerRef.current);
      if (hideBonusesTimerRef.current) clearTimeout(hideBonusesTimerRef.current);
      if (showButtonTimerRef.current) clearTimeout(showButtonTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber]);

  return (
    <div className="w-full bg-black flex flex-col items-center justify-center p-4 sm:p-6" style={{ minHeight: '100dvh' }}>
      {/* ROWDY BRANDING - TOP */}
      <div className="mb-4 sm:mb-8">
        <p className="text-4xl sm:text-6xl font-black text-red-500" style={{ textShadow: '0 0 40px #ef4444', letterSpacing: '0.12em' }}>
          ROWDY
        </p>
      </div>

      <div className={`max-w-2xl w-full transition-all duration-700 ${showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-cyan-400 mb-2 uppercase tracking-wide" style={{ textShadow: '0 0 20px #00ffff' }}>
            Round {roundNumber} Complete
          </h1>
          <div className="flex items-center justify-center gap-2">
            {gameIcon && (
              <div className="text-cyan-400" style={{ filter: 'drop-shadow(0 0 10px #00ffff)' }}>
                {gameIcon}
              </div>
            )}
            <p className="text-base sm:text-lg text-cyan-300/80">{gameName}</p>
          </div>
        </div>

        <div className="bg-black backdrop-blur rounded-xl p-4 sm:p-6 mb-3 border-2 border-cyan-400/40" style={{ boxShadow: '0 0 25px rgba(0, 255, 255, 0.3)' }}>
          <div className="text-center mb-4 pb-4 border-b border-cyan-400/30">
            <div
              className={`flex items-center justify-center gap-1 sm:gap-2 mb-3 ${showContent ? 'animate-pop-in' : 'opacity-0'}`}
            >
              {Array.from({ length: 5 }, (_, i) => {
                const filled = i < (gameScore.grade.match(/★/g)?.length ?? 0);
                return (
                  <svg
                    key={i}
                    viewBox="0 0 24 24"
                    className="w-10 h-10 sm:w-12 sm:h-12"
                    style={filled ? { filter: 'drop-shadow(0 0 6px rgba(234, 179, 8, 0.6))' } : undefined}
                  >
                    <polygon
                      points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                      fill={filled ? '#eab308' : 'none'}
                      stroke={filled ? '#ca8a04' : 'rgba(234,179,8,0.35)'}
                      strokeWidth={filled ? '1' : '1.5'}
                    />
                  </svg>
                );
              })}
            </div>
            <div
              className={`text-2xl sm:text-3xl font-bold text-cyan-300 mb-2 uppercase tracking-wider ${showContent ? 'animate-pop-in' : 'opacity-0'}`}
              style={{ textShadow: '0 0 15px #00ffff' }}
            >
              {getGradeLabel(gameScore.normalizedScore)}
            </div>
            <div className="text-lg sm:text-xl text-white/70 font-semibold tabular-nums">
              {Math.round(gameScore.normalizedScore + (hasTimeBonus ? animatedBonus : 0))}/100
            </div>
          </div>

          <div style={{ minHeight: (showSpeedBonus || showPerfectBonus) ? '140px' : '60px', transition: 'min-height 0.3s ease-out' }}>
            {showSpeedBonus && (
              <div className="mb-4 pb-4 border-b border-cyan-400/30">
                <div className="text-center animate-slide-up">
                  <div
                    className={`text-sm mb-2 uppercase tracking-wide ${hasTimeBonus ? 'text-yellow-300' : 'text-red-400'}`}
                    style={{ textShadow: hasTimeBonus ? '0 0 8px #fbbf24' : '0 0 8px #ef4444' }}
                  >
                    Speed Bonus
                  </div>
                  <div
                    className={`text-4xl sm:text-5xl font-bold mb-1 ${hasTimeBonus ? 'text-yellow-400' : 'text-red-400 animate-pulse-danger'}`}
                    style={{ textShadow: hasTimeBonus ? '0 0 15px #fbbf24' : '0 0 15px #ef4444' }}
                  >
                    +{hasTimeBonus ? Math.round(animatedBonus) : 0}
                  </div>
                </div>
              </div>
            )}
            {showPerfectBonus && (
              <div className="pb-4">
                <div className="text-center animate-slide-up">
                  <div
                    className="text-sm mb-2 uppercase tracking-wide text-pink-300 font-bold"
                    style={{ textShadow: '0 0 12px #ec4899' }}
                  >
                    Perfect Score Bonus
                  </div>
                  <div
                    className="text-4xl sm:text-5xl font-bold mb-1 text-pink-400 animate-pulse"
                    style={{ textShadow: '0 0 20px #ec4899' }}
                  >
                    +{Math.round(animatedPerfectBonus)}
                  </div>
                  <div className="text-sm text-pink-300">2X Multiplier</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onContinue}
          disabled={!showButton}
          className={`w-full py-4 sm:py-5 bg-transparent border-2 border-green-500 text-green-400 font-bold rounded-xl text-lg sm:text-xl transition-all active:scale-95 active:bg-green-500 active:text-black flex items-center justify-center gap-3 uppercase tracking-wide ${showButton ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          style={{ textShadow: '0 0 15px #22c55e', boxShadow: '0 0 30px rgba(34, 197, 94, 0.4)' }}
        >
          {isLastRound ? (
            <>
              <Trophy className="w-6 h-6" />
              <span>View Final Results</span>
            </>
          ) : (
            <>
              <span>Next Round</span>
              <ChevronRight className="w-6 h-6" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}