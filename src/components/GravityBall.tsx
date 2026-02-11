import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

// --- Constants ---
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const BALL_RADIUS = 12;
const GRAVITY = 0.4;
const JUMP_FORCE = -11;
const PLATFORM_WIDTH = 75;
const PLATFORM_HEIGHT = 12;
const STAR_COUNT = 50;

interface Platform {
  x: number;
  y: number;
  id: number;
  type: 'normal' | 'spring' | 'breakable';
  isBroken?: boolean;
}

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
}

const GravityBall = forwardRef((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameOver'>('idle');
  const [score, setScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);

  // --- Refs for High-Performance Logic ---
  const ballRef = useRef({
    x: 200, y: 300, vx: 0, vy: 0,
    scaleX: 1, scaleY: 1 // For Squash & Stretch
  });
  const platformsRef = useRef<Platform[]>([]);
  const starsRef = useRef<Star[]>([]);
  const tiltRef = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score: scoreRef.current, maxScore: 1000 }),
    onGameEnd: () => setGameState('gameOver'),
  }));

  // --- iOS Sensor Permission & Start ---
  const startSensor = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
          initGame();
        }
      } catch (err) {
        alert("Motion sensors required for iPhone play.");
      }
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
      initGame();
    }
  };

  const handleOrientation = (e: DeviceOrientationEvent) => {
    // Gamma is left-to-right tilt on mobile
    const tilt = e.gamma || 0;
    tiltRef.current = tilt / 25; 
  };

  const resetBall = () => {
    ballRef.current = { x: 200, y: 300, vx: 0, vy: 0, scaleX: 1, scaleY: 1 };

    // Regenerate platforms
    const startPlatforms: Platform[] = [];
    for (let i = 0; i < 7; i++) {
      startPlatforms.push({
        x: i === 0 ? 160 : Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
        y: i * 90 + 100,
        id: Math.random(),
        type: 'normal'
      });
    }
    platformsRef.current = startPlatforms;
  };

  const initGame = () => {
    scoreRef.current = 0;
    setScore(0);
    livesRef.current = 3;
    setDisplayLives(3);
    ballRef.current = { x: 200, y: 300, vx: 0, vy: 0, scaleX: 1, scaleY: 1 };

    // Generate Stars for Parallax
    starsRef.current = Array.from({ length: STAR_COUNT }).map(() => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: Math.random() * 2,
      speed: Math.random() * 0.5 + 0.2
    }));

    // Initial platforms
    const startPlatforms: Platform[] = [];
    for (let i = 0; i < 7; i++) {
      startPlatforms.push({
        x: i === 0 ? 160 : Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
        y: i * 90 + 100,
        id: Math.random(),
        type: 'normal'
      });
    }
    platformsRef.current = startPlatforms;
    setGameState('playing');
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    let frameId: number;

    const loop = () => {
      const b = ballRef.current;

      // 1. Physics & Tilt
      b.vx = tiltRef.current * 6;
      b.vy += GRAVITY;
      b.x += b.vx;
      b.y += b.vy;

      // Squash & Stretch Recovery
      b.scaleX += (1 - b.scaleX) * 0.2;
      b.scaleY += (1 - b.scaleY) * 0.2;

      // Screen Wrap
      if (b.x < 0) b.x = CANVAS_WIDTH;
      if (b.x > CANVAS_WIDTH) b.x = 0;

      // 2. Collision Detection
      platformsRef.current.forEach(p => {
        if (b.vy > 0 && 
            b.y + BALL_RADIUS > p.y && 
            b.y + BALL_RADIUS < p.y + PLATFORM_HEIGHT + 12 &&
            b.x > p.x - 10 && b.x < p.x + PLATFORM_WIDTH + 10) {
          
          if (p.type === 'breakable') {
            if (!p.isBroken) {
              b.vy = JUMP_FORCE;
              p.isBroken = true;
              applySquash();
            }
          } else if (p.type === 'spring') {
            b.vy = JUMP_FORCE * 1.8;
            applySquash(0.6, 1.4); // Deep squash for big jump
          } else {
            b.vy = JUMP_FORCE;
            applySquash();
          }
        }
      });

      function applySquash(sx = 1.3, sy = 0.7) {
        b.scaleX = sx;
        b.scaleY = sy;
      }

      // 3. Camera Scrolling & Parallax
      if (b.y < 250) {
        const offset = 250 - b.y;
        b.y = 250;
        
        // Move platforms down
        platformsRef.current.forEach(p => p.y += offset);
        
        // Move stars down (Parallax)
        starsRef.current.forEach(s => {
          s.y += offset * s.speed;
          if (s.y > CANVAS_HEIGHT) s.y = 0;
        });

        scoreRef.current += Math.floor(offset / 10);
        setScore(scoreRef.current);
      }

      // 4. Cleanup & Procedural Generation
      platformsRef.current = platformsRef.current.filter(p => p.y < CANVAS_HEIGHT);
      while (platformsRef.current.length < 8) {
        const topP = platformsRef.current[0];
        const rand = Math.random();
        let type: 'normal' | 'spring' | 'breakable' = 'normal';
        if (rand > 0.9) type = 'spring';
        else if (rand > 0.75) type = 'breakable';

        platformsRef.current.unshift({
          x: Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
          y: (topP?.y || 0) - (80 + Math.random() * 40),
          id: Math.random(),
          type
        });
      }

      // 5. Life Lost or Game Over
      if (b.y > CANVAS_HEIGHT + 100) {
        livesRef.current -= 1;
        setDisplayLives(livesRef.current);

        if (livesRef.current <= 0) {
          setGameState('gameOver');
        } else {
          resetBall();
        }
      }

      // 6. Draw Everything
      if (ctx) {
        ctx.fillStyle = '#0f172a'; // Deep Navy
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw Stars
        ctx.fillStyle = '#ffffff';
        starsRef.current.forEach(s => {
          ctx.globalAlpha = s.speed;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Draw Platforms
        platformsRef.current.forEach(p => {
          if (p.isBroken) return;
          ctx.shadowBlur = 10;
          if (p.type === 'spring') {
            ctx.fillStyle = '#fbbf24'; // Gold
            ctx.shadowColor = '#fbbf24';
          } else if (p.type === 'breakable') {
            ctx.fillStyle = '#ef4444'; // Red
            ctx.shadowColor = '#ef4444';
          } else {
            ctx.fillStyle = '#10b981'; // Green
            ctx.shadowColor = '#10b981';
          }
          ctx.beginPath();
          ctx.roundRect(p.x, p.y, PLATFORM_WIDTH, PLATFORM_HEIGHT, 5);
          ctx.fill();
        });

        // Draw Ball with Squash & Stretch
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.scale(b.scaleX, b.scaleY);
        ctx.fillStyle = '#22d3ee';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#22d3ee';
        ctx.beginPath();
        ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      frameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(frameId);
  }, [gameState]);

  return (
    <div className="flex flex-col h-full bg-slate-900 items-center justify-center select-none overflow-hidden touch-none font-sans">
      <div className="absolute top-6 flex flex-col items-center z-10 gap-2">
        <span className="text-cyan-400 font-mono text-2xl font-bold tracking-widest uppercase">
          Altitude: {score}m
        </span>
        <div className="flex gap-1">
          {Array.from({length: 3}).map((_, i) => (
            <span key={i} className={i < displayLives ? "grayscale-0" : "grayscale opacity-20"}>
              ❤️
            </span>
          ))}
        </div>
      </div>

      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} height={CANVAS_HEIGHT} 
        className="bg-black max-h-[75vh] w-auto border-x border-slate-700 shadow-2xl"
      />

      {gameState === 'idle' && (
        <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
          <h1 className="text-5xl font-black text-white mb-2 italic tracking-tighter">GRAVITY</h1>
          <h1 className="text-5xl font-black text-cyan-500 mb-6 italic tracking-tighter">BOUNCE</h1>
          <p className="text-slate-400 max-w-xs mb-10 leading-relaxed">
            Tilt your phone to steer. Landing on <span className="text-yellow-400">Gold Springs</span> boosts you higher!
          </p>
          <button 
            onClick={startSensor}
            className="bg-cyan-500 hover:bg-cyan-400 text-white font-black py-5 px-14 rounded-full text-xl transition-all active:scale-95 shadow-[0_0_30px_rgba(34,211,238,0.4)]"
          >
            INITIALIZE SENSORS
          </button>
        </div>
      )}

      {gameState === 'gameOver' && (
        <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center p-8 text-center">
          <span className="text-7xl mb-4">☄️</span>
          <h2 className="text-5xl font-black text-white mb-2">CRASHED!</h2>
          <p className="text-2xl text-red-200 font-mono mb-10">Altitude: {score}m</p>
          <button 
            onClick={initGame}
            className="bg-white text-red-950 font-black py-4 px-12 rounded-full text-xl shadow-xl active:scale-95"
          >
            RE-LAUNCH
          </button>
        </div>
      )}
    </div>
  );
});

export default GravityBall;