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
  // ┌──────────────────────────────────────────────────────────────┐
  // │ ADJUST THIS VALUE to control how long the bar stays at zero  │
  // │ before switching to results screen                           │
  // │                                                              │
  // │ 400–600 ms = quick but visible settle                        │
  // │ 800–1200 ms = more dramatic "zoom complete" feel             │
  // └──────────────────────────────────────────────────────────────┘
  const POST_ZERO_LINGER_MS = 700;   // ← Tune this number!

  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isActive, setIsActive] = useState(true);
  const [isFastCountdown, setIsFastCountdown] = useState(false);
  const [hideTimerBar, setHideTimerBar] = useState(false);

  const timerRef = useRef<number | null>(null);
  const lingerTimeoutRef = useRef<number | null>(null);
  const childrenRef = useRef<any>(null);
  const gameCompletedRef = useRef(false);
  const finalScoreRef = useRef<{ score: number; maxScore: number; timeRemaining: number } | null>(null);

  useEffect(() => {
    if (childrenRef.current?.hideTimer) {
      setHideTimerBar(true);
    }
  }, [children]);

  useEffect(() => {
    if (!isActive) return;

    const intervalTime = isFastCountdown ? 25 : 1000;
    const decrement = isFastCountdown ? 3 : 1;

    console.log('⏱️ Timer running:', { 
      isActive, isFastCountdown, intervalTime, decrement, current: timeRemaining.toFixed(1) 
    });

    timerRef.current = window.setInterval(() => {
      if (!isFastCountdown) {
        const shouldPause = childrenRef.current?.pauseTimer !== false;
        if (shouldPause) return;
      }

      setTimeRemaining((prev) => {
        const newTime = Math.max(0, prev - decrement);

        if (newTime <= 0 && isFastCountdown) {
          // Instead of calling onComplete immediately, start linger delay
          console.log(`⏱️ Reached zero during fast countdown — lingering ${POST_ZERO_LINGER_MS}ms`);
          if (lingerTimeoutRef.current) clearTimeout(lingerTimeoutRef.current);
          
          lingerTimeoutRef.current = window.setTimeout(() => {
            console.log('⏱️ Linger complete → reporting final score');
            handleEarlyCompletion();
          }, POST_ZERO_LINGER_MS);
        }

        return newTime;
      });
    }, intervalTime);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (lingerTimeoutRef.current) clearTimeout(lingerTimeoutRef.current);
    };
  }, [isActive, isFastCountdown]);

  const handleEarlyCompletion = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setIsFastCountdown(false);

    const final = finalScoreRef.current;
    if (final) {
      onComplete(final.score, final.maxScore, final.timeRemaining);
    } else {
      onComplete(0, 100, 0);
    }
  };

  const handleTimeUp = () => {
    console.log('⏰ Natural time up (no linger needed)');
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setIsFastCountdown(false);

    const final = finalScoreRef.current;
    if (final) {
      onComplete(final.score, final.maxScore, final.timeRemaining);
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

    finalScoreRef.current = { score, maxScore, timeRemaining: effectiveRemaining };

    if (hideTimerBar) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsActive(false);
      setIsFastCountdown(false);
      onComplete(score, maxScore, effectiveRemaining);
      return;
    }

    if (effectiveRemaining > 1.5) {
      console.log(`🎮 Starting FAST ZOOM from ${effectiveRemaining.toFixed(1)}s`);
      setIsFastCountdown(true);
      // Completion happens after zoom + linger (see timer logic)
    } else {
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