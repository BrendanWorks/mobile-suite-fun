import React, { useState, useEffect, useRef, ReactNode } from 'react';
import VisualTimerBar from './VisualTimerBar';

interface GameWrapperProps {
  duration: number;
  onComplete: (rawScore: number, maxScore: number) => void;
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
  const finalScoreRef = useRef<{ score: number; maxScore: number } | null>(null);

  // Check if game wants to hide timer (set by game's imperative handle)
  useEffect(() => {
    if (childrenRef.current?.hideTimer) {
      setHideTimerBar(true);
    }
  }, [children]);

  useEffect(() => {
    if (isActive && timeRemaining > 0) {
      const intervalTime = isFastCountdown ? 50 : 1000;
      const decrement = isFastCountdown ? 0.05 : 1;

      timerRef.current = window.setInterval(() => {
        // Don't start countdown until child component is ready
        // This prevents timer from running while images are loading
        if (!childrenRef.current || childrenRef.current?.pauseTimer === true) {
          return; // Skip this tick if child not ready or explicitly paused
        }

        setTimeRemaining((prev) => {
          const newTime = prev - decrement;
          if (newTime <= 0) {
            handleTimeUp();
            return 0;
          }
          return newTime;
        });
      }, intervalTime);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeRemaining, isFastCountdown]);

  const handleTimeUp = () => {
    console.log('⏰ GameWrapper.handleTimeUp called');
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);

    if (!gameCompletedRef.current) {
      gameCompletedRef.current = true;

      // Use stored final score if available (from early completion)
      if (finalScoreRef.current) {
        console.log('⏰ Using stored final score:', finalScoreRef.current);
        onComplete(finalScoreRef.current.score, finalScoreRef.current.maxScore);
        return;
      }

      // Call onGameEnd if available to let game know it's ending
      // Note: onGameEnd might call onComplete/handleGameComplete, setting finalScoreRef
      if (childrenRef.current?.onGameEnd) {
        console.log('⏰ Calling onGameEnd');
        childrenRef.current.onGameEnd();
      }

      // Check again if onGameEnd set the finalScoreRef
      if (finalScoreRef.current) {
        // onGameEnd already triggered score reporting, we're done
        console.log('⏰ onGameEnd set finalScoreRef:', finalScoreRef.current);
        return;
      }

      // Otherwise, get score directly
      if (childrenRef.current?.getGameScore) {
        const { score, maxScore } = childrenRef.current.getGameScore();
        console.log('⏰ Getting score from getGameScore:', { score, maxScore });
        onComplete(score, maxScore);
      } else {
        console.log('⏰ No getGameScore method, using default 0/100');
        onComplete(0, 100);
      }
    }
  };

  const handleGameComplete = (score: number, maxScore: number) => {
    if (gameCompletedRef.current) return;
    gameCompletedRef.current = true;

    console.log('🎮 GameWrapper.handleGameComplete:', { score, maxScore, timeRemaining });

    // Store the final score for use when countdown completes
    finalScoreRef.current = { score, maxScore };

    if (timeRemaining > 2) {
      setIsFastCountdown(true);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsActive(false);
      onComplete(score, maxScore);
    }
  };

  const cloneChildren = () => {
    if (!children) return null;

    if (React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref: childrenRef,
        onScoreUpdate,
        onComplete: handleGameComplete,
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