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
  type: string;
  color: string;
  themeColor: string;
  frequency: number;
  x: number;
  y: number;
  size: number;
  actualX?: number;
  actualY?: number;
  actualSize?: number;
}

interface GameState {
  canvasWidth: number;
  canvasHeight: number;
  shapes: GameShape[];
  sequence: number[];
  playerSequence: number[];
  animatingShape: number | null;
  animationStartTime: number;
  feedbackStartTime: number;
  feedbackType: 'correct' | 'wrong' | null;
}

// Game constants - centralized
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
  HIT_DETECTION_RADIUS_MULTIPLIER: 1.2, // Slightly larger than visual
  STORAGE_KEY: 'recallHighScore',
} as const;

// Theme constants
const THEME = {
  color: '#00ffff',
  glow: 'rgba(0, 255, 255, 0.6)',
  glowShadow: '0 0 20px rgba(0, 255, 255, 0.6)',
  textShadow: '0 0 10px #00ffff',
  shadowColor: 'rgba(0, 255, 255, 0.3)',
} as const;

// Shape definitions - includes drawing data
const SHAPE_CONFIG: GameShape[] = [
  { id: 0, type: 'circle', color: '#ef4444', themeColor: 'red', frequency: 440, x: 0.25, y: 0.25, size: 75 },
  { id: 1, type: 'square', color: '#3b82f6', themeColor: 'blue', frequency: 523.25, x: 0.75, y: 0.25, size: 75 },
  { id: 2, type: 'triangle', color: '#10b981', themeColor: 'green', frequency: 659.25, x: 0.25, y: 0.75, size: 75 },
  { id: 3, type: 'diamond', color: '#f59e0b', themeColor: 'amber', frequency: 783.99, x: 0.75, y: 0.75, size: 75 },
  { id: 4, type: 'star', color: '#8b5cf6', themeColor: 'purple', frequency: 880, x: 0.5, y: 0.5, size: 75 },
];

// Shape drawing paths - DRY: centralized drawing logic
const SHAPE_PATHS: Record<string, (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => void> = {
  circle: (ctx, x, y, size) => {
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  },
  square: (ctx, x, y, size) => {
    ctx.rect(x - size / 2, y - size / 2, size, size);
  },
  triangle: (ctx, x, y, size) => {
    ctx.moveTo(x, y - size / 2);
    ctx.lineTo(x - size / 2, y + size / 2);
    ctx.lineTo(x + size / 2, y + size / 2);
    ctx.closePath();
  },
  diamond: (ctx, x, y, size) => {
    ctx.moveTo(x, y - size / 2);
    ctx.lineTo(x + size / 2, y);
    ctx.lineTo(x, y + size / 2);
    ctx.lineTo(x - size / 2, y);
    ctx.closePath();
  },
  star: (ctx, x, y, size) => {
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * i) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? size / 2 : size / 4;
      ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
    ctx.closePath();
  },
};

