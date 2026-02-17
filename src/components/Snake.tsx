import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { TrendingUp } from 'lucide-react';
import { GameHandle } from '../lib/gameTypes';
import { audioManager } from '../lib/audioManager';

interface Position { x: number; y: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }
interface TrailSegment { x: number; y: number; life: number; }
interface PowerUp { x: number; y: number; type: 'gold' | 'ice' | 'ghost' | 'shrink' | 'rewind'; spawnTime: number; }
interface Obstacle { x: number; y: number; }
interface HistoryState { snake: Position[]; dir: Position; }

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
const POWERUP_CHANCE = 0.22;
const SLOW_DURATION = 10000;
const GHOST_DURATION = 5000;

const Snake = forwardRef<GameHandle, SnakeProps>(({ onScoreUpdate, onComplete, timeRemaining }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Game State Refs (Source of Truth)
  const snakeRef = useRef<Position[]>([{ x: 10, y: 10 }]);
  const directionRef = useRef<Position>({ x: 0, y: 0 });
  const inputQueueRef = useRef<Position[]>([]);
  const foodRef = useRef<Position>({ x: 15, y: 15 });
  const obstaclesRef = useRef<Obstacle[]>([]);
  const powerUpRef = useRef<PowerUp | null>(null);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const gameOverRef = useRef(false);
  const slowedUntilRef = useRef(0);
  const invincibleUntilRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const trailRef = useRef<TrailSegment[]>([]);
  const historyRef = useRef<HistoryState[]>([]);
  const comboRef = useRef(0);
  const rewindUsesRef = useRef(0);
  const touchStartRef = useRef<Position | null>(null);

  // UI State
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const [displayCombo, setDisplayCombo] = useState(0);
  const [rewindUses, setRewindUses] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [activeEffects, setActiveEffects] = useState<{ slow: boolean; ghost: boolean }>({ slow: false, ghost: false });
  const [audioLoaded, setAudioLoaded] = useState(false);

  // Visual Effects
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

  // Audio
  useEffect(() => {
    const loadAudio = async () => {
      await audioManager.loadSound('snake_eat', '/sounds/snake/collect.mp3', 3);
      await audioManager.loadSound('snake_powerup_gold', '/sounds/snake/powerup_gold.mp3', 2);
      await audioManager.loadSound('snake_powerup_special', '/sounds/snake/powerup_special.mp3', 2);
      await audioManager.loadSound('snake_die', '/sounds/snake/crash.mp3', 2);
      await audioManager.loadSound('snake_gameover', '/sounds/snake/game_end.mp3', 1);
      await audioManager.loadSound('snake_bg_music', '/sounds/snake/neon_arcade_dreams.mp3', 1);
      setAudioLoaded(true);
    };
    loadAudio();
    return () => audioManager.stopMusic('snake_bg_music');
  }, []);

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
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14;
      const speed = 1.8 + Math.random() * 2.2;
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
    comboRef.current = 0;
    setDisplayCombo(0);
    trailRef.current = [];
    historyRef.current = [];
    rewindUsesRef.current = 0;
    setRewindUses(0);
    invincibleUntilRef.current = 0;
    powerUpRef.current = null;
  };

  const performRewind = () => {
    if (rewindUsesRef.current <= 0 || historyRef.current.length === 0) return;

    const prevState = historyRef.current.pop()!;
    snakeRef.current = prevState.snake.map(s => ({ ...s }));
    directionRef.current = { ...prevState.dir };
    inputQueueRef.current = [];

    rewindUsesRef.current--;
    setRewindUses(rewindUsesRef.current);

    triggerHaptic(80);
    createParticleBurst(snakeRef.current[0].x, snakeRef.current[0].y, '#a855f7');
    setScreenShake(8);
    audioManager.play('snake_powerup_special', 0.5);
  };

  const gameLoop = () => {
    if (gameOverRef.current) return;

    if (inputQueueRef.current.length > 0) {
      directionRef.current = inputQueueRef.current.shift()!;
    }

    const dir = directionRef.current;
    if (dir.x === 0 && dir.y === 0) return;

    const head = { x: snakeRef.current[0].x + dir.x, y: snakeRef.current[0].y + dir.y };

    const hitWall = head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20;
    const hitBody = snakeRef.current.some(seg => seg.x === head.x && seg.y === head.y);
    const hitObs = obstaclesRef.current.some(obs => obs.x === head.x && obs.y === head.y);
    const isInvincible = Date.now() < invincibleUntilRef.current;

    if (hitWall || (!isInvincible && (hitBody || hitObs))) {
      triggerHaptic(100);
      setScreenShake(10);
      livesRef.current -= 1;
      setDisplayLives(livesRef.current);

      if (livesRef.current <= 0) {
        audioManager.stopMusic('snake_bg_music');
        audioManager.play('snake_gameover', 0.7);
        gameOverRef.current = true;
        setIsGameOver(true);
        if (onComplete) {
          setTimeout(() => onComplete(scoreRef.current, 200, timeRemaining), 2000);
        }
      } else {
        audioManager.play('snake_die', 0.7);
        resetSnake();
      }
      return;
    }

    let newSnake = [head, ...snakeRef.current];
    let grew = false;

    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      audioManager.play('snake_eat', 0.5);
      triggerHaptic(40);
      comboRef.current++;
      setDisplayCombo(comboRef.current);

      const multiplier = Math.min(4, 1 + Math.floor((comboRef.current - 1) / 5));
      scoreRef.current += 10 * multiplier;
      setDisplayScore(scoreRef.current);
      if (onScoreUpdate) onScoreUpdate(scoreRef.current, 200);

      foodRef.current = createFood();
      createParticleBurst(head.x, head.y, '#ef4444');
      setShimmer(1);
      grew = true;

      if (scoreRef.current % 50 === 0) {
        obstaclesRef.current.push(createFood());
        setBackgroundHue(h => (h + 40) % 360);
      }

      if (Math.random() < POWERUP_CHANCE && !powerUpRef.current) {
        const types: PowerUp['type'][] = ['gold', 'ice', 'ghost', 'shrink', 'rewind'];
        const chosen = types[Math.floor(Math.random() * types.length)];
        powerUpRef.current = { ...createFood(), type: chosen, spawnTime: Date.now() };
      }
    } else if (powerUpRef.current && head.x === powerUpRef.current.x && head.y === powerUpRef.current.y) {
      triggerHaptic(60);
      grew = true;

      const type = powerUpRef.current.type;
      if (type === 'gold') {
        audioManager.play('snake_powerup_gold', 0.6);
        const multiplier = Math.min(4, 1 + Math.floor((comboRef.current - 1) / 5)) || 1;
        scoreRef.current += Math.floor(50 * multiplier);
        setDisplayScore(scoreRef.current);
        if (onScoreUpdate) onScoreUpdate(scoreRef.current, 200);
        createParticleBurst(head.x, head.y, '#fbbf24');
      } else if (type === 'ice') {
        audioManager.play('snake_powerup_special', 0.6);
        slowedUntilRef.current = Date.now() + SLOW_DURATION;
        setActiveEffects(prev => ({ ...prev, slow: true }));
        createParticleBurst(head.x, head.y, '#60a5fa');
      } else if (type === 'ghost') {
        audioManager.play('snake_powerup_special', 0.6);
        invincibleUntilRef.current = Date.now() + GHOST_DURATION;
        setActiveEffects(prev => ({ ...prev, ghost: true }));
        createParticleBurst(head.x, head.y, '#c084fc');
      } else if (type === 'shrink') {
        audioManager.play('snake_powerup_special', 0.6);
        const newLen = Math.max(1, Math.floor(snakeRef.current.length / 2));
        snakeRef.current = snakeRef.current.slice(0, newLen);
        newSnake = snakeRef.current; // override since we already sliced
        createParticleBurst(head.x, head.y, '#eab308');
      } else if (type === 'rewind') {
        audioManager.play('snake_powerup_special', 0.6);
        rewindUsesRef.current = Math.min(3, rewindUsesRef.current + 2);
        setRewindUses(rewindUsesRef.current);
        createParticleBurst(head.x, head.y, '#a78bfa');
      }

      powerUpRef.current = null;
    } else {
      newSnake.pop();
      comboRef.current = 0;
      setDisplayCombo(0);
    }

    snakeRef.current = newSnake;

    // Trail (neon glow behind head path)
    trailRef.current.push({ x: head.x, y: head.y, life: 32 });

    // History for rewind (max 8 states)
    historyRef.current.push({
      snake: snakeRef.current.map(p => ({ ...p })),
      dir: { ...directionRef.current }
    });
    if (historyRef.current.length > 8) historyRef.current.shift();
  };

  const updateDirection = (newDir: Position) => {
    if (gameOverRef.current) return;

    if (!gameStarted) {
      audioManager.initialize();
      setGameStarted(true);
      setShowInstructions(false);
      if (audioLoaded) {
        audioManager.playMusic('snake_bg_music');
      }
    }

    const lastQueued = inputQueueRef.current.length > 0
      ? inputQueueRef.current[inputQueueRef.current.length - 1]
      : directionRef.current;

    if ((newDir.x !== 0 && lastQueued.x !== 0) || (newDir.y !== 0 && lastQueued.y !== 0)) return;

    if (inputQueueRef.current.length < 3) {
      inputQueueRef.current.push(newDir);
    }
  };

  // Input
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

  // Game Ticker
  useEffect(() => {
    if (!gameStarted || isGameOver) return;

    const ticker = setInterval(() => {
      gameLoop();

      // Particles
      particlesRef.current = particlesRef.current
        .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.055 }))
        .filter(p => p.life > 0);

      // Trail fade
      trailRef.current = trailRef.current
        .map(t => ({ ...t, life: t.life - 1 }))
        .filter(t => t.life > 0);

      // Effect timeouts
      if (Date.now() > slowedUntilRef.current && activeEffects.slow) {
        setActiveEffects(prev => ({ ...prev, slow: false }));
      }
      if (Date.now() > invincibleUntilRef.current && activeEffects.ghost) {
        setActiveEffects(prev => ({ ...prev, ghost: false }));
      }
    }, activeEffects.slow 
      ? INITIAL_SPEED * 1.5 
      : Math.max(MAX_SPEED, INITIAL_SPEED - Math.floor(scoreRef.current / 50) * SPEED_INCREMENT)
    );

    return () => clearInterval(ticker);
  }, [gameStarted, isGameOver, activeEffects.slow, activeEffects.ghost]);

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    let animFrame: number;

    const draw = () => {
      // Background
      ctx.fillStyle = `hsl(${backgroundHue}, 15%, 5%)`;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Pulsing neon grid + twinkling stars
      const time = Date.now() / 1000;
      ctx.strokeStyle = `hsl(${backgroundHue}, 85%, 28%)`;
      ctx.lineWidth = 1.5;
      const gridOffset = (time * 38) % GRID_SIZE;
      for (let x = -gridOffset; x < CANVAS_SIZE; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_SIZE);
        ctx.stroke();
      }
      for (let y = -gridOffset * 0.7; y < CANVAS_SIZE; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_SIZE, y);
        ctx.stroke();
      }

      ctx.globalAlpha = 0.65;
      ctx.fillStyle = '#bae6fd';
      for (let i = 0; i < 38; i++) {
        const tx = ((time * (12 + (i % 6)) + i * 23) % (CANVAS_SIZE + 60)) - 30;
        const ty = (Math.sin(time * 1.3 + i * 0.7) * 95 + 170 + (i * 11)) % (CANVAS_SIZE + 40);
        const sz = 1.2 + Math.sin(time * 4 + i) * 0.9;
        ctx.fillRect(tx, ty, sz, sz);
      }
      ctx.globalAlpha = 1;

      // Particles
      particlesRef.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      });
      ctx.globalAlpha = 1;

      // Neon Trail
      ctx.shadowBlur = 32;
      ctx.shadowColor = '#22d3ee';
      trailRef.current.forEach((t, idx) => {
        const alpha = (t.life / 32) * 0.82;
        ctx.globalAlpha = alpha;
        const size = 11 + (t.life / 32) * 7;
        ctx.fillStyle = idx % 4 === 0 ? '#67e8f9' : '#10b981';
        ctx.fillRect(
          t.x * GRID_SIZE + (GRID_SIZE - size) / 2,
          t.y * GRID_SIZE + (GRID_SIZE - size) / 2,
          size,
          size
        );
      });
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Food (pulsing)
      const pulse = Math.sin(Date.now() / 180) * 2.5;
      ctx.fillStyle = '#ef4444';
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#ef4444';
      ctx.beginPath();
      ctx.arc(foodRef.current.x * GRID_SIZE + 10, foodRef.current.y * GRID_SIZE + 10, 7.5 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Power-up
      if (powerUpRef.current) {
        let pColor = '#fbbf24';
        if (powerUpRef.current.type === 'ice') pColor = '#60a5fa';
        else if (powerUpRef.current.type === 'ghost') pColor = '#c084fc';
        else if (powerUpRef.current.type === 'shrink') pColor = '#facc15';
        else if (powerUpRef.current.type === 'rewind') pColor = '#a78bfa';

        ctx.fillStyle = pColor;
        ctx.shadowBlur = 18;
        ctx.shadowColor = pColor;
        const px = powerUpRef.current.x * GRID_SIZE + 3;
        const py = powerUpRef.current.y * GRID_SIZE + 3;
        ctx.fillRect(px, py, 14, 14);
        ctx.shadowBlur = 0;
      }

      // Obstacles
      ctx.fillStyle = '#444';
      obstaclesRef.current.forEach(o => {
        ctx.fillRect(o.x * GRID_SIZE + 1, o.y * GRID_SIZE + 1, 18, 18);
      });

      // Snake
      snakeRef.current.forEach((seg, i) => {
        let fillColor = i === 0 ? '#22d3ee' : '#10b981';
        let shadowColor = '#22d3ee';

        if (Date.now() < invincibleUntilRef.current) {
          fillColor = i === 0 ? '#d946ef' : '#c026d3';
          shadowColor = '#d946ef';
        }

        ctx.fillStyle = fillColor;
        ctx.shadowBlur = i === 0 ? 19 : 0;
        ctx.shadowColor = shadowColor;

        const r = 5;
        const x = seg.x * GRID_SIZE + 1;
        const y = seg.y * GRID_SIZE + 1;
        const s = 18;
        ctx.beginPath();
        ctx.roundRect(x, y, s, s, r);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Shimmer border
      if (shimmer > 0) {
        ctx.strokeStyle = `rgba(74, 222, 128, ${shimmer})`;
        ctx.lineWidth = 5;
        ctx.strokeRect(2, 2, CANVAS_SIZE - 4, CANVAS_SIZE - 4);
        setShimmer(s => Math.max(0, s - 0.018));
      }

      animFrame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrame);
  }, [backgroundHue, shimmer]);

  // Screen shake cleanup
  useEffect(() => {
    if (screenShake > 0) {
      const t = setTimeout(() => setScreenShake(s => Math.max(0, s - 1)), 45);
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
        <div className="flex justify-between mt-2 font-mono text-sm">
          <div className="text-green-300 flex items-center gap-2">
            SCORE: <span className="text-yellow-400 font-bold">{displayScore}</span>
            {displayCombo > 1 && (
              <span className="text-pink-400 text-xs font-black tracking-widest">×{displayCombo} COMBO 🔥</span>
            )}
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={i < displayLives ? 'grayscale-0' : 'grayscale opacity-20'}>
                ❤️
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div
          className="relative border-4 border-green-900 rounded-2xl overflow-hidden bg-black"
          style={{
            width: '340px',
            height: '340px',
            transform: `translate(${(Math.random() - 0.5) * screenShake * 1.6}px, ${(Math.random() - 0.5) * screenShake * 1.6}px)`,
            boxShadow: '0 0 50px rgba(0,0,0,0.6)'
          }}
        >
          <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} style={{ width: '100%', height: '100%' }} />

          {showInstructions && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-center p-6">
              <div className="text-green-400 animate-pulse">
                <p className="mb-2 font-bold text-xl">SWIPE or KEYS TO MOVE</p>
                <p className="text-xs text-green-200 opacity-80">Eat apples • Grab power-ups<br />Ghost through obstacles • Rewind mistakes!</p>
              </div>
            </div>
          )}

          {isGameOver && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center">
              <span className="text-6xl mb-4">💀</span>
              <h3 className="text-red-500 text-3xl font-black">CRASHED</h3>
              <p className="text-yellow-500 font-mono text-xl">FINAL SCORE: {scoreRef.current}</p>
            </div>
          )}

          {activeEffects.slow && (
            <div className="absolute top-3 left-3 bg-blue-600/90 text-white text-[10px] px-3 py-1 rounded-full font-mono tracking-widest animate-bounce">
              ❄️ SLOW MOTION
            </div>
          )}

          {activeEffects.ghost && (
            <div className="absolute top-3 right-3 bg-purple-600/90 text-white text-[10px] px-3 py-1 rounded-full font-mono tracking-widest animate-pulse">
              👻 GHOST MODE
            </div>
          )}

          {rewindUses > 0 && (
            <button
              onClick={performRewind}
              className="absolute bottom-3 right-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-xl active:scale-95 transition-all border border-purple-400/30"
            >
              ⏪ REWIND ({rewindUses})
            </button>
          )}
        </div>

        {/* DPAD */}
        <div className="grid grid-cols-3 gap-2 mt-8 w-44 sm:hidden">
          <div />
          <button onClick={() => updateDirection({ x: 0, y: -1 })} className="h-12 bg-green-900/30 border border-green-500 rounded-xl text-white text-2xl active:bg-green-800">↑</button>
          <div />
          <button onClick={() => updateDirection({ x: -1, y: 0 })} className="h-12 bg-green-900/30 border border-green-500 rounded-xl text-white text-2xl active:bg-green-800">←</button>
          <button onClick={() => updateDirection({ x: 0, y: 1 })} className="h-12 bg-green-900/30 border border-green-500 rounded-xl text-white text-2xl active:bg-green-800">↓</button>
          <button onClick={() => updateDirection({ x: 1, y: 0 })} className="h-12 bg-green-900/30 border border-green-500 rounded-xl text-white text-2xl active:bg-green-800">→</button>
        </div>
      </div>
    </div>
  );
});

Snake.displayName = 'Snake';
export default Snake;