/**
 * GameWrapper.tsx - UPDATED WITH VISUAL TIMER BAR
 * 
 * Replaced clock-based timer with visual progress bar
 * Blue → Yellow → Red as time depletes
 * 
 * Paste this into bolt.new to replace GameWrapper.tsx
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
}

export default function GameWrapper({
  children,
  duration = 60,
  onComplete,
  gameName,
  showTimer = true
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

  const handleQuitClick = () => {
    endGame('quit');
  };

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

      {/* Header with Quit button */}
      <div className="flex-shrink-0 px-6 py-3 bg-gray-800 border-b border-gray-700">
        <button
          onClick={handleQuitClick}
          disabled={hasEnded}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors"
        >
          {hasEnded ? 'Round Complete' : 'Quit Round'}
        </button>
      </div>

      {/* Game Content */}
      <div className={`flex-1 overflow-auto ${hasEnded ? 'pointer-events-none opacity-50' : ''}`}>
        {React.cloneElement(children, { ref: gameRef })}
      </div>

      {/* Game Complete Overlay */}
      {hasEnded && (
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

/**
 * WHAT CHANGED:
 * 
 * BEFORE:
 * - Clock icon + MM:SS time display
 * - Quit button on the same line
 * - Simple gray background
 * 
 * AFTER:
 * - VisualTimerBar at top (full width, visual progress)
 * - No clock icon or numbers
 * - Quit button in separate header below
 * - Game content takes up more space
 * - Cleaner, less cluttered
 * 
 * LAYOUT:
 * 
 * ┌────────────────────────────────────────┐
 * │  [Visual Timer Bar - Blue/Yellow/Red]  │  ← VisualTimerBar
 * ├────────────────────────────────────────┤
 * │              [Quit Round]              │  ← Header with button
 * ├────────────────────────────────────────┤
 * │                                        │
 * │           GAME CONTENT AREA            │  ← Game fills space
 * │                                        │
 * │                                        │
 * └────────────────────────────────────────┘
 */

/**
 * KEY IMPROVEMENTS:
 * 
 * ✅ Visual timer is the focus (not text/numbers)
 * ✅ Full width bar shows urgency clearly
 * ✅ No mental math required
 * ✅ Color transition is intuitive
 * ✅ More screen space for games
 * ✅ Cleaner, more modern UI
 * ✅ Game logic unchanged - just UI swap
 */
