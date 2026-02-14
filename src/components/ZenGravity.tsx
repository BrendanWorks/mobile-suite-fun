/**
 * ZenGravity.tsx - A physics-based marble sorting procedural
 */
import React, { useState, useEffect, useRef } from 'react';

interface ZenGravityProps {
  onComplete: (score: number, maxScore: number, timeRemaining: number) => void;
  duration: number;
}

interface Marble {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  active: boolean;
}

export default function ZenGravity({ onComplete, duration }: ZenGravityProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration);
  
  const COLORS = {
    cyan: '#00ffff',
    pink: '#ec4899',
    yellow: '#fbbf24'
  };

  const gameState = useRef({
    marbles: [] as Marble[],
    lastSpawn: 0,
    collected: 0,
    totalSpawned: 0,
    tilt: { x: 0, y: 0 },
    active: true
  });

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        // Adjust for natural phone holding angle (~45 degrees)
        gameState.current.tilt.x = e.gamma * 0.08;
        gameState.current.tilt.y = (e.beta - 45) * 0.08;
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let animationFrame: number;

    const render = (time: number) => {
      if (!gameState.current.active) return;

      // 1. Spawning Logic
      if (time - gameState.current.lastSpawn > 1500 && gameState.current.totalSpawned < 25) {
        const colorKeys = Object.keys(COLORS) as Array<keyof typeof COLORS>;
        gameState.current.marbles.push({
          id: Date.now(),
          x: canvas.width / 2 + (Math.random() * 40 - 20),
          y: 20,
          vx: 0,
          vy: 0,
          color: COLORS[colorKeys[Math.floor(Math.random() * colorKeys.length)]],
          active: true
        });
        gameState.current.lastSpawn = time;
        gameState.current.totalSpawned++;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 2. Draw Goals (Bottom Sockets)
      const goalWidth = canvas.width / 3;
      Object.entries(COLORS).forEach(([name, color], i) => {
        ctx.fillStyle = `${color}33`;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(i * goalWidth + 10, canvas.height - 60, goalWidth - 20, 50, 10);
        ctx.stroke();
        ctx.fill();
        
        // Label or icon could go here
      });

      // 3. Update & Draw Marbles
      gameState.current.marbles.forEach(m => {
        if (!m.active) return;

        // Apply Tilt Gravity
        m.vx += gameState.current.tilt.x;
        m.vy += gameState.current.tilt.y + 0.1; // Slight downward bias
        
        // Friction
        m.vx *= 0.98;
        m.vy *= 0.98;

        m.x += m.vx;
        m.y += m.vy;

        // Wall Collisions
        if (m.x < 15 || m.x > canvas.width - 15) {
          m.vx *= -0.5;
          m.x = m.x < 15 ? 15 : canvas.width - 15;
        }
        if (m.y < 15) {
          m.vy *= -0.5;
          m.y = 15;
        }

        // Goal Detection
        if (m.y > canvas.height - 60) {
          const goalIndex = Math.floor(m.x / goalWidth);
          const goalColor = Object.values(COLORS)[goalIndex];
          
          if (m.color === goalColor) {
            gameState.current.collected++;
            setScore(s => s + 1);
          }
          m.active = false;
        }

        // Draw Marble
        ctx.shadowBlur = 15;
        ctx.shadowColor = m.color;
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // End Game Condition
      if (gameState.current.totalSpawned >= 25 && 
          gameState.current.marbles.every(m => !m.active)) {
        endGame();
      }

      animationFrame = requestAnimationFrame(render);
    };

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) endGame();
        return prev - 1;
      });
    }, 1000);

    const endGame = () => {
      if (!gameState.current.active) return;
      gameState.current.active = false;
      onComplete(gameState.current.collected, 20, timeLeft);
    };

    animationFrame = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      cancelAnimationFrame(animationFrame);
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute top-6 left-6 text-cyan-400 font-mono text-lg">
        SORTED: {score}/20
      </div>
      <div className="absolute top-6 right-6 text-pink-500 font-mono text-lg">
        {timeLeft}s
      </div>
      
      <canvas 
        ref={canvasRef} 
        width={360} 
        height={600} 
        className="max-w-full max-h-[80vh] border-x border-slate-800"
      />
      
      <div className="mt-8 text-slate-500 text-sm animate-pulse">
        TILT PHONE TO GUIDE MARBLES
      </div>
    </div>
  );
}