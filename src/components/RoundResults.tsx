import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Award } from 'lucide-react';
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
  const [animateRound, setAnimateRound] = useState(0);
  const [animateTotal, setAnimateTotal] = useState(0);
  const [showContent, setShowContent] = useState(false);

  const roundPercentage = gameScore.normalizedScore;
  const totalPercentage = (totalSessionScore / maxSessionScore) * 100;

  useEffect(() => {
    setTimeout(() => setShowContent(true), 200);

    const roundDuration = 1500;
    const roundSteps = 60;
    const roundIncrement = gameScore.normalizedScore / roundSteps;
    let roundStep = 0;

    const roundInterval = setInterval(() => {
      roundStep++;
      setAnimateRound(Math.min(gameScore.normalizedScore, roundStep * roundIncrement));
      if (roundStep >= roundSteps) {
        clearInterval(roundInterval);
      }
    }, roundDuration / roundSteps);

    setTimeout(() => {
      const totalDuration = 1500;
      const totalSteps = 60;
      const totalIncrement = totalSessionScore / totalSteps;
      let totalStep = 0;

      const totalInterval = setInterval(() => {
        totalStep++;
        setAnimateTotal(Math.min(totalSessionScore, totalStep * totalIncrement));
        if (totalStep >= totalSteps) {
          clearInterval(totalInterval);
        }
      }, totalDuration / totalSteps);

      return () => clearInterval(totalInterval);
    }, 800);

    return () => clearInterval(roundInterval);
  }, [gameScore.normalizedScore, totalSessionScore]);

  const getGradeColor = (grade: string) => {
    switch(grade) {
      case 'S': return 'text-yellow-400';
      case 'A': return 'text-green-400';
      case 'B': return 'text-blue-400';
      case 'C': return 'text-orange-400';
      default: return 'text-red-400';
    }
  };

  const getGradeBgColor = (grade: string) => {
    switch(grade) {
      case 'S': return 'from-yellow-400 to-yellow-500';
      case 'A': return 'from-green-400 to-green-500';
      case 'B': return 'from-blue-400 to-blue-500';
      case 'C': return 'from-orange-400 to-orange-500';
      default: return 'from-red-400 to-red-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-gray-900 flex flex-col p-3 sm:p-6">
      <div className={`max-w-2xl w-full mx-auto flex flex-col transition-all duration-700 ${showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        {/* Compact Header */}
        <div className="text-center mb-3 sm:mb-4">
          <Award className={`w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 ${getGradeColor(gameScore.grade)}`} />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Round {roundNumber} Complete!</h1>
          <p className="text-sm sm:text-base text-gray-300">{gameName}</p>
        </div>

        {/* Compact Score Card */}
        <div className="bg-white/10 backdrop-blur rounded-xl p-3 sm:p-4 mb-3">
          {/* Round Score - Hero Element */}
          <div className="text-center mb-3 pb-3 border-b border-white/20">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
              <span className="text-xs sm:text-sm text-gray-300">Round Score</span>
            </div>
            <div className={`text-6xl sm:text-7xl font-bold ${getGradeColor(gameScore.grade)} mb-1`}>
              {gameScore.grade}
            </div>
            <div className="text-sm sm:text-base text-gray-400">
              {Math.round(gameScore.normalizedScore)}/100 points
            </div>
          </div>

          {/* Session Total - Compact */}
          <div className="mb-3 pb-3 border-b border-white/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                <span className="text-xs sm:text-sm text-gray-300">Session Total</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-cyan-400">
                {Math.round(totalPercentage)}%
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-400 text-center">
              {totalSessionScore}/{maxSessionScore} points
            </div>
          </div>

          {/* Game Breakdown - Compact List */}
          {allRoundScores.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-2">Games played:</div>
              <div className="space-y-1">
                {allRoundScores.map((round, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-white/5 px-2 py-1.5 rounded">
                    <span className="text-gray-300 truncate">{idx + 1}. {round.gameName}</span>
                    <span className={`font-bold text-sm ${getGradeColor(round.score.grade)} ml-2`}>
                      {round.score.grade}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Continue Button - Always Visible */}
        <button
          onClick={onContinue}
          className="w-full py-3 sm:py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg text-base sm:text-lg transition-all shadow-lg active:scale-95"
        >
          {isLastRound ? 'View Final Results' : 'Next Round'}
        </button>
      </div>
    </div>
  );
}