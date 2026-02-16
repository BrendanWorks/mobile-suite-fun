import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Repeat } from 'lucide-react';

interface ShapeSequenceProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
  duration?: number;
}

interface GameShape {
  id: number;
  type: string;
  color: string;
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

const MAX_SCORE = 1000;
const MAX_LIVES = 3;
const INITIAL_SEQUENCE_LENGTH = 3;
const MAX_SEQUENCE_LENGTH = 10;
const SHAPE_ANIMATION_DURATION = 500;
const FEEDBACK_DURATION = 800;

const SHAPES: GameShape[] = [
  { id: 0, type: 'circle', color: '#ef4444', x: 0.25, y: 0.25, size: 75 },
  { id: 1, type: 'square', color: '#3b82f6', x: 0.75, y: 0.25, size: 75 },
  { id: 2, type: 'triangle', color: '#10b981', x: 0.25, y: 0.75, size: 75 },
  { id: 3, type: 'diamond', color: '#f59e0b', x: 0.75, y: 0.75, size: 75 },
  { id: 4, type: 'star', color: '#8b5cf6', x: 0.5, y: 0.5, size: 75 },
];

const SHAPE_FREQUENCIES = [440, 523.25, 659.25, 783.99, 880];

const ShapeSequenceGame = forwardRef<any, ShapeSequenceProps>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const sequenceTimeoutsRef = useRef<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const [gameStatus, setGameStatus] = useState<'idle' | 'showing' | 'playing' | 'gameover'>('idle');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('simonHighScore') || '0');
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

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score, maxScore: MAX_SCORE }),
    onGameEnd: () => {
      cleanup();
      if (props.onComplete) {
        props.onComplete(score, MAX_SCORE, props.timeRemaining);
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
    const osc = audioContextRef.current.createOscillator();
    const gain = audioContextRef.current.createGain();
    osc.connect(gain);
    gain.connect(audioContextRef.current.destination);
    osc.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
    gain.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + duration / 1000);
    osc.start();
    osc.stop(audioContextRef.current.currentTime + duration / 1000);
  }, []);

  const drawShape = useCallback((ctx: CanvasRenderingContext2D, shape: GameShape, isHighlighted: boolean) => {
    const { actualX: x, actualY: y, actualSize: size } = shape;
    if (x === undefined || y === undefined || size === undefined) return;

    ctx.save();
    if (isHighlighted) {
      ctx.shadowColor = shape.color;
      ctx.shadowBlur = 30;
      ctx.fillStyle = shape.color;
      ctx.strokeStyle = '#fff';
    } else {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = shape.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    }

    ctx.beginPath();
    switch (shape.type) {
      case 'circle': ctx.arc(x, y, size / 2, 0, Math.PI * 2); break;
      case 'square': ctx.rect(x - size / 2, y - size / 2, size, size); break;
      case 'triangle':
        ctx.moveTo(x, y - size / 2);
        ctx.lineTo(x - size / 2, y + size / 2);
        ctx.lineTo(x + size / 2, y + size / 2);
        break;
      case 'diamond':
        ctx.moveTo(x, y - size / 2);
        ctx.lineTo(x + size / 2, y);
        ctx.lineTo(x, y + size / 2);
        ctx.lineTo(x - size / 2, y);
        break;
      case 'star':
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI * i) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? size / 2 : size / 4;
          ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
        }
        break;
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const state = gameStateRef.current;
    const now = Date.now();

    state.shapes.forEach(shape => {
      let active = false;
      if (state.animatingShape === shape.id) {
        const elapsed = now - state.animationStartTime;
        if (elapsed < SHAPE_ANIMATION_DURATION) {
          active = true;
        } else {
          state.animatingShape = null;
        }
      }
      drawShape(ctx, shape, active);
    });

    if (state.feedbackType) {
      const elapsed = now - state.feedbackStartTime;
      if (elapsed < FEEDBACK_DURATION) {
        ctx.save();
        ctx.globalAlpha = (1 - elapsed / FEEDBACK_DURATION) * 0.3;
        ctx.fillStyle = state.feedbackType === 'correct' ? '#10b981' : '#ef4444';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        state.feedbackType = null;
      }
    }

    animationFrameRef.current = requestAnimationFrame(render);
  }, [drawShape]);

  const cleanup = useCallback(() => {
    sequenceTimeoutsRef.current.forEach(clearTimeout);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const startSequence = useCallback(async (seq: number[]) => {
    setGameStatus('showing');
    gameStateRef.current.playerSequence = [];
    
    for (let i = 0; i < seq.length; i++) {
      await new Promise(r => {
        const t = window.setTimeout(r, 200);
        sequenceTimeoutsRef.current.push(t);
      });

      const shapeId = seq[i];
      gameStateRef.current.animatingShape = shapeId;
      gameStateRef.current.animationStartTime = Date.now();
      playSound(SHAPE_FREQUENCIES[shapeId], 400);

      await new Promise(r => {
        const t = window.setTimeout(r, SHAPE_ANIMATION_DURATION + 100);
        sequenceTimeoutsRef.current.push(t);
      });
    }
    setGameStatus('playing');
  }, [playSound]);

  const handleShapeClick = (shapeId: number) => {
    if (gameStatus !== 'playing') return;

    const state = gameStateRef.current;
    state.animatingShape = shapeId;
    state.animationStartTime = Date.now();
    playSound(SHAPE_FREQUENCIES[shapeId], 200);

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
          localStorage.setItem('simonHighScore', newScore.toString());
        }
        setTimeout(() => {
          setLevel(l => l + 1);
          const nextSeq = [...state.sequence, Math.floor(Math.random() * (level >= 3 ? 5 : 4))];
          state.sequence = nextSeq;
          startSequence(nextSeq);
        }, 1000);
      }
    } else {
      // Wrong
      state.feedbackType = 'wrong';
      state.feedbackStartTime = Date.now();
      playSound(150, 600);
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives <= 0) {
        setGameStatus('gameover');
        setTimeout(() => props.onComplete?.(score, MAX_SCORE), 2000);
      } else {
        setTimeout(() => startSequence(state.sequence), 1000);
      }
    }
  };

  const handleCanvasClick = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX || e.touches?.[0].clientX) - rect.left) * (canvas.width / rect.width);
    const y = ((e.clientY || e.touches?.[0].clientY) - rect.top) * (canvas.height / rect.height);

    const clicked = gameStateRef.current.shapes.find(s => {
      const dx = x - (s.actualX || 0);
      const dy = y - (s.actualY || 0);
      return Math.sqrt(dx * dx + dy * dy) < (s.actualSize || 0) / 1.5;
    });

    if (clicked) handleShapeClick(clicked.id);
  };

  const startGame = () => {
    initAudio();
    setScore(0);
    setLevel(1);
    setLives(MAX_LIVES);
    const initialSeq = Array.from({ length: 3 }, () => Math.floor(Math.random() * 4));
    gameStateRef.current.sequence = initialSeq;
    startSequence(initialSeq);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = Math.min(canvas.parentElement?.offsetWidth || 400, 500);
    canvas.width = size;
    canvas.height = size;
    gameStateRef.current.shapes = SHAPES.map(s => ({
      ...s,
      actualX: s.x * size,
      actualY: s.y * size,
      actualSize: s.size * (size / 400),
    }));
    render();
    return () => cleanup();
  }, [render, cleanup]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center">
      <div className="max-w-md w-full">
        <div className="flex justify-between mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-400">SCORE</p>
            <p className="text-xl font-bold text-yellow-400">{score}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">LEVEL</p>
            <p className="text-xl font-bold text-green-400">{level}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">LIVES</p>
            <p className="text-xl font-bold text-red-500">{'❤️'.repeat(lives)}</p>
          </div>
        </div>

        <div className="relative mb-8">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-full aspect-square rounded-3xl bg-black/50 border-4 border-gray-800 shadow-2xl cursor-pointer"
          />
          {gameStatus === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-3xl">
              <button onClick={startGame} className="px-8 py-3 bg-orange-500 hover:bg-orange-600 rounded-full font-bold text-white transition-transform active:scale-95">
                START GAME
              </button>
            </div>
          )}
        </div>

        <div className="text-center text-lg font-medium h-8">
          {gameStatus === 'showing' && <span className="text-orange-400 animate-pulse">Watch...</span>}
          {gameStatus === 'playing' && <span className="text-green-400">Repeat the pattern!</span>}
          {gameStatus === 'gameover' && <span className="text-red-500">Game Over!</span>}
        </div>
      </div>
    </div>
  );
});

export default ShapeSequenceGame;