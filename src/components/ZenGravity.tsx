import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { GameHandle } from '../lib/gameTypes';

interface ZenGravityProps {
  onComplete: (score: number, maxScore: number, timeRemaining: number) => void;
  duration: number;
  timeRemaining: number;
}

interface Marble {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  colorKey: 'cyan' | 'pink' | 'yellow';
  active: boolean;
  status?: 'correct' | 'wrong';
  opacity: number;
  scale: number;
  trail: { x: number; y: number; opacity: number }[];
}

interface Peg {
  x: number;
  y: number;
  lastHit: number;
  glowIntensity: number;
}

interface IncomingSignal {
  lane: number; // 0=left, 1=center, 2=right
  colorKey: 'cyan' | 'pink' | 'yellow';
  spawnAt: number;
  shown: boolean;
}

const COLORS = {
  cyan:   '#00ffff',
  pink:   '#ec4899',
  yellow: '#fbbf24',
} as const;

const COLOR_LABELS = {
  cyan:   'CYAN',
  pink:   'PINK',
  yellow: 'GOLD',
} as const;

const GOAL_GLOW = {
  cyan:   'rgba(0,255,255,0.15)',
  pink:   'rgba(236,72,153,0.15)',
  yellow: 'rgba(251,191,36,0.15)',
} as const;

const GOAL_ORDER: Array<'cyan' | 'pink' | 'yellow'> = ['cyan', 'pink', 'yellow'];

const MAX_MARBLES = 20;

