/**
 * ColorClash.tsx
 * Stroop-effect color identification game.
 * Integrated with GameWrapper via forwardRef / GameHandle.
 */

import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { GameHandle } from '../lib/gameTypes';
import { playWin, playWrong, preloadGameSounds } from '../lib/sounds';
import { RoundCountdown } from './RoundCountdown';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColorClashProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onTimerPause?: (paused: boolean) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
}

type GamePhase = 'idle' | 'countdown' | 'playing' | 'gameover';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
  { id: 'red',    label: 'RED',    hex: '#FF4444' },
  { id: 'blue',   label: 'BLUE',   hex: '#4488FF' },
  { id: 'green',  label: 'GREEN',  hex: '#22C55E' },
  { id: 'yellow', label: 'YELLOW', hex: '#FFD700' },
];

const THEME = {
  cyan: {
    hex: '#00ffff',
    textShadow: '0 0 10px #00ffff',
    glow: 'rgba(0, 255, 255, 0.4)',
    boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)',
  },
  yellow: {
    hex: '#fbbf24',
    textShadow: '0 0 10px #fbbf24',
  },
  pink: {
    hex: '#ec4899',
    textShadow: '0 0 8px #ec4899',
    boxShadow: '0 0 10px rgba(236, 72, 153, 0.3)',
  },
  green: {
    hex: '#22c55e',
    boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)',
  },
} as const;

const TOTAL_TIME        = 30;
const CORRECT_PTS       = 100;
const STREAK_EVERY      = 5;
const MULTIPLIER        = 1.5;
const INCONGRUENT_RATIO = 0.7;
const MAX_SCORE         = 3000;
const INSTRUCTION_DURATION = 1500; // 1.5 seconds

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function nextStimulus() {
  const inkColor  = randomFrom(COLORS);
  let   wordColor = randomFrom(COLORS);
  if (Math.random() < INCONGRUENT_RATIO) {
    while (wordColor.id === inkColor.id) wordColor = randomFrom(COLORS);
  }
  return { inkColor, wordColor };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700;900&display=swap');

  @keyframes pulse-twice {
    0%,100% { opacity:1; }
    25%      { opacity:0.4; }
    50%      { opacity:1; }
    75%      { opacity:0.4; }
  }
  @keyframes score-pop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.35); }
    70%  { transform: scale(0.95); }
    100% { transform: scale(1); }
  }
  @keyframes word-in {
    from { opacity:0; transform: scale(0.7); }
    to   { opacity:1; transform: scale(1); }
  }
  @keyframes shake {
    0%, 100% { transform: translate(0, 0); }
    25%      { transform: translate(-4px, -4px); }
    50%      { transform: translate(4px, 4px); }
    75%      { transform: translate(-4px, 4px); }
  }

  .animate-pulse-twice { animation: pulse-twice 0.6s ease-in-out; }
  .animate-score-pop   { animation: score-pop 0.4s ease-out; }
  .animate-word-in     { animation: word-in 0.18s ease-out; }
  .animate-shake       { animation: shake 0.3s ease-in-out; }

  .color-clash-word {
    font-family: 'Inter', sans-serif;
    font-size: clamp(52px, 12vw, 80px);
    font-weight: 900;
    letter-spacing: -1px;
    text-shadow: 0 0 30px currentColor, 0 0 60px currentColor;
    user-select: none;
  }

  .instruction-demo {
    font-family: 'Inter', sans-serif;
    font-size: clamp(40px, 10vw, 60px);
    font-weight: 900;
    letter-spacing: -1px;
    text-shadow: 0 0 30px currentColor, 0 0 60px currentColor;
    user-select: none;
  }
