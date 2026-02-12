import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';

// --- Constants ---
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const BALL_RADIUS = 12;
const GRAVITY = 0.4;
const JUMP_FORCE = -11;
const PLATFORM_WIDTH = 75;
const PLATFORM_HEIGHT = 12;
const STAR_COUNT = 50;
const SAFE_START_Y = 500; // Ball spawns lower for more climbing room

const DIFFICULTY_THRESHOLDS = [
  { score: 0, platformGap: 90, speed: 1.0, specialChance: 0.1 },
  { score: 500, platformGap: 80, speed: 1.2, specialChance: 0.2 },
  { score: 1000, platformGap: 70, speed: 1.4, specialChance: 0.3 },
];

// --- Types ---
interface Platform {
  x: number; y: number; id: number; 
  type: 'normal' | 'spring' | 'breakable' | 'moving';
  isBroken?: boolean; vx?: number;
}

// --- Component ---
const GravityBall = forwardRef((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'countdown' | 'playing' | 'paused' | 'gameOver'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const [highScore, setHighScore] = useState(0);

  // Logic Refs
  const ballRef = useRef({ x: 200, y: 0, vx: 0, vy: 0, trail: [] as any[] });
  const platformsRef = useRef<Platform[]>([]);
  const starsRef = useRef<any[]>([]);
  const tiltRef = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const audioContextRef = useRef<AudioContext | null>(null);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score: scoreRef.current, level: 1 }),
    onGameEnd: () => setGameState('gameOver'),
  }));

  // --- Initialization & Safe Spawn ---
  const resetBall = (isNewGame = false) => {
    const startX = CANVAS_WIDTH / 2;
    const startY = SAFE_START_Y - 40;

    ballRef.current = {
      x: startX,
      y: startY,
      vx: 0,
      vy: JUMP_FORCE * 0.7, // Initial "pop"
      trail: [],
    };

    const diff = DIFFICULTY_THRESHOLDS[0];
    const startPlatforms: Platform[] = [];
    
    // GUARANTEED PLATFORM 1 (Under the ball)
    startPlatforms.push({
      x: startX - PLATFORM_WIDTH / 2,
      y: SAFE_START_Y,
      id: Math.random(),
      type: 'normal',
    });

    // Generate path UPWARDS
    for (let i = 1; i < 8; i++) {
      startPlatforms.push({
        x: Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
        y: SAFE_START_Y - (i * diff.platformGap),
        id: Math.random(),
        type: 'normal',
      });
    }
    platformsRef.current = startPlatforms;
  };

  const startSequence = () => {
    resetBall(true);
    setGameState('countdown');
    setCountdown(3);
  };

  useEffect(() => {
    if (gameState !== 'countdown') return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setGameState('playing');
          return 0;
        }
        return prev - 1;
      });
    }, 800);
    return () => clearInterval(timer);
  }, [gameState]);

  // --- Game Loop ---
  useEffect(() => {
    if (gameState !== 'playing') return;
    const ctx = canvasRef.current?.getContext('2d')!;
    let frameId: number;

    const loop = () => {
      const b = ballRef.current;
      
      // Update Trail
      b.trail.unshift({ x: b.x, y: b.y });
      if (b.trail.length > 10) b.trail.pop();

      // Physics
      b.vx = tiltRef.current * 7;
      b.vy += GRAVITY;
      b.x += b.vx;
      b.y += b.vy;

      // Screen Wrap
      if (b.x < 0) b.x = CANVAS_WIDTH;
      if (b.x > CANVAS_WIDTH) b.x = 0;

      // Collisions
      platformsRef.current.forEach(p => {
        if (b.vy > 0 && b.y + BALL_RADIUS > p.y && b.y + BALL_RADIUS < p.y + PLATFORM_HEIGHT + 10 &&
            b.x > p.x - 10 && b.x < p.x + PLATFORM_WIDTH + 10) {
          b.vy = JUMP_FORCE;
        }
      });

      // Camera Follow (Climbing)
      if (b.y < 250) {
        const offset = 250 - b.y;
        b.y = 250;
        platformsRef.current.forEach(p => p.y += offset);
        scoreRef.current += Math.floor(offset / 10);
        setScore(scoreRef.current);
      }

      // Cleanup & Procedural Generation
      platformsRef.current = platformsRef.current.filter(p => p.y < CANVAS_HEIGHT);
      while (platformsRef.current.length < 8) {
        const topY = platformsRef.current[0]?.y || 0;
        platformsRef.current.unshift({
          x: Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
          y: topY - 90,
          id: Math.random(),
          type: 'normal'
        });
      }

      // Death Check
      if (b.y > CANVAS_HEIGHT + 50) {
        livesRef.current -= 1;
        setDisplayLives(livesRef.current);
        if (livesRef.current <= 0) setGameState('gameOver');
        else resetBall();
      }

      // Draw
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Draw Platforms
      ctx.fillStyle = '#0ff';
      ctx.shadowBlur = 10; ctx.shadowColor = '#0ff';
      platformsRef.current.forEach(p => ctx.fillRect(p.x, p.y, PLATFORM_WIDTH, PLATFORM_HEIGHT));
      
      // Draw Ball
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      frameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(frameId);
  }, [gameState]);

  return (
    <div className="flex flex-col min-h-screen bg-black items-center justify-center font-mono touch-none">
      <div className="w-[400px] flex justify-between p-4 text-cyan-400 border-b border-cyan-900/50">
        <span className="font-bold">ALT: {score}m</span>
        <div className="flex gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className={i < displayLives ? "opacity-100" : "opacity-20"}>❤️</span>
          ))}
        </div>
      </div>

      <div className="relative">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="border-2 border-cyan-500/30 rounded-lg shadow-[0_0_20px_rgba(0,255,255,0.1)]" />

        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
            <h1 className="text-4xl font-black text-cyan-400 mb-8 tracking-tighter">GRAVITY BALL</h1>
            <button onClick={startSequence} className="px-12 py-4 border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black font-bold transition-all rounded-full">INITIALIZE</button>
          </div>
        )}

        {gameState === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-9xl font-black text-white animate-ping">{countdown}</span>
          </div>
        )}

        {gameState === 'gameOver' && (
          <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center">
            <h2 className="text-5xl font-black text-white mb-2">CRASHED</h2>
            <p className="text-red-200 mb-8 font-bold">FINAL ALTITUDE: {score}m</p>
            <button onClick={() => window.location.reload()} className="px-8 py-3 bg-white text-red-900 font-bold rounded-full">REBOOT SYSTEM</button>
          </div>
        )}
      </div>
    </div>
  );
});

export default GravityBall;