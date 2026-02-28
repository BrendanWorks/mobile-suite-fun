/**
 * ColorClash.tsx
 * Stroop-effect color identification game.
 * Integrated with GameWrapper via forwardRef / GameHandle.
 */

import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { GameHandle } from '../lib/gameTypes';
import { playWin, playWrong, preloadGameSounds } from '../lib/sounds';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColorClashProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onTimerPause?: (paused: boolean) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
  { id: 'red',    label: 'RED',    hex: '#FF4444', border: 'border-red-500',    text: 'text-red-400',    shadow: '0 0 15px rgba(255,68,68,0.4)',  glow: '#FF4444' },
  { id: 'blue',   label: 'BLUE',   hex: '#4488FF', border: 'border-blue-400',   text: 'text-blue-400',   shadow: '0 0 15px rgba(68,136,255,0.4)', glow: '#4488FF' },
  { id: 'green',  label: 'GREEN',  hex: '#22C55E', border: 'border-green-500',  text: 'text-green-400',  shadow: '0 0 15px rgba(34,197,94,0.4)',  glow: '#22c55e' },
  { id: 'yellow', label: 'YELLOW', hex: '#FFD700', border: 'border-yellow-400', text: 'text-yellow-400', shadow: '0 0 15px rgba(255,215,0,0.4)',  glow: '#FFD700' },
];

const TOTAL_TIME        = 30;
const CORRECT_PTS       = 100;
const WRONG_PTS         = -50;
const WRONG_SECS        = 1;
const STREAK_EVERY      = 5;
const MULTIPLIER        = 1.5;
const INCONGRUENT_RATIO = 0.7;

// Max theoretical score: ~1 tap/sec × 30s × 100pts × 1.5 multiplier ≈ 3000
// Keeping it simple and honest:
const MAX_SCORE = 3000;

