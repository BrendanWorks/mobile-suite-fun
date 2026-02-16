import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const BALL_RADIUS = 12;
const GRAVITY = 0.4;
const JUMP_FORCE = -11;
const SPRING_JUMP_FORCE = -22;
const PLATFORM_WIDTH = 75;
const PLATFORM_HEIGHT = 12;
const STAR_COUNT = 80;
const SAFE_START_Y = 500;

const DIFFICULTY_THRESHOLDS = [
  { score: 0, platformGap: 90, speed: 1.0, specialChance: 0.15, powerUpChance: 0.08 },
  { score: 500, platformGap: 85, speed: 1.15, specialChance: 0.25, powerUpChance: 0.12 },
  { score: 1000, platformGap: 80, speed: 1.3, specialChance: 0.35, powerUpChance: 0.15 },
  { score: 1500, platformGap: 75, speed: 1.5, specialChance: 0.45, powerUpChance: 0.18 },
  { score: 2500, platformGap: 70, speed: 1.8, specialChance: 0.55, powerUpChance: 0.2 },
];

interface Platform {
  x: number;
  y: number;
  id: number;
  type: 'normal' | 'spring' | 'breakable' | 'moving';
  isBroken?: boolean;
  vx?: number;
}

interface PowerUp {
  x: number;
  y: number;
  id: number;
  type: 'shield' | 'magnet' | 'slowmo';
  collected?: boolean;
}

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  brightness: number;
}

interface GravityBallProps {
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
  duration?: number;
}

