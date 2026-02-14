import React, { useRef, useEffect, useState, useCallback } from 'react';

interface SlopeRiderProps {
  onComplete: (rawScore: number, maxScore: number, timeRemaining: number) => void;
  onScoreUpdate: (score: number, maxScore: number) => void;
  duration: number;
}

export default function SlopeRider({ onComplete, onScoreUpdate, duration }: SlopeRiderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [tiltValue, setTiltValue] = useState(0);
  const [motionGranted, setMotionGranted] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const tiltRef = useRef(0);
  const playerXRef = useRef(0);
  const playerHeightRef = useRef(0);
  const vyRef = useRef(0);
  const speedRef = useRef(2);
  const accelerationRef = useRef(0.002);
  const obstaclesRef = useRef<any[]>([]);
  const animationRef = useRef(0);
  const startTimeRef = useRef(0);
  const invincibleRef = useRef(false);
  const nitroRef = useRef(false);
  const fogRef = useRef(false);
  const invincibleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const nitroTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameOverRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFrameTimeRef = useRef(0);

  const requestMotionPermission = useCallback(async () => {
    try {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setMotionGranted(true);
          setPermissionStatus('granted');
          console.log('Motion permission granted');
        } else {
          setPermissionStatus('denied');
          console.log('Motion permission denied');
        }
      } else {
        setMotionGranted(true);
        setPermissionStatus('granted');
        console.log('Motion auto-granted (non-iOS)');
      }
    } catch (err) {
      console.error('Permission error:', err);
      setPermissionStatus('denied');
    }
  }, []);

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    console.log('Orientation event:', {
      gamma: e.gamma?.toFixed(1),
      beta: e.beta?.toFixed(1),
      alpha: e.alpha?.toFixed(1),
      time: new Date().toLocaleTimeString()
    });
    const gamma = e.gamma ?? 0;
    tiltRef.current = gamma;
    setTiltValue(Math.round(gamma));
  }, []);

  useEffect(() => {
    if (motionGranted && permissionStatus === 'granted') {
      console.log('Adding deviceorientation listener');
      window.addEventListener('deviceorientation', handleOrientation);
      return () => {
        console.log('Removing deviceorientation listener');
        window.removeEventListener('deviceorientation', handleOrientation);
      };
    }
  }, [motionGranted, permissionStatus, handleOrientation]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const touchX = touch.clientX - rect.left;
      const normalized = (touchX / rect.width - 0.5) * 180;
      tiltRef.current = normalized;
      setTiltValue(Math.round(normalized));
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || permissionStatus !== 'granted') return;

    const ctx = canvas.getContext('2d')!;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - 80;
      playerXRef.current = canvas.width / 2;
    };
    resize();
    window.addEventListener('resize', resize);

    startTimeRef.current = Date.now();
    lastFrameTimeRef.current = Date.now();
    obstaclesRef.current = [];
    gameOverRef.current = false;
    speedRef.current = 2;
    accelerationRef.current = 0.002;
    playerHeightRef.current = 0;
    vyRef.current = 0;
    invincibleRef.current = false;
    nitroRef.current = false;
    fogRef.current = false;

    const generateItem = () => {
      const rand = Math.random();
      const typeChance = rand;
      let type: string, radius = 20;
      if (typeChance < 0.20) type = 'tree';
      else if (typeChance < 0.40) type = 'boulder';
      else if (typeChance < 0.60) type = 'coin';
      else if (typeChance < 0.75) type = 'ramp';
      else if (typeChance < 0.87) type = 'nitro';
      else if (typeChance < 0.98) type = 'invinc';
      else type = 'chasm';

      const x = Math.random() * (canvas.width - 40) + 20;
      if (type === 'coin') radius = 12;
      if (type === 'chasm') {
        const gapWidth = 80 + Math.random() * 120;
        const gapX = Math.random() * (canvas.width - gapWidth - 40) + 20;
        return { type, y: -50, gapX, gapWidth, height: 12 };
      }
      return { type, x, y: -50, radius };
    };

    const gameOver = () => {
      gameOverRef.current = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (invincibleTimerRef.current) clearTimeout(invincibleTimerRef.current);
      if (nitroTimerRef.current) clearTimeout(nitroTimerRef.current);
      if (fogTimerRef.current) clearTimeout(fogTimerRef.current);
      const timeElapsed = (Date.now() - startTimeRef.current) / 1000;
      const timeRemaining = Math.max(0, duration - timeElapsed);
      onComplete(Math.floor(score), 0, timeRemaining);
    };

    const loop = () => {
      if (gameOverRef.current) return;

      const ctx = canvas.getContext('2d')!;
      const now = Date.now();
      const deltaTime = lastFrameTimeRef.current ? (now - lastFrameTimeRef.current) / 1000 : 1/60;
      lastFrameTimeRef.current = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const playerY = canvas.height - 60 - playerHeightRef.current;

      if (playerHeightRef.current > 0) {
        vyRef.current -= 0.6 * deltaTime * 60;
        playerHeightRef.current += vyRef.current * deltaTime * 60;
        if (playerHeightRef.current <= 0) {
          playerHeightRef.current = 0;
          vyRef.current = 0;
        }
      }

      speedRef.current = Math.min(8, speedRef.current + accelerationRef.current * deltaTime * 60);
      if (nitroRef.current) speedRef.current = Math.min(12, speedRef.current + 0.03 * deltaTime * 60);

      obstaclesRef.current.forEach(o => o.y += speedRef.current * deltaTime * 60);

      obstaclesRef.current = obstaclesRef.current.filter(o => o.y < canvas.height + 50);

      if (Math.random() < 0.06 * (speedRef.current / 3) * deltaTime * 60) {
        obstaclesRef.current.push(generateItem());
      }

      const playerRadius = 18;
      for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
        const o = obstaclesRef.current[i];
        if (o.type === 'chasm') {
          if (playerHeightRef.current < 5 && o.y <= playerY && playerY <= o.y + o.height &&
              playerXRef.current >= o.gapX && playerXRef.current <= o.gapX + o.gapWidth) {
            if (!invincibleRef.current) {
              gameOver();
              return;
            }
          }
        } else {
          const dx = o.x - playerXRef.current;
          const dy = o.y - playerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < playerRadius + o.radius) {
            if (o.type === 'tree' || o.type === 'boulder') {
              if (!invincibleRef.current) {
                gameOver();
                return;
              }
            } else if (o.type === 'coin') {
              setScore(s => {
                const newScore = s + 10;
                onScoreUpdate(newScore, 0);
                return newScore;
              });
              obstaclesRef.current.splice(i, 1);
            } else if (o.type === 'ramp') {
              vyRef.current = 8;
              playerHeightRef.current = 5;
              obstaclesRef.current.splice(i, 1);
            } else if (o.type === 'nitro') {
              nitroRef.current = true;
              if (nitroTimerRef.current) clearTimeout(nitroTimerRef.current);
              nitroTimerRef.current = setTimeout(() => { nitroRef.current = false; }, 3000);
              obstaclesRef.current.splice(i, 1);
            } else if (o.type === 'invinc') {
              invincibleRef.current = true;
              if (invincibleTimerRef.current) clearTimeout(invincibleTimerRef.current);
              invincibleTimerRef.current = setTimeout(() => { invincibleRef.current = false; }, 5000);
              obstaclesRef.current.splice(i, 1);
            }
          }
        }
      }

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#333';
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.fillRect(i, canvas.height - 50, 20, 2);
      }

      obstaclesRef.current.forEach(o => {
        if (o.type === 'tree') {
          ctx.fillStyle = '#2d5016';
          ctx.fillRect(o.x - 8, o.y - 20, 16, 40);
          ctx.fillStyle = '#4a7c2e';
          ctx.beginPath();
          ctx.arc(o.x, o.y - 25, 18, 0, Math.PI * 2);
          ctx.fill();
        } else if (o.type === 'boulder') {
          ctx.fillStyle = '#555';
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (o.type === 'coin') {
          ctx.fillStyle = '#ffd700';
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (o.type === 'ramp') {
          ctx.fillStyle = '#8b4513';
          ctx.beginPath();
          ctx.moveTo(o.x - 25, o.y + 10);
          ctx.lineTo(o.x + 25, o.y + 10);
          ctx.lineTo(o.x + 25, o.y - 10);
          ctx.closePath();
          ctx.fill();
        } else if (o.type === 'nitro') {
          ctx.fillStyle = '#ff6600';
          ctx.fillRect(o.x - 12, o.y - 12, 24, 24);
        } else if (o.type === 'invinc') {
          ctx.fillStyle = '#00ffff';
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (o.type === 'chasm') {
          ctx.fillStyle = '#000';
          ctx.fillRect(o.gapX, o.y, o.gapWidth, o.height);
        }
      });

      // PLAYER UPDATE - HIGH SENSITIVITY FOR TESTING
      const sensitivity = 15;
      const vx = (tiltRef.current / 90) * sensitivity * deltaTime * 60;
      playerXRef.current += vx;
      playerXRef.current = Math.max(30, Math.min(canvas.width - 30, playerXRef.current));

      // DRAW PLAYER WITH VISUAL TILT FEEDBACK
      ctx.save();
      ctx.translate(playerXRef.current, playerY);
      ctx.rotate(tiltRef.current * Math.PI / 180 * 0.6);

      if (invincibleRef.current) {
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 20;
      }

      ctx.fillStyle = nitroRef.current ? '#ff6600' : '#00ffff';
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(-15, 20);
      ctx.lineTo(15, 20);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      const timeRemaining = Math.max(0, duration - (now - startTimeRef.current) / 1000);
      ctx.fillStyle = '#00ffff';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`Score: ${score}`, 20, 40);
      ctx.fillText(`Time: ${Math.ceil(timeRemaining)}s`, 20, 70);

      if (invincibleRef.current) {
        ctx.fillStyle = '#00ffff';
        ctx.fillText('INVINCIBLE!', canvas.width - 150, 40);
      }
      if (nitroRef.current) {
        ctx.fillStyle = '#ff6600';
        ctx.fillText('NITRO!', canvas.width - 150, 70);
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    timerRef.current = setTimeout(gameOver, duration * 1000);

    return () => {
      cancelAnimationFrame(animationRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (invincibleTimerRef.current) clearTimeout(invincibleTimerRef.current);
      if (nitroTimerRef.current) clearTimeout(nitroTimerRef.current);
      if (fogTimerRef.current) clearTimeout(fogTimerRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [onComplete, onScoreUpdate, duration, permissionStatus, score]);

  return (
    <div className="relative w-full h-full bg-black" style={{ border: '2px solid #00ffff' }}>
      {permissionStatus === 'pending' && (
        <div
          onClick={() => requestMotionPermission()}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50 cursor-pointer"
        >
          <h1 className="text-5xl font-bold text-cyan-400 mb-6" style={{ textShadow: '0 0 20px #00ffff' }}>
            🏂 Slope Rider
          </h1>
          <p className="text-2xl text-cyan-300 mb-4">Tap to enable tilt controls</p>
          <p className="text-lg text-cyan-400/70">You'll see a permission popup – allow it!</p>
        </div>
      )}

      {permissionStatus === 'granted' && (
        <div className="absolute top-4 left-4 text-cyan-300 text-sm bg-black/60 px-3 py-1 rounded z-10">
          Tilt enabled • Gamma: {tiltValue}° • Sensitivity: 15x
        </div>
      )}

      {permissionStatus === 'denied' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-40">
          <p className="text-xl text-red-400 text-center px-6">
            Motion access denied.<br/>
            Use finger swipe left/right to steer (fallback mode)
          </p>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none"
        onTouchMove={handleTouchMove}
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}
