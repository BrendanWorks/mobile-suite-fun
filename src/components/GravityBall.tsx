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
const PARTICLE_COUNT = 20;

// Add difficulty scaling
const DIFFICULTY_THRESHOLDS = [
  { score: 0, platformGap: 90, speed: 1.0, specialChance: 0.1 },
  { score: 200, platformGap: 85, speed: 1.1, specialChance: 0.15 },
  { score: 500, platformGap: 80, speed: 1.2, specialChance: 0.2 },
  { score: 800, platformGap: 75, speed: 1.3, specialChance: 0.25 },
];

interface Platform {
  x: number;
  y: number;
  id: number;
  type: 'normal' | 'spring' | 'breakable' | 'moving';
  isBroken?: boolean;
  vx?: number; // For moving platforms
  movingRange?: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'shield' | 'magnet' | 'slowmo';
  id: number;
}

const GravityBall = forwardRef((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'gameOver'>('idle');
  const [score, setScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [activePowerUp, setActivePowerUp] = useState<string | null>(null);
  const [powerUpTimer, setPowerUpTimer] = useState(0);

  // --- Refs for High-Performance Logic ---
  const ballRef = useRef({
    x: 200, y: 300, vx: 0, vy: 0,
    scaleX: 1, scaleY: 1,
    trail: [] as Array<{x: number, y: number, life: number}>,
    hasShield: false,
    magnetRadius: 0
  });
  const platformsRef = useRef<Platform[]>([]);
  const starsRef = useRef<Star[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const tiltRef = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const comboRef = useRef(0);
  const lastJumpTimeRef = useRef(0);
  const gameSpeedRef = useRef(1);
  const powerUpEndTimeRef = useRef(0);
  const shakeRef = useRef(0);

  // High score persistence
  useEffect(() => {
    const saved = localStorage.getItem('gravityBallHighScore');
    if (saved) setHighScore(parseInt(saved));
  }, []);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score: scoreRef.current, maxScore: 1000 }),
    onGameEnd: () => setGameState('gameOver'),
  }));

  // --- Audio Effects ---
  const playSound = useCallback((type: 'jump' | 'spring' | 'break' | 'powerup' | 'death') => {
    // Simple Web Audio implementation - consider using Howler.js for production
    if (typeof window !== 'undefined' && window.AudioContext) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      let frequency = 440;
      let duration = 0.1;
      
      switch(type) {
        case 'jump': frequency = 523.25; break;
        case 'spring': frequency = 659.25; duration = 0.2; break;
        case 'break': frequency = 220; break;
        case 'powerup': frequency = 880; duration = 0.3; break;
        case 'death': frequency = 110; duration = 0.5; break;
      }
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    }
  }, []);

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
    const tilt = e.gamma || 0;
    // Smoother tilt with damping
    tiltRef.current += (tilt / 25 - tiltRef.current) * 0.3;
  };

  const createParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2,
        life: 1,
        color,
        size: Math.random() * 4 + 2
      });
    }
  };

  const applyShake = (intensity: number) => {
    shakeRef.current = Math.max(shakeRef.current, intensity);
  };

  const getCurrentDifficulty = () => {
    const score = scoreRef.current;
    for (let i = DIFFICULTY_THRESHOLDS.length - 1; i >= 0; i--) {
      if (score >= DIFFICULTY_THRESHOLDS[i].score) {
        return DIFFICULTY_THRESHOLDS[i];
      }
    }
    return DIFFICULTY_THRESHOLDS[0];
  };

  const resetBall = () => {
    ballRef.current = { 
      x: 200, y: 300, vx: 0, vy: 0, 
      scaleX: 1, scaleY: 1,
      trail: [],
      hasShield: false,
      magnetRadius: 0
    };
    ballRef.current.trail = Array(10).fill(null).map(() => ({x: 200, y: 300, life: 1}));

    // Regenerate platforms
    const difficulty = getCurrentDifficulty();
    const startPlatforms: Platform[] = [];
    for (let i = 0; i < 7; i++) {
      startPlatforms.push({
        x: i === 0 ? 160 : Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
        y: i * difficulty.platformGap + 100,
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
    comboRef.current = 0;
    setCombo(0);
    gameSpeedRef.current = 1;
    powerUpsRef.current = [];
    setActivePowerUp(null);
    ballRef.current = { 
      x: 200, y: 300, vx: 0, vy: 0, 
      scaleX: 1, scaleY: 1,
      trail: [],
      hasShield: false,
      magnetRadius: 0
    };
    ballRef.current.trail = Array(10).fill(null).map(() => ({x: 200, y: 300, life: 1}));

    // Generate Stars for Parallax with varying opacity
    starsRef.current = Array.from({ length: STAR_COUNT }).map(() => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: Math.random() * 3,
      speed: Math.random() * 0.5 + 0.2,
      opacity: Math.random() * 0.5 + 0.5
    }));

    // Initial platforms
    const difficulty = getCurrentDifficulty();
    const startPlatforms: Platform[] = [];
    for (let i = 0; i < 7; i++) {
      startPlatforms.push({
        x: i === 0 ? 160 : Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
        y: i * difficulty.platformGap + 100,
        id: Math.random(),
        type: 'normal'
      });
    }
    platformsRef.current = startPlatforms;
    setGameState('playing');
  };

  const collectPowerUp = (powerUp: PowerUp) => {
    playSound('powerup');
    powerUpsRef.current = powerUpsRef.current.filter(p => p.id !== powerUp.id);
    
    const now = Date.now();
    powerUpEndTimeRef.current = now + 10000; // 10 seconds
    
    switch(powerUp.type) {
      case 'shield':
        ballRef.current.hasShield = true;
        setActivePowerUp('Shield Active');
        break;
      case 'magnet':
        ballRef.current.magnetRadius = 150;
        setActivePowerUp('Magnet Active');
        break;
      case 'slowmo':
        gameSpeedRef.current = 0.5;
        setActivePowerUp('Slow-Mo Active');
        break;
    }
    
    createParticles(powerUp.x, powerUp.y, '#FFD700', 15);
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    let frameId: number;

    const loop = () => {
      const b = ballRef.current;
      const difficulty = getCurrentDifficulty();
      gameSpeedRef.current = difficulty.speed;

      // Update trail
      b.trail.unshift({x: b.x, y: b.y, life: 1});
      if (b.trail.length > 10) b.trail.pop();
      b.trail.forEach((p, i) => p.life = i / b.trail.length);

      // 1. Physics & Tilt
      b.vx = tiltRef.current * 6 * gameSpeedRef.current;
      b.vy += GRAVITY * gameSpeedRef.current;
      b.x += b.vx;
      b.y += b.vy;

      // Apply magnet effect to power-ups
      if (b.magnetRadius > 0) {
        powerUpsRef.current.forEach(p => {
          const dx = p.x - b.x;
          const dy = p.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < b.magnetRadius) {
            p.x += (b.x - p.x) * 0.1;
            p.y += (b.y - p.y) * 0.1;
          }
        });
      }

      // Squash & Stretch Recovery
      b.scaleX += (1 - b.scaleX) * 0.2;
      b.scaleY += (1 - b.scaleY) * 0.2;

      // Screen Wrap with bounce
      if (b.x < -BALL_RADIUS) b.x = CANVAS_WIDTH + BALL_RADIUS;
      if (b.x > CANVAS_WIDTH + BALL_RADIUS) b.x = -BALL_RADIUS;

      // 2. Update moving platforms
      platformsRef.current.forEach(p => {
        if (p.type === 'moving' && p.vx && p.movingRange) {
          p.x += p.vx * gameSpeedRef.current;
          if (p.x < 0 || p.x > CANVAS_WIDTH - PLATFORM_WIDTH) {
            p.vx *= -1;
          }
        }
      });

      // 3. Collision Detection
      let jumped = false;
      platformsRef.current.forEach(p => {
        if (b.vy > 0 && 
            b.y + BALL_RADIUS > p.y && 
            b.y + BALL_RADIUS < p.y + PLATFORM_HEIGHT + 12 &&
            b.x > p.x - 10 && b.x < p.x + PLATFORM_WIDTH + 10) {
          
          if (p.type === 'breakable') {
            if (!p.isBroken) {
              b.vy = JUMP_FORCE * gameSpeedRef.current;
              p.isBroken = true;
              applySquash();
              createParticles(p.x + PLATFORM_WIDTH/2, p.y, '#EF4444', 10);
              playSound('break');
              applyShake(5);
            }
          } else if (p.type === 'spring') {
            b.vy = JUMP_FORCE * 1.8 * gameSpeedRef.current;
            applySquash(0.6, 1.4);
            createParticles(p.x + PLATFORM_WIDTH/2, p.y, '#FBBF24', 8);
            playSound('spring');
            comboRef.current++;
            setCombo(comboRef.current);
          } else {
            b.vy = JUMP_FORCE * gameSpeedRef.current;
            applySquash();
            playSound('jump');
            comboRef.current++;
            setCombo(comboRef.current);
          }
          jumped = true;
          lastJumpTimeRef.current = Date.now();
        }
      });

      function applySquash(sx = 1.3, sy = 0.7) {
        b.scaleX = sx;
        b.scaleY = sy;
      }

      // 4. Power-up collisions
      powerUpsRef.current.forEach(powerUp => {
        const dx = powerUp.x - b.x;
        const dy = powerUp.y - b.y;
        if (dx * dx + dy * dy < (BALL_RADIUS + 10) ** 2) {
          collectPowerUp(powerUp);
        }
      });

      // 5. Camera Scrolling & Parallax
      if (b.y < 250) {
        const offset = 250 - b.y;
        b.y = 250;
        
        // Move platforms down
        platformsRef.current.forEach(p => p.y += offset);
        
        // Move power-ups down
        powerUpsRef.current.forEach(p => p.y += offset);
        
        // Move stars down (Parallax)
        starsRef.current.forEach(s => {
          s.y += offset * s.speed * gameSpeedRef.current;
          if (s.y > CANVAS_HEIGHT) s.y = 0;
        });

        scoreRef.current += Math.floor(offset / 10);
        setScore(scoreRef.current);
      }

      // 6. Cleanup & Procedural Generation
      platformsRef.current = platformsRef.current.filter(p => p.y < CANVAS_HEIGHT);
      while (platformsRef.current.length < 8) {
        const topP = platformsRef.current[0];
        const rand = Math.random();
        const difficulty = getCurrentDifficulty();
        
        let type: Platform['type'] = 'normal';
        if (rand > 0.95) type = 'spring';
        else if (rand > 0.85) type = 'breakable';
        else if (rand > 0.7) type = 'moving';

        const platform = {
          x: Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
          y: (topP?.y || 0) - (difficulty.platformGap + Math.random() * 20),
          id: Math.random(),
          type
        };

        if (type === 'moving') {
          platform.vx = Math.random() > 0.5 ? 2 : -2;
          platform.movingRange = 100;
        }

        platformsRef.current.unshift(platform);

        // Chance to spawn power-up
        if (Math.random() < 0.1) {
          const powerUpTypes: PowerUp['type'][] = ['shield', 'magnet', 'slowmo'];
          powerUpsRef.current.push({
            x: platform.x + PLATFORM_WIDTH / 2,
            y: platform.y - 30,
            type: powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)],
            id: Math.random()
          });
        }
      }

      // 7. Update particles
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= 0.02;
      });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      // 8. Update power-up timers
      if (Date.now() > powerUpEndTimeRef.current) {
        ballRef.current.hasShield = false;
        ballRef.current.magnetRadius = 0;
        gameSpeedRef.current = difficulty.speed;
        setActivePowerUp(null);
      }

      // 9. Combo system
      if (Date.now() - lastJumpTimeRef.current > 1000) {
        if (comboRef.current > 1) {
          createParticles(b.x, b.y, '#8B5CF6', comboRef.current * 2);
        }
        comboRef.current = 0;
        setCombo(0);
      }

      // 10. Life Lost or Game Over
      if (b.y > CANVAS_HEIGHT + 100) {
        if (ballRef.current.hasShield) {
          ballRef.current.hasShield = false;
          ballRef.current.y = CANVAS_HEIGHT - 100;
          ballRef.current.vy = JUMP_FORCE;
          createParticles(b.x, b.y, '#22D3EE', 20);
        } else {
          livesRef.current -= 1;
          setDisplayLives(livesRef.current);
          applyShake(20);
          playSound('death');

          if (livesRef.current <= 0) {
            if (scoreRef.current > highScore) {
              setHighScore(scoreRef.current);
              localStorage.setItem('gravityBallHighScore', scoreRef.current.toString());
            }
            setGameState('gameOver');
          } else {
            resetBall();
          }
        }
      }

      // 11. Draw Everything
      if (ctx) {
        // Apply screen shake
        const shakeX = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
        const shakeY = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
        shakeRef.current *= 0.9;
        
        ctx.save();
        ctx.translate(shakeX, shakeY);

        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, '#0f172a');
        gradient.addColorStop(1, '#1e293b');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw Stars
        starsRef.current.forEach(s => {
          ctx.globalAlpha = s.opacity;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Draw Ball trail
        b.trail.forEach((pos, i) => {
          ctx.globalAlpha = pos.life * 0.3;
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, BALL_RADIUS * pos.life, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Draw Platforms
        platformsRef.current.forEach(p => {
          if (p.isBroken) return;
          ctx.shadowBlur = 10;
          if (p.type === 'spring') {
            ctx.fillStyle = '#fbbf24';
            ctx.shadowColor = '#fbbf24';
          } else if (p.type === 'breakable') {
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#ef4444';
          } else if (p.type === 'moving') {
            ctx.fillStyle = '#8b5cf6';
            ctx.shadowColor = '#8b5cf6';
          } else {
            ctx.fillStyle = '#10b981';
            ctx.shadowColor = '#10b981';
          }
          ctx.beginPath();
          ctx.roundRect(p.x, p.y, PLATFORM_WIDTH, PLATFORM_HEIGHT, 5);
          ctx.fill();
        });

        // Draw Power-ups
        powerUpsRef.current.forEach(p => {
          ctx.globalAlpha = 0.8;
          ctx.shadowBlur = 15;
          if (p.type === 'shield') {
            ctx.fillStyle = '#22d3ee';
            ctx.shadowColor = '#22d3ee';
          } else if (p.type === 'magnet') {
            ctx.fillStyle = '#f87171';
            ctx.shadowColor = '#f87171';
          } else {
            ctx.fillStyle = '#a78bfa';
            ctx.shadowColor = '#a78bfa';
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        });

        // Draw Particles
        particlesRef.current.forEach(p => {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Draw Ball with Squash & Stretch
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.scale(b.scaleX, b.scaleY);
        
        // Draw shield if active
        if (ballRef.current.hasShield) {
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, BALL_RADIUS + 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        
        ctx.fillStyle = '#22d3ee';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#22d3ee';
        ctx.beginPath();
        ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        ctx.restore(); // Restore from shake transform
      }

      frameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(frameId);
  }, [gameState, playSound, highScore]);

  const handlePause = () => {
    setGameState(gameState === 'playing' ? 'paused' : 'playing');
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950 items-center justify-center select-none overflow-hidden touch-none font-sans">
      <div className="absolute top-4 flex flex-col items-center z-10 gap-1">
        <div className="flex items-center gap-4">
          <span className="text-cyan-400 font-mono text-xl font-bold tracking-widest">
            ALT: {score}m
          </span>
          <span className="text-purple-400 font-mono text-lg">
            HI: {highScore}m
          </span>
          {combo > 1 && (
            <span className="text-yellow-400 font-bold animate-pulse">
              COMBO x{combo}!
            </span>
          )}
        </div>
        <div className="flex gap-1 mt-1">
          {Array.from({length: 3}).map((_, i) => (
            <span key={i} className={`transition-all duration-300 ${i < displayLives ? "grayscale-0 scale-110" : "grayscale opacity-20"}`}>
              ❤️
            </span>
          ))}
        </div>
        {activePowerUp && (
          <div className="mt-2 px-3 py-1 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full animate-pulse">
            <span className="text-white text-xs font-bold">{activePowerUp}</span>
          </div>
        )}
      </div>

      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} height={CANVAS_HEIGHT} 
        className="max-h-[75vh] w-auto border border-slate-700 rounded-xl shadow-2xl"
      />

      {/* Pause Button */}
      {gameState === 'playing' && (
        <button
          onClick={handlePause}
          className="absolute top-4 right-4 bg-slate-800/50 text-white p-2 rounded-full backdrop-blur-sm"
        >
          ⏸
        </button>
      )}

      {gameState === 'idle' && (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/95 to-slate-900/95 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
          <h1 className="text-6xl font-black text-white mb-2 italic tracking-tighter drop-shadow-lg">GRAVITY</h1>
          <h1 className="text-6xl font-black bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent mb-2 italic tracking-tighter drop-shadow-lg">BOUNCE</h1>
          <p className="text-slate-300 max-w-sm mb-8 leading-relaxed text-lg">
            <span className="text-yellow-400 font-bold">Tilt</span> to steer • 
            <span className="text-green-400 font-bold"> Bounce</span> on platforms • 
            <span className="text-purple-400 font-bold"> Collect</span> power-ups!
          </p>
          
          <div className="mb-10 text-left text-slate-400">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-4 h-4 bg-yellow-500 rounded"></span>
              <span>Spring: Mega bounce!</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-4 h-4 bg-purple-500 rounded"></span>
              <span>Moving: Watch out!</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-cyan-500 rounded-full"></span>
              <span>Power-ups: Special abilities</span>
            </div>
          </div>
          
          <button 
            onClick={startSensor}
            className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-black py-5 px-14 rounded-full text-xl transition-all active:scale-95 shadow-[0_0_40px_rgba(34,211,238,0.5)] animate-pulse"
          >
            🚀 LAUNCH GAME
          </button>
          
          <div className="mt-8 text-slate-500 text-sm">
            High Score: {highScore}m
          </div>
        </div>
      )}

      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
          <h2 className="text-4xl font-black text-white mb-2">PAUSED</h2>
          <p className="text-slate-400 mb-8">Altitude: {score}m</p>
          <div className="flex gap-4">
            <button 
              onClick={handlePause}
              className="bg-green-500 hover:bg-green-400 text-white font-bold py-3 px-8 rounded-full text-lg transition-all"
            >
              RESUME
            </button>
            <button 
              onClick={initGame}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-8 rounded-full text-lg transition-all"
            >
              RESTART
            </button>
          </div>
        </div>
      )}

      {gameState === 'gameOver' && (
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/95 to-slate-900/95 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
          <span className="text-8xl mb-2 animate-bounce">☄️</span>
          <h2 className="text-5xl font-black text-white mb-2">CRASH LANDING!</h2>
          <p className="text-3xl text-red-200 font-mono mb-2">Altitude: {score}m</p>
          {score > highScore && (
            <p className="text-yellow-400 font-bold text-xl mb-4 animate-pulse">
              🏆 NEW HIGH SCORE! 🏆
            </p>
          )}
          <p className="text-slate-300 mb-8">High Score: {Math.max(score, highScore)}m</p>
          
          <div className="flex gap-4">
            <button 
              onClick={initGame}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-black py-4 px-10 rounded-full text-xl shadow-xl active:scale-95 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all"
            >
              PLAY AGAIN
            </button>
          </div>
          
          <div className="mt-8 text-slate-500">
            Combo Bonus: +{combo * 10} points
          </div>
        </div>
      )}
    </div>
  );
});

export default GravityBall;