import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Zap, Lightbulb, Bug } from 'lucide-react';
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
  SHAPE_ANIMATION_DURATION: 350,
  SHAPE_SOUND_DURATION: 300,
  SEQUENCE_DELAY: 600,
  SEQUENCE_GAP: 200,
  WRONG_SOUND_FREQUENCY: 150,
  WRONG_SOUND_DURATION: 600,
  STORAGE_KEY: 'recallHighScore',
} as const;

const THEME = {
  color: '#00ffff',
  glow: 'rgba(0, 255, 255, 0.6)',
  textShadow: '0 0 10px #00ffff',
} as const;

const SHAPES: GameShape[] = [
  { id: 0, label: 'Red', color: '#ef4444', frequency: 440 },
  { id: 1, label: 'Blue', color: '#3b82f6', frequency: 523.25 },
  { id: 2, label: 'Green', color: '#10b981', frequency: 659.25 },
  { id: 3, label: 'Amber', color: '#f59e0b', frequency: 783.99 },
];

const Recall = forwardRef<any, RecallProps>((props, ref) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sequenceTimeoutsRef = useRef<number[]>([]);
  const cleanedUpRef = useRef(false);
  const sequenceAbortRef = useRef(false);

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
  const [showHints, setShowHints] = useState(false);
  const [debugMode, setDebugMode] = useState(true);

  const gameStateRef = useRef({
    sequence: [] as number[],
    playerSequence: [] as number[],
  });

  const isPlayingRef = useRef(false);

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

  const showSequence = useCallback((seq: number[]) => {
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
  }, [playSound]);

  const handleShapeClick = useCallback((shapeId: number) => {
    if (!isPlayingRef.current || cleanedUpRef.current) return;
    const state = gameStateRef.current;
    if (state.playerSequence.length >= state.sequence.length) return;
    state.playerSequence.push(shapeId);
    const shape = SHAPES.find((s) => s.id === shapeId);
    if (shape) {
      playSound(shape.frequency, 200);
    }
    const expectedId = state.sequence[state.playerSequence.length - 1];
    if (shapeId === expectedId) {
      if (state.playerSequence.length === state.sequence.length) {
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
          const nextSeq = [...state.sequence, Math.floor(Math.random() * SHAPES.length)];
          state.sequence = nextSeq;
          showSequence(nextSeq);
        }, 1500);
        sequenceTimeoutsRef.current.push(t);
      }
    } else {
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
            showSequence(state.sequence);
          }
        }, 1500);
        sequenceTimeoutsRef.current.push(t);
      }
    }
  }, [score, level, lives, highScore, showSequence, playSound, props]);

  const startGame = useCallback(() => {
    cleanedUpRef.current = false;
    initAudio();
    setScore(0);
    setLevel(1);
    setLives(GAME_CONFIG.MAX_LIVES);
    setAnimatingShapeId(null);
    const initialSeq = Array.from({ length: GAME_CONFIG.INITIAL_SEQUENCE_LENGTH }, () =>
      Math.floor(Math.random() * SHAPES.length)
    );
    gameStateRef.current.sequence = initialSeq;
    showSequence(initialSeq);
  }, [initAudio, showSequence]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const getNextExpectedId = () => {
    const { sequence, playerSequence } = gameStateRef.current;
    if (gameStatus !== 'playing' || playerSequence.length >= sequence.length) return null;
    return sequence[playerSequence.length];
  };

  const getRemainingSequence = () => {
    const { sequence, playerSequence } = gameStateRef.current;
    if (gameStatus !== 'playing') return [];
    return sequence.slice(playerSequence.length);
  };

  const nextExpectedId = getNextExpectedId();
  const nextShape = nextExpectedId !== null ? SHAPES.find(s => s.id === nextExpectedId) : null;

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center">
      <div className="max-w-2xl w-full text-center space-y-4">
        <div className="flex items-center justify-between border-b-2 border-cyan-500/50 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6" style={{ color: THEME.color, filter: `drop-shadow(0 0 8px ${THEME.glow})` }} />
            <h2 className="text-lg font-bold text-cyan-400" style={{ textShadow: THEME.textShadow }}>
              Recall
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-cyan-300">
              Score: <strong className="text-yellow-400">{score}</strong>
            </div>
            <button
              onClick={() => setShowHints(p => !p)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all ${
                showHints ? 'bg-cyan-600/40 text-cyan-200' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600'
              }`}
            >
              <Lightbulb size={16} />
              Hints {showHints ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setDebugMode(p => !p)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all ${
                debugMode ? 'bg-red-600/40 text-red-200' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600'
              }`}
            >
              <Bug size={16} />
              Debug {debugMode ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <div className="flex justify-between text-sm mb-2">
          <div>Level: <strong className="text-cyan-400">{level}</strong></div>
          <div>Lives: <strong className="text-red-400">{'❤️'.repeat(lives)}</strong></div>
        </div>

        <div className="relative w-full aspect-square max-w-[min(80vw,500px)] mx-auto">
          {gameStatus === 'countdown' ? (
            <div className="w-full h-full flex items-center justify-center bg-black/80 rounded-2xl border-2 border-cyan-500/50">
              <RoundCountdown onComplete={startGame} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 h-full relative rounded-2xl border-2 border-cyan-500/50 bg-black/20 p-4">
              {SHAPES.map(shape => {
                const isNext = showHints && nextShape?.id === shape.id && gameStatus === 'playing';
                return (
                  <div key={shape.id} className="relative">
                    <button
                      onClick={() => handleShapeClick(shape.id)}
                      disabled={!isPlayingRef.current}
                      className={`w-full h-full rounded-xl transition-all duration-200 font-bold text-xl flex items-center justify-center shadow-xl ${
                        animatingShapeId === shape.id
                          ? 'scale-95 brightness-125 ring-4 ring-white/50 shadow-2xl'
                          : isPlayingRef.current
                          ? 'hover:scale-110 active:scale-95 hover:brightness-110'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                      style={{
                        backgroundColor: animatingShapeId === shape.id ? shape.color : `${shape.color}30`,
                        border: `3px solid ${shape.color}`,
                        color: animatingShapeId === shape.id ? 'black' : 'white',
                        boxShadow: animatingShapeId === shape.id
                          ? `0 0 40px ${shape.color}, inset 0 0 20px ${shape.color}`
                          : `0 0 20px ${shape.color}40`,
                      }}
                    >
                      {shape.label}
                    </button>
                    {isNext && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-2xl animate-pulse" style={{ boxShadow: `0 0 25px ${shape.color}` }}>
                          {shape.label[0]}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {debugMode && gameStatus === 'playing' && (
          <div className="mt-6 p-3 bg-black/40 rounded-xl border border-cyan-800/50 max-w-lg mx-auto">
            <div className="text-xs text-cyan-300 mb-2 uppercase tracking-wider">Remaining sequence:</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {getRemainingSequence().map((id, idx) => {
                const shape = SHAPES.find(s => s.id === id);
                return (
                  <div
                    key={idx}
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-lg transition-transform"
                    style={{
                      background: `linear-gradient(135deg, ${shape?.color}60, ${shape?.color}30)`,
                      border: `2px solid ${shape?.color}`,
                      transform: idx === 0 ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: idx === 0 ? `0 0 20px ${shape?.color}` : 'none',
                    }}
                  >
                    {idx + 1}
                  </div>
                );
              })}
              {getRemainingSequence().length === 0 && (
                <span className="text-green-400">Sequence complete!</span>
              )}
            </div>
          </div>
        )}

        <div className="text-center text-lg font-medium mt-6 h-8">
          {gameStatus === 'showing' && <span className="text-orange-400 animate-pulse">Watch...</span>}
          {gameStatus === 'playing' && <span className="text-green-400">Your turn!</span>}
          {gameStatus === 'gameover' && <span className="text-red-500">Game Over!</span>}
        </div>
      </div>
    </div>
  );
});

Recall.displayName = 'Recall';
export default Recall;