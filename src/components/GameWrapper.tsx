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
  const hasReportedCompletion = useRef(false);  // ← NEW safeguard against double-calls

  useEffect(() => {
    if (childrenRef.current?.hideTimer) {
      setHideTimerBar(true);
    }
  }, [children]);

  useEffect(() => {
    if (!isActive) return;

    const intervalTime = isFastCountdown ? 25 : 1000;
    const decrement = isFastCountdown ? 3 : 1;

    console.log('Timer interval started/updated', { 
      isFastCountdown, intervalTime, decrement, currentTime: timeRemaining 
    });

    timerRef.current = window.setInterval(() => {
      // Pause check only in normal mode
      if (!isFastCountdown) {
        const shouldPause = childrenRef.current?.pauseTimer !== false;
        if (shouldPause) {
          console.log('Timer paused by child game');
          return;
        }
      }

      setTimeRemaining((prev) => {
        if (prev <= 0) return 0;  // Already done, no-op

        const newTime = Math.max(0, prev - decrement);

        // Trigger completion logic only once when we cross to zero in fast mode
        if (newTime <= 0 && isFastCountdown && !hasReportedCompletion.current) {
          console.log(`Fast countdown hit zero — starting ${POST_ZERO_LINGER_MS}ms linger`);

          // Clear any existing linger to avoid multiples
          if (lingerTimeoutRef.current) {
            clearTimeout(lingerTimeoutRef.current);
          }

          lingerTimeoutRef.current = window.setTimeout(() => {
            if (hasReportedCompletion.current) {
              console.log('Completion already reported during linger — skipping');
              return;
            }

            console.log('Linger finished → reporting completion now');
            hasReportedCompletion.current = true;
            handleEarlyCompletion();
          }, POST_ZERO_LINGER_MS);
        }

        return newTime;
      });
    }, intervalTime);

    return () => {
      console.log('Cleaning up timer + any pending linger');
      if (timerRef.current) clearInterval(timerRef.current);
      if (lingerTimeoutRef.current) clearTimeout(lingerTimeoutRef.current);
    };
  }, [isActive, isFastCountdown]);  // ← REMOVED timeRemaining from deps → stable interval

  const handleEarlyCompletion = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setIsFastCountdown(false);

    const final = finalScoreRef.current;
    if (final) {
      console.log('Reporting early completion with stored score:', final);
      onComplete(final.score, final.maxScore, final.timeRemaining);
    } else {
      console.warn('No final score stored — using fallback');
      onComplete(0, 100, 0);
    }
  };

  const handleTimeUp = () => {
    console.log('Natural time up triggered');
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
    console.log('handleGameComplete called (early finish):', { score, maxScore, effectiveRemaining });

    finalScoreRef.current = { score, maxScore, timeRemaining: effectiveRemaining };

    if (hideTimerBar) {
      console.log('Hidden timer game → immediate complete');
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
      // Completion handled by timer when it reaches 0 + linger
    } else {
      console.log('Little time left → direct complete');
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