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
  const POST_ZERO_LINGER_MS = 700;   // ← Tune this (500–1000 ms usually feels best)

  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isActive, setIsActive] = useState(true);
  const [isFastCountdown, setIsFastCountdown] = useState(false);
  const [hideTimerBar, setHideTimerBar] = useState(false);

  const timerRef = useRef<number | null>(null);
  const lingerTimeoutRef = useRef<number | null>(null);
  const childrenRef = useRef<any>(null);
  const gameCompletedRef = useRef(false);
  const finalScoreRef = useRef<{ score: number; maxScore: number; timeRemaining: number } | null>(null);
  const hasReportedCompletion = useRef(false);

  // Check if game wants to hide timer
  useEffect(() => {
    if (childrenRef.current?.hideTimer) {
      setHideTimerBar(true);
    }
  }, [children]);

  useEffect(() => {
    if (!isActive) return;

    const intervalTime = isFastCountdown ? 25 : 1000;
    const decrement = isFastCountdown ? 3 : 1;

    console.log('Timer interval active:', { 
      isFastCountdown, intervalTime, decrement, currentTime: timeRemaining.toFixed(1) 
    });

    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        let newTime = prev;

        // Always check if we're already at/below zero
        if (newTime <= 0) {
          if (!hasReportedCompletion.current) {
            console.log('Time already <=0 — triggering completion');
            handleTimeUp();
          }
          return 0;
        }

        // Decrement only if allowed
        if (isFastCountdown) {
          // Fast mode always decrements (no pause)
          newTime = Math.max(0, prev - decrement);
        } else {
          // Normal mode: respect child's pause request
          const shouldPause = childrenRef.current?.pauseTimer !== false;
          if (!shouldPause) {
            newTime = Math.max(0, prev - decrement);
          } else {
            console.log('Timer tick skipped (paused by game)');
          }
        }

        // Check if we crossed to zero this tick
        if (newTime <= 0) {
          if (isFastCountdown) {
            console.log(`Fast countdown reached zero — lingering ${POST_ZERO_LINGER_MS}ms`);
            if (lingerTimeoutRef.current) clearTimeout(lingerTimeoutRef.current);

            lingerTimeoutRef.current = window.setTimeout(() => {
              if (hasReportedCompletion.current) {
                console.log('Already completed during linger — skipping');
                return;
              }
              console.log('Linger finished → final completion');
              hasReportedCompletion.current = true;
              handleEarlyCompletion();
            }, POST_ZERO_LINGER_MS);
          } else {
            console.log('Natural time up → immediate completion');
            handleTimeUp();
          }
        }

        return newTime;
      });
    }, intervalTime);

    return () => {
      console.log('Cleaning up timer interval');
      if (timerRef.current) clearInterval(timerRef.current);
      if (lingerTimeoutRef.current) clearTimeout(lingerTimeoutRef.current);
    };
  }, [isActive, isFastCountdown]);  // Stable deps — no timeRemaining here

  const handleEarlyCompletion = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setIsFastCountdown(false);

    const final = finalScoreRef.current;
    if (final) {
      console.log('handleEarlyCompletion: reporting stored final score', final);
      onComplete(final.score, final.maxScore, final.timeRemaining);
    } else {
      console.warn('No final score — fallback to 0/100');
      onComplete(0, 100, 0);
    }
  };

  const handleTimeUp = () => {
    console.log('handleTimeUp triggered — ending game');
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setIsFastCountdown(false);

    if (hasReportedCompletion.current) return;
    hasReportedCompletion.current = true;

    const final = finalScoreRef.current;
    if (final) {
      onComplete(final.score, final.maxScore, final.timeRemaining);
      return;
    }

    if (!gameCompletedRef.current) {
      gameCompletedRef.current = true;

      if (childrenRef.current?.onGameEnd) {
        console.log('Calling child onGameEnd');
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
    console.log('handleGameComplete (early finish):', { score, maxScore, effectiveRemaining });

    finalScoreRef.current = { score, maxScore, timeRemaining: effectiveRemaining };

    if (hideTimerBar) {
      console.log('Hidden timer → immediate');
      if (timerRef.current) clearInterval(timerRef.current);
      setIsActive(false);
      setIsFastCountdown(false);
      hasReportedCompletion.current = true;
      onComplete(score, maxScore, effectiveRemaining);
      return;
    }

    if (effectiveRemaining > 1.5) {
      console.log(`Starting fast zoom from ${effectiveRemaining.toFixed(1)}s`);
      setIsFastCountdown(true);
      // Completion happens after zoom + linger
    } else {
      console.log('Low time left → direct complete');
      if (timerRef.current) clearInterval(timerRef.current);
      setIsActive(false);
      setIsFastCountdown(false);
      hasReportedCompletion.current = true;
      onComplete(score, maxScore, effectiveRemaining);
    }
  };

  const cloneChildren = () => {
    if (!children) return null;
    if (React.isValidElement(children)) {
      const childProps = (children as React.ReactElement<any>).props;
      return React.cloneElement(children as React.ReactElement<any>, {
        ...childProps,
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