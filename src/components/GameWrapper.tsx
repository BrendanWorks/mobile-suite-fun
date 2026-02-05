import React, { useState, useEffect, useRef, ReactNode } from 'react';
import VisualTimerBar from './VisualTimerBar';

interface GameWrapperProps {
  duration: number;
  onComplete: (rawScore: number, maxScore: number, timeRemaining?: number) => void;
  gameName: string;
  onScoreUpdate: (score: number, maxScore: number) => void;
  children: ReactNode;
}

export default function GameWrapper({
  duration,
  onComplete,
  gameName,
  onScoreUpdate,
  children
}: GameWrapperProps) {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isActive, setIsActive] = useState(true);
  const [isFastCountdown, setIsFastCountdown] = useState(false);
  const [hideTimerBar, setHideTimerBar] = useState(false);

  const timerRef = useRef<number | null>(null);
  const childrenRef = useRef<any>(null);
  const gameCompletedRef = useRef(false);
  const finalScoreRef = useRef<{ score: number; maxScore: number; timeRemaining: number } | null>(null);

  // Check if game wants to hide timer (e.g. Snake)
  useEffect(() => {
    if (childrenRef.current?.hideTimer) {
      setHideTimerBar(true);
    }
  }, [children]);

  useEffect(() => {
    if (!isActive) return;

    const intervalTime = isFastCountdown ? 30 : 1000;   // 25ms → very smooth fast drain
    const decrement = isFastCountdown ? 2 : 1;          // ~0.8–1.2s total drain for most cases

    console.log('⏱️ Timer running:', { 
      isActive, 
      isFastCountdown, 
      intervalTime, 
      decrement, 
      currentTime: timeRemaining.toFixed(1) 
    });

    timerRef.current = window.setInterval(() => {
      // Normal pause check only applies outside fast mode
      if (!isFastCountdown) {
        const shouldPause = childrenRef.current?.pauseTimer !== false;
        if (shouldPause) {
          console.log('⏸️ Timer paused by game');
          return;
        }
      }

      setTimeRemaining((prev) => {
        const newTime = Math.max(0, prev - decrement);

        // When we hit zero during fast countdown → trigger completion
        if (newTime <= 0 && isFastCountdown) {
          console.log('⏱️ Fast countdown reached zero → calling onComplete');
          handleEarlyCompletion();
        }

        return newTime;
      });
    }, intervalTime);

    return () => {
      if (timerRef.current) {
        console.log('⏱️ Cleaning up timer');
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, isFastCountdown, timeRemaining]); // ← added timeRemaining dep so it reacts to changes

  const handleEarlyCompletion = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setIsFastCountdown(false);

    const final = finalScoreRef.current;
    if (final) {
      console.log('⏰ Fast countdown done → reporting final score:', final);
      onComplete(final.score, final.maxScore, final.timeRemaining);
    } else {
      // Fallback (shouldn't happen)
      console.warn('No final score stored during fast countdown');
      onComplete(0, 100, 0);
    }
  };

  const handleTimeUp = () => {
    console.log('⏰ Natural time up');
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setIsFastCountdown(false);

    if (finalScoreRef.current) {
      const f = finalScoreRef.current;
      onComplete(f.score, f.maxScore, f.timeRemaining);
      return;
    }

    if (!gameCompletedRef.current) {
      gameCompletedRef.current = true;

      if (childrenRef.current?.onGameEnd) {
        childrenRef.current.onGameEnd();
      }

      if (finalScoreRef.current) {
        const f = finalScoreRef.current;
        onComplete(f.score, f.maxScore, f.timeRemaining);
        return;
      }

      if (childrenRef.current?.getGameScore) {
        const { score, maxScore } = childrenRef.current.getGameScore();
        onComplete(score, maxScore, 0);
      } else {
        onComplete(0, 100, 0);
      }
    }
  };

  const handleGameComplete = (score: number, maxScore: number, remaining?: number) => {
    if (gameCompletedRef.current) return;
    gameCompletedRef.current = true;

    const effectiveRemaining = remaining ?? timeRemaining;
    console.log('🎮 Game completed early:', { score, maxScore, effectiveRemaining, hideTimerBar });

    // Store final score + the time we had when completed (for bonus etc.)
    finalScoreRef.current = { score, maxScore, timeRemaining: effectiveRemaining };

    if (hideTimerBar) {
      console.log('🎮 Hidden timer → immediate advance');
      if (timerRef.current) clearInterval(timerRef.current);
      setIsActive(false);
      setIsFastCountdown(false);
      onComplete(score, maxScore, effectiveRemaining);
      return;
    }

    // For normal games: fast zoom if time left
    if (effectiveRemaining > 1.5) {
      console.log(`🎮 Starting FAST ZOOM from ${effectiveRemaining.toFixed(1)}s`);
      setIsFastCountdown(true);
      // Note: we do NOT call onComplete here anymore — wait until timer hits 0
    } else {
      // Very little time left → just end normally
      console.log('🎮 Little time left → immediate end');
      if (timerRef.current) clearInterval(timerRef.current);
      setIsActive(false);
      setIsFastCountdown(false);
      onComplete(score, maxScore, effectiveRemaining);
    }
  };

  const cloneChildren = () => {
    if (!children) return null;
    if (React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref: childrenRef,
        onScoreUpdate,
        onComplete: handleGameComplete,
        timeRemaining,
        duration,
      });
    }
    return children;
  };

  return (
    <div className="h-full w-full flex flex-col bg-black" style={{ position: 'relative' }}>
      {!hideTimerBar && <VisualTimerBar totalTime={duration} timeRemaining={timeRemaining} />}
      <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
        {cloneChildren()}
      </div>
    </div>
  );
}