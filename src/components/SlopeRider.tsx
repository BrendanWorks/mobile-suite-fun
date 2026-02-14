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
  const speedRef = useRef(2);          // Slower start for testing
  const accelerationRef = useRef(0.002);
  const obstaclesRef = useRef<any[]>([]);
  const animationRef = useRef(0);
  const startTimeRef = useRef(0);
  const invincibleRef = useRef(false);
  const nitroRef = useRef(false);
  const fogRef = useRef(false);
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
    console.log('deviceorientation fired → gamma:', e.gamma); // ← Debug key line
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

  // Touch fallback
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const touchX = touch.clientX - rect.left;
      const normalized = (touchX / rect.width - 0.5) * 180; // Wider range for touch
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
    lastFrameTimeRef.current = performance.now();

    const generateItem = () => { /* unchanged, but you can tweak rates */ 
      // ... your generateItem logic here (copy from previous)
    };

    const gameOver = () => {
      gameOverRef.current = true;
      cancelAnimationFrame(animationRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      const timeElapsed = (Date.now() - startTimeRef.current) / 1000;
      onComplete(Math.floor(score), 0, Math.max(0, duration - timeElapsed));
    };

    const loop = (time: number) => {
      if (gameOverRef.current) return;
      const delta = (time - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Player movement – higher sensitivity
      const vx = (tiltRef.current / 45) * 10 * delta * 60; // ← Increased to ×10
      playerXRef.current = Math.max(30, Math.min(canvas.width - 30, playerXRef.current + vx));

      // ... rest of your loop logic (jump, speed, obstacles, collisions, score, draw) unchanged
      // Make sure playerY uses canvas.height - 80 or similar

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    timerRef.current = setTimeout(gameOver, duration * 1000);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [onComplete, onScoreUpdate, duration, permissionStatus, score /* + other deps if needed */]);

  return (
    <div className="relative w-full h-full bg-black" style={{ border: '2px solid #00ffff' }}>
      {/* Permission overlay */}
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
        <div className="absolute top-4 left-4 text-cyan-300 text-sm bg-black/60 px-3 py-1 rounded">
          Tilt enabled • Gamma: {tiltValue}°
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