const GravityBall = forwardRef<any, GravityBallProps>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'countdown' | 'playing' | 'paused' | 'gameOver'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const [combo, setCombo] = useState(0);

  const ballRef = useRef({ x: 200, y: 0, vx: 0, vy: 0, trail: [] as any[] });
  const platformsRef = useRef<Platform[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const starsRef = useRef<Star[]>([]);
  const tiltRef = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const comboRef = useRef(0);
  const comboTimerRef = useRef(0);

  const shieldActiveRef = useRef(false);
  const magnetActiveRef = useRef(false);
  const slowmoActiveRef = useRef(false);
  const shieldTimerRef = useRef(0);
  const magnetTimerRef = useRef(0);
  const slowmoTimerRef = useRef(0);

  const gameSpeedRef = useRef(1.0);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score: scoreRef.current, level: 1 }),
    onGameEnd: () => {
      setGameState('gameOver');
      if (props.onComplete) {
        props.onComplete(scoreRef.current, 3000, props.timeRemaining);
      }
    },
  }));

  const initStarfield = () => {
    const stars: Star[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.2,
        brightness: Math.random() * 0.5 + 0.5,
      });
    }
    starsRef.current = stars;
  };

  const getCurrentDifficulty = () => {
    const current = scoreRef.current;
    for (let i = DIFFICULTY_THRESHOLDS.length - 1; i >= 0; i--) {
      if (current >= DIFFICULTY_THRESHOLDS[i].score) {
        return DIFFICULTY_THRESHOLDS[i];
      }
    }
    return DIFFICULTY_THRESHOLDS[0];
  };

  const generatePlatform = (y: number): Platform => {
    const diff = getCurrentDifficulty();
    const rand = Math.random();

    let type: Platform['type'] = 'normal';
    if (rand < diff.specialChance) {
      const typeRoll = Math.random();
      if (typeRoll < 0.4) type = 'spring';
      else if (typeRoll < 0.7) type = 'breakable';
      else type = 'moving';
    }

    const platform: Platform = {
      x: Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
      y,
      id: Math.random(),
      type,
    };

    if (type === 'moving') {
      platform.vx = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 1.5);
    }

    return platform;
  };

  const generatePowerUp = (y: number): PowerUp | null => {
    const diff = getCurrentDifficulty();
    if (Math.random() > diff.powerUpChance) return null;

    const typeRoll = Math.random();
    let type: PowerUp['type'] = 'shield';
    if (typeRoll < 0.33) type = 'shield';
    else if (typeRoll < 0.66) type = 'magnet';
    else type = 'slowmo';

    return {
      x: Math.random() * (CANVAS_WIDTH - 30) + 15,
      y: y - 50,
      id: Math.random(),
      type,
    };
  };

  const resetBall = (isNewGame = false) => {
    const startX = CANVAS_WIDTH / 2;
    const startY = SAFE_START_Y - 40;

    ballRef.current = {
      x: startX,
      y: startY,
      vx: 0,
      vy: JUMP_FORCE * 0.7,
      trail: [],
    };

    if (isNewGame) {
      scoreRef.current = 0;
      setScore(0);
      livesRef.current = 3;
      setDisplayLives(3);
      comboRef.current = 0;
      setCombo(0);
      shieldActiveRef.current = false;
      magnetActiveRef.current = false;
      slowmoActiveRef.current = false;
      gameSpeedRef.current = 1.0;
      initStarfield();
    }

    const startPlatforms: Platform[] = [];
    startPlatforms.push({
      x: startX - PLATFORM_WIDTH / 2,
      y: SAFE_START_Y,
      id: Math.random(),
      type: 'normal',
    });

    for (let i = 1; i < 10; i++) {
      startPlatforms.push(generatePlatform(SAFE_START_Y - i * 90));
    }
    platformsRef.current = startPlatforms;
    powerUpsRef.current = [];
  };

  const startSequence = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission !== 'granted') {
          alert('Gyroscope permission is required to play this game');
          return;
        }
      } catch (error) {
        console.error('Error requesting device orientation permission:', error);
      }
    }

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

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) {
        tiltRef.current = Math.max(-1, Math.min(1, e.gamma / 30));
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const ctx = canvasRef.current?.getContext('2d')!;
    let frameId: number;

    const loop = () => {
      const b = ballRef.current;
      const currentSpeed = slowmoActiveRef.current ? 0.5 : gameSpeedRef.current;

      b.trail.unshift({ x: b.x, y: b.y });
      if (b.trail.length > 10) b.trail.pop();

      const effectiveGravity = GRAVITY * currentSpeed;
      b.vx = tiltRef.current * 7 * (slowmoActiveRef.current ? 1.2 : 1);
      b.vy += effectiveGravity;
      b.x += b.vx * currentSpeed;
      b.y += b.vy * currentSpeed;

      if (b.x < 0) b.x = CANVAS_WIDTH;
      if (b.x > CANVAS_WIDTH) b.x = 0;

      let bounced = false;
      platformsRef.current.forEach(p => {
        if (p.type === 'breakable' && p.isBroken) return;

        if (b.vy > 0 && b.y + BALL_RADIUS > p.y && b.y + BALL_RADIUS < p.y + PLATFORM_HEIGHT + 10 &&
            b.x > p.x - 10 && b.x < p.x + PLATFORM_WIDTH + 10) {

          if (p.type === 'spring') {
            b.vy = SPRING_JUMP_FORCE;
          } else {
            b.vy = JUMP_FORCE;
          }

          if (p.type === 'breakable') {
            p.isBroken = true;
          }

          bounced = true;
          comboRef.current += 1;
          comboTimerRef.current = 120;
          setCombo(comboRef.current);
        }

        if (p.type === 'moving' && p.vx) {
          p.x += p.vx * currentSpeed;
          if (p.x < 0 || p.x > CANVAS_WIDTH - PLATFORM_WIDTH) {
            p.vx = -p.vx;
          }
        }
      });

      if (comboTimerRef.current > 0) {
        comboTimerRef.current -= 1;
        if (comboTimerRef.current === 0) {
          comboRef.current = 0;
          setCombo(0);
        }
      }

      if (magnetActiveRef.current) {
        powerUpsRef.current.forEach(pu => {
          if (!pu.collected) {
            const dx = b.x - pu.x;
            const dy = b.y - pu.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
              pu.x += dx * 0.05;
              pu.y += dy * 0.05;
            }
          }
        });
      }

      powerUpsRef.current.forEach(pu => {
        if (!pu.collected) {
          const dx = b.x - pu.x;
          const dy = b.y - pu.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 20) {
            pu.collected = true;

            if (pu.type === 'shield') {
              shieldActiveRef.current = true;
              shieldTimerRef.current = 600;
            } else if (pu.type === 'magnet') {
              magnetActiveRef.current = true;
              magnetTimerRef.current = 450;
            } else if (pu.type === 'slowmo') {
              slowmoActiveRef.current = true;
              slowmoTimerRef.current = 300;
            }
          }
        }
      });

      if (shieldTimerRef.current > 0) {
        shieldTimerRef.current -= 1;
        if (shieldTimerRef.current === 0) shieldActiveRef.current = false;
      }
      if (magnetTimerRef.current > 0) {
        magnetTimerRef.current -= 1;
        if (magnetTimerRef.current === 0) magnetActiveRef.current = false;
      }
      if (slowmoTimerRef.current > 0) {
        slowmoTimerRef.current -= 1;
        if (slowmoTimerRef.current === 0) slowmoActiveRef.current = false;
      }

      if (b.y < 250) {
        const offset = 250 - b.y;
        b.y = 250;
        platformsRef.current.forEach(p => p.y += offset);
        powerUpsRef.current.forEach(p => p.y += offset);
        starsRef.current.forEach(s => {
          s.y += offset * 0.3;
          if (s.y > CANVAS_HEIGHT) s.y -= CANVAS_HEIGHT;
        });

        const comboMultiplier = 1 + (comboRef.current * 0.1);
        scoreRef.current += Math.floor((offset / 10) * comboMultiplier);
        setScore(scoreRef.current);
      }

      platformsRef.current = platformsRef.current.filter(p => p.y < CANVAS_HEIGHT + 50);
      powerUpsRef.current = powerUpsRef.current.filter(p => p.y < CANVAS_HEIGHT + 50 && !p.collected);

      const diff = getCurrentDifficulty();
      gameSpeedRef.current = diff.speed;

      while (platformsRef.current.length < 10) {
        const topY = platformsRef.current[0]?.y || 0;
        const newPlatform = generatePlatform(topY - diff.platformGap);
        platformsRef.current.unshift(newPlatform);

        const newPowerUp = generatePowerUp(topY - diff.platformGap);
        if (newPowerUp) {
          powerUpsRef.current.unshift(newPowerUp);
        }
      }

      if (b.y > CANVAS_HEIGHT + 50) {
        if (shieldActiveRef.current) {
          shieldActiveRef.current = false;
          b.vy = SPRING_JUMP_FORCE * 1.5;
          b.y = CANVAS_HEIGHT - 100;
        } else {
          livesRef.current -= 1;
          setDisplayLives(livesRef.current);
          comboRef.current = 0;
          setCombo(0);
          if (livesRef.current <= 0) {
            setGameState('gameOver');
            if (props.onComplete) {
              setTimeout(() => {
                props.onComplete?.(scoreRef.current, 3000, props.timeRemaining);
              }, 2000);
            }
          } else {
            resetBall();
          }
        }
      }

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      starsRef.current.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      });

      platformsRef.current.forEach(p => {
        if (p.type === 'breakable' && p.isBroken) return;

        ctx.shadowBlur = 10;
        if (p.type === 'spring') {
          ctx.fillStyle = '#FFD700';
          ctx.shadowColor = '#FFD700';
        } else if (p.type === 'breakable') {
          ctx.fillStyle = '#FF4444';
          ctx.shadowColor = '#FF4444';
        } else if (p.type === 'moving') {
          ctx.fillStyle = '#FF69B4';
          ctx.shadowColor = '#FF69B4';
        } else {
          ctx.fillStyle = '#0ff';
          ctx.shadowColor = '#0ff';
        }
        ctx.fillRect(p.x, p.y, PLATFORM_WIDTH, PLATFORM_HEIGHT);
      });

      ctx.shadowBlur = 0;

      powerUpsRef.current.forEach(pu => {
        if (pu.collected) return;

        ctx.shadowBlur = 15;
        if (pu.type === 'shield') {
          ctx.fillStyle = '#00FFFF';
          ctx.shadowColor = '#00FFFF';
          ctx.font = '24px monospace';
          ctx.fillText('💠', pu.x - 12, pu.y + 8);
        } else if (pu.type === 'magnet') {
          ctx.fillStyle = '#FF00FF';
          ctx.shadowColor = '#FF00FF';
          ctx.font = '24px monospace';
          ctx.fillText('🧲', pu.x - 12, pu.y + 8);
        } else if (pu.type === 'slowmo') {
          ctx.fillStyle = '#FFFF00';
          ctx.shadowColor = '#FFFF00';
          ctx.font = '24px monospace';
          ctx.fillText('⏳', pu.x - 12, pu.y + 8);
        }
      });

      ctx.shadowBlur = 0;

      b.trail.forEach((pos, i) => {
        const alpha = (1 - i / b.trail.length) * 0.5;
        ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, BALL_RADIUS * (1 - i / b.trail.length), 0, Math.PI * 2);
        ctx.fill();
      });

      if (shieldActiveRef.current) {
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00FFFF';
        ctx.beginPath();
        ctx.arc(b.x, b.y, BALL_RADIUS + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = '#0ff';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#0ff';
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
        {combo > 1 && (
          <span className="font-bold text-yellow-400 animate-pulse">COMBO x{combo}</span>
        )}
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
