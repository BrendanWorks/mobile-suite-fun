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
  status?: 'correct' | 'wrong';
  opacity: number;
  scale: number;
}

interface Peg {
  x: number;
  y: number;
  lastHit: number;
}

export default function ZenGravity({ onComplete, duration }: ZenGravityProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isStarted, setIsStarted] = useState(false);
  
  const COLORS = {
    cyan: '#00ffff',
    pink: '#ec4899',
    yellow: '#fbbf24'
  };

  const gameState = useRef({
    marbles: [] as Marble[],
    pegs: [] as Peg[],
    lastSpawn: 0,
    collected: 0,
    totalSpawned: 0,
    tiltX: 0,
    active: true,
    spawnInterval: 3000 
  });

  const playClack = (volume = 0.1, pitch = 400) => {
    if (!audioCtx.current || audioCtx.current.state === 'suspended') return;
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch + (Math.random() * 50), audioCtx.current.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.current.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.current.destination);
    osc.start();
    osc.stop(audioCtx.current.currentTime + 0.1);
  };

  const requestPermission = async () => {
    audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission !== 'granted') return;
      } catch (e) { console.error(e); }
    }
    setIsStarted(true);
  };

  useEffect(() => {
    if (!isStarted) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) {
        gameState.current.tiltX = e.gamma * 0.045; 
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // V-Shape / Diamond Peg Layout
    const pegs: Peg[] = [];
    const centerX = canvas.width / 2;
    const startY = 180;
    const rowSpacing = 70;
    const colSpacing = 60;

    for (let row = 0; row < 6; row++) {
        // Creates a widening then narrowing diamond funnel
        const count = row < 4 ? row + 2 : 7 - row; 
        for (let i = 0; i < count; i++) {
            const xOffset = (i - (count - 1) / 2) * colSpacing;
            pegs.push({
                x: centerX + xOffset,
                y: startY + (row * rowSpacing),
                lastHit: 0
            });
        }
    }
    gameState.current.pegs = pegs;

    let animationFrame: number;

    const render = (time: number) => {
      if (!gameState.current.active) return;

      const timeElapsed = (duration - timeLeft);
      gameState.current.spawnInterval = Math.max(900, 3000 - (timeElapsed * 150));

      if (time - gameState.current.lastSpawn > gameState.current.spawnInterval && gameState.current.totalSpawned < 20) {
        const colorKeys = Object.keys(COLORS) as Array<keyof typeof COLORS>;
        gameState.current.marbles.push({
          id: Date.now(),
          x: canvas.width / 2 + (Math.random() * 20 - 10),
          y: -30,
          vx: (Math.random() - 0.5) * 1.5,
          vy: 2,
          color: COLORS[colorKeys[Math.floor(Math.random() * colorKeys.length)]],
          active: true,
          opacity: 1,
          scale: 1
        });
        gameState.current.lastSpawn = time;
        gameState.current.totalSpawned++;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const goalWidth = canvas.width / 3;
      Object.entries(COLORS).forEach(([_, color], i) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(i * goalWidth + 12, canvas.height - 70, goalWidth - 24, 60);
        ctx.fillStyle = `${color}15`;
        ctx.fillRect(i * goalWidth + 12, canvas.height - 70, goalWidth - 24, 60);
      });

      gameState.current.pegs.forEach(peg => {
        const hit = Math.max(0, 1 - (time - peg.lastHit) / 300);
        ctx.fillStyle = hit > 0 ? '#fff' : '#1e293b';
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });

      gameState.current.marbles.forEach(m => {
        if (!m.active && m.opacity <= 0) return;

        if (m.active) {
          m.vx += gameState.current.tiltX;
          m.vy += 0.2; 
          
          if (Math.abs(m.vy) < 0.1) m.vy += 0.3;
          
          m.vx *= 0.96; 
          m.vy *= 0.99;
          m.x += m.vx;
          m.y += m.vy;

          gameState.current.pegs.forEach(p => {
            const dx = m.x - p.x;
            const dy = m.y - p.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 19) {
              const angle = Math.atan2(dy, dx);
              m.x = p.x + Math.cos(angle) * 19.5;
              m.y = p.y + Math.sin(angle) * 19.5;
              
              const speed = Math.sqrt(m.vx*m.vx + m.vy*m.vy);
              m.vx = Math.cos(angle) * speed * 0.85;
              m.vy = Math.sin(angle) * speed * 0.85;
              p.lastHit = time;
              playClack(0.06, 350);
            }
          });

          if (m.x < 15) { m.x = 15; m.vx *= -0.5; }
          if (m.x > canvas.width - 15) { m.x = canvas.width - 15; m.vx *= -0.5; }

          if (m.y > canvas.height - 70) {
            const goalIdx = Math.floor(m.x / goalWidth);
            const goalColor = Object.values(COLORS)[goalIdx];
            m.active = false;
            if (m.color === goalColor) {
              m.status = 'correct';
              gameState.current.collected++;
              setScore(s => s + 1);
              playClack(0.12, 550); 
            } else {
              m.status = 'wrong';
              playClack(0.12, 120); 
            }
          }
        } else {
          m.opacity -= 0.05;
          m.scale = m.status === 'wrong' ? m.scale + 0.07 : m.scale - 0.07;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, m.opacity);
        ctx.translate(m.x, m.y);
        ctx.scale(Math.max(0, m.scale), Math.max(0, m.scale));
        ctx.shadowBlur = 15;
        ctx.shadowColor = m.status === 'wrong' ? '#ff3333' : m.color;
        ctx.fillStyle = m.status === 'wrong' ? '#ff3333' : m.color;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      if (gameState.current.totalSpawned >= 20 && gameState.current.marbles.every(m => !m.active && m.opacity <= 0)) {
        endGame();
      }

      animationFrame = requestAnimationFrame(render);
    };

    const timer = setInterval(() => setTimeLeft(p => p > 0 ? p - 1 : 0), 1000);
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
  }, [isStarted]);

  return (
    <div className="relative w-full h-full bg-[#020617] flex flex-col items-center justify-center overflow-hidden">
      {!isStarted && (
        <div className="absolute inset-0 z-50 bg-slate-950 flex items-center justify-center p-8 text-center">
          <div className="max-w-xs">
            <h2 className="text-4xl font-black text-white mb-2 tracking-tighter italic uppercase">Neon Flow</h2>
            <p className="text-slate-400 mb-10 text-xs font-bold uppercase tracking-widest leading-relaxed">
              Steer the marbles.<br/>Match the colors.
            </p>
            <button 
              onClick={requestPermission}
              className="w-full py-5 bg-cyan-400 text-black font-black rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.4)] active:scale-95 transition-transform"
            >
              READY
            </button>
          </div>
        </div>
      )}

      <div className="absolute top-12 left-0 right-0 flex justify-between px-10 z-10 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Sorted</span>
          <span className="text-3xl font-black text-white tabular-nums">{score}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Timer</span>
          <span className="text-3xl font-black text-pink-500 tabular-nums">{timeLeft}s</span>
        </div>
      </div>

      <canvas ref={canvasRef} width={360} height={640} className="w-full h-full max-h-screen object-contain" />
      
      <div className="absolute bottom-10 w-32 h-1 bg-slate-900 rounded-full overflow-hidden">
        <div 
          className="h-full bg-cyan-400 shadow-[0_0_15px_#22d3ee] transition-transform duration-100 ease-out"
          style={{ 
            width: '10px', 
            marginLeft: 'calc(50% - 5px)',
            transform: `translateX(${gameState.current.tiltX * 180}px)` 
          }}
        />
      </div>
    </div>
  );
}
