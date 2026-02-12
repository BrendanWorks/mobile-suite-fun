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

const DIFFICULTY_THRESHOLDS = [
  { score: 0, platformGap: 90, speed: 1.0, specialChance: 0.1 },
  { score: 200, platformGap: 85, speed: 1.1, specialChance: 0.15 },
  { score: 500, platformGap: 80, speed: 1.2, specialChance: 0.2 },
  { score: 800, platformGap: 75, speed: 1.3, specialChance: 0.25 },
];

// --- Types ---
interface Platform {
  x: number;
  y: number;
  id: number;
  type: 'normal' | 'spring' | 'breakable' | 'moving';
  isBroken?: boolean;
  vx?: number;
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

// --- Shared neon style helpers ---
const neonText = (color: string) => ({ textShadow: `0 0 10px ${color}` });
const neonBox = (color: string, opacity = 0.3) => ({
  boxShadow: `0 0 15px rgba(${hexToRgb(color)}, ${opacity})`,
});
const neonBoxInner = (color: string) => ({
  boxShadow: `0 0 15px rgba(${hexToRgb(color)}, 0.3), inset 0 0 20px rgba(${hexToRgb(color)}, 0.1)`,
});

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// --- Neon Button Components ---
function NeonButton({
  children,
  onClick,
  color = 'cyan',
  size = 'md',
  pulse = false,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  color?: 'cyan' | 'pink' | 'red' | 'yellow';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}) {
  const colorMap = {
    cyan: { border: 'border-cyan-400', text: 'text-cyan-400', hover: 'hover:bg-cyan-400', hex: '#00ffff' },
    pink: { border: 'border-pink-500', text: 'text-pink-400', hover: 'hover:bg-pink-500', hex: '#ec4899' },
    red: { border: 'border-red-500', text: 'text-red-400', hover: 'hover:bg-red-500', hex: '#ef4444' },
    yellow: { border: 'border-yellow-400', text: 'text-yellow-400', hover: 'hover:bg-yellow-400', hex: '#fbbf24' },
  };
  const sizeMap = {
    sm: 'px-3 py-1.5 text-xs sm:text-sm',
    md: 'px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base',
    lg: 'px-8 sm:px-10 py-3.5 sm:py-4 text-base sm:text-lg',
  };
  const c = colorMap[color];

  return (
    <button
      onClick={onClick}
      className={`bg-transparent border-2 ${c.border} ${c.text} font-bold rounded-lg
        transition-all ${c.hover} hover:text-black active:scale-95 touch-manipulation
        ${sizeMap[size]} ${pulse ? 'animate-pulse' : ''} ${className}`}
      style={{
        ...neonText(c.hex),
        ...neonBox(c.hex),
      }}
    >
      {children}
    </button>
  );
}

// --- Main Component ---
const GravityBall = forwardRef((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'gameOver'>('idle');
  const [score, setScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [activePowerUp, setActivePowerUp] = useState<string | null>(null);
  const [powerUpTimer, setPowerUpTimer] = useState(0);

  // --- Refs for game logic (unchanged) ---
  const ballRef = useRef({
    x: 200, y: 300, vx: 0, vy: 0,
    scaleX: 1, scaleY: 1,
    trail: [] as Array<{ x: number; y: number; life: number }>,
    hasShield: false,
    magnetRadius: 0,
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
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('gravityBallHighScore');
    if (saved) setHighScore(parseInt(saved));
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return () => {
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score: scoreRef.current, maxScore: 1000 }),
    onGameEnd: () => setGameState('gameOver'),
  }));

  // --- Audio (unchanged) ---
  const playSound = useCallback((type: 'jump' | 'spring' | 'break' | 'powerup' | 'death') => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      const sounds: Record<string, { freq: number; dur: number }> = {
        jump: { freq: 523.25, dur: 0.1 },
        spring: { freq: 659.25, dur: 0.2 },
        break: { freq: 220, dur: 0.1 },
        powerup: { freq: 880, dur: 0.3 },
        death: { freq: 110, dur: 0.5 },
      };
      const s = sounds[type];
      oscillator.frequency.setValueAtTime(s.freq, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + s.dur);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + s.dur);
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  }, []);

  // --- Sensor & Init (unchanged logic) ---
  const startSensor = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
          initGame();
        }
      } catch {
        alert('Motion sensors required for iPhone play.');
      }
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
      initGame();
    }
  };

  const handleOrientation = (e: DeviceOrientationEvent) => {
    const tilt = e.gamma || 0;
    tiltRef.current += (tilt / 25 - tiltRef.current) * 0.3;
  };

  const createParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2,
        life: 1,
        color,
        size: Math.random() * 4 + 2,
      });
    }
  };

  const applyShake = (intensity: number) => {
    shakeRef.current = Math.max(shakeRef.current, intensity);
  };

  const getCurrentDifficulty = () => {
    const s = scoreRef.current;
    for (let i = DIFFICULTY_THRESHOLDS.length - 1; i >= 0; i--) {
      if (s >= DIFFICULTY_THRESHOLDS[i].score) return DIFFICULTY_THRESHOLDS[i];
    }
    return DIFFICULTY_THRESHOLDS[0];
  };

  const resetBall = () => {
    ballRef.current = {
      x: 200, y: 300, vx: 0, vy: 0,
      scaleX: 1, scaleY: 1,
      trail: Array(10).fill(null).map(() => ({ x: 200, y: 300, life: 1 })),
      hasShield: false,
      magnetRadius: 0,
    };
    const difficulty = getCurrentDifficulty();
    const startPlatforms: Platform[] = [];
    for (let i = 0; i < 7; i++) {
      startPlatforms.push({
        x: i === 0 ? 160 : Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
        y: i * difficulty.platformGap + 100,
        id: Math.random(),
        type: 'normal',
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
      trail: Array(10).fill(null).map(() => ({ x: 200, y: 300, life: 1 })),
      hasShield: false,
      magnetRadius: 0,
    };
    starsRef.current = Array.from({ length: STAR_COUNT }).map(() => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: Math.random() * 3,
      speed: Math.random() * 0.5 + 0.2,
      opacity: Math.random() * 0.5 + 0.5,
    }));
    const difficulty = getCurrentDifficulty();
    const startPlatforms: Platform[] = [];
    for (let i = 0; i < 7; i++) {
      startPlatforms.push({
        x: i === 0 ? 160 : Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
        y: i * difficulty.platformGap + 100,
        id: Math.random(),
        type: 'normal',
      });
    }
    platformsRef.current = startPlatforms;
    setGameState('playing');
  };

  const collectPowerUp = (powerUp: PowerUp) => {
    playSound('powerup');
    powerUpsRef.current = powerUpsRef.current.filter((p) => p.id !== powerUp.id);
    powerUpEndTimeRef.current = Date.now() + 10000;
    switch (powerUp.type) {
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

  // --- Game Loop (canvas drawing unchanged) ---
  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    let frameId: number;

    const loop = () => {
      const b = ballRef.current;
      const difficulty = getCurrentDifficulty();
      gameSpeedRef.current = difficulty.speed;

      b.trail.unshift({ x: b.x, y: b.y, life: 1 });
      if (b.trail.length > 10) b.trail.pop();
      b.trail.forEach((p, i) => (p.life = i / b.trail.length));

      b.vx = tiltRef.current * 6 * gameSpeedRef.current;
      b.vy += GRAVITY * gameSpeedRef.current;
      b.x += b.vx;
      b.y += b.vy;

      if (b.magnetRadius > 0) {
        powerUpsRef.current.forEach((p) => {
          const dx = p.x - b.x;
          const dy = p.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < b.magnetRadius) {
            p.x += (b.x - p.x) * 0.1;
            p.y += (b.y - p.y) * 0.1;
          }
        });
      }

      b.scaleX += (1 - b.scaleX) * 0.2;
      b.scaleY += (1 - b.scaleY) * 0.2;

      if (b.x < -BALL_RADIUS) b.x = CANVAS_WIDTH + BALL_RADIUS;
      if (b.x > CANVAS_WIDTH + BALL_RADIUS) b.x = -BALL_RADIUS;

      platformsRef.current.forEach((p) => {
        if (p.type === 'moving' && p.vx && p.movingRange) {
          p.x += p.vx * gameSpeedRef.current;
          if (p.x < 0 || p.x > CANVAS_WIDTH - PLATFORM_WIDTH) p.vx *= -1;
        }
      });

      platformsRef.current.forEach((p) => {
        if (
          b.vy > 0 &&
          b.y + BALL_RADIUS > p.y &&
          b.y + BALL_RADIUS < p.y + PLATFORM_HEIGHT + 12 &&
          b.x > p.x - 10 &&
          b.x < p.x + PLATFORM_WIDTH + 10
        ) {
          if (p.type === 'breakable') {
            if (!p.isBroken) {
              b.vy = JUMP_FORCE * gameSpeedRef.current;
              p.isBroken = true;
              b.scaleX = 1.3;
              b.scaleY = 0.7;
              createParticles(p.x + PLATFORM_WIDTH / 2, p.y, '#EF4444', 10);
              playSound('break');
              applyShake(5);
            }
          } else if (p.type === 'spring') {
            b.vy = JUMP_FORCE * 1.8 * gameSpeedRef.current;
            b.scaleX = 0.6;
            b.scaleY = 1.4;
            createParticles(p.x + PLATFORM_WIDTH / 2, p.y, '#FBBF24', 8);
            playSound('spring');
            comboRef.current++;
            setCombo(comboRef.current);
          } else {
            b.vy = JUMP_FORCE * gameSpeedRef.current;
            b.scaleX = 1.3;
            b.scaleY = 0.7;
            playSound('jump');
            comboRef.current++;
            setCombo(comboRef.current);
          }
          lastJumpTimeRef.current = Date.now();
        }
      });

      powerUpsRef.current.forEach((powerUp) => {
        const dx = powerUp.x - b.x;
        const dy = powerUp.y - b.y;
        if (dx * dx + dy * dy < (BALL_RADIUS + 10) ** 2) collectPowerUp(powerUp);
      });

      if (b.y < 250) {
        const offset = 250 - b.y;
        b.y = 250;
        platformsRef.current.forEach((p) => (p.y += offset));
        powerUpsRef.current.forEach((p) => (p.y += offset));
        starsRef.current.forEach((s) => {
          s.y += offset * s.speed * gameSpeedRef.current;
          if (s.y > CANVAS_HEIGHT) s.y = 0;
        });
        scoreRef.current += Math.floor(offset / 10);
        setScore(scoreRef.current);
      }

      platformsRef.current = platformsRef.current.filter((p) => p.y < CANVAS_HEIGHT);
      while (platformsRef.current.length < 8) {
        const topP = platformsRef.current[0];
        const diff = getCurrentDifficulty();
        const rand = Math.random();
        let type: Platform['type'] = 'normal';
        if (rand > 0.95) type = 'spring';
        else if (rand > 0.85) type = 'breakable';
        else if (rand > 0.7) type = 'moving';

        const platform: any = {
          x: Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
          y: (topP?.y || 0) - (diff.platformGap + Math.random() * 20),
          id: Math.random(),
          type,
        };
        if (type === 'moving') {
          platform.vx = Math.random() > 0.5 ? 2 : -2;
          platform.movingRange = 100;
        }
        platformsRef.current.unshift(platform);

        if (Math.random() < 0.1) {
          const powerUpTypes: PowerUp['type'][] = ['shield', 'magnet', 'slowmo'];
          powerUpsRef.current.push({
            x: platform.x + PLATFORM_WIDTH / 2,
            y: platform.y - 30,
            type: powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)],
            id: Math.random(),
          });
        }
      }

      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= 0.02;
      });
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      if (Date.now() > powerUpEndTimeRef.current) {
        ballRef.current.hasShield = false;
        ballRef.current.magnetRadius = 0;
        gameSpeedRef.current = difficulty.speed;
        setActivePowerUp(null);
      }

      if (Date.now() - lastJumpTimeRef.current > 1000) {
        if (comboRef.current > 1) createParticles(b.x, b.y, '#8B5CF6', comboRef.current * 2);
        comboRef.current = 0;
        setCombo(0);
      }

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

      // --- DRAW ---
      if (ctx) {
        const shakeX = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
        const shakeY = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
        shakeRef.current *= 0.9;

        ctx.save();
        ctx.translate(shakeX, shakeY);

        // Black bg to match neon aesthetic
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        starsRef.current.forEach((s) => {
          ctx.globalAlpha = s.opacity;
          ctx.fillStyle = '#00ffff';
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        b.trail.forEach((pos) => {
          ctx.globalAlpha = pos.life * 0.3;
          ctx.fillStyle = '#00ffff';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, BALL_RADIUS * pos.life, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        platformsRef.current.forEach((p) => {
          if (p.isBroken) return;
          ctx.shadowBlur = 10;
          if (p.type === 'spring') {
            ctx.fillStyle = '#fbbf24';
            ctx.shadowColor = '#fbbf24';
          } else if (p.type === 'breakable') {
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#ef4444';
          } else if (p.type === 'moving') {
            ctx.fillStyle = '#ec4899';
            ctx.shadowColor = '#ec4899';
          } else {
            ctx.fillStyle = '#00ffff';
            ctx.shadowColor = '#00ffff';
          }
          ctx.beginPath();
          ctx.roundRect(p.x, p.y, PLATFORM_WIDTH, PLATFORM_HEIGHT, 3);
          ctx.fill();
          ctx.shadowBlur = 0;
        });

        powerUpsRef.current.forEach((p) => {
          ctx.globalAlpha = 0.8;
          ctx.shadowBlur = 15;
          if (p.type === 'shield') {
            ctx.fillStyle = '#00ffff';
            ctx.shadowColor = '#00ffff';
          } else if (p.type === 'magnet') {
            ctx.fillStyle = '#ec4899';
            ctx.shadowColor = '#ec4899';
          } else {
            ctx.fillStyle = '#fbbf24';
            ctx.shadowColor = '#fbbf24';
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        });

        particlesRef.current.forEach((p) => {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.scale(b.scaleX, b.scaleY);
        if (ballRef.current.hasShield) {
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, BALL_RADIUS + 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = '#00ffff';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        ctx.restore();
      }

      frameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(frameId);
  }, [gameState, playSound, highScore]);

  const handlePause = () => {
    setGameState(gameState === 'playing' ? 'paused' : 'playing');
  };

  // ==========================================================================
  // RENDER — Neon Arcade UI
  // ==========================================================================
  return (
    <div className="flex flex-col min-h-screen bg-black items-center justify-start select-none overflow-hidden touch-none p-2 pt-4">
      {/* --- HUD (visible during play) --- */}
      {gameState === 'playing' && (
        <div className="w-full max-w-2xl flex flex-col items-center gap-1 mb-2 z-10">
          <div className="w-full flex justify-between items-center px-1">
            <div className="flex items-center gap-3">
              <span
                className="text-cyan-400 font-bold text-sm sm:text-base tracking-wide"
                style={neonText('#00ffff')}
              >
                ALT: <strong className="text-yellow-400" style={neonText('#fbbf24')}>{score}m</strong>
              </span>
              {combo > 1 && (
                <span
                  className="text-yellow-400 font-bold text-xs sm:text-sm animate-pulse"
                  style={neonText('#fbbf24')}
                >
                  x{combo}
                </span>
              )}
            </div>

            <div className="flex gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <span
                  key={i}
                  className={`text-xs transition-all duration-300 ${
                    i < displayLives ? 'opacity-100' : 'opacity-20 grayscale'
                  }`}
                >
                  ❤️
                </span>
              ))}
            </div>

            <button
              onClick={handlePause}
              className="px-2 py-1 bg-transparent border-2 border-cyan-400/30 text-cyan-400
                         rounded text-xs font-bold transition-all hover:border-cyan-400 active:scale-95"
              style={neonText('#00ffff')}
            >
              ⏸
            </button>
          </div>

          {activePowerUp && (
            <div
              className="px-3 py-0.5 border border-cyan-400 rounded-full animate-pulse"
              style={neonBox('#00ffff', 0.4)}
            >
              <span className="text-cyan-400 text-[10px] sm:text-xs font-bold" style={neonText('#00ffff')}>
                {activePowerUp}
              </span>
            </div>
          )}
        </div>
      )}

      {/* --- Canvas --- */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="max-h-[75vh] w-auto border-2 border-cyan-400 rounded-lg"
        style={neonBoxInner('#00ffff')}
      />

      {/* ================================================================== */}
      {/* IDLE / LANDING SCREEN                                               */}
      {/* ================================================================== */}
      {gameState === 'idle' && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-4 text-center">
          {/* Title */}
          <h1
            className="text-2xl sm:text-3xl font-bold text-cyan-400 mb-0.5 tracking-wide"
            style={neonText('#00ffff')}
          >
            🚀 GRAVITY BOUNCE
          </h1>
          <div
            className="w-48 h-0.5 bg-cyan-400 mx-auto mb-4"
            style={{ boxShadow: '0 0 10px #00ffff' }}
          />

          {/* Instructions */}
          <p className="text-cyan-300 text-xs sm:text-sm mb-6 max-w-xs leading-relaxed">
            Tilt your device to steer. Bounce on platforms. Collect power-ups. Climb as high as you can.
          </p>

          {/* Platform legend */}
          <div className="mb-6 space-y-2 text-left">
            {[
              { color: 'bg-cyan-400', shadow: '#00ffff', label: 'Normal platform' },
              { color: 'bg-yellow-400', shadow: '#fbbf24', label: 'Spring — mega bounce' },
              { color: 'bg-pink-500', shadow: '#ec4899', label: 'Moving — stay sharp' },
              { color: 'bg-red-500', shadow: '#ef4444', label: 'Breakable — one use only' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className={`w-4 h-2 ${item.color} rounded-sm`}
                  style={{ boxShadow: `0 0 6px ${item.shadow}` }}
                />
                <span className="text-cyan-300/80 text-xs sm:text-sm">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Launch button */}
          <NeonButton onClick={startSensor} color="cyan" size="lg" pulse>
            LAUNCH GAME
          </NeonButton>

          {/* High score */}
          {highScore > 0 && (
            <p className="mt-4 text-cyan-400/50 text-xs">
              Best: <span className="text-yellow-400/70" style={neonText('#fbbf24')}>{highScore}m</span>
            </p>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* PAUSED SCREEN                                                       */}
      {/* ================================================================== */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-4 text-center">
          <h2
            className="text-xl sm:text-2xl font-bold text-cyan-400 mb-1"
            style={neonText('#00ffff')}
          >
            ⏸ PAUSED
          </h2>
          <p className="text-cyan-300/60 text-xs sm:text-sm mb-6">
            Altitude: <strong className="text-yellow-400" style={neonText('#fbbf24')}>{score}m</strong>
          </p>
          <div className="flex gap-3">
            <NeonButton onClick={handlePause} color="cyan" size="md">
              RESUME
            </NeonButton>
            <NeonButton onClick={initGame} color="red" size="md">
              RESTART
            </NeonButton>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* GAME OVER SCREEN                                                    */}
      {/* ================================================================== */}
      {gameState === 'gameOver' && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-4 text-center">
          <h2
            className="text-xl sm:text-2xl font-bold text-red-500 mb-1"
            style={neonText('#ef4444')}
          >
            ☄️ CRASH LANDING
          </h2>
          <div
            className="w-40 h-0.5 bg-red-500 mx-auto mb-4"
            style={{ boxShadow: '0 0 10px #ef4444' }}
          />

          <p className="text-cyan-300 text-sm sm:text-base mb-1">
            Altitude: <strong className="text-yellow-400" style={neonText('#fbbf24')}>{score}m</strong>
          </p>

          {score > highScore && (
            <p
              className="text-yellow-400 font-bold text-xs sm:text-sm mb-3 animate-pulse"
              style={neonText('#fbbf24')}
            >
              NEW HIGH SCORE
            </p>
          )}

          <p className="text-cyan-400/40 text-xs mb-6">
            Best: {Math.max(score, highScore)}m
          </p>

          <NeonButton onClick={initGame} color="cyan" size="lg">
            PLAY AGAIN
          </NeonButton>
        </div>
      )}
    </div>
  );
});

export default GravityBall;