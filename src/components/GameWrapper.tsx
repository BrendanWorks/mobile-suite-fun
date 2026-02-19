import React, { useState, useEffect, useRef, useMemo, ReactNode } from 'react';
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
  const POST_ZERO_LINGER_MS = 700;

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

  useEffect(() => {
    if (childrenRef.current?.hideTimer) {
      setHideTimerBar(true);
    }
  }, [children]);

  useEffect(() => {
    if (!isActive) return;

    const intervalTime = isFastCountdown ? 25 : 1000;
    const decrement = isFastCountdown ? 3 : 1;

    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        let newTime = prev;

        if (newTime <= 0) {
          if (!hasReportedCompletion.current) {
            handleTimeUp();
          }
          return 0;
        }

        if (isFastCountdown) {
          newTime = Math.max(0, prev - decrement);
        } else {
          // pauseTimer: true → paused, false/undefined → running
          const isPaused = childrenRef.current?.pauseTimer === true;
          if (!isPaused) {
            newTime = Math.max(0, prev - decrement);
          }
        }

        if (newTime <= 0) {
          if (isFastCountdown) {
            if (lingerTimeoutRef.current) clearTimeout(lingerTimeoutRef.current);

            lingerTimeoutRef.current = window.setTimeout(() => {
              if (hasReportedCompletion.current) return;
              hasReportedCompletion.current = true;
              handleEarlyCompletion();
            }, POST_ZERO_LINGER_MS);
          } else {
            handleTimeUp();
          }
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
    finalScoreRef.current = { score, maxScore, timeRemaining: effectiveRemaining };

    if (hideTimerBar) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsActive(false);
      setIsFastCountdown(false);
      hasReportedCompletion.current = true;
      onComplete(score, maxScore, effectiveRemaining);
      return;
    }

    if (effectiveRemaining > 1.5) {
      setIsFastCountdown(true);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsActive(false);
      setIsFastCountdown(false);
      hasReportedCompletion.current = true;
      onComplete(score, maxScore, effectiveRemaining);
    }
  };

  const clonedChildren = useMemo(() => {
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
  }, [children, onScoreUpdate, timeRemaining, duration]);

  return (
    <div className="h-full w-full flex flex-col bg-black" style={{ position: 'relative' }}>
      {!hideTimerBar && <VisualTimerBar totalTime={duration} timeRemaining={timeRemaining} />}
      <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
        {clonedChildren}
      </div>
    </div>
  );
}
