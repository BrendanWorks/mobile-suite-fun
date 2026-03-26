import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { GameHandle } from '../lib/gameTypes';

interface Vec2 { x: number; y: number; }

interface Rock {
  id: number;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  angularVel: number;
  size: 'large' | 'medium' | 'small';
  vertices: Vec2[];
  radius: number;
}

interface Bullet {
  id: number;
  pos: Vec2;
  vel: Vec2;
  born: number;
}

interface Particle {
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface DebrisProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
}

const W = 800;
const H = 600;
const MAX_SCORE = 1000;
const BULLET_SPEED = 480;
const BULLET_LIFE = 3000;
const FIRE_COOLDOWN = 300;
const PLAYER_MAX_SPEED = 200;
const THRUST_ACCEL = 250;
const FRICTION = 0.985;
const ROTATE_SPEED = 3.5;
const INVINCIBLE_MS = 1500;
const TOTAL_LIVES = 3;
const WRAP_MARGIN = 80;

const ROCK_RADII = { large: 46, medium: 28, small: 14 };
const ROCK_POINTS = { large: 50, medium: 100, small: 200 };

const COLORS = {
  bg: '#000000',
  cyan: '#22d3ee',
  cyanDim: 'rgba(34,211,238,0.15)',
  cyanMid: 'rgba(34,211,238,0.5)',
  pink: '#f472b6',
  pinkBright: '#ff6ec7',
  white: '#e0f7ff',
  red: '#ef4444',
  yellow: '#fbbf24',
  gray: '#334155',
};

let nextId = 1;

function randomSign() { return Math.random() < 0.5 ? 1 : -1; }

function buildRockVertices(radius: number, count: number): Vec2[] {
  const verts: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = radius * (0.7 + Math.random() * 0.55);
    verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return verts;
}

function spawnRock(size: 'large' | 'medium' | 'small', pos?: Vec2, velocityBoost = 1): Rock {
  const radius = ROCK_RADII[size];
  const vertCount = size === 'large' ? 9 : size === 'medium' ? 7 : 5;

  let spawnPos: Vec2;
  if (pos) {
    spawnPos = { ...pos };
  } else {
    const edge = Math.floor(Math.random() * 4);
    const off = radius + WRAP_MARGIN + 5;
    if (edge === 0) spawnPos = { x: Math.random() * W, y: -off };
    else if (edge === 1) spawnPos = { x: W + off, y: Math.random() * H };
    else if (edge === 2) spawnPos = { x: Math.random() * W, y: H + off };
    else spawnPos = { x: -off, y: Math.random() * H };
  }

  const baseMin = size === 'large' ? 40 : size === 'medium' ? 60 : 100;
  const baseMax = size === 'large' ? 80 : size === 'medium' ? 120 : 150;
  const speed = (baseMin + Math.random() * (baseMax - baseMin)) * velocityBoost;

  const targetX = W * 0.25 + Math.random() * W * 0.5;
  const targetY = H * 0.25 + Math.random() * H * 0.5;
  const dx = targetX - spawnPos.x;
  const dy = targetY - spawnPos.y;
  const baseAngle = Math.atan2(dy, dx);
  const spread = Math.PI * 0.3;
  const angle = pos ? (Math.random() * Math.PI * 2) : (baseAngle + (Math.random() - 0.5) * spread);

  return {
    id: nextId++,
    pos: spawnPos,
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    angle: 0,
    angularVel: (0.5 + Math.random() * 1.5) * randomSign(),
    size,
    vertices: buildRockVertices(radius, vertCount),
    radius,
  };
}

function wrapPos(pos: Vec2): Vec2 {
  let { x, y } = pos;
  const M = WRAP_MARGIN;
  if (x < -M) x += W + M * 2;
  else if (x > W + M) x -= W + M * 2;
  if (y < -M) y += H + M * 2;
  else if (y > H + M) y -= H + M * 2;
  return { x, y };
}

function dist(a: Vec2, b: Vec2) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function spawnWaveRocks(wave: number, boostFactor: number): Rock[] {
  const count = 3 + wave;
  const rocks: Rock[] = [];
  for (let i = 0; i < count; i++) rocks.push(spawnRock('large', undefined, boostFactor));
  return rocks;
}

