import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface GameWrapperProps {
  children: React.ReactNode;
  duration?: number;
  onComplete: (score: number) => void;
  gameName: string;
}

export default function GameWrapper({
  children,
  duration = 60,
  onComplete,
  gameName
}: GameWrapperProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0 && !hasCompleted) {
      setHasCompleted(true);
      const score = Math.floor(50 + Math.random() * 50);
      onComplete(score);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, hasCompleted, onComplete]);

  const handleManualComplete = () => {
    if (!hasCompleted) {
      setHasCompleted(true);
      const score = Math.floor(70 + Math.random() * 30);
      onComplete(score);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-4 bg-gray-100 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <Clock className={`w-5 h-5 ${timeLeft < 10 ? 'text-red-600 animate-pulse' : 'text-gray-600'}`} />
          <span className={`font-bold ${timeLeft < 10 ? 'text-red-600' : 'text-gray-700'}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
        <button
          onClick={handleManualComplete}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Finish Round
        </button>
      </div>

      <div className={hasCompleted ? 'pointer-events-none opacity-50' : ''}>
        {children}
      </div>

      {hasCompleted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <div className="bg-white p-6 rounded-lg text-center">
            <p className="text-xl font-bold text-gray-800 mb-2">Round Complete!</p>
            <p className="text-gray-600">Calculating score...</p>
          </div>
        </div>
      )}
    </div>
  );
}
