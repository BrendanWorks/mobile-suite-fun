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
  const [showPermission, setShowPermission] = useState(true);
  const tiltRef = useRef(0);
  const playerXRef = useRef(0);
  const playerHeightRef = useRef(0);
  const vyRef = useRef(0);
  const speedRef = useRef(3);
  const accelerationRef = useRef(0.005);
  const obstaclesRef = useRef<any[]>([]);
  const animationRef = useRef(0);
  const startTimeRef = useRef(0);
  const invincibleRef = useRef(false);
  const invincibleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const nitroRef = useRef(false);
  const nitroTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fogRef = useRef(false);
  const fogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameOverRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const orientationHandlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  const requestMotionPermission = useCallback(async () => {
    try {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        // iOS 13+
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setMotionGranted(true);
          setShowPermission(false);
          console.log('✅ Motion permission granted');
        } else {
          console.log('❌ Motion permission denied');
          setShowPermission(false); // Hide prompt, fallback to touch
        }
      } else {
        // Android/other
        setMotionGranted(true);
        setShowPermission(false);
        console.log('✅ Motion supported (no permission needed)');
      }
    } catch (err) {
      console.error('Motion permission error:', err);
      setShowPermission(false);
    }
  }, []);

  useEffect(() => {
    requestMotionPermission();
  }, [requestMotionPermission]);

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    const gamma = e.gamma ?? 0;
    tiltRef.current = gamma;
    setTiltValue(Math.round(gamma ?? 0));
  }, []);

  useEffect(() => {
    if (!motionGranted) return;

    orientationHandlerRef.current = handleOrientation;
    window.addEventListener('deviceorientation', handleOrientation as any);

    return () => {
      if (orientationHandlerRef.current) {
        window.removeEventListener('deviceorientation', orientationHandlerRef.current);
      }
    };
  }, [motionGranted, handleOrientation]);

  // Touch fallback for tilt
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const touchX = touch.clientX - rect.left;
      const normalized = (touchX / rect.width - 0.5) * 90; // -45 to 45
      tiltRef.current = normalized;
      setTiltValue(Math.round(normalized));
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - 80; // Nav bar
      playerXRef.current = canvas.width / 2;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    startTimeRef.current = Date.now();

    const generateItem = () => {
      const rand = Math.random();
      const typeChance = rand;
      let type: string, radius = 20;
      if (typeChance < 0.35) type = 'tree';
      else if (typeChance < 0.65) type = 'boulder';
      else if (typeChance < 0.78) type = 'coin';
      else if (typeChance < 0.88) type = 'ramp';
      else if (typeChance < 0.93) type = 'nitro';
      else if (typeChance < 0.97) type = 'invinc';
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
      const deltaTime = (now - (startTimeRef.current + (now - startTimeRef.current))) / 1000; // ~1/60

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Player update
      const vx = (tiltRef.current / 45) * 4 * deltaTime * 60;
      playerXRef.current = Math.max(25, Math.min(canvas.width - 25, playerXRef.current + vx));

      // Jump physics
      if (playerHeightRef.current > 0) {
        vyRef.current -= 0.6 * deltaTime * 60;
        playerHeightRef.current += vyRef.current * deltaTime * 60;
        if (playerHeightRef.current <= 0) {
          playerHeightRef.current = 0;
          vyRef.current = 0;
        }
      }

      // Speed ramp
      speedRef.current = Math.min(8, speedRef.current + accelerationRef.current * deltaTime * 60);
      if (nitroRef.current) speedRef.current = Math.min(12, speedRef.current + 0.03 * deltaTime * 60);

      // Update obstacles
      obstaclesRef.current.forEach(o => o.y += speedRef.current * deltaTime * 60);

      // Remove offscreen
      obstaclesRef.current = obstaclesRef.current.filter(o => o.y < canvas.height + 50);

      // Generate new items
      if (Math.random() < 0.12 * (speedRef.current / 3) * deltaTime * 60) {
        obstaclesRef.current.push(generateItem());
      }

      // Collisions
      const playerY = canvas.height - 60 - playerHeightRef.current;
      const playerRadius = 18;
      for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
        const o = obstaclesRef.current[i];
        if (o.type === 'chasm') {
          if (playerHeightRef.current < 5 && o.y <= playerY && playerY <= o.y + o.height &&
              !(o.gapX < playerXRef.current && playerXRef.current < o.gapX + o.gapWidth)) {
            if (!invincibleRef.current) gameOver();
          }
          continue;
        }
        const dx = Math.abs(o.x - playerXRef.current);
        const dy = Math.abs(o.y - playerY);
        if (Math.sqrt(dx * dx + dy * dy) < o.radius + playerRadius) {
          if (o.type === 'coin') {
            setScore(s => s + 25);
            obstaclesRef.current.splice(i, 1);
          } else if (o.type === 'ramp') {
            vyRef.current = 18;
            obstaclesRef.current.splice(i, 1);
          } else if (o.type === 'nitro') {
            nitroRef.current = true;
            if (nitroTimerRef.current) clearTimeout(nitroTimerRef.current);
            nitroTimerRef.current = setTimeout(() => { nitroRef.current = false; }, 4000);
            obstaclesRef.current.splice(i, 1);
          } else if (o.type === 'invinc') {
            invincibleRef.current = true;
            if (invincibleTimerRef.current) clearTimeout(invincibleTimerRef.current);
            invincibleTimerRef.current = setTimeout(() => { invincibleRef.current = false; }, 5000);
            obstaclesRef.current.splice(i, 1);
          } else if (playerHeightRef.current > 15 || invincibleRef.current) {
            // Safe jump or invinc
            obstaclesRef.current.splice(i, 1);
          } else {
            gameOver();
          }
        }
      }

      // Score: base distance + coins
      setScore(s => {
        const newScore = s + (speedRef.current * 2 + (nitroRef.current ? 5 : 0)) * deltaTime * 60;
        onScoreUpdate(Math.floor(newScore), 0);
        return Math.floor(newScore);
      });

      // Random powder flurry (~every 15-25s)
      if (Math.random() < 0.0008 && !fogRef.current) {
        fogRef.current = true;
        if (fogTimerRef.current) clearTimeout(fogTimerRef.current);
        fogTimerRef.current = setTimeout(() => { fogRef.current = false; }, 6000 + Math.random() * 4000);
      }

      // Draw snowy background (procedural flakes moving down)
      ctx.fillStyle = '#ffffff20';
      for (let i = 0; i < 60; i++) {
        const flakeY = (Date.now() * 0.01 + i * 100) % canvas.height;
        ctx.fillRect(Math.sin(Date.now() * 0.001 + i) * canvas.width * 0.3 + canvas.width * 0.5, flakeY, 1.5, 1.5);
      }

      // Draw obstacles
      obstaclesRef.current.forEach(o => {
        if (o.type === 'chasm') {
          ctx.fillStyle = '#111';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 5;
          ctx.fillRect(0, o.y, o.gapX, o.height);
          ctx.fillRect(o.gapX + o.gapWidth, o.y, canvas.width - o.gapX - o.gapWidth, o.height);
          ctx.shadowBlur = 0;
          return;
        }

        const colors: { [key: string]: string } = {
          tree: '#ec4899',
          boulder: '#ef4444',
          coin: '#fbbf24',
          ramp: '#00ffff',
          nitro: '#22c55e',
          invinc: '#00ff88'
        };
        const color = colors[o.type] || '#00ffff';
        ctx.shadowColor = color;
        ctx.shadowBlur = invincibleRef.current ? 0 : 12;
        ctx.fillStyle = color;
        if (o.type === 'tree' || o.type === 'ramp') {
          ctx.save();
          ctx.translate(o.x, o.y);
          ctx.rotate(o.type === 'ramp' ? -0.3 : 0);
          ctx.beginPath();
          ctx.moveTo(-o.radius, o.radius);
          ctx.lineTo(0, -o.radius * 0.8);
          ctx.lineTo(o.radius, o.radius);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Player sled (low-poly cyan)
      ctx.save();
      ctx.shadowColor = invincibleRef.current ? '#00ff88' : '#00ffff';
      ctx.shadowBlur = invincibleRef.current ? 25 : 18;
      ctx.fillStyle = invincibleRef.current ? '#00ff88' : '#00ffff';
      ctx.translate(playerXRef.current, playerY);
      // Sled shape
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(-12, -8);
      ctx.lineTo(12, -8);
      ctx.lineTo(18, 0);
      ctx.lineTo(12, 12);
      ctx.lineTo(-12, 12);
      ctx.closePath();
      ctx.fill();
      // Tilt indicator line
      ctx.strokeStyle = '#ffffff80';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(tiltRef.current / 3, -12);
      ctx.stroke();
      ctx.restore();

      // Nitro glow trail
      if (nitroRef.current) {
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 30;
        ctx.fillStyle = '#fbbf2480';
        ctx.fillRect(playerXRef.current - 20, playerY + 10, 40, 20);
      }

      // HUD: Score (neon yellow)
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#000';
      ctx.fillRect(20, 20, 200, 50);
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 28px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.floor(score)}`, 35, 45);

      // Tilt debug (small, cyan)
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#00ffff80';
      ctx.font = '14px -apple-system, sans-serif';
      ctx.fillText(`Tilt: ${tiltValue.toString().padStart(3, ' ')}°`, canvas.width - 120, 35);

      // Permission overlay
      if (showPermission) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 32px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏂 Slope Rider', canvas.width / 2, canvas.height / 2 - 60);
        ctx.font = 'bold 20px -apple-system, sans-serif';
        ctx.fillText('Tap to enable', canvas.width / 2, canvas.height / 2);
        ctx.font = '18px -apple-system, sans-serif';
        ctx.fillStyle = '#00ffff80';
        ctx.fillText('Tilt phone to steer', canvas.width / 2, canvas.height / 2 + 40);
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    loop();

    timerRef.current = setTimeout(gameOver, duration * 1000);

    return () => {
      gameOver();
      window.removeEventListener('resize', resizeCanvas);
      if (orientationHandlerRef.current) {
        window.removeEventListener('deviceorientation', orientationHandlerRef.current);
      }
    };
  }, [onComplete, onScoreUpdate, duration, score, tiltValue, motionGranted, showPermission, handleTouchMove, handleTouchStart]);

  return (
    <div className="w-full h-full relative bg-black" style={{ border: '2px solid #00ffff', boxShadow: '0 0 20px rgba(0,255,255,0.4), inset 0 0 30px rgba(0,255,255,0.1)' }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        style={{ touchAction: 'none', cursor: 'none' }}
      />
    </div>
  );
}
