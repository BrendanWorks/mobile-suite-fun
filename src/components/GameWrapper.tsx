import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { GameHandle } from '../lib/gameTypes';

interface GameWrapperProps {
  children: React.ReactElement;
  duration?: number;
  onComplete: (score: number, maxScore: number) => void;
  gameName: string;
}

export default function GameWrapper({
  children,
  duration = 60,
  onComplete,
  gameName
}: GameWrapperProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [hasEnded, setHasEnded] = useState(false);
  const gameRef = useRef<GameHandle>(null);

  useEffect(() => {
    if (timeLeft <= 0 && !hasEnded) {
      endGame('timeout');
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, hasEnded]);

  const endGame = (reason: 'timeout' | 'quit') => {
    if (hasEnded) return;

    setHasEnded(true);

    gameRef.current?.onGameEnd?.();

    const result = gameRef.current?.getGameScore?.();
    if (result) {
      const { score, maxScore } = result;

      if (reason === 'quit') {
        console.log(`${gameName}: Player quit with ${score}/${maxScore} points`);
      } else {
        console.log(`${gameName}: Time up with ${score}/${maxScore} points`);
      }

      onComplete(score, maxScore);
    } else {
      console.warn(`${gameName}: Game did not return score. Using 0/100.`);
      onComplete(0, 100);
    }
  };

  const handleQuitClick = () => {
    endGame('quit');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-4 bg-gray-100 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <Clock className={`w-5 h-5 ${timeLeft < 10 ? 'text-red-600 animate-pulse' : 'text-gray-600'}`} />
          <span className={`font-bold text-lg ${timeLeft < 10 ? 'text-red-600' : 'text-gray-700'}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
        <button
          onClick={handleQuitClick}
          disabled={hasEnded}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {hasEnded ? 'Round Complete' : 'Quit Round'}
        </button>
      </div>

      <div className={hasEnded ? 'pointer-events-none opacity-50' : ''}>
        {React.cloneElement(children, { ref: gameRef })}
      </div>

      {hasEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg z-50">
          <div className="bg-white p-8 rounded-lg text-center shadow-2xl">
            <p className="text-2xl font-bold text-gray-800 mb-2">Round Complete!</p>
            <p className="text-gray-600">Calculating score...</p>
          </div>
        </div>
      )}
    </div>
  );
}
