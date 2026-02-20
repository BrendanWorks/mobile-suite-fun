import { useState, useEffect, useMemo } from 'react';
import { Check } from 'lucide-react';
import { GameScore } from '../lib/scoringSystem';

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
  const [dialFill, setDialFill] = useState(0);
  const [visibleTiles, setVisibleTiles] = useState<number>(0);

  const totalPercentage = useMemo(
    () => maxSessionScore > 0 ? (totalSessionScore / maxSessionScore) * 100 : 0,
    [totalSessionScore, maxSessionScore]
  );

  useEffect(() => {
    let fillTimer: NodeJS.Timeout;
    let tileTimer: NodeJS.Timeout;

    fillTimer = setInterval(() => {
      setDialFill((prev) => {
        const next = Math.min(prev + 2, 100);
        if (next === 100) clearInterval(fillTimer);
        return next;
      });
    }, 15);

    tileTimer = setTimeout(() => {
      let tileCount = 0;
      const tileInterval = setInterval(() => {
        tileCount++;
        setVisibleTiles(Math.min(tileCount, roundScores.length));
        if (tileCount >= roundScores.length) clearInterval(tileInterval);
      }, 120);
    }, 400);

    return () => {
      clearInterval(fillTimer);
      clearInterval(tileTimer);
    };
  }, [roundScores.length]);

  const dialRadius = 80;
  const circumference = 2 * Math.PI * dialRadius;
  const strokeDashoffset = circumference - (dialFill / 100) * circumference;

  return (
    <div className="min-h-screen w-screen bg-black flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="flex flex-col items-center gap-8 sm:gap-10 max-w-2xl w-full py-8">
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-3xl sm:text-5xl font-bold text-cyan-400 uppercase tracking-wider animate-fade-in" style={{ textShadow: '0 0 20px #00ffff' }}>
            Round Complete!
          </h1>

          <div className="relative w-48 h-48 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full animate-pulse" style={{ boxShadow: '0 0 40px rgba(0, 255, 255, 0.2)' }} />
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
                  <stop offset="0%" style={{ stopColor: '#00ffff', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#fbbf24', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl sm:text-5xl font-bold text-yellow-400" style={{ textShadow: '0 0 15px #fbbf24' }}>
                {Math.round(totalPercentage)}%
              </div>
              <div className="text-xs sm:text-sm text-cyan-300 uppercase tracking-wide">
                Session
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-cyan-400 text-sm sm:text-base">
              {Math.round(totalSessionScore)} / {Math.round(maxSessionScore)} points
            </p>
          </div>
        </div>

        <div className="w-full grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          {roundScores.map((tile, index) => (
            <div
              key={`${tile.gameId}-${index}`}
              className={`transition-all duration-500 ${
                index < visibleTiles
                  ? 'opacity-100 scale-100'
                  : 'opacity-0 scale-75'
              }`}
            >
              <div
                className="h-32 sm:h-40 bg-black rounded-lg border-2 border-cyan-400/50 p-3 sm:p-4 flex flex-col items-center justify-center relative overflow-hidden group hover:border-cyan-400/80 transition-all duration-300 touch-manipulation"
                style={{
                  boxShadow: index < visibleTiles
                    ? '0 0 25px rgba(0, 255, 255, 0.3), inset 0 0 15px rgba(0, 255, 255, 0.1)'
                    : 'none',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 to-yellow-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ boxShadow: 'inset 0 0 20px rgba(0, 255, 255, 0.15)' }} />

                <div className="relative z-10 flex flex-col items-center justify-center h-full gap-2 text-center">
                  <div className="text-xl sm:text-3xl font-bold text-yellow-400 transition-transform duration-300 group-hover:scale-110" style={{ textShadow: '0 0 10px #fbbf24' }}>
                    {Math.round(tile.score.normalizedScore)}
                  </div>

                  <div className="text-[11px] sm:text-xs text-cyan-300 uppercase tracking-wide font-semibold line-clamp-2">
                    {tile.gameName}
                  </div>

                  {index < visibleTiles && (
                    <div className="mt-auto pt-2 animate-pop-in">
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" style={{ filter: 'drop-shadow(0 0 6px #22c55e)' }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="w-full flex flex-col items-center gap-4 pt-4 sm:pt-6 border-t border-cyan-400/30">
          <button
            onClick={onPlayAgain}
            className="w-full py-4 sm:py-5 px-6 bg-transparent border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black font-bold rounded-lg text-lg sm:text-xl transition-all active:scale-95 touch-manipulation uppercase tracking-wide"
            style={{
              textShadow: '0 0 15px #00ffff',
              boxShadow: '0 0 30px rgba(0, 255, 255, 0.3)',
            }}
          >
            Play Again
          </button>

          <div className="flex items-center gap-2 text-green-400 text-sm sm:text-base">
            <Check className="w-5 h-5" style={{ filter: 'drop-shadow(0 0 8px #22c55e)' }} />
            <span>Progress Saved</span>
          </div>
        </div>
      </div>
    </div>
  );
}
