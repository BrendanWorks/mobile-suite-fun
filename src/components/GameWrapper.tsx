import React, { useState, useEffect, useRef } from 'react';
import VisualTimerBar from './VisualTimerBar';
import { GameHandle } from '../lib/gameTypes';

interface GameWrapperProps {
  children: React.ReactElement;
  duration?: number;
  onComplete: (score: number, maxScore: number) => void;
  gameName: string;
  showTimer?: boolean;
  onScoreUpdate?: (score: number, maxScore: number) => void;
  showCompletionModal?: boolean;
}

export default function GameWrapper({
  children,
  duration = 60,
  onComplete,
  gameName,
  showTimer = true,
  onScoreUpdate,
  showCompletionModal = true
}: GameWrapperProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [hasEnded, setHasEnded] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(true);
  const [countdownTime, setCountdownTime] = useState(7);
  const [showBorderBlink, setShowBorderBlink] = useState(false);
  const gameRef = useRef<GameHandle>(null);
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.log('Audio context failed to initialize');
    }
  }, []);

  useEffect(() => {
    if (!isCountingDown) return;

    if (countdownTime <= 0) {
      startGame();
      return;
    }

    const timer = setTimeout(() => {
      if (countdownTime <= 3 && countdownTime > 0) {
        playTinkSound();
      }
      setCountdownTime(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdownTime, isCountingDown]);

  useEffect(() => {
    if (!showBorderBlink) return;

    const blink2Timer = setTimeout(() => {
      setShowBorderBlink(false);
    }, 500);

    const blink3Timer = setTimeout(() => {
      setShowBorderBlink(true);
    }, 500);

    const blink4Timer = setTimeout(() => {
      setShowBorderBlink(false);
    }, 1000);

    return () => {
      clearTimeout(blink2Timer);
      clearTimeout(blink3Timer);
      clearTimeout(blink4Timer);
    };
  }, [showBorderBlink]);

  useEffect(() => {
    if (isCountingDown || timeLeft <= 0 || hasEnded) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, hasEnded, isCountingDown]);

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

      oscillator.frequency.value = 1000;
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

  const wipeProgress = 1 - (countdownTime / 7);

  return (
    <div className={`relative flex flex-col h-full bg-gray-900 transition-all duration-100 ${
      showBorderBlink ? 'border-4 border-white' : 'border-4 border-transparent'
    }`}>
      {!isCountingDown && showTimer && (
        <div className="flex-shrink-0">
          <VisualTimerBar
            timeRemaining={timeLeft}
            totalTime={duration}
          />
        </div>
      )}

      <div className="flex-shrink-0 px-3 sm:px-6 py-2.5 sm:py-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center gap-2 sm:gap-4">
        {gameRef.current?.loadNextPuzzle && (
          <div className="flex-1 flex justify-center">
            <button
              onClick={() => gameRef.current?.loadNextPuzzle?.()}
              className="px-4 sm:px-6 py-2 bg-cyan-500 active:bg-cyan-600 text-white rounded-lg font-semibold text-xs sm:text-sm transition-colors touch-manipulation"
            >
              Next Question
            </button>
          </div>
        )}

        <button
          onClick={handleQuitClick}
          disabled={hasEnded}
          className="px-4 sm:px-6 py-2 bg-blue-600 active:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap touch-manipulation"
        >
          {hasEnded ? 'Round Complete' : 'Next Round'}
        </button>
      </div>

      <div className={`flex-1 overflow-auto relative ${hasEnded ? 'pointer-events-none opacity-50' : ''}`}>
        {React.cloneElement(children, { ref: gameRef })}
      </div>

      {isCountingDown && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-50">
          <div className="text-center">
            <div className="text-6xl sm:text-8xl font-bold text-white mb-6 sm:mb-8">
              {countdownTime}
            </div>

            <button
              onClick={handleStartButtonClick}
              className="relative px-10 sm:px-12 py-3 sm:py-4 rounded-full font-bold text-lg sm:text-xl overflow-hidden transition-all active:scale-95 shadow-lg touch-manipulation"
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

            <p className="mt-6 sm:mt-8 text-gray-300 text-xs sm:text-sm">
              Press to start now, or wait for auto-start
            </p>
          </div>
        </div>
      )}

      {hasEnded && showCompletionModal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50 rounded-lg">
          <div className="bg-white p-8 sm:p-12 rounded-xl text-center shadow-2xl max-w-sm mx-4">
            <div className="mb-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl sm:text-3xl">✓</span>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Round Complete!</p>
            <p className="text-sm sm:text-base text-gray-600">Calculating your score...</p>
          </div>
        </div>
      )}
    </div>
  );
}
