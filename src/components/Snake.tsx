import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { TrendingUp } from 'lucide-react';
import { GameHandle } from '../lib/gameTypes';
import { audioManager } from '../lib/audioManager';

interface Position { x: number; y: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }
interface PowerUp { x: number; y: number; type: 'gold' | 'ice'; spawnTime: number; }
interface Obstacle { x: number; y: number; }

interface SnakeProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
}

const GRID_SIZE = 20;
const CANVAS_SIZE = 400;
const INITIAL_SPEED = 180;
const SPEED_INCREMENT = 5;
const MAX_SPEED = 60;
const POWERUP_CHANCE = 0.15;
const SLOW_DURATION = 10000;

const Snake = forwardRef<GameHandle, SnakeProps>(({ onScoreUpdate, onComplete, timeRemaining }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State Refs (Source of Truth for the loop)
  const snakeRef = useRef<Position[]>([{ x: 10, y: 10 }]);
  const directionRef = useRef<Position>({ x: 0, y: 0 });
  const inputQueueRef = useRef<Position[]>([]); // Input Buffer
  const foodRef = useRef<Position>({ x: 15, y: 15 });
  const obstaclesRef = useRef<Obstacle[]>([]);
  const powerUpRef = useRef<PowerUp | null>(null);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const gameOverRef = useRef(false);
  const slowedUntilRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const touchStartRef = useRef<Position | null>(null);

  // UI State
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [activeEffects, setActiveEffects] = useState<{slow: boolean}>({ slow: false });

  // Visual Effects State
  const [screenShake, setScreenShake] = useState(0);
  const [shimmer, setShimmer] = useState(0);
  const [backgroundHue, setBackgroundHue] = useState(0);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score: scoreRef.current, maxScore: 200 }),
    onGameEnd: () => {
      if (!gameOverRef.current && onComplete) onComplete(scoreRef.current, 200, timeRemaining);
    },
    canSkipQuestion: false,
    hideTimer: true
  }));

  // Initialize Audio
  useEffect(() => {
    const loadAudio = async () => {
      await audioManager.loadSound('snake_eat', '/sounds/snake/short_success.mp3', 3);
      await audioManager.loadSound('snake_gobble', '/sounds/snake/gobble_optimized.mp3', 2);
      await audioManager.loadSound('snake_die', '/sounds/ranky/fail.mp3', 2);
      await audioManager.loadSound('snake_gameover', '/sounds/snake/level_complete.mp3', 1);
      await audioManager.loadSound('snake_ticktock', '/sounds/snake/ticktock.mp3', 1);
    };
    loadAudio();
    return () => audioManager.stopMusic('snake_ticktock');
  }, []);

  // Utility: Vibration for mobile "Juice"
  const triggerHaptic = (ms = 50) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  };

  const createFood = (): Position => {
    let newFood;
    while (true) {
      newFood = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
      const onSnake = snakeRef.current.some(s => s.x === newFood.x && s.y === newFood.y);
      const onObs = obstaclesRef.current.some(o => o.x === newFood.x && o.y === newFood.y);
      if (!onSnake && !onObs) break;
    }
    return newFood;
  };

  const createParticleBurst = (x: number, y: number, color: string) => {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const speed = 1.5 + Math.random() * 2;
      particlesRef.current.push({
        x: x * GRID_SIZE + GRID_SIZE / 2,
        y: y * GRID_SIZE + GRID_SIZE / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color
      });
    }
  };

  const resetSnake = () => {
    snakeRef.current = [{ x: 10, y: 10 }];
    directionRef.current = { x: 0, y: 0 };
    inputQueueRef.current = [];
  };

  const gameLoop = () => {
    if (gameOverRef.current) return;

    // Apply next movement from buffer
    if (inputQueueRef.current.length > 0) {
      directionRef.current = inputQueueRef.current.shift()!;
    }

    const dir = directionRef.current;
    if (dir.x === 0 && dir.y === 0) return;

    const head = { x: snakeRef.current[0].x + dir.x, y: snakeRef.current[0].y + dir.y };

    // Collision Check
    const hitWall = head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20;
    const hitBody = snakeRef.current.some(seg => seg.x === head.x && seg.y === head.y);
    const hitObs = obstaclesRef.current.some(obs => obs.x === head.x && obs.y === head.y);

    if (hitWall || hitBody || hitObs) {
      audioManager.stopMusic('snake_ticktock');
      triggerHaptic(100);
      setScreenShake(10);
      livesRef.current -= 1;
      setDisplayLives(livesRef.current);

      if (livesRef.current <= 0) {
        audioManager.play('snake_gameover', 0.7);
        gameOverRef.current = true;
        setIsGameOver(true);
      } else {
        audioManager.play('snake_die', 0.5);
        resetSnake();
      }
      return;
    }

    const newSnake = [head, ...snakeRef.current];
    
    // Check Food
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      audioManager.play('snake_eat', 0.5);
      triggerHaptic(40);
      scoreRef.current += 10;
      setDisplayScore(scoreRef.current);
      if (onScoreUpdate) onScoreUpdate(scoreRef.current, 200);
      
      foodRef.current = createFood();
      createParticleBurst(head.x, head.y, '#ef4444');
      setShimmer(1);

      // Procedural Obstacles
      if (scoreRef.current % 50 === 0) {
        obstaclesRef.current.push(createFood());
        setBackgroundHue(h => (h + 40) % 360);
      }

      // Roll for Powerup
      if (Math.random() < POWERUP_CHANCE && !powerUpRef.current) {
        powerUpRef.current = { ...createFood(), type: Math.random() > 0.5 ? 'gold' : 'ice', spawnTime: Date.now() };
      }
    } else if (powerUpRef.current && head.x === powerUpRef.current.x && head.y === powerUpRef.current.y) {
      // Handle Powerup
      audioManager.play('snake_gobble', 0.6);
      triggerHaptic(60);
      if (powerUpRef.current.type === 'gold') {
        scoreRef.current += 50;
        setDisplayScore(scoreRef.current);
        createParticleBurst(head.x, head.y, '#fbbf24');
      } else {
        slowedUntilRef.current = Date.now() + SLOW_DURATION;
        setActiveEffects({ slow: true });
        createParticleBurst(head.x, head.y, '#60a5fa');
      }
      powerUpRef.current = null;
    } else {
      newSnake.pop();
    }

    snakeRef.current = newSnake;
  };

  // Input Handling (Buffer Strategy)
  const updateDirection = (newDir: Position) => {
    if (gameOverRef.current) return;
    
    if (!gameStarted) {
      setGameStarted(true);
      setShowInstructions(false);
      audioManager.playMusic('snake_ticktock');
    }

    const lastQueued = inputQueueRef.current.length > 0 
      ? inputQueueRef.current[inputQueueRef.current.length - 1] 
      : directionRef.current;

    // Prevent 180-degree turns
    if (newDir.x !== 0 && lastQueued.x !== 0) return;
    if (newDir.y !== 0 && lastQueued.y !== 0) return;

    if (inputQueueRef.current.length < 3) {
      inputQueueRef.current.push(newDir);
    }
  };

  // Keyboard and Swipe Listeners
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const keys: Record<string, Position> = {
        ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }
      };
      if (keys[e.key]) updateDirection(keys[e.key]);
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 30) updateDirection({ x: dx > 0 ? 1 : -1, y: 0 });
      } else {
        if (Math.abs(dy) > 30) updateDirection({ x: 0, y: dy > 0 ? 1 : -1 });
      }
      touchStartRef.current = null;
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameStarted]);

  // Main Ticker
  useEffect(() => {
    if (!gameStarted || isGameOver) return;
    const ticker = setInterval(() => {
      gameLoop();
      // Particles update
      particlesRef.current = particlesRef.current
        .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.05 }))
        .filter(p => p.life > 0);
      
      if (Date.now() > slowedUntilRef.current && activeEffects.slow) {
        setActiveEffects({ slow: false });
      }
    }, activeEffects.slow ? INITIAL_SPEED * 1.5 : Math.max(MAX_SPEED, INITIAL_SPEED - Math.floor(scoreRef.current / 50) * SPEED_INCREMENT));

    return () => clearInterval(ticker);
  }, [gameStarted, isGameOver, activeEffects.slow]);

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animFrame: number;

    const draw = () => {
      ctx.fillStyle = `hsl(${backgroundHue}, 15%, 5%)`;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Draw Particles
      particlesRef.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
      });
      ctx.globalAlpha = 1;

      // Draw Food
      const pulse = Math.sin(Date.now() / 200) * 2;
      ctx.fillStyle = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ef4444';
      ctx.beginPath();
      ctx.arc(foodRef.current.x * 20 + 10, foodRef.current.y * 20 + 10, 7 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Draw Powerups
      if (powerUpRef.current) {
        ctx.fillStyle = powerUpRef.current.type === 'gold' ? '#fbbf24' : '#60a5fa';
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillRect(powerUpRef.current.x * 20 + 2, powerUpRef.current.y * 20 + 2, 16, 16);
      }

      // Draw Obstacles
      ctx.fillStyle = '#444';
      ctx.shadowBlur = 0;
      obstaclesRef.current.forEach(o => ctx.fillRect(o.x * 20, o.y * 20, 18, 18));

      // Draw Snake (Smooth Connection)
      snakeRef.current.forEach((seg, i) => {
        ctx.fillStyle = i === 0 ? '#22d3ee' : '#10b981';
        ctx.shadowBlur = i === 0 ? 15 : 0;
        ctx.shadowColor = '#22d3ee';
        
        // Slightly rounded segments
        const r = 4;
        const x = seg.x * 20;
        const y = seg.y * 20;
        const s = 18;
        ctx.beginPath();
        ctx.roundRect(x, y, s, s, r);
        ctx.fill();
      });

      // Shimmer Effect
      if (shimmer > 0) {
        ctx.strokeStyle = `rgba(34, 197, 94, ${shimmer})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        setShimmer(s => Math.max(0, s - 0.02));
      }

      animFrame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animFrame);
  }, [backgroundHue, shimmer]);

  // Shake Cleanup
  useEffect(() => {
    if (screenShake > 0) {
      const t = setTimeout(() => setScreenShake(s => Math.max(0, s - 1)), 50);
      return () => clearTimeout(t);
    }
  }, [screenShake]);

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden touch-none">
      <div className="px-6 py-4">
        <h2 className="text-2xl font-bold text-green-400 border-b border-green-900 pb-2 flex items-center justify-center gap-2">
          <TrendingUp className="w-6 h-6" />
          <span style={{ textShadow: '0 0 10px #22c55e' }}>NEO-SNAKE</span>
        </h2>
        <div className="flex justify-between mt-2 font-mono">
          <div className="text-green-300">SCORE: <span className="text-yellow-400">{displayScore}</span></div>
          <div className="flex gap-1">
            {Array.from({length: 3}).map((_, i) => (
              <span key={i} className={i < displayLives ? "grayscale-0" : "grayscale opacity-20"}>❤️</span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div 
          className="relative border-4 border-green-900 rounded-xl overflow-hidden bg-black"
          style={{ 
            width: '340px', height: '340px',
            transform: `translate(${(Math.random()-0.5)*screenShake}px, ${(Math.random()-0.5)*screenShake}px)`,
            boxShadow: '0 0 40px rgba(0,0,0,0.5)'
          }}
        >
          <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} style={{ width: '100%', height: '100%' }} />

          {showInstructions && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-center p-6">
              <div className="text-green-400 animate-pulse">
                <p className="mb-2 font-bold">SWIPE or KEYS TO MOVE</p>
                <p className="text-xs text-green-200 opacity-80">Avoid obstacles and yourself.<br/>Collect gold for big points!</p>
              </div>
            </div>
          )}

          {isGameOver && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center">
              <span className="text-6xl mb-4">💀</span>
              <h3 className="text-red-500 text-3xl font-black">CRASHED</h3>
              <p className="text-yellow-500 font-mono text-xl">FINAL: {scoreRef.current}</p>
            </div>
          )}
          
          {activeEffects.slow && (
            <div className="absolute top-2 left-2 bg-blue-500/80 text-white text-[10px] px-2 py-1 rounded-full animate-bounce">
              ❄️ SLOW MOTION
            </div>
          )}
        </div>

        {/* DPAD for Non-Swipe users */}
        <div className="grid grid-cols-3 gap-2 mt-8 w-44 sm:hidden">
          <div />
          <button onClick={() => updateDirection({x:0, y:-1})} className="h-12 bg-green-900/30 border border-green-500 rounded-lg text-white">↑</button>
          <div />
          <button onClick={() => updateDirection({x:-1, y:0})} className="h-12 bg-green-900/30 border border-green-500 rounded-lg text-white">←</button>
          <button onClick={() => updateDirection({x:0, y:1})} className="h-12 bg-green-900/30 border border-green-500 rounded-lg text-white">↓</button>
          <button onClick={() => updateDirection({x:1, y:0})} className="h-12 bg-green-900/30 border border-green-500 rounded-lg text-white">→</button>
        </div>
      </div>
    </div>
  );
});

Snake.displayName = 'Snake';
export default Snake;