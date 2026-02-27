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
  SHAPE_ANIMATION_DURATION: 400,     // reduced a bit for testing
  SHAPE_SOUND_DURATION: 350,
  SEQUENCE_DELAY: 400,
  SEQUENCE_GAP: 150,
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
  { id: 0, label: 'Red',    color: '#ef4444', frequency: 440    },
  { id: 1, label: 'Blue',   color: '#3b82f6', frequency: 523.25 },
  { id: 2, label: 'Green',  color: '#10b981', frequency: 659.25 },
  { id: 3, label: 'Amber',  color: '#f59e0b', frequency: 783.99 },
  { id: 4, label: 'Purple', color: '#8b5cf6', frequency: 880    },
];

const Recall = forwardRef<any, RecallProps>((props, ref) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSequenceRunningRef = useRef(false);

  const [animatingShapeId, setAnimatingShapeId] = useState<number | null>(null);
  const [gameStatus, setGameStatus] = useState<'countdown' | 'idle' | 'showing' | 'playing' | 'gameover'>('countdown');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(GAME_CONFIG.MAX_LIVES);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem(GAME_CONFIG.STORAGE_KEY) || '0', 10);
    } catch {
      return 0;
    }
  });

  const gameStateRef = useRef({
    sequence: [] as number[],
    playerSequence: [] as number[],
  });

  const isPlayingRef = useRef(false);
  const isMountedRef = useRef(true);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score, maxScore: GAME_CONFIG.MAX_SCORE }),
    onGameEnd: () => {
      cleanup();
      props.onComplete?.(score, GAME_CONFIG.MAX_SCORE, props.timeRemaining);
    },
    canSkipQuestion: false,
    hideTimer: true,
  }));

  const initAudio = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
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
    } catch {
      // silent fail
    }
  }, []);

  const cleanup = useCallback(() => {
    isMountedRef.current = false;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isSequenceRunningRef.current = false;
  }, []);

  const delay = useCallback((ms: number, signal?: AbortSignal): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  }, []);

  const showSequence = useCallback(async (sequence: number[]) => {
    if (!isMountedRef.current || isSequenceRunningRef.current) {
      console.log("Sequence blocked - already running or unmounted");
      return;
    }

    isSequenceRunningRef.current = true;
    console.log(`Starting sequence of length ${sequence.length} (level ${level})`);

    // Cancel any previous playback
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setGameStatus('showing');
    isPlayingRef.current = false;
    gameStateRef.current.playerSequence = [];
    setAnimatingShapeId(null);

    try {
      await delay(GAME_CONFIG.SEQUENCE_DELAY, signal);

      for (const id of sequence) {
        if (signal.aborted || !isMountedRef.current) throw new DOMException('Aborted', 'AbortError');

        const shape = SHAPES.find(s => s.id === id);
        if (!shape) continue;

        setAnimatingShapeId(id);
        playSound(shape.frequency, GAME_CONFIG.SHAPE_SOUND_DURATION);

        await delay(GAME_CONFIG.SHAPE_ANIMATION_DURATION, signal);
        setAnimatingShapeId(null);

        await delay(GAME_CONFIG.SEQUENCE_GAP, signal);
      }

      if (!signal.aborted && isMountedRef.current) {
        setGameStatus('playing');
        isPlayingRef.current = true;
        console.log("Sequence finished → now playing");
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Sequence error:", err);
      } else {
        console.log("Sequence aborted cleanly");
      }
    } finally {
      isSequenceRunningRef.current = false;
    }
  }, [playSound, delay, level]);

  const startNextRound = useCallback((currentSequence: number[]) => {
    if (!isMountedRef.current) return;

    const newLevel = level + 1;
    setLevel(newLevel);

    const maxId = newLevel >= 3 ? 4 : 3;
    const nextSeq = [...currentSequence, Math.floor(Math.random() * (maxId + 1))];
    gameStateRef.current.sequence = nextSeq;

    // Give extra breathing room after win animation
    setTimeout(() => {
      if (isMountedRef.current) {
        showSequence(nextSeq);
      }
    }, 1800); // <--- increased from 1000 ms
  }, [level, showSequence]);

  const handleShapeClick = useCallback((shapeId: number) => {
    if (!isPlayingRef.current || !isMountedRef.current) return;

    const state = gameStateRef.current;
    if (state.playerSequence.length >= state.sequence.length) return;

    state.playerSequence.push(shapeId);
    const shape = SHAPES.find(s => s.id === shapeId);
    if (shape) playSound(shape.frequency, 200);

    const expected = state.sequence[state.playerSequence.length - 1];

    if (shapeId !== expected) {
      isPlayingRef.current = false;
      playSound(GAME_CONFIG.WRONG_SOUND_FREQUENCY, GAME_CONFIG.WRONG_SOUND_DURATION);

      const newLives = lives - 1;
      setLives(newLives);

      if (newLives <= 0) {
        setGameStatus('gameover');
        setTimeout(() => {
          if (isMountedRef.current) props.onComplete?.(score, GAME_CONFIG.MAX_SCORE);
        }, 2200);
      } else {
        setTimeout(() => {
          if (isMountedRef.current) showSequence(state.sequence);
        }, 1400);
      }
      return;
    }

    if (state.playerSequence.length === state.sequence.length) {
      isPlayingRef.current = false;
      const newScore = score + level * 20;
      setScore(newScore);

      if (newScore > highScore) {
        setHighScore(newScore);
        localStorage.setItem(GAME_CONFIG.STORAGE_KEY, newScore.toString());
      }

      setTimeout(() => {
        if (isMountedRef.current) startNextRound(state.sequence);
      }, 1200);
    }
  }, [score, level, lives, highScore, showSequence, playSound, props.onComplete, startNextRound]);

  const startGame = useCallback(() => {
    isMountedRef.current = true;
    initAudio();

    setScore(0);
    setLevel(1);
    setLives(GAME_CONFIG.MAX_LIVES);
    setAnimatingShapeId(null);

    const initialSeq = Array.from({ length: GAME_CONFIG.INITIAL_SEQUENCE_LENGTH }, () =>
      Math.floor(Math.random() * 4)
    );

    gameStateRef.current.sequence = initialSeq;
    showSequence(initialSeq);
  }, [initAudio, showSequence]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return (
    <div className="min-h-screen bg-black text-white p-3 sm:p-4 flex flex-col items-center">
      <div className="max-w-2xl w-full text-center space-y-3">
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

        <div className="flex justify-between gap-3 text-xs sm:text-sm">
          <div className="text-cyan-300">
            Level: <strong className="text-cyan-400">{level}</strong>
          </div>
          <div className="text-cyan-300">
            Lives: <strong className="text-red-400">{'❤️'.repeat(lives)}</strong>
          </div>
        </div>

        <div className="relative w-full">
          {gameStatus === 'countdown' && (
            <div className="aspect-square flex items-center justify-center bg-black rounded-2xl border-2 border-cyan-500/50">
              <RoundCountdown onComplete={startGame} />
            </div>
          )}

          {gameStatus !== 'countdown' && (
            <div className="w-full bg-black/50 p-4 sm:p-6 rounded-2xl border-2 border-cyan-500/50">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 aspect-square">
                {SHAPES.slice(0, 4).map(shape => (
                  <button
                    key={shape.id}
                    onClick={() => handleShapeClick(shape.id)}
                    disabled={!isPlayingRef.current}
                    className={`rounded-xl transition-all duration-150 font-semibold text-sm sm:text-base ${
                      animatingShapeId === shape.id
                        ? 'scale-90 shadow-2xl'
                        : isPlayingRef.current
                        ? 'hover:scale-105 active:scale-95'
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                    style={{
                      backgroundColor: animatingShapeId === shape.id ? shape.color : `${shape.color}40`,
                      borderColor: shape.color,
                      borderWidth: '3px',
                      color: animatingShapeId === shape.id ? '#000' : '#fff',
                      boxShadow:
                        animatingShapeId === shape.id
                          ? `0 0 30px ${shape.color}, inset 0 0 12px ${shape.color}`
                          : `0 0 12px ${shape.color}60`,
                    }}
                  >
                    {shape.label}
                  </button>
                ))}
              </div>

              {SHAPES.length > 4 && (
                <div className="mt-4 space-y-3">
                  {SHAPES.slice(4).map(shape => (
                    <button
                      key={shape.id}
                      onClick={() => handleShapeClick(shape.id)}
                      disabled={!isPlayingRef.current}
                      className={`w-full rounded-xl transition-all duration-150 font-semibold text-base py-3 ${
                        animatingShapeId === shape.id
                          ? 'scale-95 shadow-2xl'
                          : isPlayingRef.current
                          ? 'hover:scale-105 active:scale-95'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                      style={{
                        backgroundColor: animatingShapeId === shape.id ? shape.color : `${shape.color}40`,
                        borderColor: shape.color,
                        borderWidth: '3px',
                        color: animatingShapeId === shape.id ? '#000' : '#fff',
                        boxShadow:
                          animatingShapeId === shape.id
                            ? `0 0 30px ${shape.color}, inset 0 0 12px ${shape.color}`
                            : `0 0 12px ${shape.color}60`,
                      }}
                    >
                      {shape.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-center text-base font-medium h-6">
          {gameStatus === 'showing' && <span className="text-orange-400 animate-pulse">Watch carefully...</span>}
          {gameStatus === 'playing' && <span className="text-green-400">Your turn — repeat!</span>}
          {gameStatus === 'gameover' && <span className="text-red-500">Game Over</span>}
        </div>
      </div>
    </div>
  );
});

Recall.displayName = 'Recall';
export default Recall;