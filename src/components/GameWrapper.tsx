import { useState, useEffect, useRef, ReactNode } from 'react';
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
  const timerRef = useRef<number | null>(null);
  const childrenRef = useRef<any>(null);
  const gameCompletedRef = useRef(false);

  useEffect(() => {
    if (isActive && timeRemaining > 0) {
      // Fast countdown: 50ms intervals, subtract 0.05
      // Normal countdown: 1000ms intervals, subtract 1
      const intervalTime = isFastCountdown ? 50 : 1000;
      const decrement = isFastCountdown ? 0.05 : 1;

      timerRef.current = window.setInterval(() => {
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
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    
    if (!gameCompletedRef.current) {
      gameCompletedRef.current = true;
      if (childrenRef.current?.getGameScore) {
        const { score, maxScore } = childrenRef.current.getGameScore();
        onComplete(score, maxScore);
      } else {
        onComplete(0, 100);
      }
    }
  };

  const handleGameComplete = (score: number, maxScore: number) => {
    if (gameCompletedRef.current) return; // Prevent double completion
    gameCompletedRef.current = true;

    // If more than 2 seconds remaining, trigger fast countdown
    if (timeRemaining > 2) {
      setIsFastCountdown(true);
      // Timer will finish naturally and call onComplete
    } else {
      // Less than 2 seconds, complete immediately
      if (timerRef.current) clearInterval(timerRef.current);
      setIsActive(false);
      onComplete(score, maxScore);
    }
  };

  const cloneChildren = () => {
    if (!children) return null;
    
    return (children as any).type
      ? {
          ...children,
          ref: childrenRef,
          props: {
            ...(children as any).props,
            onScoreUpdate,
            onComplete: handleGameComplete,
          },
        }
      : children;
  };

  return (
    <div className="h-full w-full flex flex-col bg-gray-900">
      <VisualTimerBar totalTime={duration} timeRemaining={timeRemaining} />
      <div className="flex-1 overflow-hidden">
        {cloneChildren()}
      </div>
    </div>
  );
}