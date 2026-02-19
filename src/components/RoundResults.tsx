import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Trophy, TrendingUp, ChevronRight } from 'lucide-react';
import { GameScore } from '../lib/scoringSystem';
import { useCountUp } from '../hooks/useCountUp';
import { playWin } from '../lib/sounds';
import ReactGA from 'react-ga4';

interface RoundResultsProps {
  roundNumber: number;
  gameName: string;
  gameScore: GameScore;
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
  allRoundScores,
  totalSessionScore,
  maxSessionScore,
  onContinue,
  isLastRound
}: RoundResultsProps) {
  const [showContent, setShowContent] = useState(false);
  const [showBonus, setShowBonus] = useState(false);
  const showContentTimerRef = useRef<number | null>(null);
  const showBonusTimerRef = useRef<number | null>(null);

  const totalPercentage = useMemo(
    () => maxSessionScore > 0 ? (totalSessionScore / maxSessionScore) * 100 : 0,
    [totalSessionScore, maxSessionScore]
  );

  const isTimedGame = gameScore.timeBonus !== undefined;
  const hasTimeBonus = !!gameScore.timeBonus && gameScore.timeBonus > 0;
  const timeBonus = gameScore.timeBonus || 0;

  const animatedBonus = useCountUp(hasTimeBonus ? timeBonus : 0, 900, showBonus && hasTimeBonus);

  const getGradeLabel = useCallback((score: number): string => {
    if (score >= 100) return "Perfect";
    if (score >= 90) return "Amazeballs!";
    if (score >= 80) return "Exceptional";
    if (score >= 70) return "Very Good";
    if (score >= 60) return "Well Done";
    if (score >= 50) return "Above Average";
    if (score >= 40) return "Pretty Good";
    if (score >= 30) return "Needs Improvement";
    if (score >= 20) return "Keep Trying";
    if (score >= 10) return "Ouch!";
    if (score > 0) return "Poor";
    return "Didn't Even Try!";
  }, []);

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
      playWin(0.5);
    }, 200);

    if (isTimedGame) {
      showBonusTimerRef.current = window.setTimeout(() => setShowBonus(true), 800);
    }

    return () => {
      if (showContentTimerRef.current) clearTimeout(showContentTimerRef.current);
      if (showBonusTimerRef.current) clearTimeout(showBonusTimerRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 sm:p-6">
      <div className={`max-w-2xl w-full transition-all duration-700 ${showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-cyan-400 mb-2 uppercase tracking-wide" style={{ textShadow: '0 0 20px #00ffff' }}>
            Round {roundNumber} Complete
          </h1>
          <p className="text-base sm:text-lg text-cyan-300/80">{gameName}</p>
        </div>

        <div className="bg-black backdrop-blur rounded-xl p-4 sm:p-6 mb-3 border-2 border-cyan-400/40" style={{ boxShadow: '0 0 25px rgba(0, 255, 255, 0.3)' }}>
          <div className="text-center mb-4 pb-4 border-b border-cyan-400/30">
            <div
              className={`text-6xl sm:text-7xl font-bold text-yellow-400 mb-3 ${showContent ? 'animate-pop-in' : 'opacity-0'}`}
              style={{ textShadow: '0 0 20px #fbbf24' }}
            >
              {gameScore.grade}
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-cyan-400 mb-3 uppercase tracking-wider animate-fade-in-up" style={{ textShadow: '0 0 15px #00ffff', animationDelay: '0.15s', animationFillMode: 'both' }}>
              {getGradeLabel(gameScore.normalizedScore)}
            </div>
            <div className="text-lg sm:text-xl text-cyan-400 font-semibold">
              {Math.round(gameScore.normalizedScore)}/100
            </div>
          </div>

          <div className="mb-4 pb-4 border-b border-cyan-400/30" style={{ minHeight: '100px' }}>
            {isTimedGame && showBonus && (
              <div className="text-center animate-fade-in">
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
                {gameScore.totalWithBonus && hasTimeBonus && (
                  <div className="text-sm text-cyan-400">
                    New Total: {Math.round(gameScore.totalWithBonus)}/100
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-cyan-400" style={{ filter: 'drop-shadow(0 0 10px #00ffff)' }} />
              <span className="text-sm text-cyan-300 uppercase tracking-wide">Session Progress</span>
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-cyan-400 mb-2" style={{ textShadow: '0 0 10px #00ffff' }}>
              {Math.round(totalPercentage)}%
            </div>
            <div className="text-sm text-cyan-400/80">
              {totalSessionScore} / {maxSessionScore} points
            </div>
          </div>
        </div>

        <button
          onClick={onContinue}
          className="w-full py-4 sm:py-5 bg-transparent border-2 border-green-500 text-green-400 hover:bg-green-500 hover:text-black font-bold rounded-xl text-lg sm:text-xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-wide"
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
