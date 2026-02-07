import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, ChevronRight } from 'lucide-react';
import { GameScore } from '../lib/scoringSystem';

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
  const [animateBonus, setAnimateBonus] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [showBonus, setShowBonus] = useState(false);

  const totalPercentage = (totalSessionScore / maxSessionScore) * 100;
  const hasTimeBonus = gameScore.timeBonus && gameScore.timeBonus > 0;

  useEffect(() => {
    // Show content with fade-in
    setTimeout(() => setShowContent(true), 200);

    // Animate time bonus if present
    if (hasTimeBonus) {
      setTimeout(() => {
        setShowBonus(true);
        const bonusDuration = 1000;
        const bonusSteps = 40;
        const bonusIncrement = (gameScore.timeBonus || 0) / bonusSteps;
        let bonusStep = 0;

        const bonusInterval = setInterval(() => {
          bonusStep++;
          setAnimateBonus(Math.min(gameScore.timeBonus || 0, bonusStep * bonusIncrement));
          if (bonusStep >= bonusSteps) {
            clearInterval(bonusInterval);
          }
        }, bonusDuration / bonusSteps);

        return () => clearInterval(bonusInterval);
      }, 800);
    }
  }, [gameScore.timeBonus, hasTimeBonus]);

  const getGradeLabel = (score: number): string => {
    if (score >= 90) return "Absolutely Crushed It!";
    if (score >= 80) return "Pretty Damn Good!";
    if (score >= 70) return "Solidly Mediocre";
    if (score >= 60) return "Kinda Rough";
    if (score >= 50) return "That Was Ugly";
    if (score >= 40) return "Spectacularly Bad!";
    return "What Just Happened?";
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 sm:p-6">
      <div className={`max-w-2xl w-full transition-all duration-700 ${showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-cyan-400 mb-2 uppercase tracking-wide" style={{ textShadow: '0 0 20px #00ffff' }}>
            Round {roundNumber} Complete
          </h1>
          <p className="text-base sm:text-lg text-cyan-300/80">{gameName}</p>
        </div>

        {/* Score Card */}
        <div className="bg-black backdrop-blur rounded-xl p-4 sm:p-6 mb-3 border-2 border-cyan-400/40" style={{ boxShadow: '0 0 25px rgba(0, 255, 255, 0.3)' }}>
          {/* Round Score - Hero Element */}
          <div className="text-center mb-4 pb-4 border-b border-cyan-400/30">
            <div className="text-6xl sm:text-7xl font-bold text-cyan-400 mb-3" style={{ textShadow: '0 0 20px #00ffff' }}>
              {gameScore.grade}
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-cyan-400 mb-3 uppercase tracking-wider" style={{ textShadow: '0 0 15px #00ffff' }}>
              {getGradeLabel(gameScore.normalizedScore)}
            </div>
            <div className="text-lg sm:text-xl text-cyan-400 font-semibold">
              {Math.round(gameScore.normalizedScore)}/100
            </div>
          </div>

          {/* Time Bonus - Fixed height to prevent layout shift */}
          <div className="mb-4 pb-4 border-b border-cyan-400/30" style={{ minHeight: '100px' }}>
            {hasTimeBonus && showBonus && (
              <div className="text-center animate-fade-in">
                <div className="text-sm text-yellow-300 mb-2 uppercase tracking-wide" style={{ textShadow: '0 0 8px #fbbf24' }}>
                  Speed Bonus
                </div>
                <div className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-1" style={{ textShadow: '0 0 15px #fbbf24' }}>
                  +{Math.round(animateBonus)}
                </div>
                {gameScore.totalWithBonus && (
                  <div className="text-sm text-cyan-400">
                    New Total: {Math.round(gameScore.totalWithBonus)}/100
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Session Progress */}
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

        {/* Continue Button */}
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