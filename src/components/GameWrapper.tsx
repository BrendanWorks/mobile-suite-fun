/**
 * GameWrapper.tsx - UPDATED WITH SKIP CONTROLS
 * 
 * Replaced "Quit Round" with "Skip Question" and "Next Round"
 * Skip Question = next puzzle/question in current game (no points)
 * Next Round = skip to next game type (forfeit current game)
 */

import React, { useState, useEffect, useRef } from 'react';
import VisualTimerBar from './VisualTimerBar';
import { GameHandle } from '../lib/gameTypes';

interface GameWrapperProps {
  children: React.ReactElement;
  duration?: number;
  onComplete: (score: number, maxScore: number) => void;
  gameName: string;
  showTimer?: boolean;
  showCompletionModal?: boolean;
}

export default function GameWrapper({
  children,
  duration = 60,
  onComplete,
  gameName,
  showTimer = true,
  showCompletionModal = true
}: GameWrapperProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [hasEnded, setHasEnded] = useState(false);
  const gameRef = useRef<GameHandle>(null);

  // Timer countdown
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

  // End game and get score
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

  const handleSkipQuestion = () => {
    gameRef.current?.skipQuestion?.();
  };

  const handleNextRound = () => {
    endGame('quit');
  };

  const canSkipQuestion = gameRef.current?.canSkipQuestion !== false;

  return (
    <div className="relative flex flex-col h-full bg-gray-900">
      {/* Visual Timer Bar - Always visible at top */}
      {showTimer && (
        <div className="flex-shrink-0">
          <VisualTimerBar
            timeRemaining={timeLeft}
            totalTime={duration}
          />
        </div>
      )}

      {/* Header with Skip controls */}
      <div className="flex-shrink-0 px-6 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex gap-3 justify-center">
          {canSkipQuestion && (
            <button
              onClick={handleSkipQuestion}
              disabled={hasEnded}
              className="px-6 py-2 bg-white hover:bg-gray-100 disabled:bg-gray-600 disabled:opacity-50 text-gray-800 disabled:text-white rounded-lg font-semibold text-sm transition-colors"
            >
              Skip Question
            </button>
          )}
          <button
            onClick={handleNextRound}
            disabled={hasEnded}
            className="px-6 py-2 bg-white hover:bg-gray-100 disabled:bg-gray-600 disabled:opacity-50 text-gray-800 disabled:text-white rounded-lg font-semibold text-sm transition-colors"
          >
            Next Round
          </button>
        </div>
      </div>

      {/* Game Content */}
      <div className={`flex-1 overflow-auto ${hasEnded ? 'pointer-events-none opacity-50' : ''}`}>
        {React.cloneElement(children, { ref: gameRef })}
      </div>

      {/* Game Complete Overlay */}
      {hasEnded && showCompletionModal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50 rounded-lg">
          <div className="bg-white p-12 rounded-xl text-center shadow-2xl">
            <div className="mb-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✓</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800 mb-2">Round Complete!</p>
            <p className="text-gray-600">Calculating your score...</p>
          </div>
        </div>
      )}
    </div>
  );
}