const Debris = forwardRef<GameHandle, DebrisProps>(({ onScoreUpdate, onComplete, timeRemaining }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scoreRef = useRef(0);
  const livesRef = useRef(TOTAL_LIVES);
  const gameOverRef = useRef(false);
  const wonRef = useRef(false);
  const doneRef = useRef(false);

  const playerPosRef = useRef<Vec2>({ x: W / 2, y: H / 2 });
  const playerVelRef = useRef<Vec2>({ x: 0, y: 0 });
  const playerAngleRef = useRef(0);
  const invincibleUntilRef = useRef(Date.now() + INVINCIBLE_MS);

  const rocksRef = useRef<Rock[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  const keysRef = useRef<Set<string>>(new Set());
  const lastFireRef = useRef(0);
  const lastFrameRef = useRef(0);
  const rafRef = useRef(0);

  const waveRef = useRef(1);
  const waveStartRef = useRef(Date.now());
  const comboRef = useRef(0);
  const lastShotHitRef = useRef(true);
  const multiplierRef = useRef(1.0);
  const missTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scaleRef = useRef(1);

  const onScoreUpdateRef = useRef(onScoreUpdate);
  const onCompleteRef = useRef(onComplete);
  const timeRemainingRef = useRef(timeRemaining);
  useEffect(() => { onScoreUpdateRef.current = onScoreUpdate; }, [onScoreUpdate]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score: Math.round(scoreRef.current), maxScore: MAX_SCORE }),
    onGameEnd: () => { cancelAnimationFrame(rafRef.current); },
  }));

  useEffect(() => {
    if (timeRemaining !== undefined && timeRemaining <= 0 && !doneRef.current) {
      doneRef.current = true;
      cancelAnimationFrame(rafRef.current);
      setTimeout(() => onCompleteRef.current?.(scoreRef.current, MAX_SCORE, 0), 200);
    }
  }, [timeRemaining]);

  useEffect(() => {
    rocksRef.current = spawnWaveRocks(1, 1);
    waveStartRef.current = Date.now();
    invincibleUntilRef.current = Date.now() + INVINCIBLE_MS;

    function addScore(pts: number) {
      const earned = Math.round(pts * multiplierRef.current);
      scoreRef.current = Math.min(scoreRef.current + earned, MAX_SCORE * 2);
      onScoreUpdateRef.current?.(Math.round(scoreRef.current), MAX_SCORE);

      if (scoreRef.current >= MAX_SCORE && !wonRef.current && !doneRef.current) {
        wonRef.current = true;
        doneRef.current = true;
        cancelAnimationFrame(rafRef.current);
        setTimeout(() => onCompleteRef.current?.(scoreRef.current, MAX_SCORE, timeRemainingRef.current), 400);
      }
    }

    function spawnParticles(pos: Vec2, count: number, color: string, speed = 120) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.9);
        particlesRef.current.push({
          pos: { ...pos },
          vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
          life: 1,
          maxLife: 0.6 + Math.random() * 0.6,
          color,
          size: 1.5 + Math.random() * 2,
        });
      }
    }

    function destroyRock(rock: Rock, rocks: Rock[]) {
      const idx = rocks.findIndex(r => r.id === rock.id);
      if (idx !== -1) rocks.splice(idx, 1);

      addScore(ROCK_POINTS[rock.size]);
      spawnParticles(rock.pos, rock.size === 'large' ? 18 : rock.size === 'medium' ? 12 : 7, COLORS.cyan, 160);

      if (rock.size === 'large') {
        rocks.push(spawnRock('medium', { ...rock.pos }));
        rocks.push(spawnRock('medium', { ...rock.pos }));
      } else if (rock.size === 'medium') {
        rocks.push(spawnRock('small', { ...rock.pos }));
        rocks.push(spawnRock('small', { ...rock.pos }));
      }

      comboRef.current++;
      multiplierRef.current = 1.0 + Math.floor(comboRef.current / 10) * 0.1;
      if (missTimerRef.current) clearTimeout(missTimerRef.current);
      lastShotHitRef.current = true;
    }

    function handlePlayerHit() {
      if (Date.now() < invincibleUntilRef.current) return;
      livesRef.current--;
      spawnParticles(playerPosRef.current, 24, COLORS.red, 200);
      invincibleUntilRef.current = Date.now() + INVINCIBLE_MS;
      comboRef.current = 0;
      multiplierRef.current = 1.0;

      if (livesRef.current <= 0 && !doneRef.current) {
        gameOverRef.current = true;
        doneRef.current = true;
        cancelAnimationFrame(rafRef.current);
        setTimeout(() => onCompleteRef.current?.(scoreRef.current, MAX_SCORE, 0), 500);
      }
    }

    function fire() {
      const now = Date.now();
      if (now - lastFireRef.current < FIRE_COOLDOWN) return;
      lastFireRef.current = now;

      const angle = playerAngleRef.current;
      bulletsRef.current.push({
        id: nextId++,
        pos: {
          x: playerPosRef.current.x + Math.cos(angle) * 16,
          y: playerPosRef.current.y + Math.sin(angle) * 16,
        },
        vel: {
          x: Math.cos(angle) * BULLET_SPEED + playerVelRef.current.x,
          y: Math.sin(angle) * BULLET_SPEED + playerVelRef.current.y,
        },
        born: now,
      });

      lastShotHitRef.current = false;
      if (missTimerRef.current) clearTimeout(missTimerRef.current);
      missTimerRef.current = setTimeout(() => {
        if (!lastShotHitRef.current) {
          comboRef.current = 0;
          multiplierRef.current = 1.0;
        }
      }, 2200);
    }

    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const s = scaleRef.current;
      ctx.setTransform(s, 0, 0, s, 0, 0);

      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(34,211,238,0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      for (const rock of rocksRef.current) {
        ctx.save();
        ctx.translate(rock.pos.x, rock.pos.y);
        ctx.rotate(rock.angle);
        ctx.beginPath();
        ctx.moveTo(rock.vertices[0].x, rock.vertices[0].y);
        for (let i = 1; i < rock.vertices.length; i++) ctx.lineTo(rock.vertices[i].x, rock.vertices[i].y);
        ctx.closePath();
        ctx.strokeStyle = COLORS.cyan;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = COLORS.cyanDim;
        ctx.fill();
        ctx.restore();
      }

      for (const b of bulletsRef.current) {
        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.pinkBright;
        ctx.shadowColor = COLORS.pinkBright;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;

        const tailLen = 14;
        const bspeed = Math.sqrt(b.vel.x ** 2 + b.vel.y ** 2);
        if (bspeed > 0) {
          const nx = b.vel.x / bspeed, ny = b.vel.y / bspeed;
          const grad = ctx.createLinearGradient(b.pos.x, b.pos.y, b.pos.x - nx * tailLen, b.pos.y - ny * tailLen);
          grad.addColorStop(0, 'rgba(255,110,199,0.9)');
          grad.addColorStop(1, 'rgba(255,110,199,0)');
          ctx.beginPath();
          ctx.moveTo(b.pos.x, b.pos.y);
          ctx.lineTo(b.pos.x - nx * tailLen, b.pos.y - ny * tailLen);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }

      for (const p of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      const invincible = Date.now() < invincibleUntilRef.current;
      if (!gameOverRef.current) {
        const px = playerPosRef.current.x;
        const py = playerPosRef.current.y;
        const pa = playerAngleRef.current;

        if (!invincible || Math.floor(Date.now() / 120) % 2 === 0) {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(pa);

          ctx.shadowColor = invincible ? COLORS.yellow : COLORS.cyan;
          ctx.shadowBlur = invincible ? 20 : 14;
          ctx.strokeStyle = invincible ? COLORS.yellow : COLORS.cyan;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(18, 0);
          ctx.lineTo(-12, -10);
          ctx.lineTo(-6, 0);
          ctx.lineTo(-12, 10);
          ctx.closePath();
          ctx.stroke();

          const thrusting = keysRef.current.has('ArrowUp') || keysRef.current.has('w');
          if (thrusting) {
            ctx.strokeStyle = COLORS.yellow;
            ctx.lineWidth = 2;
            ctx.shadowColor = COLORS.yellow;
            ctx.shadowBlur = 16;
            ctx.beginPath();
            const fl = 8 + Math.random() * 12;
            ctx.moveTo(-6, -4);
            ctx.lineTo(-6 - fl, 0);
            ctx.lineTo(-6, 4);
            ctx.stroke();
          }

          ctx.restore();
        }
      }

      const score = Math.round(scoreRef.current);
      const lives = livesRef.current;
      const mult = multiplierRef.current;

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = COLORS.white;
      ctx.textAlign = 'center';
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 8;
      ctx.fillText(`${score}`, W / 2, 34);
      ctx.shadowBlur = 0;

      ctx.font = '12px monospace';
      ctx.fillStyle = COLORS.cyanMid;
      ctx.fillText('SCORE', W / 2, 50);

      if (mult > 1.05) {
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = COLORS.yellow;
        ctx.textAlign = 'center';
        ctx.shadowColor = COLORS.yellow;
        ctx.shadowBlur = 8;
        ctx.fillText(`${mult.toFixed(1)}x`, W / 2, 68);
        ctx.shadowBlur = 0;
      }

      ctx.textAlign = 'left';
      ctx.font = '12px monospace';
      ctx.fillStyle = COLORS.cyanMid;
      ctx.fillText('LIVES', 16, 22);
      for (let i = 0; i < TOTAL_LIVES; i++) {
        const alive = i < lives;
        ctx.save();
        ctx.translate(20 + i * 28, 38);
        ctx.rotate(-Math.PI / 2);
        ctx.strokeStyle = alive ? COLORS.cyan : COLORS.gray;
        ctx.lineWidth = 1.5;
        if (alive) { ctx.shadowColor = COLORS.cyan; ctx.shadowBlur = 8; }
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-6, -6);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      const elapsed2 = Math.round((Date.now() - waveStartRef.current) / 1000);
      const timeLeft = Math.max(0, 60 - elapsed2);
      ctx.textAlign = 'right';
      ctx.font = '12px monospace';
      ctx.fillStyle = COLORS.cyanMid;
      ctx.fillText('WAVE', W - 16, 22);
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = timeLeft <= 10 ? COLORS.red : COLORS.cyan;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6;
      ctx.fillText(`${waveRef.current}`, W - 16, 42);
      ctx.shadowBlur = 0;

      if (gameOverRef.current) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 52px monospace';
        ctx.fillStyle = COLORS.red;
        ctx.textAlign = 'center';
        ctx.shadowColor = COLORS.red;
        ctx.shadowBlur = 30;
        ctx.fillText('DESTROYED', W / 2, H / 2 - 20);
        ctx.shadowBlur = 0;
        ctx.font = '20px monospace';
        ctx.fillStyle = COLORS.white;
        ctx.fillText(`SCORE: ${score}`, W / 2, H / 2 + 24);
      }

      if (wonRef.current) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 52px monospace';
        ctx.fillStyle = COLORS.yellow;
        ctx.textAlign = 'center';
        ctx.shadowColor = COLORS.yellow;
        ctx.shadowBlur = 30;
        ctx.fillText('CLEARED!', W / 2, H / 2 - 20);
        ctx.shadowBlur = 0;
        ctx.font = '20px monospace';
        ctx.fillStyle = COLORS.white;
        ctx.fillText(`SCORE: ${score}`, W / 2, H / 2 + 24);
      }
    }

    function gameLoop(ts: number) {
      if (doneRef.current) return;
      const dt = Math.min((ts - (lastFrameRef.current || ts)) / 1000, 0.05);
      lastFrameRef.current = ts;

      const keys = keysRef.current;

      if (keys.has('ArrowLeft') || keys.has('a')) playerAngleRef.current -= ROTATE_SPEED * dt;
      if (keys.has('ArrowRight') || keys.has('d')) playerAngleRef.current += ROTATE_SPEED * dt;

      if (keys.has('ArrowUp') || keys.has('w')) {
        playerVelRef.current.x += Math.cos(playerAngleRef.current) * THRUST_ACCEL * dt;
        playerVelRef.current.y += Math.sin(playerAngleRef.current) * THRUST_ACCEL * dt;
      }

      const spd = Math.sqrt(playerVelRef.current.x ** 2 + playerVelRef.current.y ** 2);
      if (spd > PLAYER_MAX_SPEED) {
        const scale = PLAYER_MAX_SPEED / spd;
        playerVelRef.current.x *= scale;
        playerVelRef.current.y *= scale;
      }

      playerVelRef.current.x *= FRICTION;
      playerVelRef.current.y *= FRICTION;
      playerPosRef.current.x += playerVelRef.current.x * dt;
      playerPosRef.current.y += playerVelRef.current.y * dt;
      playerPosRef.current = wrapPos(playerPosRef.current);

      if (keys.has(' ') || keys.has('Space')) fire();

      const now = Date.now();
      const elapsed = (now - waveStartRef.current) / 1000;

      let velocityBoost = 1;
      if (elapsed >= 45) velocityBoost = 1.4;
      else if (elapsed >= 30) velocityBoost = 1.25;
      else if (elapsed >= 15) velocityBoost = 1.1;

      const targetWave = elapsed >= 45 ? 4 : elapsed >= 30 ? 3 : elapsed >= 15 ? 2 : 1;
      if (targetWave > waveRef.current) {
        waveRef.current = targetWave;
        rocksRef.current.push(...spawnWaveRocks(targetWave - 1, velocityBoost));
      }

      if (rocksRef.current.length === 0) {
        rocksRef.current = spawnWaveRocks(waveRef.current, velocityBoost);
      }

      for (const rock of rocksRef.current) {
        rock.pos.x += rock.vel.x * dt;
        rock.pos.y += rock.vel.y * dt;
        rock.pos = wrapPos(rock.pos);
        rock.angle += rock.angularVel * dt;
      }

      const aliveBullets: Bullet[] = [];
      for (const b of bulletsRef.current) {
        if (now - b.born > BULLET_LIFE) continue;
        b.pos.x += b.vel.x * dt;
        b.pos.y += b.vel.y * dt;
        b.pos = wrapPos(b.pos);

        let hit = false;
        for (let i = rocksRef.current.length - 1; i >= 0; i--) {
          const rock = rocksRef.current[i];
          if (dist(b.pos, rock.pos) < rock.radius * 0.85) {
            destroyRock(rock, rocksRef.current);
            spawnParticles(b.pos, 5, COLORS.pinkBright, 80);
            hit = true;
            break;
          }
        }
        if (!hit) aliveBullets.push(b);
      }
      bulletsRef.current = aliveBullets;

      if (now >= invincibleUntilRef.current) {
        for (const rock of rocksRef.current) {
          if (dist(playerPosRef.current, rock.pos) < rock.radius * 0.75 + 8) {
            const ddx = playerPosRef.current.x - rock.pos.x;
            const ddy = playerPosRef.current.y - rock.pos.y;
            const dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
            playerVelRef.current.x += (ddx / dd) * 200;
            playerVelRef.current.y += (ddy / dd) * 200;
            handlePlayerHit();
            break;
          }
        }
      }

      for (const p of particlesRef.current) {
        p.pos.x += p.vel.x * dt;
        p.pos.y += p.vel.y * dt;
        p.vel.x *= 0.96;
        p.vel.y *= 0.96;
        p.life -= dt / p.maxLife;
      }
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      draw();
      rafRef.current = requestAnimationFrame(gameLoop);
    }

    const handleKey = (e: KeyboardEvent) => {
      const k = e.key === ' ' ? 'Space' : e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', ' ', 'Space'].includes(e.key) || k === 'Space') {
        e.preventDefault();
        keysRef.current.add(k === 'Space' ? ' ' : e.key);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
      keysRef.current.delete(' ');
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKeyUp);
    rafRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKeyUp);
      if (missTimerRef.current) clearTimeout(missTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const s = Math.min(cw / W, ch / H);
      scaleRef.current = s;
      if (canvasRef.current) {
        canvasRef.current.width = Math.round(W * s);
        canvasRef.current.height = Math.round(H * s);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const tx = t.clientX;
      if (tx < cx - 30) keysRef.current.add('ArrowLeft');
      else if (tx > cx + 30) keysRef.current.add('ArrowRight');
      keysRef.current.add('ArrowUp');
    }
    if (e.touches.length === 2) {
      const now = Date.now();
      if (now - lastFireRef.current >= FIRE_COOLDOWN) {
        lastFireRef.current = now;
        const angle = playerAngleRef.current;
        bulletsRef.current.push({
          id: nextId++,
          pos: {
            x: playerPosRef.current.x + Math.cos(angle) * 16,
            y: playerPosRef.current.y + Math.sin(angle) * 16,
          },
          vel: {
            x: Math.cos(angle) * BULLET_SPEED + playerVelRef.current.x,
            y: Math.sin(angle) * BULLET_SPEED + playerVelRef.current.y,
          },
          born: now,
        });
      }
    }
  };

  const handleTouchEnd = () => {
    keysRef.current.delete('ArrowLeft');
    keysRef.current.delete('ArrowRight');
    keysRef.current.delete('ArrowUp');
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-black flex flex-col items-center justify-center select-none overflow-hidden">
      <canvas
        ref={canvasRef}
        className="touch-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ display: 'block', imageRendering: 'pixelated' }}
      />
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-6 pointer-events-none md:hidden opacity-50">
        <span className="text-cyan-400 text-xs font-mono">← → rotate · ↑ thrust · SPACE fire</span>
      </div>
    </div>
  );
});

Debris.displayName = 'Debris';
export default Debris;
