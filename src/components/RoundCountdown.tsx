import { useState, useEffect } from "react";

interface RoundCountdownProps {
  onComplete: () => void;
  from?: number;
  intervalMs?: number;
}

export function RoundCountdown({ onComplete, from = 3, intervalMs = 800 }: RoundCountdownProps) {
  const [count, setCount] = useState(from);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
      <span
        className="font-black text-white animate-ping"
        style={{ fontSize: "clamp(5rem, 25vw, 9rem)", lineHeight: 1 }}
      >
        {count}
      </span>
    </div>
  );
}
