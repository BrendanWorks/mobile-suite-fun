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

  // Check if game wants to hide timer
  useEffect(() => {
    if (childrenRef.current?.hideTimer) {
      setHideTimerBar(true);
    }
  }, [children]);

  useEffect(() => {
    if (!isActive) return;

    const intervalTime = isFastCountdown ? 30 : 1000; // faster ticks during zoom
    const decrement = isFastCountdown ? 2.5 : 1;      // aggressive drain → ~0.6–1s for most cases

    console.log('⏱️ Timer effect running:', { isActive, isFastCountdown, intervalTime, decrement });

    timerRef.current = window.setInterval(() => {
      if (!isFastCountdown) {
        const shouldPause = childrenRef.current?.pauseTimer !== false;
        if (shouldPause) {
          console.log('⏸️ Timer paused by game');
          return;
        }
      }

      setTimeRemaining((prev) => {
        const newTime = Math.max(0, prev - decrement);
        if (newTime <= 0) {
          handleTimeUp();
        }
        return newTime;
      });
    }, intervalTime);

    return () => {
      if (timerRef.current) {
        console.log('⏱️ Cleaning up timer interval');
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, isFastCountdown]);

  const handleTimeUp = () => {
    console.log('⏰ handleTimeUp called');
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setIsFastCountdown(false);

    const final = finalScoreRef.current;
    if (final) {
      console.log('⏰ Using stored final score:', final);
      onComplete(final.score, final.maxScore, final.timeRemaining);
      return;
    }

    if (!gameCompletedRef.current) {
      gameCompletedRef.current = true;

      if (childrenRef.current?.onGameEnd) {
        console.log('⏰ Calling onGameEnd');
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
    console.log('🎮 handleGameComplete:', { score, maxScore, effectiveRemaining, hideTimerBar });

    finalScoreRef.current = { score, maxScore, timeRemaining: effectiveRemaining };

    if (hideTimerBar) {
      console.log('🎮 Hidden timer game → immediate complete');
      if (timerRef.current) clearInterval(timerRef.current);
      setIsActive(false);
      setIsFastCountdown(false);
      onComplete(score, maxScore, effectiveRemaining);
      return;
    }

    // Fast zoom if meaningful time left
    if (effectiveRemaining > 1.5) {
      console.log(`🎮 Starting FAST COUNTDOWN from ${effectiveRemaining.toFixed(1)}s`);
      setIsFastCountdown(true);
    } else {
      console.log('🎮 Little time left → immediate complete');
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
        onComplete: handleGameComplete,   // ← now passes 3 args
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