`;

// ─── Icon ─────────────────────────────────────────────────────────────────────

function ColorClashIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 0 6px rgba(0,255,255,0.6))' }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M 12 2 A 10 10 0 0 1 12 22" fill="#3b82f6" />
    </svg>
  );
}

// ─── Button Style Helper (DRY) ────────────────────────────────────────────────

function getColorButtonClasses(
  color: typeof COLORS[0],
  feedback: 'correct' | 'wrong' | null,
  stimulus: ReturnType<typeof nextStimulus>
): { className: string; style: React.CSSProperties } {
  const baseClass = 'w-full py-4 rounded-lg font-bold text-base border-2 transition-all duration-150 active:scale-95 touch-manipulation text-white';

  if (!feedback) {
    return {
      className: `${baseClass} hover:opacity-90`,
      style: {
        backgroundColor: color.hex,
        borderColor: color.hex,
        boxShadow: `0 0 15px rgba(${hexToRgb(color.hex).join(',')},0.5)`,
      },
    };
  }

  if (color.id === stimulus.inkColor.id) {
    return {
      className: `${baseClass} ${feedback === 'correct' ? 'animate-pulse' : ''}`,
      style: {
        backgroundColor: color.hex,
        borderColor: '#22c55e',
        boxShadow: `0 0 25px rgba(34, 197, 94, 0.7), inset 0 0 10px rgba(255, 255, 255, 0.2)`,
      },
    };
  }

  return {
    className: `${baseClass}`,
    style: {
      backgroundColor: color.hex,
      borderColor: color.hex,
      opacity: 0.3,
      boxShadow: `0 0 10px rgba(${hexToRgb(color.hex).join(',')},0.2)`,
    },
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
}

// ─── Component ───────────────────────────────────────────────────────────────

const ColorClash = forwardRef<GameHandle, ColorClashProps>((props, ref) => {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [stimulus, setStimulus] = useState(() => nextStimulus());
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [scorePop, setScorePop] = useState(false);
  const [wordKey, setWordKey] = useState(0);
  const [shake, setShake] = useState(false);

  const feedbackRef = useRef<number | null>(null);
  const idleTimeoutRef = useRef<number | null>(null);
  const scoreRef = useRef(score);
  const onCompleteRef = useRef(props.onComplete);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onCompleteRef.current = props.onComplete; }, [props.onComplete]);

  useEffect(() => {
    preloadGameSounds();
  }, []);

  // ── Auto-start countdown after 2 seconds of instructions ──────────────────
  useEffect(() => {
    if (phase === 'idle') {
      idleTimeoutRef.current = window.setTimeout(() => {
        setPhase('countdown');
      }, 3500);
    }
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [phase]);

  // ── GameHandle ──────────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: scoreRef.current,
      maxScore: MAX_SCORE,
    }),
    onGameEnd: () => {
      if (feedbackRef.current) clearTimeout(feedbackRef.current);
      setPhase('gameover');
      onCompleteRef.current?.(scoreRef.current, MAX_SCORE, props.timeRemaining);
    },
    pauseTimer: false,
    canSkipQuestion: false,
    hideTimer: true,
  }), [props.timeRemaining]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    if (feedbackRef.current) clearTimeout(feedbackRef.current);
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
  }, []);

  // ── Start Game (from countdown) ──────────────────────────────────────────────
  const startGame = useCallback(() => {
    setScore(0);
    setStreak(0);
    setMultiplier(1);
    setFeedback(null);
    setStimulus(nextStimulus());
    setWordKey(k => k + 1);
    setPhase('playing');
  }, []);

  // ── Tap handler ─────────────────────────────────────────────────────────────
  const handleTap = useCallback((colorId: string) => {
    if (phase !== 'playing' || feedback) return;

    const correct = colorId === stimulus.inkColor.id;

    if (correct) {
      const pts = Math.round(CORRECT_PTS * multiplier);
      setScore(s => {
        const next = Math.max(0, s + pts);
        props.onScoreUpdate?.(next, MAX_SCORE);
        return next;
      });
      setScorePop(true);
      setTimeout(() => setScorePop(false), 400);
      setStreak(prev => {
        const next = prev + 1;
        setMultiplier(next % STREAK_EVERY === 0 ? MULTIPLIER : 1);
        return next;
      });
      playWin(0.7);
    } else {
      setStreak(0);
      setMultiplier(1);
      setShake(true);
      playWrong(0.5);
      setTimeout(() => setShake(false), 300);
    }

    setFeedback(correct ? 'correct' : 'wrong');
    feedbackRef.current = window.setTimeout(() => {
      setFeedback(null);
      setStimulus(nextStimulus());
      setWordKey(k => k + 1);
    }, 300);
  }, [phase, feedback, stimulus, multiplier, props]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const timerPct = props.timeRemaining ? (props.timeRemaining / TOTAL_TIME) * 100 : 0;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{styles}</style>
      <div className="min-h-screen bg-black flex items-start justify-center p-2 pt-3">
        <div className="w-full max-w-sm text-white">

          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <ColorClashIcon size={18} />
              <h2 className="text-xs sm:text-sm font-bold text-cyan-400"
                style={{ textShadow: THEME.cyan.textShadow }}>
                Color Clash
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {multiplier > 1 && (
                <span className="text-pink-400 text-xs font-bold"
                  style={{ textShadow: THEME.pink.textShadow }}>
                  ×{multiplier}
                </span>
              )}
              {phase === 'playing' && (
                <span className="text-cyan-300 text-xs sm:text-sm">
                  Score: <strong
                    className={`text-yellow-400 tabular-nums inline-block ${scorePop ? 'animate-score-pop' : ''}`}
                    style={{ textShadow: THEME.yellow.textShadow }}
                  >{score}</strong>
                </span>
              )}
            </div>
          </div>

          {/* ── Timer Bar (only during gameplay) ── */}
          {phase === 'playing' && (
            <div className="w-full mb-3">
              <div className="w-full h-2 bg-black rounded-lg border-2 border-cyan-400 overflow-hidden"
                style={{ boxShadow: '0 0 15px rgba(0,255,255,0.4), inset 0 0 10px rgba(0,255,255,0.1)' }}>
                <div className="h-full bg-cyan-400 transition-all duration-1000"
                  style={{ width: `${timerPct}%`, boxShadow: '0 0 20px #00ffff' }} />
              </div>
            </div>
          )}

          {/* ── IDLE: Instructions Screen ── */}
          {phase === 'idle' && (
            <div className="relative bg-black border-2 border-cyan-400 rounded-lg overflow-hidden mb-3 flex flex-col items-center justify-center p-6"
              style={{
                height: '420px',
                boxShadow: '0 0 15px rgba(0,255,255,0.3), inset 0 0 20px rgba(0,255,255,0.1)',
              }}>
              <div className="text-center space-y-6 w-full">
                <div className="text-cyan-300 text-xs sm:text-sm leading-snug">
                  <p>Click the button that matches the<br/><strong className="text-cyan-400">COLOR</strong> of the displayed word,<br/>not the word itself.</p>
                </div>
                <div>
                  <div className="text-xs text-cyan-300 mb-3">Example:</div>
                  <div className="instruction-demo text-lg sm:text-2xl mb-3" style={{ color: '#FF4444' }}>
                    BLUE
                  </div>
                  <div className="text-xs sm:text-sm text-cyan-300">
                    is written in RED, so click the
                  </div>
                  <button className="inline-block mt-2 px-4 py-2 rounded-lg font-bold text-white text-sm sm:text-base transition-all active:scale-95"
                    style={{
                      backgroundColor: '#FF4444',
                      borderColor: '#FF4444',
                      border: '2px solid #FF4444',
                      boxShadow: '0 0 12px rgba(255, 68, 68, 0.6)',
                    }}>
                    RED
                  </button>
                  <div className="text-xs text-cyan-300 mt-2">button</div>
                </div>
              </div>
            </div>
          )}

          {/* ── COUNTDOWN: Starting screen ── */}
          {phase === 'countdown' && (
            <div className="relative bg-black border-2 border-cyan-400 rounded-lg overflow-hidden mb-3 flex items-center justify-center"
              style={{
                height: '280px',
                boxShadow: '0 0 15px rgba(0,255,255,0.3), inset 0 0 20px rgba(0,255,255,0.1)',
              }}>
              <RoundCountdown onComplete={startGame} />
            </div>
          )}

          {/* ── PLAYING: Play Area ── */}
          {phase === 'playing' && (
            <div className={`relative bg-black border-2 border-cyan-400 rounded-lg overflow-hidden mb-3 flex items-center justify-center ${shake ? 'animate-shake' : ''}`}
              style={{
                height: '180px',
                boxShadow: '0 0 15px rgba(0,255,255,0.3), inset 0 0 20px rgba(0,255,255,0.1)',
              }}>
              <span key={wordKey} className="color-clash-word animate-word-in"
                style={{ color: stimulus.inkColor.hex }}>
                {stimulus.wordColor.label}
              </span>
            </div>
          )}

          {/* ── GAMEOVER: End state ── */}
          {phase === 'gameover' && (
            <div className="relative bg-black border-2 border-cyan-400 rounded-lg overflow-hidden mb-3 flex flex-col items-center justify-center"
              style={{
                height: '200px',
                boxShadow: '0 0 15px rgba(0,255,255,0.3), inset 0 0 20px rgba(0,255,255,0.1)',
              }}>
              <div className="text-center">
                <div className="text-red-500 text-lg font-bold mb-2">Game Over!</div>
                <div className="text-cyan-300 text-sm">
                  Final Score: <strong className="text-yellow-400 text-xl">{score}</strong>
                </div>
              </div>
            </div>
          )}

          {/* ── Color Buttons (playing only) ── */}
          {phase === 'playing' && (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {COLORS.map(color => {
                  const { className, style } = getColorButtonClasses(color, feedback, stimulus);
                  return (
                    <button key={color.id}
                      onClick={() => handleTap(color.id)}
                      disabled={!!feedback}
                      className={className}
                      style={style}
                      data-color={color.id}>
                      {color.label}
                    </button>
                  );
                })}
              </div>
              <div className="text-center text-xs text-cyan-300">
                Click the button that matches the font color
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
});

ColorClash.displayName = 'ColorClash';

export default ColorClash;
export { ColorClashIcon };