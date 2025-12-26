import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Award } from 'lucide-react';

interface RoundResultsProps {
  roundNumber: number;
  roundScore: number;
  maxRoundScore: number;
  totalScore: number;
  maxTotalScore: number;
  gameName: string;
  onContinue: () => void;
  isLastRound: boolean;
}

export default function RoundResults({
  roundNumber,
  roundScore,
  maxRoundScore,
  totalScore,
  maxTotalScore,
  gameName,
  onContinue,
  isLastRound
}: RoundResultsProps) {
  const [animateRound, setAnimateRound] = useState(0);
  const [animateTotal, setAnimateTotal] = useState(0);
  const [showContent, setShowContent] = useState(false);

  const roundPercentage = (roundScore / maxRoundScore) * 100;
  const totalPercentage = (totalScore / maxTotalScore) * 100;

  useEffect(() => {
    setTimeout(() => setShowContent(true), 200);

    const roundDuration = 1500;
    const roundSteps = 60;
    const roundIncrement = roundScore / roundSteps;
    let roundStep = 0;

    const roundInterval = setInterval(() => {
      roundStep++;
      setAnimateRound(Math.min(roundScore, roundStep * roundIncrement));
      if (roundStep >= roundSteps) {
        clearInterval(roundInterval);
      }
    }, roundDuration / roundSteps);

    setTimeout(() => {
      const totalDuration = 1500;
      const totalSteps = 60;
      const totalIncrement = totalScore / totalSteps;
      let totalStep = 0;

      const totalInterval = setInterval(() => {
        totalStep++;
        setAnimateTotal(Math.min(totalScore, totalStep * totalIncrement));
        if (totalStep >= totalSteps) {
          clearInterval(totalInterval);
        }
      }, totalDuration / totalSteps);

      return () => clearInterval(totalInterval);
    }, 800);

    return () => clearInterval(roundInterval);
  }, [roundScore, totalScore]);

  const getRoundGrade = () => {
    if (roundPercentage >= 90) return { grade: 'S', color: 'text-yellow-400', bgColor: 'bg-yellow-400' };
    if (roundPercentage >= 75) return { grade: 'A', color: 'text-green-400', bgColor: 'bg-green-400' };
    if (roundPercentage >= 60) return { grade: 'B', color: 'text-blue-400', bgColor: 'bg-blue-400' };
    if (roundPercentage >= 40) return { grade: 'C', color: 'text-orange-400', bgColor: 'bg-orange-400' };
    return { grade: 'D', color: 'text-red-400', bgColor: 'bg-red-400' };
  };

  const gradeInfo = getRoundGrade();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-gray-900 flex items-center justify-center p-6">
      <div className={`max-w-3xl w-full transition-all duration-700 ${showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <Award className={`w-20 h-20 ${gradeInfo.color} animate-bounce`} />
          </div>
          <h1 className="text-5xl font-bold text-white mb-2">Round {roundNumber} Complete!</h1>
          <p className="text-xl text-gray-300">{gameName}</p>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-8 mb-6">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                Round Score
              </h3>
              <div className={`text-5xl font-bold ${gradeInfo.color}`}>
                {gradeInfo.grade}
              </div>
            </div>

            <div className="relative h-12 bg-gray-700/50 rounded-full overflow-hidden mb-2">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-1000 ease-out flex items-center justify-end pr-4"
                style={{ width: `${(animateRound / maxRoundScore) * 100}%` }}
              >
                <span className="text-white font-bold text-lg drop-shadow-lg">
                  {Math.round(animateRound)}
                </span>
              </div>
              <div
                className="absolute inset-y-0 left-0 border-r-4 border-yellow-400 border-dashed pointer-events-none"
                style={{ width: '100%' }}
              />
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Your Score: <span className="font-bold text-white">{roundScore}</span></span>
              <span className="text-gray-400">Possible: <span className="font-bold text-yellow-400">{maxRoundScore}</span></span>
            </div>
          </div>

          <div className="pt-6 border-t border-white/20">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-cyan-400" />
                Total Score
              </h3>
              <div className="text-3xl font-bold text-cyan-400">
                {Math.round(totalPercentage)}%
              </div>
            </div>

            <div className="relative h-12 bg-gray-700/50 rounded-full overflow-hidden mb-2">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-1000 ease-out delay-700 flex items-center justify-end pr-4"
                style={{ width: `${(animateTotal / maxTotalScore) * 100}%` }}
              >
                <span className="text-white font-bold text-lg drop-shadow-lg">
                  {Math.round(animateTotal)}
                </span>
              </div>
              <div
                className="absolute inset-y-0 left-0 border-r-4 border-yellow-400 border-dashed pointer-events-none"
                style={{ width: '100%' }}
              />
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Cumulative: <span className="font-bold text-white">{totalScore}</span></span>
              <span className="text-gray-400">Possible: <span className="font-bold text-yellow-400">{maxTotalScore}</span></span>
            </div>
          </div>
        </div>

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
