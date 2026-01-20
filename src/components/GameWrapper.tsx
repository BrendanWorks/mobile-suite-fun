/**
 * GameWrapper.tsx - UPDATED WITH COUNTDOWN START
 * 
 * Features:
 * - 7-second countdown button with green→white wipe animation
 * - User can click to start early
 * - Auto-starts at 0
 * - White border blink (500ms on, off, 500ms on) when game starts
 * - Subtle "tink" sounds on 3, 2, 1
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
  const [isCountingDown, setIsCountingDown] = useState(true);
  const [countdownTime, setCountdownTime] = useState(7);
  const [showBorderBlink, setShowBorderBlink] = useState(false);
  const gameRef = useRef<GameHandle>(null);
  const audioContext = useRef<AudioContext | null>(null);

  // Initialize audio context
  useEffect(() => {
    try {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.log('Audio context failed to initialize');
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!isCountingDown) return;

    if (countdownTime <= 0) {
      startGame();
      return;
    }

    const timer = setTimeout(() => {
      // Play tink sound for 3, 2, 1
      if (countdownTime <= 3 && countdownTime > 0) {
        playTinkSound();
      }
      setCountdownTime(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdownTime, isCountingDown]);

  // Border blink effect when game starts
  useEffect(() => {
    if (!showBorderBlink) return;

    // Blink 1: Already showing
    const blink2Timer = setTimeout(() => {
      setShowBorderBlink(false);
    }, 500);

    // Blink 2: Turn back on
    const blink3Timer = setTimeout(() => {
      setShowBorderBlink(true);
    }, 500);

    // Turn off after second blink
    const blink4Timer = setTimeout(() => {
      setShowBorderBlink(false);
    }, 1000);

    return () => {
      clearTimeout(blink2Timer);
      clearTimeout(blink3Timer);
      clearTimeout(blink4Timer);
    };
  }, [showBorderBlink]);

  // Game timer countdown (only runs after game starts)
  useEffect(() => {
    if (isCountingDown || timeLeft <= 0 || hasEnded) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, hasEnded, isCountingDown]);

  // End game when time runs out
  useEffect(() => {
    if (timeLeft <= 0 && !isCountingDown && !hasEnded) {
      endGame('timeout');
    }
  }, [timeLeft, isCountingDown, hasEnded]);

  const playTinkSound = () => {
    if (!audioContext.current) return;

    try {
      const ctx = audioContext.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.frequency.value = 1000; // High pitch
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.1);
    } catch (error) {
      console.log('Failed to play tink sound:', error);
    }
  };

  const startGame = () => {
    setIsCountingDown(false);
    setShowBorderBlink(true);
    setTimeLeft(duration);
  };

  const handleStartButtonClick = () => {
    startGame();
  };

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

  // Calculate progress for green-to-white wipe (0 to 1)
  const wipeProgress = 1 - (countdownTime / 7);

  return (
    <div className={`relative flex flex-col h-full bg-gray-900 transition-all duration-100 ${
      showBorderBlink ? 'border-4 border-white' : 'border-4 border-transparent'
    }`}>
      {/* Visual Timer Bar - Always visible at top when game is running */}
      {!isCountingDown && showTimer && (
        <div className="flex-shrink-0">
          <VisualTimerBar
            timeRemaining={timeLeft}
            totalTime={duration}
          />
        </div>
      )}

      {/* Header with Controls */}
      <div className="flex-shrink-0 px-6 py-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center gap-4">
        {/* Center: Next Question button (only shows if game supports it) */}
        {gameRef.current?.loadNextPuzzle && (
          <div className="flex-1 flex justify-center">
            <button
              onClick={() => gameRef.current?.loadNextPuzzle?.()}
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-semibold text-sm transition-colors"
            >
              Next Question
            </button>
          </div>
        )}
        
        {/* Right: Next Round button (ends game) */}
        <button
          onClick={handleQuitClick}
          disabled={hasEnded}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors whitespace-nowrap"
        >
          {hasEnded ? 'Round Complete' : 'Next Round'}
        </button>
      </div>

      {/* Game Content */}
      <div className={`flex-1 overflow-auto relative ${hasEnded ? 'pointer-events-none opacity-50' : ''}`}>
        {React.cloneElement(children, { ref: gameRef })}
      </div>

      {/* Countdown Overlay (shown before game starts) */}
      {isCountingDown && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-50">
          <div className="text-center">
            {/* Big countdown number */}
            <div className="text-8xl font-bold text-white mb-8">
              {countdownTime}
            </div>

            {/* Start button with green-to-white wipe */}
            <button
              onClick={handleStartButtonClick}
              className="relative px-12 py-4 rounded-full font-bold text-xl overflow-hidden transition-all transform active:scale-95 shadow-lg"
              style={{
                background: `linear-gradient(to right, 
                  rgb(255, 255, 255) 0%, 
                  rgb(255, 255, 255) ${wipeProgress * 100}%, 
                  rgb(34, 197, 94) ${wipeProgress * 100}%, 
                  rgb(34, 197, 94) 100%)`
              }}
            >
              <span style={{
                color: wipeProgress > 0.5 ? 'black' : 'white'
              }}>
                Start
              </span>
            </button>

            {/* Helper text */}
            <p className="mt-8 text-gray-300 text-sm">
              Press to start now, or wait for auto-start
            </p>
          </div>
        </div>
      )}

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