const ZenGravity = forwardRef<GameHandle, ZenGravityProps>(({ onComplete, duration, timeRemaining }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const [score, setScore] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [totalSpawned, setTotalSpawned] = useState(0);
  const scoreRef = useRef(0);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score: scoreRef.current, maxScore: MAX_MARBLES }),
    onGameEnd: () => {
      gameState.current.active = false;
      onComplete(scoreRef.current, MAX_MARBLES, timeRemaining);
    },
    canSkipQuestion: false,
    hideTimer: false,
    pauseTimer: false,
  }));

  const gameState = useRef({
    marbles: [] as Marble[],
    pegs: [] as Peg[],
    incoming: [] as IncomingSignal[],
    lastSpawn: 0,
    collected: 0,
    totalSpawned: 0,
    tiltX: 0,
    active: true,
    spawnInterval: 3000,
  });

  const playClack = (volume = 0.1, pitch = 400) => {
    if (!audioCtx.current || audioCtx.current.state === 'suspended') return;
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch + Math.random() * 50, audioCtx.current.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.current.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.current.destination);
    osc.start();
    osc.stop(audioCtx.current.currentTime + 0.12);
  };

  const playSuccess = () => {
    if (!audioCtx.current) return;
    [550, 700, 880].forEach((freq, i) => {
      const osc = audioCtx.current!.createOscillator();
      const gain = audioCtx.current!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.current!.currentTime + i * 0.06);
      gain.gain.setValueAtTime(0.12, audioCtx.current!.currentTime + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.current!.currentTime + i * 0.06 + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.current!.destination);
      osc.start(audioCtx.current!.currentTime + i * 0.06);
      osc.stop(audioCtx.current!.currentTime + i * 0.06 + 0.15);
    });
  };

  const playWrong = () => {
    if (!audioCtx.current) return;
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, audioCtx.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, audioCtx.current.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, audioCtx.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.current.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.current.destination);
    osc.start();
    osc.stop(audioCtx.current.currentTime + 0.2);
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
        gameState.current.tiltX = Math.max(-3, Math.min(3, e.gamma * 0.045));
      }
    };
    window.addEventListener('deviceorientation', handleOrientation);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;

    // Peg layout — diamond funnel
    const pegs: Peg[] = [];
    const centerX = W / 2;
    const startY = 155;
    const rowSpacing = 68;
    const colSpacing = 58;

    for (let row = 0; row < 6; row++) {
      const count = row < 4 ? row + 2 : 7 - row;
      for (let i = 0; i < count; i++) {
        const xOffset = (i - (count - 1) / 2) * colSpacing;
        pegs.push({ x: centerX + xOffset, y: startY + row * rowSpacing, lastHit: 0, glowIntensity: 0 });
      }
    }
    gameState.current.pegs = pegs;

    const goalHeight = 72;
    const goalY = H - goalHeight - 30;
    const goalWidth = W / 3;

    // Goal flash state
    const goalFlash = { lane: -1, color: '', until: 0, type: '' as 'correct' | 'wrong' | '' };

    let animationFrame: number;

    const getSpawnLane = (): number => Math.floor(Math.random() * 3);
    const getLaneX = (lane: number): number => goalWidth * lane + goalWidth / 2 + (Math.random() * 16 - 8);

    const spawnMarble = (time: number) => {
      const colorKeys = Object.keys(COLORS) as Array<keyof typeof COLORS>;
      const colorKey = colorKeys[Math.floor(Math.random() * colorKeys.length)];
      const lane = getSpawnLane();

      // Queue incoming signal 1.5s before actual spawn
      gameState.current.incoming.push({
        lane,
        colorKey,
        spawnAt: time,
        shown: false,
      });

      gameState.current.marbles.push({
        id: Date.now(),
        x: getLaneX(lane),
        y: -20,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 2,
        color: COLORS[colorKey],
        colorKey,
        active: true,
        opacity: 1,
        scale: 1,
        trail: [],
      });

      gameState.current.lastSpawn = time;
      gameState.current.totalSpawned++;
      setTotalSpawned(gameState.current.totalSpawned);
    };

    const render = (time: number) => {
      if (!gameState.current.active) return;

      const timeElapsed = duration - timeRemaining;
      gameState.current.spawnInterval = Math.max(800, 3000 - timeElapsed * 150);

      // Spawn
      if (
        time - gameState.current.lastSpawn > gameState.current.spawnInterval &&
        gameState.current.totalSpawned < MAX_MARBLES
      ) {
        spawnMarble(time);
      }

      ctx.clearRect(0, 0, W, H);

      // Subtle grid background
      ctx.strokeStyle = 'rgba(0,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // ── Goal zones ──────────────────────────────────────────────────────

      GOAL_ORDER.forEach((colorKey, i) => {
        const color = COLORS[colorKey];
        const gx = i * goalWidth;
        const isFlashing = goalFlash.lane === i && time < goalFlash.until;
        const flashColor = goalFlash.color;

        // Fill
        ctx.fillStyle = isFlashing
          ? (goalFlash.type === 'correct' ? `${flashColor}35` : 'rgba(239,68,68,0.2)')
          : GOAL_GLOW[colorKey];
        ctx.fillRect(gx + 10, goalY, goalWidth - 20, goalHeight);

        // Border
        ctx.strokeStyle = isFlashing
          ? (goalFlash.type === 'correct' ? flashColor : '#ef4444')
          : color;
        ctx.lineWidth = isFlashing ? 3 : 2;
        ctx.globalAlpha = isFlashing ? 1 : 0.6;
        ctx.strokeRect(gx + 10, goalY, goalWidth - 20, goalHeight);
        ctx.globalAlpha = 1;

        // Glow on flash
        if (isFlashing) {
          ctx.shadowBlur = 20;
          ctx.shadowColor = goalFlash.type === 'correct' ? flashColor : '#ef4444';
          ctx.strokeRect(gx + 10, goalY, goalWidth - 20, goalHeight);
          ctx.shadowBlur = 0;
        }

        // Color dot
        ctx.beginPath();
        ctx.arc(gx + goalWidth / 2, goalY + 22, 10, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.textAlign = 'center';
        ctx.fillText(COLOR_LABELS[colorKey], gx + goalWidth / 2, goalY + 56);
        ctx.globalAlpha = 1;
      });

      // ── Incoming lane indicators ─────────────────────────────────────────

      gameState.current.incoming.forEach((sig) => {
        const pulse = (Math.sin(time * 0.008) + 1) / 2;
        const laneX = goalWidth * sig.lane + goalWidth / 2;
        const color = COLORS[sig.colorKey];

        // Dashed lane line from top to peg area
        ctx.setLineDash([6, 8]);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.15 + pulse * 0.1;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(laneX, 0);
        ctx.lineTo(laneX, 160);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Small arrow at top
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5 + pulse * 0.3;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.moveTo(laneX, 12);
        ctx.lineTo(laneX - 7, 0);
        ctx.lineTo(laneX + 7, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      });

      // ── Pegs ─────────────────────────────────────────────────────────────

      gameState.current.pegs.forEach((peg) => {
        const hitAge = time - peg.lastHit;
        const hitFade = Math.max(0, 1 - hitAge / 400);
        peg.glowIntensity = hitFade;

        // Idle glow
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = hitFade > 0
          ? `rgba(255,255,255,${0.15 + hitFade * 0.85})`
          : 'rgba(0,255,255,0.12)';
        ctx.shadowBlur = hitFade > 0 ? 18 : 6;
        ctx.shadowColor = hitFade > 0 ? '#ffffff' : '#00ffff';
        ctx.fill();
        ctx.shadowBlur = 0;

        // Core dot
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = hitFade > 0 ? '#fff' : 'rgba(0,255,255,0.4)';
        ctx.fill();
      });

      // ── Marbles ───────────────────────────────────────────────────────────

      gameState.current.marbles.forEach((m) => {
        if (!m.active && m.opacity <= 0) return;

        if (m.active) {
          // Store trail
          m.trail.push({ x: m.x, y: m.y, opacity: 0.5 });
          if (m.trail.length > 8) m.trail.shift();
          m.trail.forEach((t) => (t.opacity *= 0.8));

          m.vx += gameState.current.tiltX;
          m.vy += 0.22;
          if (Math.abs(m.vy) < 0.1) m.vy += 0.3;
          m.vx *= 0.96;
          m.vy *= 0.99;
          m.x += m.vx;
          m.y += m.vy;

          // Peg collisions
          gameState.current.pegs.forEach((p) => {
            const dx = m.x - p.x;
            const dy = m.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 20) {
              const angle = Math.atan2(dy, dx);
              m.x = p.x + Math.cos(angle) * 20.5;
              m.y = p.y + Math.sin(angle) * 20.5;
              const speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
              m.vx = Math.cos(angle) * speed * 0.82;
              m.vy = Math.sin(angle) * speed * 0.82;
              p.lastHit = time;
              playClack(0.06, 300 + Math.random() * 100);
            }
          });

          // Wall bounce
          if (m.x < 14) { m.x = 14; m.vx *= -0.5; }
          if (m.x > W - 14) { m.x = W - 14; m.vx *= -0.5; }

          // Goal detection
          if (m.y > goalY) {
            const goalIdx = Math.floor(m.x / goalWidth);
            const clampedIdx = Math.max(0, Math.min(2, goalIdx));
            const goalColorKey = GOAL_ORDER[clampedIdx];
            m.active = false;

            // Remove incoming signal for this marble
            const sigIdx = gameState.current.incoming.findIndex((s) => s.colorKey === m.colorKey);
            if (sigIdx !== -1) gameState.current.incoming.splice(sigIdx, 1);

            if (m.colorKey === goalColorKey) {
              m.status = 'correct';
              gameState.current.collected++;
              scoreRef.current++;
              setScore(scoreRef.current);
              goalFlash.lane = clampedIdx;
              goalFlash.color = COLORS[goalColorKey];
              goalFlash.until = time + 500;
              goalFlash.type = 'correct';
              playSuccess();
            } else {
              m.status = 'wrong';
              goalFlash.lane = clampedIdx;
              goalFlash.color = '#ef4444';
              goalFlash.until = time + 400;
              goalFlash.type = 'wrong';
              playWrong();
            }
          }
        } else {
          m.opacity -= 0.04;
          m.scale = m.status === 'wrong' ? m.scale + 0.06 : Math.max(0, m.scale - 0.06);
        }

        // Draw trail
        m.trail.forEach((t, ti) => {
          ctx.beginPath();
          ctx.arc(t.x, t.y, 4 * (ti / m.trail.length), 0, Math.PI * 2);
          ctx.fillStyle = m.color;
          ctx.globalAlpha = t.opacity * 0.3 * Math.max(0, m.opacity);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Draw marble
        ctx.save();
        ctx.globalAlpha = Math.max(0, m.opacity);
        ctx.translate(m.x, m.y);
        ctx.scale(Math.max(0, m.scale), Math.max(0, m.scale));

        const marbleColor = m.status === 'wrong' ? '#ff4444' : m.color;

        // Outer glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = marbleColor;

        // Marble body
        const grad = ctx.createRadialGradient(-3, -3, 1, 0, 0, 12);
        grad.addColorStop(0, 'rgba(255,255,255,0.8)');
        grad.addColorStop(0.4, marbleColor);
        grad.addColorStop(1, marbleColor + '88');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Specular highlight
        ctx.beginPath();
        ctx.arc(-4, -4, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();

        ctx.restore();
      });

      // ── Speed ramp indicator ─────────────────────────────────────────────

      const speedFraction = Math.min(1, (duration - timeRemaining) / duration);
      if (speedFraction > 0.3) {
        const intensity = (speedFraction - 0.3) / 0.7;
        ctx.fillStyle = `rgba(239,68,68,${intensity * 0.12})`;
        ctx.fillRect(0, 0, W, H);

        // Edge pulse
        const edgeGrad = ctx.createLinearGradient(0, 0, 40, 0);
        edgeGrad.addColorStop(0, `rgba(239,68,68,${intensity * 0.3})`);
        edgeGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = edgeGrad;
        ctx.fillRect(0, 0, 40, H);

        const edgeGradR = ctx.createLinearGradient(W, 0, W - 40, 0);
        edgeGradR.addColorStop(0, `rgba(239,68,68,${intensity * 0.3})`);
        edgeGradR.addColorStop(1, 'transparent');
        ctx.fillStyle = edgeGradR;
        ctx.fillRect(W - 40, 0, 40, H);
      }

      // ── End condition ────────────────────────────────────────────────────

      if (
        gameState.current.totalSpawned >= MAX_MARBLES &&
        gameState.current.marbles.every((m) => !m.active && m.opacity <= 0)
      ) {
        if (gameState.current.active) {
          gameState.current.active = false;
          onComplete(scoreRef.current, MAX_MARBLES, timeRemaining);
        }
        return;
      }

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      cancelAnimationFrame(animationFrame);
    };
  }, [isStarted, timeRemaining]);

  // Tilt indicator value (live read from gameState)
  const tiltDisplay = gameState.current?.tiltX ?? 0;

  return (
    <div className="relative w-full flex-1 bg-black flex flex-col items-center justify-center overflow-hidden">

      {/* Start screen */}
      {!isStarted && (
        <div className="absolute inset-0 z-50 bg-black flex items-center justify-center p-8 text-center">
          <div className="max-w-xs w-full">
            {/* Title */}
            <div className="mb-8">
              <h2
                className="text-4xl font-black text-cyan-400 mb-1 tracking-tight uppercase"
                style={{ textShadow: '0 0 30px #00ffff, 0 0 60px rgba(0,255,255,0.4)' }}
              >
                Balls
              </h2>
              <div className="w-16 h-0.5 bg-cyan-400 mx-auto mb-4" style={{ boxShadow: '0 0 8px #00ffff' }} />
              <p className="text-white/50 text-xs font-bold uppercase tracking-widest leading-relaxed">
                Tilt to steer each marble<br />into its matching color zone
              </p>
            </div>

            {/* Color key */}
            <div className="flex justify-center gap-6 mb-8">
              {GOAL_ORDER.map((colorKey) => (
                <div key={colorKey} className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-8 h-8 rounded-full"
                    style={{ background: COLORS[colorKey], boxShadow: `0 0 12px ${COLORS[colorKey]}` }}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COLORS[colorKey] }}>
                    {COLOR_LABELS[colorKey]}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={requestPermission}
              className="w-full py-4 font-black text-black rounded-xl uppercase tracking-widest text-sm active:scale-95 transition-transform"
              style={{
                background: '#00ffff',
                boxShadow: '0 0 30px rgba(0,255,255,0.5), 0 0 60px rgba(0,255,255,0.2)',
              }}
            >
              Start
            </button>
          </div>
        </div>
      )}

      {/* HUD */}
      {isStarted && (
        <div className="absolute top-3 left-0 right-0 flex justify-between items-start px-4 z-10 pointer-events-none">
          {/* Score */}
          <div className="flex flex-col items-start">
            <span className="text-[9px] text-cyan-400/50 font-bold uppercase tracking-widest">Sorted</span>
            <div className="flex items-baseline gap-1">
              <span
                className="text-3xl font-black text-white tabular-nums"
                style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}
              >
                {score}
              </span>
              <span className="text-sm text-white/30 font-bold">/{MAX_MARBLES}</span>
            </div>
          </div>

          {/* Tilt indicator */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] text-cyan-400/50 font-bold uppercase tracking-widest">Tilt</span>
            <div
              className="w-24 h-2 rounded-full overflow-hidden border border-cyan-400/20"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              <div
                className="h-full w-2 rounded-full transition-all duration-75"
                style={{
                  background: '#00ffff',
                  boxShadow: '0 0 8px #00ffff',
                  marginLeft: `calc(50% - 4px + ${tiltDisplay * 28}px)`,
                }}
              />
            </div>
          </div>

          {/* Remaining */}
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-cyan-400/50 font-bold uppercase tracking-widest">Left</span>
            <span
              className="text-3xl font-black tabular-nums"
              style={{ color: '#fbbf24', textShadow: '0 0 10px #fbbf24' }}
            >
              {MAX_MARBLES - totalSpawned}
            </span>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={360}
        height={620}
        className="w-full h-full max-h-screen object-contain"
      />
    </div>
  );
});

export default ZenGravity;