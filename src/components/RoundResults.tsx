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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-gray-900 flex items-center justify-center p-6">
      <div className={`max-w-3xl w-full transition-all duration-700 ${showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        {/* Round Header */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <Award className={`w-20 h-20 ${getGradeColor(gameScore.grade)} animate-bounce`} />
          </div>
          <h1 className="text-5xl font-bold text-white mb-2">Round {roundNumber} Complete!</h1>
          <p className="text-xl text-gray-300">{gameName}</p>
        </div>

        {/* Main Score Card */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-8 mb-6">
          {/* Round Score */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                Round Score
              </h3>
              <div className={`text-5xl font-bold ${getGradeColor(gameScore.grade)}`}>
                {gameScore.grade}
              </div>
            </div>

            {/* Score Bar */}
            <div className="relative h-12 bg-gray-700/50 rounded-full overflow-hidden mb-2">
              <div
                className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getGradeBgColor(gameScore.grade)} transition-all duration-1000 ease-out flex items-center justify-end pr-4`}
                style={{ width: `${(animateRound / 100) * 100}%` }}
              >
                <span className="text-white font-bold text-lg drop-shadow-lg">
                  {Math.round(animateRound)}
                </span>
              </div>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Your Score: <span className="font-bold text-white">{Math.round(gameScore.normalizedScore)}</span></span>
              <span className="text-gray-400">Max: <span className="font-bold text-yellow-400">100</span></span>
            </div>

            {/* Breakdown */}
            <div className="mt-3 text-sm text-gray-300 bg-white/5 p-2 rounded">
              {gameScore.breakdown}
            </div>
          </div>

          <div className="pt-6 border-t border-white/20">
            {/* Session Total */}
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-cyan-400" />
                Session Total
              </h3>
              <div className="text-3xl font-bold text-cyan-400">
                {Math.round(totalPercentage)}%
              </div>
            </div>

            {/* Session Score Bar */}
            <div className="relative h-12 bg-gray-700/50 rounded-full overflow-hidden mb-2">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-1000 ease-out delay-700 flex items-center justify-end pr-4"
                style={{ width: `${(animateTotal / maxSessionScore) * 100}%` }}
              >
                <span className="text-white font-bold text-lg drop-shadow-lg">
                  {Math.round(animateTotal)}
                </span>
              </div>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Cumulative: <span className="font-bold text-white">{totalSessionScore}</span></span>
              <span className="text-gray-400">Max: <span className="font-bold text-yellow-400">{maxSessionScore}</span></span>
            </div>

            {/* Game Breakdown Mini */}
            {allRoundScores.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="text-xs text-gray-400 mb-2">Games played:</div>
                <div className="grid grid-cols-2 gap-2">
                  {allRoundScores.map((round, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-white/10 p-2 rounded">
                      <span className="text-gray-300 truncate">{idx + 1}. {round.gameName}</span>
                      <span className={`font-bold ${getGradeColor(round.score.grade)}`}>
                        {round.score.grade}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Continue Button */}
        <div className="text-center">
          <button
            onClick={onContinue}
            className="px-12 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg text-xl transition-all transform hover:scale-105 shadow-lg"
          >
            {isLastRound ? 'View Final Results' : 'Next Round'}
          </button>
        </div>
      </div>
    </div>
  );
}