const Recall = forwardRef<any, RecallProps>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const sequenceTimeoutsRef = useRef<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const cleanedUpRef = useRef(false);
  
  const [gameStatus, setGameStatus] = useState<'countdown' | 'idle' | 'showing' | 'playing' | 'gameover'>('countdown');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(GAME_CONFIG.MAX_LIVES);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem(GAME_CONFIG.STORAGE_KEY) || '0');
    } catch { return 0; }
  });

  const gameStateRef = useRef<GameState>({
    canvasWidth: 0,
    canvasHeight: 0,
    shapes: [],
    sequence: [],
    playerSequence: [],
    animatingShape: null,
    animationStartTime: 0,
    feedbackStartTime: 0,
    feedbackType: null,
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
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  }, []);

  const drawShape = useCallback((ctx: CanvasRenderingContext2D, shape: GameShape, isHighlighted: boolean) => {
    const { actualX: x, actualY: y, actualSize: size } = shape;
    if (x === undefined || y === undefined || size === undefined) return;

    ctx.save();
    ctx.globalAlpha = isHighlighted ? 1 : 0.6;
    ctx.fillStyle = shape.color;

    if (isHighlighted) {
      ctx.shadowColor = shape.color;
      ctx.shadowBlur = 40;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
    }

    ctx.beginPath();
    const drawPath = SHAPE_PATHS[shape.type];
    if (drawPath) {
      drawPath(ctx, x, y, size);
    }

    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const state = gameStateRef.current;
    const now = Date.now();

    state.shapes.forEach(shape => {
      let active = false;
      if (state.animatingShape === shape.id) {
        const elapsed = now - state.animationStartTime;
        if (elapsed < GAME_CONFIG.SHAPE_ANIMATION_DURATION) {
          active = true;
        } else {
          state.animatingShape = null;
        }
      }
      drawShape(ctx, shape, active);
    });

    if (state.feedbackType) {
      const elapsed = now - state.feedbackStartTime;
      if (elapsed < GAME_CONFIG.FEEDBACK_DURATION) {
        ctx.save();
        ctx.globalAlpha = (1 - elapsed / GAME_CONFIG.FEEDBACK_DURATION) * 0.3;
        ctx.fillStyle = state.feedbackType === 'correct' ? '#10b981' : '#ef4444';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        state.feedbackType = null;
      }
    }

    if (!cleanedUpRef.current) {
      animationFrameRef.current = requestAnimationFrame(render);
    }
  }, [drawShape]);

  const cleanup = useCallback(() => {
    cleanedUpRef.current = true;
    sequenceTimeoutsRef.current.forEach(clearTimeout);
    sequenceTimeoutsRef.current = [];
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
  }, []);

  const startSequence = useCallback(async (seq: number[]) => {
    if (cleanedUpRef.current) return;
    setGameStatus('showing');
    isPlayingRef.current = false;
    gameStateRef.current.playerSequence = [];
    
    for (let i = 0; i < seq.length; i++) {
      if (cleanedUpRef.current) return;
      
      await new Promise(r => {
        const t = window.setTimeout(r, GAME_CONFIG.SEQUENCE_DELAY);
        sequenceTimeoutsRef.current.push(t);
      });

      const shapeId = seq[i];
      const shape = gameStateRef.current.shapes.find(s => s.id === shapeId);
      if (shape) {
        gameStateRef.current.animatingShape = shapeId;
        gameStateRef.current.animationStartTime = Date.now();
        playSound(shape.frequency, GAME_CONFIG.SHAPE_SOUND_DURATION);
      }

      await new Promise(r => {
        const t = window.setTimeout(r, GAME_CONFIG.SHAPE_ANIMATION_DURATION + GAME_CONFIG.SEQUENCE_GAP);
        sequenceTimeoutsRef.current.push(t);
      });
    }
    
    if (!cleanedUpRef.current) {
      setGameStatus('playing');
      isPlayingRef.current = true;
    }
  }, [playSound]);

  const handleShapeClick = (shapeId: number) => {
    if (!isPlayingRef.current || cleanedUpRef.current) return;

    const state = gameStateRef.current;
    const shape = state.shapes.find(s => s.id === shapeId);
    if (!shape) return;

    // Prevent out-of-sequence clicks
    if (state.playerSequence.length >= state.sequence.length) return;

    state.animatingShape = shapeId;
    state.animationStartTime = Date.now();
    playSound(shape.frequency, 200);

    const expectedId = state.sequence[state.playerSequence.length];
    
    if (shapeId === expectedId) {
      state.playerSequence.push(shapeId);
      if (state.playerSequence.length === state.sequence.length) {
        // Round Win
        state.feedbackType = 'correct';
        state.feedbackStartTime = Date.now();
        const newScore = score + (level * 20);
        setScore(newScore);
        if (newScore > highScore) {
          setHighScore(newScore);
          localStorage.setItem(GAME_CONFIG.STORAGE_KEY, newScore.toString());
        }
        setTimeout(() => {
          if (cleanedUpRef.current) return;
          setLevel(l => l + 1);
          const maxShapeId = level >= 3 ? 5 : 3;
          const nextSeq = [...state.sequence, Math.floor(Math.random() * maxShapeId)];
          state.sequence = nextSeq;
          startSequence(nextSeq);
        }, 1000);
      }
    } else {
      // Wrong
      state.feedbackType = 'wrong';
      state.feedbackStartTime = Date.now();
      playSound(GAME_CONFIG.WRONG_SOUND_FREQUENCY, GAME_CONFIG.WRONG_SOUND_DURATION);
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives <= 0) {
        setGameStatus('gameover');
        setTimeout(() => {
          if (!cleanedUpRef.current) {
            props.onComplete?.(score, GAME_CONFIG.MAX_SCORE);
          }
        }, 2000);
      } else {
        setTimeout(() => {
          if (!cleanedUpRef.current) {
            startSequence(state.sequence);
          }
        }, 1000);
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    // FIX: Use actual canvas resolution, not CSS size
    // DPR adjustment ensures high-DPI screens work correctly
    const dpr = window.devicePixelRatio || 1;
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    // FIX: More accurate hit detection using actualSize
    const clicked = gameStateRef.current.shapes.find(s => {
      if (s.actualX === undefined || s.actualY === undefined || s.actualSize === undefined) return false;
      const dx = x - s.actualX;
      const dy = y - s.actualY;
      const radius = (s.actualSize / 2) * GAME_CONFIG.HIT_DETECTION_RADIUS_MULTIPLIER;
      return Math.sqrt(dx * dx + dy * dy) < radius;
    });

    if (clicked) handleShapeClick(clicked.id);
  };

  const startGame = () => {
    cleanedUpRef.current = false;
    initAudio();
    setScore(0);
    setLevel(1);
    setLives(GAME_CONFIG.MAX_LIVES);
    const initialSeq = Array.from({ length: GAME_CONFIG.INITIAL_SEQUENCE_LENGTH }, () => Math.floor(Math.random() * 3));
    gameStateRef.current.sequence = initialSeq;
    startSequence(initialSeq);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const size = Math.min(canvas.parentElement?.offsetWidth || 400, 500);
    canvas.width = size;
    canvas.height = size;
    
    gameStateRef.current.shapes = SHAPE_CONFIG.map(s => ({
      ...s,
      actualX: s.x * size,
      actualY: s.y * size,
      actualSize: s.size * (size / 400),
    }));
    
    render();
    return () => cleanup();
  }, [render, cleanup]);

  return (
    <div className="min-h-screen bg-black text-white p-3 sm:p-4 flex flex-col items-center">
      <div className="max-w-2xl w-full text-center space-y-3">
        {/* Header - Single line (per Game Component Style Reference) */}
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

        {/* Canvas */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onTouchEnd={handleCanvasClick}
            className="w-full aspect-square rounded-2xl bg-black border-2 border-cyan-500/50 shadow-lg cursor-pointer mx-auto"
            style={{ boxShadow: THEME.glowShadow }}
          />
          {gameStatus === 'countdown' && (
            <div className="absolute inset-0 bg-black/80 rounded-2xl overflow-hidden flex items-center justify-center">
              <RoundCountdown onComplete={startGame} />
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