const GAME_STATES = { IDLE: 'IDLE', PLAYING: 'PLAYING' } as const;

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
`;

// ─── Icon ─────────────────────────────────────────────────────────────────────

function ColorClashIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 0 6px rgba(0,255,255,0.6))' }}>
      <path d="M12 4.5C9.5 4.5 7 6.5 7 9.5C7 11 7.8 12.5 9 13.5C8.5 14.5 8.5 15.8 9 16.8C9.8 18 11 18.5 12 18.5"
        stroke="#00ffff" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M7 9.5C6 9 5.2 8 5.5 6.8C5.8 5.8 7 5.5 7.5 6.2"
        stroke="#00ffff" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M7 13.5C6 13.5 5 12.8 5 11.8"
        stroke="#00ffff" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M12 4.5C14.5 4.5 17 6.5 17 9.5C17 11 16.2 12.5 15 13.5C15.5 14.5 15.5 15.8 15 16.8C14.2 18 13 18.5 12 18.5"
        stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M17 9.5C18 9 18.8 8 18.5 6.8C18.2 5.8 17 5.5 16.5 6.2"
        stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M17 13.5C18 13.5 19 12.8 19 11.8"
        stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <line x1="12" y1="4.5" x2="12" y2="18.5"
        stroke="#ffffff" strokeWidth="1" strokeDasharray="2 2" opacity="0.3"/>
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

const ColorClash = forwardRef<GameHandle, ColorClashProps>((props, ref) => {
  const [gameState,  setGameState]  = useState<'IDLE' | 'PLAYING'>(GAME_STATES.IDLE);
  const [score,      setScore]      = useState(0);
  const [streak,     setStreak]     = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [stimulus,   setStimulus]   = useState(() => nextStimulus());
  const [feedback,   setFeedback]   = useState<'correct' | 'wrong' | null>(null);
  const [scorePop,   setScorePop]   = useState(false);
  const [wordKey,    setWordKey]    = useState(0);
  const [shake,      setShake]      = useState(false);

  const feedbackRef   = useRef<number | null>(null);
  const scoreRef      = useRef(score);
  const onCompleteRef = useRef(props.onComplete);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onCompleteRef.current = props.onComplete; }, [props.onComplete]);

  useEffect(() => {
    preloadGameSounds();
  }, []);

  // ── GameHandle ──────────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: scoreRef.current,
      maxScore: MAX_SCORE,
    }),
    onGameEnd: () => {
      // GameWrapper called time's up — stop everything and report
      if (feedbackRef.current) clearTimeout(feedbackRef.current);
      setGameState(GAME_STATES.IDLE);
      onCompleteRef.current?.(scoreRef.current, MAX_SCORE, props.timeRemaining);
    },
    pauseTimer: false,
    canSkipQuestion: false,
    hideTimer: false,
  }), [props.timeRemaining]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    if (feedbackRef.current) clearTimeout(feedbackRef.current);
  }, []);

  // ── Start ───────────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    setScore(0);
    setStreak(0);
    setMultiplier(1);
    setFeedback(null);
    setStimulus(nextStimulus());
    setWordKey(k => k + 1);
    setGameState(GAME_STATES.PLAYING);
  }, []);

  // ── Tap handler ─────────────────────────────────────────────────────────────
  const handleTap = useCallback((colorId: string) => {
    if (gameState !== GAME_STATES.PLAYING || feedback) return;

    const correct = colorId === stimulus.inkColor.id;

    if (correct) {
      const pts = Math.round(CORRECT_PTS * multiplier);
      setScore(s => {
        const next = s + pts;
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
      setScore(s => {
        const next = s + WRONG_PTS;
        props.onScoreUpdate?.(next, MAX_SCORE);
        return next;
      });
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
  }, [gameState, feedback, stimulus, multiplier, props.onScoreUpdate]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const timerPct = props.timeRemaining ? (props.timeRemaining / TOTAL_TIME) * 100 : 0;
  const isPlaying = gameState === GAME_STATES.PLAYING;

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
                style={{ textShadow: '0 0 10px #00ffff' }}>
                Color Clash
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {multiplier > 1 && (
                <span className="text-pink-400 text-xs font-bold"
                  style={{ textShadow: '0 0 8px #ec4899' }}>
                  ×{multiplier}
                </span>
              )}
              <span className="text-cyan-300 text-xs sm:text-sm">
                Score: <strong
                  className={`text-yellow-400 tabular-nums inline-block ${scorePop ? 'animate-score-pop' : ''}`}
                  style={{ textShadow: '0 0 10px #fbbf24' }}
                >{score}</strong>
              </span>
            </div>
          </div>

          {/* ── Timer Bar ── */}
          <div className="w-full mb-3">
            <div className="w-full h-2 bg-black rounded-lg border-2 border-cyan-400 overflow-hidden"
              style={{ boxShadow: '0 0 15px rgba(0,255,255,0.4), inset 0 0 10px rgba(0,255,255,0.1)' }}>
              <div className="h-full bg-cyan-400 transition-all duration-1000"
                style={{ width: `${timerPct}%`, boxShadow: '0 0 20px #00ffff' }} />
            </div>
          </div>

          {/* ── Play Area ── */}
          <div className={`relative bg-black border-2 border-cyan-400 rounded-lg overflow-hidden mb-3 flex items-center justify-center ${shake ? 'animate-shake' : ''}`}
            style={{
              height: '180px',
              boxShadow: '0 0 15px rgba(0,255,255,0.3), inset 0 0 20px rgba(0,255,255,0.1)',
            }}>
            {gameState === GAME_STATES.IDLE && (
              <div className="text-center px-4">
                <p className="text-cyan-300 text-sm mb-1">Tap the button matching the</p>
                <p className="text-cyan-400 font-bold text-sm">INK COLOR — not the word!</p>
              </div>
            )}
            {isPlaying && (
              <span key={wordKey} className="color-clash-word animate-word-in"
                style={{ color: stimulus.inkColor.hex }}>
                {stimulus.wordColor.label}
              </span>
            )}
          </div>

          {/* ── Color Buttons 2×2 ── */}
          {isPlaying && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {COLORS.map(color => {
                let btnClass = `w-full py-4 rounded-lg font-bold text-base border-2 bg-black transition-all duration-150 active:scale-95 touch-manipulation`;
                let boxShadow = color.shadow;

                if (feedback) {
                  if (color.id === stimulus.inkColor.id) {
                    btnClass += ` border-green-500 text-green-400${feedback === 'correct' ? ' animate-pulse' : ''}`;
                    boxShadow = '0 0 20px rgba(34,197,94,0.5)';
                  } else {
                    btnClass += ` ${color.border} ${color.text} opacity-30`;
                  }
                } else {
                  btnClass += ` ${color.border} ${color.text} hover:opacity-80`;
                }

                return (
                  <button key={color.id}
                    onClick={() => handleTap(color.id)}
                    disabled={!!feedback}
                    className={btnClass}
                    style={{ textShadow: `0 0 8px ${color.glow}`, boxShadow, fontFamily: 'Inter, sans-serif' }}>
                    {color.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Start prompt (IDLE only) ── */}
          {gameState === GAME_STATES.IDLE && (
            <button onClick={startGame}
              className="w-full py-4 bg-transparent border-2 border-cyan-400 text-cyan-400 font-bold text-base rounded-lg transition-all hover:bg-cyan-400 hover:text-black active:scale-95 touch-manipulation"
              style={{ textShadow: '0 0 8px #00ffff', boxShadow: '0 0 15px rgba(0,255,255,0.3)' }}>
              TAP TO PLAY
            </button>
          )}

        </div>
      </div>
    </>
  );
});

ColorClash.displayName = 'ColorClash';

export default ColorClash;
