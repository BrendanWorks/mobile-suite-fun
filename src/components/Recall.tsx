import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';
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
  SHAKE_DURATION: 300,
  SHAKE_INTENSITY: 8,
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

type Phase = 'countdown' | 'showing' | 'input' | 'gameover';

const Recall = forwardRef<any, RecallProps>((props, ref) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const mountedRef = useRef(true);
  const showTimeoutRef = useRef<number | null>(null);
  const roundTimeoutRef = useRef<number | null>(null);
  const lastSoundKeyRef = useRef<string>('');
  const [phase, setPhase] = useState<Phase>('countdown');
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [showIndex, setShowIndex] = useState(0);
  const [showLit, setShowLit] = useState(false);
  const [animatingShapeId, setAnimatingShapeId] = useState<number | null>(null);
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
  const [shake, setShake] = useState(false);
  const [combo, setCombo] = useState(0);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score, maxScore: GAME_CONFIG.MAX_SCORE }),
    onGameEnd: () => {
      if (props.onComplete) {
        props.onComplete(score, GAME_CONFIG.MAX_SCORE, props.timeRemaining);
      }
    },
    canSkipQuestion: false,
    hideTimer: true,
  }));

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
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
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + duration / 1000
      );
      osc.start();
      osc.stop(ctx.currentTime + duration / 1000);
    } catch {
      // ignore audio errors
    }
  }, []);

  const clearTimers = () => {
    if (showTimeoutRef.current !== null) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (roundTimeoutRef.current !== null) {
      clearTimeout(roundTimeoutRef.current);
      roundTimeoutRef.current = null;
    }
  };

  const getSpeedMultiplier = (currentLevel: number): number => {
    const speedIncrease = Math.min(currentLevel * 0.08, 0.5);
    return Math.max(1 - speedIncrease, 0.5);
  };

  const startGame = useCallback(() => {
    clearTimers();
    initAudio();
    lastSoundKeyRef.current = '';
    setScore(0);
    setLevel(1);
    setLives(GAME_CONFIG.MAX_LIVES);
    setPlayerIndex(0);
    setShowIndex(0);
    setShowLit(false);
    setAnimatingShapeId(null);
    setCombo(0);
    const initialSeq = Array.from(
      { length: GAME_CONFIG.INITIAL_SEQUENCE_LENGTH },
      () => Math.floor(Math.random() * SHAPES.length)
    );
    setSequence(initialSeq);
    setPhase('showing');
    showTimeoutRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setShowLit(false);
    }, GAME_CONFIG.SEQUENCE_DELAY);
  }, [initAudio]);

  // Main show loop: drives the animation (on/off toggling)
  useEffect(() => {
    if (phase !== 'showing') {
      setAnimatingShapeId(null);
      return;
    }
    if (sequence.length === 0) return;

    // If we've finished showing the whole sequence, switch to input
    if (showIndex >= sequence.length) {
      setAnimatingShapeId(null);
      setPhase('input');
      setPlayerIndex(0);
      return;
    }

    const currentId = sequence[showIndex];
    const shape = SHAPES.find((s) => s.id === currentId) || null;

    if (!showLit) {
      setAnimatingShapeId(currentId);
      const speedMultiplier = getSpeedMultiplier(level);
      showTimeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setShowLit(true);
      }, GAME_CONFIG.SHAPE_ANIMATION_DURATION * speedMultiplier);
    } else {
      setAnimatingShapeId(null);
      const speedMultiplier = getSpeedMultiplier(level);
      showTimeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setShowLit(false);
        setShowIndex((idx) => idx + 1);
      }, GAME_CONFIG.SEQUENCE_GAP * speedMultiplier);
    }

    return () => {
      if (showTimeoutRef.current !== null) {
        clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = null;
      }
    };
  }, [phase, sequence, showIndex, showLit, level]);

  // Dedicated sound effect — plays ONLY when a shape is lit
  useEffect(() => {
    if (phase !== 'showing' || showIndex >= sequence.length || !showLit) return;

    const currentId = sequence[showIndex];
    const soundKey = `${showIndex}-${currentId}`;

    if (lastSoundKeyRef.current === soundKey) return;
    lastSoundKeyRef.current = soundKey;

    const shape = SHAPES.find((s) => s.id === currentId);
    if (shape) {
      playSound(shape.frequency, GAME_CONFIG.SHAPE_SOUND_DURATION);
    }
  }, [showLit, showIndex, sequence, phase, playSound]);

  const scheduleNextRound = (nextSequence: number[]) => {
    clearTimers();
    lastSoundKeyRef.current = '';
    setPhase('showing');
    setSequence(nextSequence);
    setShowIndex(0);
    setShowLit(false);
    setPlayerIndex(0);
    setAnimatingShapeId(null);
    roundTimeoutRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setShowLit(false);
    }, GAME_CONFIG.SEQUENCE_DELAY);
  };

  const handleShapeClick = useCallback(
    (shapeId: number) => {
      if (phase !== 'input') return;
      const expectedId = sequence[playerIndex];
      const shape = SHAPES.find((s) => s.id === shapeId);
      if (shape) {
        playSound(shape.frequency, 200);
      }
      if (shapeId === expectedId) {
        const nextPlayerIndex = playerIndex + 1;
        setPlayerIndex(nextPlayerIndex);
        setCombo((c) => c + 1);
        if (nextPlayerIndex === sequence.length) {
          const newScore = score + level * 20;
          setScore(newScore);
          if (newScore > highScore) {
            setHighScore(newScore);
            try {
              localStorage.setItem(
                GAME_CONFIG.STORAGE_KEY,
                newScore.toString()
              );
            } catch {
              // ignore storage errors
            }
          }
          const nextSeq = [
            ...sequence,
            Math.floor(Math.random() * SHAPES.length),
          ];
          roundTimeoutRef.current = window.setTimeout(() => {
            if (!mountedRef.current) return;
            setLevel((l) => l + 1);
            scheduleNextRound(nextSeq);
          }, 600);
        }
      } else {
        playSound(
          GAME_CONFIG.WRONG_SOUND_FREQUENCY,
          GAME_CONFIG.WRONG_SOUND_DURATION
        );
        setShake(true);
        setTimeout(() => setShake(false), GAME_CONFIG.SHAKE_DURATION);
        setCombo(0);
        const newLives = lives - 1;
        setLives(newLives);
        if (newLives <= 0) {
          setPhase('gameover');
          clearTimers();
          roundTimeoutRef.current = window.setTimeout(() => {
            if (!mountedRef.current) return;
            props.onComplete?.(score, GAME_CONFIG.MAX_SCORE);
          }, 1000);
        } else {
          roundTimeoutRef.current = window.setTimeout(() => {
            if (!mountedRef.current) return;
            scheduleNextRound(sequence);
          }, 600);
        }
      }
    },
    [phase, sequence, playerIndex, score, level, highScore, lives, playSound, props]
  );

  useEffect(() => {
    if (props.onScoreUpdate) {
      props.onScoreUpdate(score, GAME_CONFIG.MAX_SCORE);
    }
  }, [score, props]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, []);

  const getRemainingSequence = () => {
    if (sequence.length === 0) return [];
    return sequence.slice(playerIndex);
  };

  const nextExpectedId =
    phase === 'input' && playerIndex < sequence.length
      ? sequence[playerIndex]
      : null;

  const nextShape =
    nextExpectedId !== null
      ? SHAPES.find((s) => s.id === nextExpectedId)
      : null;

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center">
      <div className="max-w-2xl w-full text-center space-y-4">
        <div className="flex items-center justify-between border-b-2 border-cyan-500/50 pb-3">
          <div className="flex items-center gap-2">
            <Zap
              className="w-6 h-6"
              style={{
                color: THEME.color,
                filter: `drop-shadow(0 0 8px ${THEME.glow})`,
              }}
            />
            <h2
              className="text-lg font-bold text-cyan-400"
              style={{ textShadow: THEME.textShadow }}
            >
              Recall
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-cyan-300">
              Score:{' '}
              <strong className="text-yellow-400">{score}</strong>
            </div>
            <button
              onClick={() => setShowHints((p) => !p)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all ${
                showHints
                  ? 'bg-cyan-600/40 text-cyan-200'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600'
              }`}
            >
              <Lightbulb size={16} />
              Hints {showHints ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setDebugMode((p) => !p)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all ${
                debugMode
                  ? 'bg-red-600/40 text-red-200'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600'
              }`}
            >
              <Bug size={16} />
              Debug {debugMode ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <div>
            Level:{' '}
            <strong className="text-cyan-400">{level}</strong>
          </div>
          <div className="text-center flex-1">
            {combo > 0 && phase === 'input' && (
              <div className="text-yellow-400 font-bold animate-pulse">
                Combo: {combo}
              </div>
            )}
          </div>
          <div>
            Lives:{' '}
            <strong className="text-red-400">
              {'❤️'.repeat(lives)}
            </strong>
          </div>
        </div>
        <div className="relative w-full aspect-square max-w-[min(80vw,500px)] mx-auto">
          {phase === 'countdown' ? (
            <div className="w-full h-full flex items-center justify-center bg-black/80 rounded-2xl border-2 border-cyan-500/50">
              <RoundCountdown onComplete={startGame} />
            </div>
          ) : (
            <div
              className="grid grid-cols-2 gap-4 h-full relative rounded-2xl border-2 border-cyan-500/50 bg-black/20 p-4 transition-transform"
              style={{
                transform: shake
                  ? `translate(${Math.sin(Date.now() / 30) * GAME_CONFIG.SHAKE_INTENSITY}px, ${Math.cos(Date.now() / 25) * GAME_CONFIG.SHAKE_INTENSITY}px)`
                  : 'translate(0, 0)',
              }}
            >
              {SHAPES.map((shape) => {
                const isNext =
                  showHints &&
                  nextShape?.id === shape.id &&
                  phase === 'input';
                const isActive = animatingShapeId === shape.id;
                return (
                  <div key={shape.id} className="relative">
                    <button
                      onClick={() => handleShapeClick(shape.id)}
                      disabled={phase !== 'input'}
                      className={`w-full h-full rounded-xl transition-all duration-200 font-bold text-xl flex items-center justify-center shadow-xl ${
                        isActive
                          ? 'scale-95 brightness-125 ring-4 ring-white/50 shadow-2xl'
                          : phase === 'input'
                          ? 'hover:scale-110 active:scale-95 hover:brightness-110'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                      style={{
                        backgroundColor: isActive
                          ? shape.color
                          : `${shape.color}30`,
                        border: `3px solid ${shape.color}`,
                        color: isActive ? 'black' : 'white',
                        boxShadow: isActive
                          ? `0 0 40px ${shape.color}, inset 0 0 20px ${shape.color}`
                          : `0 0 20px ${shape.color}40`,
                      }}
                    >
                      {shape.label}
                    </button>
                    {isNext && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div
                          className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-2xl animate-pulse"
                          style={{
                            boxShadow: `0 0 25px ${shape.color}`,
                          }}
                        >
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
        {debugMode && sequence.length > 0 && (
          <div className="mt-6 p-3 bg-black/40 rounded-xl border border-cyan-800/50 max-w-lg mx-auto">
            <div className="text-xs text-cyan-300 mb-2 uppercase tracking-wider">
              Remaining sequence:
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {getRemainingSequence().map((id, idx) => {
                const shape = SHAPES.find((s) => s.id === id);
                return (
                  <div
                    key={`${id}-${idx}`}
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-lg transition-transform"
                    style={{
                      background: `linear-gradient(135deg, ${shape?.color}60, ${shape?.color}30)`,
                      border: `2px solid ${shape?.color}`,
                      transform: idx === 0 ? 'scale(1.15)' : 'scale(1)',
                      boxShadow:
                        idx === 0 ? `0 0 20px ${shape?.color}` : 'none',
                    }}
                  >
                    {idx + 1}
                  </div>
                );
              })}
              {getRemainingSequence().length === 0 && (
                <span className="text-green-400">
                  Sequence complete!
                </span>
              )}
            </div>
          </div>
        )}
        <div className="text-center text-lg font-medium mt-6 h-8">
          {phase === 'showing' && (
            <span className="text-orange-400 animate-pulse">
              Watch...
            </span>
          )}
          {phase === 'input' && (
            <span className="text-green-400">Your turn!</span>
          )}
          {phase === 'gameover' && (
            <span className="text-red-500">Game Over!</span>
          )}
        </div>
      </div>
    </div>
  );
});

Recall.displayName = 'Recall';
export default Recall;