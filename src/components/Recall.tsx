import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { RoundCountdown } from './RoundCountdown';

interface RecallProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
  duration?: number;
}

interface GameShape {
  id: number;
  label: string;
  color: string;
  frequency: number;
}

const GAME_CONFIG = {
  MAX_SCORE: 1000,
  MAX_LIVES: 3,
  INITIAL_SEQUENCE_LENGTH: 3,
  SHAPE_ANIMATION_DURATION: 500,
  SHAPE_SOUND_DURATION: 400,
  FEEDBACK_DURATION: 800,
  SEQUENCE_DELAY: 200,
  SEQUENCE_GAP: 100,
  WRONG_SOUND_FREQUENCY: 150,
  WRONG_SOUND_DURATION: 600,
  STORAGE_KEY: 'recallHighScore',
} as const;

const THEME = {
  color: '#00ffff',
  glow: 'rgba(0, 255, 255, 0.6)',
  glowShadow: '0 0 20px rgba(0, 255, 255, 0.6)',
  textShadow: '0 0 10px #00ffff',
} as const;

const SHAPES: GameShape[] = [
  { id: 0, label: 'Red', color: '#ef4444', frequency: 440 },
  { id: 1, label: 'Blue', color: '#3b82f6', frequency: 523.25 },
  { id: 2, label: 'Green', color: '#10b981', frequency: 659.25 },
  { id: 3, label: 'Amber', color: '#f59e0b', frequency: 783.99 },
  { id: 4, label: 'Purple', color: '#8b5cf6', frequency: 880 },
];

