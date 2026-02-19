import { useState, useEffect, useRef } from "react";
import { playCountdownBeep, playRoundStartChime } from "../lib/sounds";

interface RoundCountdownProps {
  onComplete: () => void;
  from?: number;
  intervalMs?: number;
}

export function RoundCountdown({ onComplete, from = 3, intervalMs = 800 }: RoundCountdownProps) {
  const [count, setCount] = useState(from);
  const [key, setKey] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    playCountdownBeep(from);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(timer);
          if (!completedRef.current) {
            completedRef.current = true;
            playRoundStartChime();
            setTimeout(onComplete, 200);
          }
          return 0;
        }
        playCountdownBeep(next);
        setKey((k) => k + 1);
        return next;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
      <span
        key={key}
        className="font-black text-white animate-countdown-pop"
        style={{
          fontSize: "clamp(5rem, 25vw, 9rem)",
          lineHeight: 1,
          textShadow: "0 0 40px rgba(255,255,255,0.6), 0 0 80px rgba(0,255,255,0.3)",
        }}
      >
        {count > 0 ? count : "GO"}
      </span>
    </div>
  );
}
