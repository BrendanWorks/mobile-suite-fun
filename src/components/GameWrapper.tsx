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
  const timerRef = useRef<number | null>(null);
  const childrenRef = useRef<any>(null);

  useEffect(() => {
    if (isActive && timeRemaining > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeRemaining]);

  const handleTimeUp = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);

    if (childrenRef.current?.getScore) {
      const { score, maxScore } = childrenRef.current.getScore();
      onComplete(score, maxScore);
    } else {
      onComplete(0, 100);
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
            onComplete: (score: number, maxScore: number) => {
              if (timerRef.current) clearInterval(timerRef.current);
              setIsActive(false);
              onComplete(score, maxScore);
            },
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
