import React, { useRef, useEffect, useState } from 'react';

interface SlopeRiderProps {
  onComplete: (rawScore: number, maxScore: number, timeRemaining: number) => void;
  onScoreUpdate: (score: number, maxScore: number) => void;
  duration: number;
  // Ignore puzzleId, etc., as procedural
}

export default function SlopeRider({ onComplete, onScoreUpdate, duration }: SlopeRiderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const tiltRef = useRef(0);
  const playerXRef = useRef(0);
  const playerHeightRef = useRef(0); // For jumps (positive up)
  const vyRef = useRef(0); // Jump velocity
  const speedRef = useRef(3); // Base speed
  const accelerationRef = useRef(0.005); // Gradual increase
  const obstaclesRef = useRef<any[]>([]);
  const animationRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const invincibleRef = useRef(false);
  const nitroRef = useRef(false);
  const fogRef = useRef(false);
  const gameOverRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 80; // Account for nav bar
    playerXRef.current = canvas.width / 2;

    // Tilt controls
    const handleOrientation = (e: DeviceOrientationEvent) => {
      tiltRef.current = e.gamma ?? 0; // -90 to 90
    };
    window.addEventListener('deviceorientation', handleOrientation);

    // Fallback keyboard for desktop testing
    // const handleKey = (e: KeyboardEvent) => {
    //   if (e.key === 'ArrowLeft') tiltRef.current = -45;
    //   if (e.key === 'ArrowRight') tiltRef.current = 45;
    // };
    // window.addEventListener('keydown', handleKey);
    // window.addEventListener('keyup', () => tiltRef.current = 0);

    // Generate obstacle/coin/power-up/chasm/ramp
    const generateItem = () => {
      const rand = Math.random();
      const typeChance = rand;
      let type: string, radius = 20;
      if (typeChance < 0.4) type = 'tree'; // Pink triangle
      else if (typeChance < 0.7) type = 'boulder'; // Red circle
      else if (typeChance < 0.85) type = 'coin'; // Yellow circle, radius 15
      else if (typeChance < 0.9) type = 'ramp'; // Blue triangle
      else if (typeChance < 0.95) type = 'nitro'; // Green circle
      else if (typeChance < 0.98) type = 'invinc'; // Cyan circle
      else type = 'chasm'; // Black bar with gap

      const x = Math.random() * canvas.width;
      if (type === 'coin') radius = 15;
      if (type === 'chasm') {
        const gapWidth = 100 + Math.random() * 100;
        const gapX = Math.random() * (canvas.width - gapWidth);
        return { type, y: -50, gapX, gapWidth, height: 10 };
      }
      return { type, x, y: -50, radius };
    };

    // Game loop
    const loop = () => {
      if (gameOverRef.current) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update player
      const vx = (tiltRef.current / 45) * 5; // Sensitivity
      playerXRef.current += vx;
      playerXRef.current = Math.max(20, Math.min(canvas.width - 20, playerXRef.current));

      // Jump physics
      vyRef.current -= 0.5; // Gravity (negative up)
      playerHeightRef.current += vyRef.current;
      if (playerHeightRef.current <= 0) {
        playerHeightRef.current = 0;
        vyRef.current = 0;
      }

      // Speed increase
      speedRef.current += accelerationRef.current;
      if (nitroRef.current) speedRef.current += 0.02; // Boost

      // Move items down (relative up)
      obstaclesRef.current.forEach((o) => (o.y += speedRef.current));

      // Clean offscreen
      obstaclesRef.current = obstaclesRef.current.filter((o) => o.y < canvas.height + 50);

      // Generate new
      if (Math.random() < 0.1 * (speedRef.current / 3)) obstaclesRef.current.push(generateItem());

      // Collision detection
      const playerY = canvas.height - 50 - playerHeightRef.current; // Player screen Y
      const playerRadius = 15;
      obstaclesRef.current.forEach((o, idx) => {
        if (o.type === 'chasm') {
          if (playerHeightRef.current === 0 && o.y < playerY && playerY < o.y + o.height && !(o.gapX < playerXRef.current && playerXRef.current < o.gapX + o.gapWidth)) {
            if (!invincibleRef.current) gameOver();
          }
          return;
        }
        const dx = o.x - playerXRef.current;
        const dy = o.y - playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < o.radius + playerRadius) {
          if (o.type === 'coin') {
            setScore((prev) => prev + 10);
            obstaclesRef.current.splice(idx, 1);
          } else if (o.type === 'nitro') {
            nitroRef.current = true;
            setTimeout(() => (nitroRef.current = false), 5000);
            obstaclesRef.current.splice(idx, 1);
          } else if (o.type === 'invinc') {
            invincibleRef.current = true;
            setTimeout(() => (invincibleRef.current = false), 5000);
            obstaclesRef.current.splice(idx, 1);
          } else if (o.type === 'ramp') {
            vyRef.current = 15; // Jump
            obstaclesRef.current.splice(idx, 1);
          } else if (playerHeightRef.current > 10) {
            // Jump over obstacle
          } else if (!invincibleRef.current) {
            gameOver();
          }
        }
      });

      // Score update (distance)
      setScore((prev) => prev + speedRef.current / 60);
      onScoreUpdate(score, 0); // No max for endless

      // Random events (every ~20s)
      if (Math.random() < 0.001) fogRef.current = true; setTimeout(() => (fogRef.current = false), 8000);

      // Draw
      // Snowflakes (procedural particles)
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 50; i++) {
        const px = Math.random() * canvas.width;
        const py = Math.random() * canvas.height;
        ctx.fillRect(px, py, 2, 2);
      }

      // Items
      obstaclesRef.current.forEach((o) => {
        if (o.type === 'chasm') {
          ctx.fillStyle = '#000000';
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 0;
          ctx.fillRect(0, o.y, o.gapX, o.height);
          ctx.fillRect(o.gapX + o.gapWidth, o.y, canvas.width - (o.gapX + o.gapWidth), o.height);
          return;
        }
        let color = o.type === 'tree' ? '#ec4899' : o.type === 'boulder' ? '#ef4444' : o.type === 'coin' ? '#fbbf24' : o.type === 'ramp' ? '#00ffff' : o.type === 'nitro' ? '#22c55e' : '#00ffff';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        if (o.type === 'tree' || o.type === 'ramp') {
          // Triangle
          ctx.beginPath();
          ctx.moveTo(o.x - o.radius, o.y + o.radius);
          ctx.lineTo(o.x, o.y - o.radius);
          ctx.lineTo(o.x + o.radius, o.y + o.radius);
          ctx.closePath();
          ctx.fill();
        } else {
          // Circle
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.radius, 0, 2 * Math.PI);
          ctx.fill();
        }
      });

      // Player (cyan rect with glow)
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(playerXRef.current - 15, playerY, 30, 20);

      // Fog event (powder flurry)
      if (fogRef.current) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    const gameOver = () => {
      gameOverRef.current = true;
      cancelAnimationFrame(animationRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      const timeElapsed = (Date.now() - startTimeRef.current) / 1000;
      const timeRemaining = Math.max(0, duration - timeElapsed);
      onComplete(score, 0, timeRemaining);
    };

    loop();

    // Fallback timer if no collision
    timerRef.current = setTimeout(gameOver, duration * 1000);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      // window.removeEventListener('keydown', handleKey);
      // window.removeEventListener('keyup', () => {});
      cancelAnimationFrame(animationRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onComplete, onScoreUpdate, duration, score]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full bg-black"
      style={{
        boxShadow: '0 0 15px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1)',
        border: '2px solid #00ffff',
      }}
    />
  );
}