const Recall = forwardRef<any, RecallProps>((props, ref) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sequenceTimeoutsRef = useRef<number[]>([]);
  const cleanedUpRef = useRef(false);
  const [animatingShapeId, setAnimatingShapeId] = useState<number | null>(null);

  const [gameStatus, setGameStatus] = useState<'countdown' | 'idle' | 'showing' | 'playing' | 'gameover'>('countdown');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(GAME_CONFIG.MAX_LIVES);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem(GAME_CONFIG.STORAGE_KEY) || '0');
    } catch {
      return 0;
    }
  });

  const gameStateRef = useRef({
    sequence: [] as number[],
    playerSequence: [] as number[],
  });

  const isPlayingRef = useRef(false);
  const sequenceAbortRef = useRef(false);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score, maxScore: GAME_CONFIG.MAX_SCORE }),
    onGameEnd: () => {
      cleanup();
      if (props.onComplete) {
        props.onComplete(score, GAME_CONFIG.MAX_SCORE, props.timeRemaining);
      }
    },
    canSkipQuestion: false,
    hideTimer: true,
  }));

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, []);

  const playSound = useCallback((frequency: number, duration: number = 150) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
      osc.start();
      osc.stop(ctx.currentTime + duration / 1000);
    } catch (e) {
      // Audio context errors on some browsers, silently fail
    }
  }, []);

  const cleanup = useCallback(() => {
    cleanedUpRef.current = true;
    sequenceAbortRef.current = true;
    sequenceTimeoutsRef.current.forEach(clearTimeout);
    sequenceTimeoutsRef.current = [];
  }, []);

  const startSequence = useCallback(
    (seq: number[]) => {
      if (cleanedUpRef.current) return;

      sequenceAbortRef.current = true;
      sequenceTimeoutsRef.current.forEach(clearTimeout);
      sequenceTimeoutsRef.current = [];

      sequenceAbortRef.current = false;

      setGameStatus('showing');
      isPlayingRef.current = false;
      gameStateRef.current.playerSequence = [];
      setAnimatingShapeId(null);

      let currentIndex = 0;

      const showNextShape = () => {
        if (sequenceAbortRef.current || cleanedUpRef.current) return;

        if (currentIndex >= seq.length) {
          setGameStatus('playing');
          isPlayingRef.current = true;
          return;
        }

        const shapeId = seq[currentIndex];
        const shape = SHAPES.find((s) => s.id === shapeId);

        setAnimatingShapeId(shapeId);
        if (shape) {
          playSound(shape.frequency, GAME_CONFIG.SHAPE_SOUND_DURATION);
        }

        const t1 = window.setTimeout(() => {
          if (sequenceAbortRef.current || cleanedUpRef.current) return;
          setAnimatingShapeId(null);

          const t2 = window.setTimeout(() => {
            if (sequenceAbortRef.current || cleanedUpRef.current) return;
            currentIndex++;
            showNextShape();
          }, GAME_CONFIG.SEQUENCE_GAP);
          sequenceTimeoutsRef.current.push(t2);
        }, GAME_CONFIG.SHAPE_ANIMATION_DURATION);
        sequenceTimeoutsRef.current.push(t1);
      };

      const t0 = window.setTimeout(() => {
        if (sequenceAbortRef.current || cleanedUpRef.current) return;
        showNextShape();
      }, GAME_CONFIG.SEQUENCE_DELAY);
      sequenceTimeoutsRef.current.push(t0);
    },
    [playSound]
  );

  const handleShapeClick = useCallback(
    (shapeId: number) => {
      if (!isPlayingRef.current || cleanedUpRef.current) return;

      const state = gameStateRef.current;

      // Prevent out-of-sequence clicks
      if (state.playerSequence.length >= state.sequence.length) return;

      state.playerSequence.push(shapeId);
      const shape = SHAPES.find((s) => s.id === shapeId);
      if (shape) {
        playSound(shape.frequency, 200);
      }

      const expectedId = state.sequence[state.playerSequence.length - 1];

      if (shapeId === expectedId) {
        // Correct
        if (state.playerSequence.length === state.sequence.length) {
          // Round win
          isPlayingRef.current = false;
          const newScore = score + level * 20;
          setScore(newScore);
          if (newScore > highScore) {
            setHighScore(newScore);
            localStorage.setItem(GAME_CONFIG.STORAGE_KEY, newScore.toString());
          }

          const t = window.setTimeout(() => {
            if (cleanedUpRef.current) return;
            setLevel((l) => l + 1);
            const maxShapeId = level >= 3 ? 4 : 3;
            const nextSeq = [...state.sequence, Math.floor(Math.random() * (maxShapeId + 1))];
            state.sequence = nextSeq;
            startSequence(nextSeq);
          }, 1000);
          sequenceTimeoutsRef.current.push(t);
        }
      } else {
        // Wrong
        isPlayingRef.current = false;
        playSound(GAME_CONFIG.WRONG_SOUND_FREQUENCY, GAME_CONFIG.WRONG_SOUND_DURATION);
        const newLives = lives - 1;
        setLives(newLives);

        if (newLives <= 0) {
          setGameStatus('gameover');
          const t = window.setTimeout(() => {
            if (!cleanedUpRef.current) {
              props.onComplete?.(score, GAME_CONFIG.MAX_SCORE);
            }
          }, 2000);
          sequenceTimeoutsRef.current.push(t);
        } else {
          const t = window.setTimeout(() => {
            if (!cleanedUpRef.current) {
              startSequence(state.sequence);
            }
          }, 1000);
          sequenceTimeoutsRef.current.push(t);
        }
      }
    },
    [score, level, lives, highScore, startSequence, playSound, props]
  );

  const startGame = useCallback(() => {
    cleanedUpRef.current = false;
    initAudio();
    setScore(0);
    setLevel(1);
    setLives(GAME_CONFIG.MAX_LIVES);
    setAnimatingShapeId(null);
    const initialSeq = Array.from({ length: GAME_CONFIG.INITIAL_SEQUENCE_LENGTH }, () =>
      Math.floor(Math.random() * 4)
    );
    gameStateRef.current.sequence = initialSeq;
    startSequence(initialSeq);
  }, [initAudio, startSequence]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return (
    <div className="min-h-screen bg-black text-white p-3 sm:p-4 flex flex-col items-center">
      <div className="max-w-2xl w-full text-center space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-cyan-500/50 pb-2 sm:pb-3">
          <div className="flex items-center gap-1.5">
            <Zap
              className="w-4 h-4 sm:w-5 sm:h-5"
              style={{ color: THEME.color, filter: `drop-shadow(0 0 8px ${THEME.glow})`, strokeWidth: 2 }}
            />
            <h2 className="text-xs sm:text-sm font-bold text-cyan-400" style={{ textShadow: THEME.textShadow }}>
              Recall
            </h2>
          </div>
          <div className="text-cyan-300 text-xs sm:text-sm">
            Score: <strong className="text-yellow-400 tabular-nums">{score}</strong>
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-between gap-3 text-xs sm:text-sm">
          <div className="text-cyan-300">
            Level: <strong className="text-cyan-400">{level}</strong>
          </div>
          <div className="text-cyan-300">
            Lives: <strong className="text-red-400">{'❤️'.repeat(lives)}</strong>
          </div>
        </div>

        {/* Game Board */}
        <div className="relative w-full">
          {gameStatus === 'countdown' && (
            <div className="aspect-square flex items-center justify-center bg-black rounded-2xl border-2 border-cyan-500/50">
              <RoundCountdown onComplete={startGame} />
            </div>
          )}

          {gameStatus !== 'countdown' && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 aspect-square bg-black/50 p-4 sm:p-6 rounded-2xl border-2 border-cyan-500/50">
              {SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  onClick={() => handleShapeClick(shape.id)}
                  disabled={!isPlayingRef.current}
                  className={`rounded-xl transition-all duration-100 font-semibold text-sm sm:text-base ${
                    animatingShapeId === shape.id
                      ? 'scale-95 shadow-lg'
                      : isPlayingRef.current
                        ? 'hover:scale-105 active:scale-95'
                        : 'opacity-50 cursor-not-allowed'
                  }`}
                  style={{
                    backgroundColor:
                      animatingShapeId === shape.id
                        ? shape.color
                        : `${shape.color}33`,
                    borderColor: shape.color,
                    borderWidth: '2px',
                    color:
                      animatingShapeId === shape.id ? '#000' : '#fff',
                    boxShadow:
                      animatingShapeId === shape.id
                        ? `0 0 20px ${shape.color}, inset 0 0 10px ${shape.color}`
                        : `0 0 10px ${shape.color}40`,
                  }}
                >
                  {shape.label}
                </button>
              ))}

              {/* Extra empty space for 5 shapes in a 2x2 grid */}
              <div />
            </div>
          )}
        </div>

        {/* Status message */}
        <div className="text-center text-sm sm:text-base font-medium h-6">
          {gameStatus === 'showing' && <span className="text-orange-400 animate-pulse">Watch the pattern...</span>}
          {gameStatus === 'playing' && <span className="text-green-400">Repeat the pattern!</span>}
          {gameStatus === 'gameover' && <span className="text-red-500">Game Over!</span>}
        </div>
      </div>
    </div>
  );
});

Recall.displayName = 'Recall';

export default Recall;