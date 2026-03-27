import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { GameHandle } from '../lib/gameTypes';

if (typeof window !== 'undefined') {
  window.onerror = (msg, src, line, col, err) => {
    console.error('GLOBAL ERROR:', msg, 'at', line + ':' + col, err);
  };

  window.onunhandledrejection = (e) => {
    console.error('PROMISE ERROR:', e.reason);
  };
}

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
  spawnTime: number;
}

interface Bullet {
  id: number;
  pos: Vec2;
  vel: Vec2;
  born: number;
  history: Vec2[];
}

interface Particle {
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface ScoreFloater {
  id: number;
  pos: Vec2;
  text: string;
  multText: string;
  born: number;
  duration: number;
}

interface CoreFlash {
  pos: Vec2;
  born: number;
  duration: number;
}

interface Ufo {
  pos: Vec2;
  vel: Vec2;
  passIndex: number;
  amplitude: number;
  baseY: number;
  phaseOffset: number;
  startX: number;
  alive: boolean;
}

interface DebrisProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
  debugMode?: boolean;
  onQuit?: () => void;
}

const W = 800;
const H = 600;
const MAX_SCORE = 2000;
const BULLET_SPEED = 480;
const BULLET_LIFE = 3000;
const FIRE_COOLDOWN = 80;
const PLAYER_MAX_SPEED = 200;
const THRUST_ACCEL = 250;
const FRICTION = 0.994;
const ROTATE_SPEED = 3.5;
const INVINCIBLE_MS = 1500;
const TOTAL_LIVES = 3;
const MAX_LIVES = 10;
const WRAP_MARGIN = 80;
const UFO_SCORE = 400;
const UFO_SPEED = 160;
const UFO_PASSES = 3;
const UFO_FIRE_INTERVAL = 2200;
const UFO_BULLET_SPEED = 220;
const BULLET_HISTORY_LEN = 6;
const ROCK_SPAWN_FADE_MS = 200;

const ROCK_RADII = { large: 46, medium: 28, small: 14 };
const ROCK_POINTS = { large: 50, medium: 100, small: 200 };

const COLORS = {
  bg: '#000000',
  cyan: '#22d3ee',
  cyanDim: 'rgba(34,211,238,0.15)',
  cyanMid: 'rgba(34,211,238,0.5)',
  magenta: '#f0f',
  magentaDim: 'rgba(255,0,255,0.18)',
  pink: '#f472b6',
  pinkBright: '#ff6ec7',
  red: '#ef4444',
  ufoRed: '#ff2020',
  ufoRedDim: 'rgba(255,32,32,0.2)',
  white: '#e0f7ff',
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
    spawnTime: Date.now(),
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

const Debris = forwardRef<GameHandle, DebrisProps>(({ onScoreUpdate, onComplete, debugMode, onQuit }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scoreRef = useRef(0);
  const livesRef = useRef(TOTAL_LIVES);
  type GameState =
    | { type: 'playing'; wave: number }
    | { type: 'ufo'; passesDone: number }
    | { type: 'transition'; nextWave: number }
    | { type: 'gameover' };

  const gameStateRef = useRef<GameState>({ type: 'playing', wave: 1 });

  const playerPosRef = useRef<Vec2>({ x: W / 2, y: H / 2 });
  const playerVelRef = useRef<Vec2>({ x: 0, y: 0 });
  const playerAngleRef = useRef(0);
  const invincibleUntilRef = useRef(Date.now() + INVINCIBLE_MS);

  const rocksRef = useRef<Rock[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scoreFloatersRef = useRef<ScoreFloater[]>([]);
  const coreFlashesRef = useRef<CoreFlash[]>([]);
  const ufoRef = useRef<Ufo | null>(null);
  const ufoPassesCompletedRef = useRef(0);
  const ufoSoundPlayingRef = useRef(false);
  const ufoTriggeredRef = useRef(false);

  const ufoBulletsRef = useRef<Bullet[]>([]);
  const lastUfoFireRef = useRef(0);

  const keysRef = useRef<Set<string>>(new Set());
  const fireQueueRef = useRef(0);
  const lastFireRef = useRef(0);
  const lastFrameRef = useRef(0);
  const rafRef = useRef(0);

  const waveRef = useRef(1);
  const waveStartRef = useRef(Date.now());
  const comboRef = useRef(0);
  const lastShotHitRef = useRef(true);
  const multiplierRef = useRef(1.0);
  const missTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMultiplierRef = useRef(1.0);
  const multPulseRef = useRef(0);

  const rocksTotalDestroyedRef = useRef(0);
  const sectorClearedRef = useRef(0);
  const transitionTimerRef = useRef<number | null>(null);

  const scaleRef = useRef(1);

  const shakeRef = useRef({ offsetX: 0, offsetY: 0, endTime: 0, maxDisp: 0, duration: 0 });
  const hitFlashRef = useRef({ opacity: 0, endTime: 0 });

  const doneRef = useRef(false);
  const gameOverRef = useRef(false);

  const shootSoundRef = useRef<HTMLAudioElement | null>(null);
  const disappearSoundRef = useRef<HTMLAudioElement | null>(null);
  const ufoSoundRef = useRef<HTMLAudioElement | null>(null);
  const boostSoundRef = useRef<HTMLAudioElement | null>(null);
  const coinSoundRef = useRef<HTMLAudioElement | null>(null);
  const boostSoundPlayingRef = useRef(false);
  const touchHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartTimeRef = useRef(0);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const onScoreUpdateRef = useRef(onScoreUpdate);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onScoreUpdateRef.current = onScoreUpdate; }, [onScoreUpdate]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score: Math.round(scoreRef.current), maxScore: MAX_SCORE }),
    onGameEnd: () => {
      cancelAnimationFrame(rafRef.current);
      doneRef.current = true;
      stopAllSounds();
    },
    hideTimer: true,
    canSkipQuestion: false,
  }));

  function spawnUfo(passIndex: number) {
    const fromLeft = passIndex % 2 === 0;
    const baseY = H * 0.2 + Math.random() * H * 0.6;
    ufoRef.current = {
      pos: { x: fromLeft ? -60 : W + 60, y: baseY },
      vel: { x: fromLeft ? UFO_SPEED : -UFO_SPEED, y: 0 },
      passIndex,
      amplitude: 80 + Math.random() * 60,
      baseY,
      phaseOffset: Math.random() * Math.PI * 2,
      startX: fromLeft ? -60 : W + 60,
      alive: true,
    };
    if (!ufoSoundPlayingRef.current && ufoSoundRef.current) {
      ufoSoundRef.current.play().catch(() => {});
      ufoSoundPlayingRef.current = true;
    }
  }

  function setGameState(next: GameState): boolean {
    const prev = gameStateRef.current;
    gameStateRef.current = next;

    console.log('STATE CHANGE:', prev.type, '→', next.type, next);

    if (prev.type === 'ufo') {
      stopUfoSound();
      ufoRef.current = null;
      ufoBulletsRef.current = [];
    }

    if (next.type === 'ufo') {
      rocksRef.current = [];
      ufoPassesCompletedRef.current = 0;
      spawnUfo(0);
      lastUfoFireRef.current = Date.now() + 1000;
    }

    if (next.type === 'transition') {
      stopAllSounds();
      sectorClearedRef.current = Date.now();
    }

    if (next.type === 'playing') {
      console.log('setGameState playing, spawning rocks for wave:', next.wave);
      ufoTriggeredRef.current = false;
      rocksRef.current = spawnWaveRocks(next.wave, 1.3);
      console.log('Rocks spawned, count:', rocksRef.current.length);
      waveRef.current = next.wave;
      waveStartRef.current = Date.now();
    }

    if (next.type === 'gameover') {
      console.trace('setGameState gameover');
      stopAllSounds();
      cancelAnimationFrame(rafRef.current);
      doneRef.current = true;
    }

    return true;
  }

  function stopUfoSound() {
    if (ufoSoundRef.current) {
      ufoSoundRef.current.pause();
      ufoSoundRef.current.currentTime = 0;
      ufoSoundPlayingRef.current = false;
    }
  }

  function stopAllSounds() {
    stopUfoSound();
    if (boostSoundRef.current) {
      boostSoundRef.current.pause();
      boostSoundRef.current.currentTime = 0;
      boostSoundPlayingRef.current = false;
    }
    if (shootSoundRef.current) {
      shootSoundRef.current.pause();
      shootSoundRef.current.currentTime = 0;
    }
    if (disappearSoundRef.current) {
      disappearSoundRef.current.pause();
      disappearSoundRef.current.currentTime = 0;
    }
  }

  useEffect(() => {
    shootSoundRef.current = new Audio('/sounds/global/SoundShootRegularOptimized.mp3');
    disappearSoundRef.current = new Audio('/sounds/global/disappear_Normalized.mp3');
    ufoSoundRef.current = new Audio('/sounds/global/ufo_normalized.mp3');
    boostSoundRef.current = new Audio('/sounds/global/BoostNormalized.mp3');
    if (ufoSoundRef.current) {
      ufoSoundRef.current.loop = true;
      ufoSoundRef.current.volume = 0.6;
    }
    if (boostSoundRef.current) {
      boostSoundRef.current.loop = true;
      boostSoundRef.current.volume = 0.35;
    }
    coinSoundRef.current = new Audio('/sounds/global/SoundCoin.mp3');
    if (coinSoundRef.current) coinSoundRef.current.volume = 0.7;
    if (shootSoundRef.current) shootSoundRef.current.volume = 0.45;
    if (disappearSoundRef.current) disappearSoundRef.current.volume = 0.7;
    return () => { stopUfoSound(); };
  }, []);

  useEffect(() => {
    console.log('🎮 DEBRIS MOUNTED');
    return () => {
      console.warn('🚨 DEBRIS UNMOUNTED - doneRef:', doneRef.current, 'rafRef:', rafRef.current);
    };
  }, []);

  useEffect(() => {
    rocksRef.current = spawnWaveRocks(1, 1);
    waveStartRef.current = Date.now();
    invincibleUntilRef.current = Date.now() + INVINCIBLE_MS;

    window.addEventListener('error', (e) => {
      console.error('GLOBAL ERROR:', e.error);
    });

    window.addEventListener('unhandledrejection', (e) => {
      console.error('PROMISE ERROR:', e.reason);
    });

    function playSound(audio: HTMLAudioElement | null) {
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }

    function safe(label: string, fn: () => void) {
      try {
        return fn();
      } catch (err) {
        console.error('CRASH in ' + label, err);
        return undefined;
      }
    }

    function addScore(pts: number) {
      const earned = Math.round(pts * multiplierRef.current);
      scoreRef.current = Math.min(scoreRef.current + earned, MAX_SCORE * 3);
      onScoreUpdateRef.current?.(Math.round(scoreRef.current), MAX_SCORE);
    }

    function triggerShake(maxDisp: number, duration: number) {
      const now = Date.now();
      shakeRef.current = { offsetX: 0, offsetY: 0, endTime: now + duration, maxDisp, duration };
    }

    function triggerHitFlash() {
      hitFlashRef.current = { opacity: 0.4, endTime: Date.now() + 200 };
    }

    function spawnExplosionParticles(pos: Vec2, rockSize: 'large' | 'medium' | 'small') {
      const sizeScale = rockSize === 'large' ? 1.0 : rockSize === 'medium' ? 0.8 : 0.6;
      const count = Math.round((40 + Math.random() * 20) * sizeScale);
      const maxRadius = (300 + Math.random() * 100) * sizeScale;
      const minSpeed = 200 * sizeScale;
      const maxSpeed = 400 * sizeScale;

      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = minSpeed + Math.random() * (maxSpeed - minSpeed);
        const sz = 2 + Math.random() * 4;
        const life = 0.15 + Math.random() * 0.25;
        particlesRef.current.push({
          pos: { ...pos },
          vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
          life: 1,
          maxLife: life,
          color: '#00ffff',
          size: sz,
        });
      }

      const sparkCount = Math.round(12 * sizeScale);
      for (let i = 0; i < sparkCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 150 + Math.random() * 200;
        particlesRef.current.push({
          pos: { ...pos },
          vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
          life: 1,
          maxLife: 0.4 + Math.random() * 0.3,
          color: '#ffffff',
          size: 1.5 + Math.random() * 2.5,
        });
      }

      coreFlashesRef.current.push({ pos: { ...pos }, born: Date.now(), duration: 100 });
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

    function spawnScoreFloater(pos: Vec2, pts: number, mult: number) {
      const now = Date.now();
      const text = `+${pts * Math.round(mult)}`;
      const multText = mult > 1.05 ? `x${mult.toFixed(1)}` : '';
      if (scoreFloatersRef.current.length >= 10) scoreFloatersRef.current.shift();
      scoreFloatersRef.current.push({
        id: nextId++,
        pos: { x: pos.x + (Math.random() - 0.5) * 20, y: pos.y },
        text,
        multText,
        born: now,
        duration: 800,
      });
    }

    function destroyRock(rock: Rock, rocks: Rock[]) {
      const idx = rocks.findIndex(r => r.id === rock.id);
      if (idx !== -1) rocks.splice(idx, 1);

      const pts = ROCK_POINTS[rock.size];
      addScore(pts);
      spawnExplosionParticles(rock.pos, rock.size);
      spawnScoreFloater(rock.pos, pts, multiplierRef.current);

      if (rock.size === 'large') {
        const r1 = spawnRock('medium', { ...rock.pos });
        const r2 = spawnRock('medium', { ...rock.pos });
        rocks.push(r1);
        rocks.push(r2);
        rocksTotalDestroyedRef.current++;
      } else if (rock.size === 'medium') {
        const r1 = spawnRock('small', { ...rock.pos });
        const r2 = spawnRock('small', { ...rock.pos });
        rocks.push(r1);
        rocks.push(r2);
      } else {
        rocksTotalDestroyedRef.current++;
      }

      comboRef.current++;
      const newMult = 1.0 + Math.floor(comboRef.current / 10) * 0.1;
      if (newMult > multiplierRef.current) {
        multPulseRef.current = Date.now();
      }
      multiplierRef.current = newMult;
      if (missTimerRef.current) clearTimeout(missTimerRef.current);
      lastShotHitRef.current = true;
    }

    function triggerUfoPhase(): boolean {
      if (gameStateRef.current.type !== 'playing') return false;
      return setGameState({ type: 'ufo', passesDone: 0 });
    }

    function clearSafeZone() {
      const safeRadius = 140;
      const cx = W / 2, cy = H / 2;
      for (const rock of rocksRef.current) {
        if (dist(rock.pos, { x: cx, y: cy }) < safeRadius) {
          const edge = Math.floor(Math.random() * 4);
          const off = rock.radius + WRAP_MARGIN + 5;
          if (edge === 0) { rock.pos.x = Math.random() * W; rock.pos.y = -off; }
          else if (edge === 1) { rock.pos.x = W + off; rock.pos.y = Math.random() * H; }
          else if (edge === 2) { rock.pos.x = Math.random() * W; rock.pos.y = H + off; }
          else { rock.pos.x = -off; rock.pos.y = Math.random() * H; }
          const targetX = W * 0.25 + Math.random() * W * 0.5;
          const targetY = H * 0.25 + Math.random() * H * 0.5;
          const ddx = targetX - rock.pos.x, ddy = targetY - rock.pos.y;
          const a = Math.atan2(ddy, ddx);
          const spd2 = Math.sqrt(rock.vel.x ** 2 + rock.vel.y ** 2) || 60;
          rock.vel.x = Math.cos(a) * spd2;
          rock.vel.y = Math.sin(a) * spd2;
        }
      }
    }

    function handlePlayerHit() {
      console.warn('🎯 PLAYER HIT DETECTED', {
        lives: livesRef.current,
        invincibleUntil: invincibleUntilRef.current,
        now: Date.now(),
        gameState: gameStateRef.current.type
      });
      if (Date.now() < invincibleUntilRef.current) return;
      livesRef.current--;
      spawnParticles(playerPosRef.current, 24, COLORS.red, 200);
      playSound(disappearSoundRef.current);
      invincibleUntilRef.current = Date.now() + INVINCIBLE_MS;
      comboRef.current = 0;
      multiplierRef.current = 1.0;
      triggerShake(30, 150);
      triggerHitFlash();

      playerPosRef.current = { x: W / 2, y: H / 2 };
      playerVelRef.current = { x: 0, y: 0 };
      clearSafeZone();

      if (livesRef.current <= 0 && !doneRef.current) {
        gameOverRef.current = true;
        console.trace('GAME OVER CALLED FROM handlePlayerHit');
        setGameState({ type: 'gameover' });
        setTimeout(() => {
          console.log('🔥 onComplete fired from handlePlayerHit:', scoreRef.current, MAX_SCORE, 0);
          onCompleteRef.current?.(scoreRef.current, MAX_SCORE, 0);
        }, 500);
      }
    }

    function fire() {
      const now = Date.now();
      if (now - lastFireRef.current < FIRE_COOLDOWN) return;
      lastFireRef.current = now;

      const angle = playerAngleRef.current;
      const startPos = {
        x: playerPosRef.current.x + Math.cos(angle) * 16,
        y: playerPosRef.current.y + Math.sin(angle) * 16,
      };
      bulletsRef.current.push({
        id: nextId++,
        pos: startPos,
        vel: {
          x: Math.cos(angle) * BULLET_SPEED + playerVelRef.current.x,
          y: Math.sin(angle) * BULLET_SPEED + playerVelRef.current.y,
        },
        born: now,
        history: [{ ...startPos }],
      });

      playSound(shootSoundRef.current);

      lastShotHitRef.current = false;
      if (missTimerRef.current) clearTimeout(missTimerRef.current);
      missTimerRef.current = setTimeout(() => {
        if (!lastShotHitRef.current) {
          comboRef.current = 0;
          multiplierRef.current = 1.0;
        }
      }, 2200);
    }

    function drawUfo(ctx: CanvasRenderingContext2D, ufo: Ufo) {
      const { pos } = ufo;
      const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 80);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      ctx.beginPath();
      ctx.ellipse(0, 4, 28, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.ufoRedDim;
      ctx.shadowColor = COLORS.ufoRed;
      ctx.shadowBlur = 18 * pulse;
      ctx.fill();
      ctx.strokeStyle = COLORS.ufoRed;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, -2, 16, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,60,60,0.25)';
      ctx.strokeStyle = COLORS.ufoRed;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(0, -2, 6, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,180,180,${0.4 * pulse})`;
      ctx.fill();

      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(i * 8, 8, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,80,80,${0.6 * pulse})`;
        ctx.shadowBlur = 10;
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }

    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const s = scaleRef.current;
      const now = Date.now();

      const shake = shakeRef.current;
      let shakeX = 0;
      let shakeY = 0;
      if (now < shake.endTime) {
        const elapsed = shake.duration - (shake.endTime - now);
        const t = elapsed / shake.duration;
        const displacement = Math.sin(t * Math.PI) * shake.maxDisp;
        shakeX = displacement;
        shakeY = displacement * 0.7;
      }

      ctx.setTransform(s, 0, 0, s, shakeX * s, shakeY * s);

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

      for (const rock of rocksRef.current || []) {
        try {
          if (!rock || !rock.pos || !rock.vertices || rock.vertices.length === 0) {
            if (rock) console.warn('BAD ROCK', rock);
            continue;
          }
          const age = now - rock.spawnTime;
          if (typeof age !== 'number' || !isFinite(age)) {
            console.warn('Bad rock age:', age, rock);
            continue;
          }
          const fadeAlpha = Math.min(1.0, age / ROCK_SPAWN_FADE_MS);
          const glowAlpha = age < 100 ? (1 - age / 100) : 0;

          ctx.save();
          ctx.globalAlpha = fadeAlpha;
          if (typeof rock.pos.x === 'number' && typeof rock.pos.y === 'number' && isFinite(rock.pos.x) && isFinite(rock.pos.y)) {
            ctx.translate(rock.pos.x, rock.pos.y);
          } else {
            ctx.restore();
            console.warn('Bad rock position:', rock.pos);
            continue;
          }
          ctx.rotate(rock.angle);
          ctx.beginPath();
          if (rock.vertices[0] && typeof rock.vertices[0].x === 'number' && typeof rock.vertices[0].y === 'number') {
            ctx.moveTo(rock.vertices[0].x, rock.vertices[0].y);
            for (let i = 1; i < rock.vertices.length; i++) {
              if (rock.vertices[i] && typeof rock.vertices[i].x === 'number' && typeof rock.vertices[i].y === 'number') {
                ctx.lineTo(rock.vertices[i].x, rock.vertices[i].y);
              }
            }
            ctx.closePath();

            if (glowAlpha > 0) {
              ctx.shadowColor = '#00ffff';
              ctx.shadowBlur = 16 * glowAlpha;
            } else {
              ctx.shadowColor = COLORS.cyan;
              ctx.shadowBlur = 8;
            }

            ctx.strokeStyle = COLORS.cyan;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.fillStyle = COLORS.cyanDim;
            ctx.fill();
          }
          ctx.restore();
        } catch (e) {
          console.warn('Error drawing rock:', e, rock);
          ctx.restore();
        }
      }

      for (const flash of coreFlashesRef.current || []) {
        try {
          if (!flash || !flash.pos || !flash.duration || flash.duration <= 0) continue;
          const age = now - flash.born;
          if (typeof age !== 'number' || !isFinite(age)) continue;
          const t = age / flash.duration;
          if (t >= 1) continue;
          const alpha = 1 - t;
          const radius = 30 + t * 20;
          ctx.save();
          ctx.globalAlpha = alpha * 0.9;
          if (typeof flash.pos.x === 'number' && typeof flash.pos.y === 'number' && isFinite(flash.pos.x) && isFinite(flash.pos.y)) {
            const grad = ctx.createRadialGradient(flash.pos.x, flash.pos.y, 0, flash.pos.x, flash.pos.y, radius);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.3, 'rgba(0,255,255,0.8)');
            grad.addColorStop(1, 'rgba(0,255,255,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(flash.pos.x, flash.pos.y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } catch (e) {
          console.warn('Error drawing flash:', e, flash);
          ctx.restore();
        }
      }
      coreFlashesRef.current = (coreFlashesRef.current || []).filter(f => f && now - f.born < f.duration);

      if (ufoRef.current?.alive) {
        drawUfo(ctx, ufoRef.current);
      }

      for (const b of bulletsRef.current || []) {
        try {
          if (!b || !b.pos) continue;
          if (!b.history) b.history = [];
          if (b.history.length >= 2) {
            for (let i = 1; i < b.history.length; i++) {
              const t = i / b.history.length;
              const prev = b.history[i - 1];
              const curr = b.history[i];
              if (!prev || !curr || typeof prev.x !== 'number' || typeof curr.x !== 'number') continue;
              const segDx = curr.x - prev.x;
              const segDy = curr.y - prev.y;
              if (segDx * segDx + segDy * segDy > 120 * 120) continue;
              const alpha = t * 0.85;
              const lineWidth = 2 + t * 4;
              ctx.beginPath();
              ctx.moveTo(prev.x, prev.y);
              ctx.lineTo(curr.x, curr.y);
              ctx.strokeStyle = `rgba(255,0,255,${alpha})`;
              ctx.lineWidth = lineWidth;
              ctx.lineCap = 'round';
              ctx.stroke();
            }
          }

          if (typeof b.pos.x === 'number' && typeof b.pos.y === 'number' && isFinite(b.pos.x) && isFinite(b.pos.y)) {
            ctx.beginPath();
            ctx.arc(b.pos.x, b.pos.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = COLORS.pinkBright;
            ctx.shadowColor = COLORS.pinkBright;
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        } catch (e) {
          console.warn('Error drawing bullet:', e, b);
        }
      }

      for (const b of ufoBulletsRef.current || []) {
        try {
          if (!b || !b.pos) continue;
          if (!b.history) b.history = [];
          if (b.history.length >= 2) {
            for (let i = 1; i < b.history.length; i++) {
              const t = i / b.history.length;
              const prev = b.history[i - 1];
              const curr = b.history[i];
              if (!prev || !curr || typeof prev.x !== 'number' || typeof curr.x !== 'number') continue;
              const segDx = curr.x - prev.x;
              const segDy = curr.y - prev.y;
              if (segDx * segDx + segDy * segDy > 120 * 120) continue;
              ctx.beginPath();
              ctx.moveTo(prev.x, prev.y);
              ctx.lineTo(curr.x, curr.y);
              ctx.strokeStyle = `rgba(255,32,32,${t * 0.7})`;
              ctx.lineWidth = 1.5 + t * 3;
              ctx.lineCap = 'round';
              ctx.stroke();
            }
          }

          if (typeof b.pos.x === 'number' && typeof b.pos.y === 'number' && isFinite(b.pos.x) && isFinite(b.pos.y)) {
            ctx.beginPath();
            ctx.arc(b.pos.x, b.pos.y, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = COLORS.ufoRed;
            ctx.shadowColor = COLORS.ufoRed;
            ctx.shadowBlur = 14;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        } catch (e) {
          console.warn('Error drawing UFO bullet:', e, b);
        }
      }

      for (const p of particlesRef.current || []) {
        try {
          if (!p || !p.pos || typeof p.life !== 'number' || !p.color || typeof p.size !== 'number') continue;
          const lifeT = Math.max(0, p.life);
          ctx.globalAlpha = lifeT;
          const easedSize = p.size * (0.5 + 0.5 * lifeT);
          if (typeof p.pos.x === 'number' && typeof p.pos.y === 'number' && isFinite(p.pos.x) && isFinite(p.pos.y)) {
            ctx.beginPath();
            ctx.arc(p.pos.x, p.pos.y, easedSize, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 4;
            ctx.fill();
          }
        } catch (e) {
          console.warn('Error drawing particle:', e, p);
        }
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      const invincible = now < invincibleUntilRef.current;
      if (!gameOverRef.current && playerPosRef.current) {
        try {
          const px = playerPosRef.current.x;
          const py = playerPosRef.current.y;
          const pa = playerAngleRef.current;

          if (typeof px !== 'number' || typeof py !== 'number' || !isFinite(px) || !isFinite(py)) {
            console.warn('Bad player position:', px, py);
          } else {
            const thrusting = keysRef.current.has('ArrowUp') || keysRef.current.has('w');
            const speed = Math.sqrt(playerVelRef.current.x ** 2 + playerVelRef.current.y ** 2);
            const velocityRatio = Math.min(speed / PLAYER_MAX_SPEED, 1);

            if (!invincible || Math.floor(now / 120) % 2 === 0) {
              ctx.save();
              ctx.translate(px, py);
              ctx.rotate(pa);

          if (thrusting && velocityRatio > 0) {
            const thrustAlpha = 0.4 + velocityRatio * 0.6;
            const thrustRadius = 18 + velocityRatio * 14;
            const r = Math.round(0 + velocityRatio * 255);
            const g = Math.round(255 - velocityRatio * 100);
            const glowGrad = ctx.createRadialGradient(-8, 0, 0, -8, 0, thrustRadius);
            glowGrad.addColorStop(0, `rgba(${r},${g},255,${thrustAlpha})`);
            glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.beginPath();
            ctx.arc(-8, 0, thrustRadius, 0, Math.PI * 2);
            ctx.fillStyle = glowGrad;
            ctx.fill();
          }

          const shipColor = invincible ? COLORS.yellow : COLORS.magenta;
          ctx.shadowColor = shipColor;
          ctx.shadowBlur = invincible ? 20 : 16;
          ctx.strokeStyle = shipColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(18, 0);
          ctx.lineTo(-12, -10);
          ctx.lineTo(-6, 0);
          ctx.lineTo(-12, 10);
          ctx.closePath();
          ctx.stroke();

          if (thrusting) {
            const r2 = Math.round(velocityRatio * 255);
            const g2 = Math.round(255 - velocityRatio * 100);
            const thrustColor = `rgb(${r2},${g2},255)`;
            ctx.strokeStyle = thrustColor;
            ctx.lineWidth = 2;
            ctx.shadowColor = thrustColor;
            ctx.shadowBlur = 16 + velocityRatio * 12;
            ctx.beginPath();
            const fl = 8 + Math.random() * 12 + velocityRatio * 8;
            ctx.moveTo(-6, -4);
            ctx.lineTo(-6 - fl, 0);
            ctx.lineTo(-6, 4);
            ctx.stroke();
          }

            ctx.restore();
            }
          }
        } catch (e) {
          console.warn('Error drawing player:', e);
        }
      }

      for (const floater of scoreFloatersRef.current || []) {
        try {
          if (!floater || !floater.pos) continue;
          const age = now - floater.born;
          if (typeof age !== 'number' || !isFinite(age)) continue;
          const t = age / floater.duration;
          if (t >= 1) continue;
          const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
          const rise = t * 70;
          const multActive = multiplierRef.current > 1.05;
          const fontSize = multActive ? 24 : 21;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.font = `bold ${fontSize}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffff00';
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = 5;
          if (typeof floater.pos.x === 'number' && typeof floater.pos.y === 'number' && isFinite(floater.pos.x) && isFinite(floater.pos.y)) {
            ctx.fillText(floater.text, floater.pos.x, floater.pos.y - rise);

            if (floater.multText) {
              ctx.font = '14px monospace';
              ctx.fillStyle = '#ffdd00';
              ctx.shadowBlur = 3;
              ctx.fillText(floater.multText, floater.pos.x + 30, floater.pos.y - rise - 12);
            }
          }

          ctx.restore();
        } catch (e) {
          console.warn('Error drawing floater:', e, floater);
          ctx.restore();
        }
      }
      scoreFloatersRef.current = (scoreFloatersRef.current || []).filter(f => f && now - f.born < f.duration);

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
        const pulseAge = now - multPulseRef.current;
        const pulseDur = 300;
        const pulseScale = pulseAge < pulseDur
          ? 1 + 0.3 * Math.sin((pulseAge / pulseDur) * Math.PI)
          : 1;

        ctx.save();
        ctx.translate(W / 2, 65);
        ctx.scale(pulseScale, pulseScale);
        ctx.font = `bold ${Math.round(14 / pulseScale)}px monospace`;
        const multAlpha = mult >= 1.3 ? 1 : 0.7 + (mult - 1.05) / 0.25 * 0.3;
        const r3 = 255;
        const g3 = Math.round(255 - (mult - 1.0) / 0.5 * 55);
        ctx.fillStyle = `rgba(${r3},${g3},0,${multAlpha})`;
        ctx.textAlign = 'center';
        ctx.shadowColor = COLORS.yellow;
        ctx.shadowBlur = 8 + (mult - 1.0) * 20;
        ctx.fillText(`${mult.toFixed(1)}x`, 0, 0);
        ctx.restore();
        ctx.shadowBlur = 0;
      }

      ctx.textAlign = 'left';
      ctx.font = '12px monospace';
      ctx.fillStyle = COLORS.cyanMid;
      ctx.fillText('LIVES', 16, 22);
      for (let i = 0; i < Math.max(lives, TOTAL_LIVES); i++) {
        const alive = i < lives;
        ctx.save();
        ctx.translate(20 + i * 28, 38);
        ctx.rotate(-Math.PI / 2);
        ctx.strokeStyle = alive ? COLORS.magenta : COLORS.gray;
        ctx.lineWidth = 1.5;
        if (alive) { ctx.shadowColor = COLORS.magenta; ctx.shadowBlur = 8; }
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-6, -6);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      ctx.textAlign = 'right';
      ctx.font = '12px monospace';
      ctx.fillStyle = COLORS.cyanMid;
      ctx.fillText('WAVE', W - 16, 22);
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = COLORS.cyan;
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 6;
      ctx.fillText(`${waveRef.current}`, W - 16, 42);
      ctx.shadowBlur = 0;

      if (gameStateRef.current.type === 'ufo') {
        const passesLeft = UFO_PASSES - ufoPassesCompletedRef.current;
        ctx.textAlign = 'right';
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = COLORS.ufoRed;
        ctx.shadowColor = COLORS.ufoRed;
        ctx.shadowBlur = 8;
        ctx.fillText(`UFO  ${passesLeft > 0 ? passesLeft + ' PASS' + (passesLeft !== 1 ? 'ES' : '') : ''}`, W - 16, 62);
        ctx.shadowBlur = 0;
      }

      const hitFlash = hitFlashRef.current;
      if (hitFlash.opacity > 0) {
        const flashAge = hitFlash.endTime - now;
        if (flashAge > 0) {
          const flashT = flashAge / 200;
          const alpha = hitFlash.opacity * flashT;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#ff0000';
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = alpha * 0.6;
          const borderW = 20;
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = borderW * 2;
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 30;
          ctx.strokeRect(0, 0, W, H);
          ctx.restore();
        } else {
          hitFlashRef.current.opacity = 0;
        }
      }

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

      if (sectorClearedRef.current > 0) {
        const age = now - sectorClearedRef.current;
        const dur = 2000;
        if (age < dur) {
          const t = age / dur;
          const alpha = t < 0.15 ? t / 0.15 : t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
          const scale = t < 0.15 ? 0.7 + 0.3 * (t / 0.15) : 1;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(W / 2, H / 2);
          ctx.scale(scale, scale);
          ctx.font = 'bold 44px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = COLORS.yellow;
          ctx.shadowColor = COLORS.yellow;
          ctx.shadowBlur = 28;
          ctx.fillText('SECTOR CLEARED', 0, 0);
          ctx.shadowBlur = 0;
          ctx.restore();
        } else {
          sectorClearedRef.current = 0;
        }
      }

      if (debugMode) {
        ctx.font = '12px monospace';
        ctx.fillStyle = COLORS.cyan;
        ctx.textAlign = 'left';
        ctx.fillText(`STATE: ${gameStateRef.current.type}`, 16, 80);
        ctx.fillText(`RAF: ${rafRef.current ? 'ACTIVE' : 'DEAD'}`, 16, 95);
      }
    }

    function resetAfterUfoPhase() {
      const nextWave = waveRef.current + 1;
      console.log('resetAfterUfoPhase called, nextWave:', nextWave);
      bulletsRef.current.length = 0;
      particlesRef.current.length = 0;
      scoreFloatersRef.current.length = 0;
      coreFlashesRef.current.length = 0;
      lastUfoFireRef.current = 0;
      transitionTimerRef.current = null;
      lastFrameRef.current = performance.now();
      setGameState({ type: 'playing', wave: nextWave });
    }

    function gameLoop(ts: number) {
      if (doneRef.current) {
        console.log('EXITING: doneRef is true');
        return;
      }

      if (!canvasRef.current) {
        console.log('No canvas, requeuing RAF');
        rafRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (Math.random() < 0.02) {
        console.log('tick', gameStateRef.current.type, 'done=', doneRef.current);
      }

      try {
        const state = gameStateRef.current;

        if (state.type === 'transition') {
          if (!transitionTimerRef.current) {
            transitionTimerRef.current = Date.now();
          }

          const elapsedMs = Date.now() - transitionTimerRef.current;
          if (elapsedMs > 1200) {
            transitionTimerRef.current = null;
            resetAfterUfoPhase();
          }

          safe('draw-transition', draw);
          rafRef.current = requestAnimationFrame(gameLoop);
          return;
        }

        if (state.type !== 'playing' && state.type !== 'ufo') {
          console.error('UNKNOWN STATE:', state.type);
          rafRef.current = requestAnimationFrame(gameLoop);
          return;
        }

        const dt = Math.min((ts - (lastFrameRef.current || ts)) / 1000, 0.05);
        lastFrameRef.current = ts;
        const keys = keysRef.current;
        const now = Date.now();

        if (keys.has('ArrowLeft') || keys.has('a')) playerAngleRef.current -= ROTATE_SPEED * dt;
        if (keys.has('ArrowRight') || keys.has('d')) playerAngleRef.current += ROTATE_SPEED * dt;

        const thrusting = keys.has('ArrowUp') || keys.has('w');
        if (thrusting) {
          playerVelRef.current.x += Math.cos(playerAngleRef.current) * THRUST_ACCEL * dt;
          playerVelRef.current.y += Math.sin(playerAngleRef.current) * THRUST_ACCEL * dt;
          if (!boostSoundPlayingRef.current && boostSoundRef.current) {
            boostSoundRef.current.currentTime = 0;
            boostSoundRef.current.play().catch(() => {});
            boostSoundPlayingRef.current = true;
          }
        } else {
          if (boostSoundPlayingRef.current && boostSoundRef.current) {
            boostSoundRef.current.pause();
            boostSoundRef.current.currentTime = 0;
            boostSoundPlayingRef.current = false;
          }
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

        while (fireQueueRef.current > 0) {
          fireQueueRef.current--;
          fire();
        }

        if (state.type === 'playing') {
          try {
            if (!rocksRef.current) rocksRef.current = [];
            if (!playerPosRef.current) {
              console.warn('Player missing, skipping playing tick');
              rafRef.current = requestAnimationFrame(gameLoop);
              return;
            }

            const elapsed = (now - waveStartRef.current) / 1000;
            let velocityBoost = 1;
            if (elapsed >= 60) velocityBoost = 1.4;
            else if (elapsed >= 40) velocityBoost = 1.25;
            else if (elapsed >= 20) velocityBoost = 1.1;

            const targetWave = elapsed >= 60 ? 4 : elapsed >= 40 ? 3 : elapsed >= 20 ? 2 : 1;
            if (targetWave > waveRef.current) {
              waveRef.current = targetWave;
              rocksRef.current.push(...spawnWaveRocks(targetWave - 1, velocityBoost));
            }

            if (rocksRef.current.length === 0) {
              rocksRef.current = spawnWaveRocks(waveRef.current, velocityBoost);
            }

            const ufoTriggerTime = debugMode ? 8 : 60;
            if (elapsed >= ufoTriggerTime && !ufoTriggeredRef.current) {
              ufoTriggeredRef.current = true;
              if (triggerUfoPhase()) {
                rafRef.current = requestAnimationFrame(gameLoop);
                return;
              }
            }

            for (let i = rocksRef.current.length - 1; i >= 0; i--) {
              const rock = rocksRef.current[i];
              if (!rock) continue;
              if (!rock.pos || !rock.vel) {
                console.warn('Bad rock object:', rock);
                continue;
              }
              rock.pos.x += rock.vel.x * dt;
              rock.pos.y += rock.vel.y * dt;
              rock.pos = wrapPos(rock.pos);
              rock.angle += rock.angularVel * dt;
            }
          } catch (e) {
            console.error('CRASH IN PLAYING STATE:', e);
            console.log('STATE SNAPSHOT:', {
              rocks: rocksRef.current?.length,
              bullets: bulletsRef.current?.length,
              player: playerPosRef.current,
              ufo: ufoRef.current,
              wave: waveRef.current
            });
            setGameState({ type: 'playing', wave: waveRef.current });
          }
        } else if (state.type === 'ufo') {
          const ufo = ufoRef.current;
          if (ufo && ufo.alive) {
            const totalDist = Math.abs(W + 120);
            const travelFrac = Math.abs(ufo.pos.x - ufo.startX) / totalDist;
            ufo.pos.x += ufo.vel.x * dt;
            ufo.pos.y = ufo.baseY + Math.sin(travelFrac * Math.PI * 3 + ufo.phaseOffset) * ufo.amplitude;

            if (now - lastUfoFireRef.current > UFO_FIRE_INTERVAL) {
              lastUfoFireRef.current = now;
              const dx = playerPosRef.current.x - ufo.pos.x;
              const dy = playerPosRef.current.y - ufo.pos.y;
              const scatter = (Math.random() - 0.5) * 0.6;
              const angle = Math.atan2(dy, dx) + scatter;
              const startPos2 = { x: ufo.pos.x, y: ufo.pos.y };
              ufoBulletsRef.current.push({
                id: nextId++,
                pos: startPos2,
                vel: { x: Math.cos(angle) * UFO_BULLET_SPEED, y: Math.sin(angle) * UFO_BULLET_SPEED },
                born: now,
                history: [{ ...startPos2 }],
              });
            }

            const offScreen = (ufo.vel.x > 0 && ufo.pos.x > W + 70) || (ufo.vel.x < 0 && ufo.pos.x < -70);
            if (offScreen) {
              ufoPassesCompletedRef.current++;
              ufoRef.current = null;

              if (ufoPassesCompletedRef.current >= UFO_PASSES) {
                if (setGameState({ type: 'transition', nextWave: waveRef.current + 1 })) {
                  rafRef.current = requestAnimationFrame(gameLoop);
                  return;
                }
              } else {
                setTimeout(() => {
                  if (!doneRef.current) {
                    spawnUfo(ufoPassesCompletedRef.current);
                  }
                }, 1800);
              }
            }
          }
        }

        const aliveBullets: Bullet[] = [];
        for (const b of bulletsRef.current || []) {
          if (!b) continue;
          if (now - b.born > BULLET_LIFE) continue;
          if (!b.pos || !b.vel) {
            console.warn('Bad bullet:', b);
            continue;
          }
          b.pos.x += b.vel.x * dt;
          b.pos.y += b.vel.y * dt;
          b.pos = wrapPos(b.pos);

          if (!b.history) b.history = [];
          b.history.push({ ...b.pos });
          if (b.history.length > BULLET_HISTORY_LEN) b.history.shift();

          let hit = false;

          const ufo = ufoRef.current;
          if (ufo && ufo.alive && dist(b.pos, ufo.pos) < 32) {
            spawnParticles(ufo.pos, 30, COLORS.ufoRed, 200);
            spawnParticles(ufo.pos, 12, COLORS.yellow, 120);
            coreFlashesRef.current.push({ pos: { ...ufo.pos }, born: now, duration: 120 });
            addScore(UFO_SCORE);
            ufo.alive = false;
            ufoRef.current = null;
            ufoPassesCompletedRef.current++;

            if (ufoPassesCompletedRef.current >= UFO_PASSES) {
              if (setGameState({ type: 'transition', nextWave: waveRef.current + 1 })) {
                rafRef.current = requestAnimationFrame(gameLoop);
                return;
              }
            } else {
              setTimeout(() => {
                if (!doneRef.current) {
                  spawnUfo(ufoPassesCompletedRef.current);
                }
              }, 1800);
            }
            hit = true;
          }

          if (!hit) {
            for (let i = rocksRef.current.length - 1; i >= 0; i--) {
              const rock = rocksRef.current[i];
              if (!rock || !rock.pos) continue;
              if (dist(b.pos, rock.pos) < rock.radius * 0.85) {
                destroyRock(rock, rocksRef.current);
                spawnParticles(b.pos, 5, COLORS.pinkBright, 80);
                hit = true;
                break;
              }
            }
          }

          if (!hit) aliveBullets.push(b);
        }
        bulletsRef.current = aliveBullets;

        const aliveUfoBullets: Bullet[] = [];
        for (const b of ufoBulletsRef.current || []) {
          if (!b) continue;
          if (now - b.born > BULLET_LIFE) continue;
          if (!b.pos || !b.vel) {
            console.warn('Bad UFO bullet:', b);
            continue;
          }
          b.pos.x += b.vel.x * dt;
          b.pos.y += b.vel.y * dt;
          b.pos = wrapPos(b.pos);

          if (!b.history) b.history = [];
          b.history.push({ ...b.pos });
          if (b.history.length > BULLET_HISTORY_LEN) b.history.shift();

          if (now >= invincibleUntilRef.current && dist(b.pos, playerPosRef.current) < 14) {
            handlePlayerHit();
          } else {
            aliveUfoBullets.push(b);
          }
        }
        ufoBulletsRef.current = aliveUfoBullets;

        if (now >= invincibleUntilRef.current) {
          for (let i = (rocksRef.current?.length || 0) - 1; i >= 0; i--) {
            const rock = rocksRef.current?.[i];
            if (!rock || !rock.pos) continue;
            if (!rock.radius) {
              console.warn('Rock missing radius:', rock);
              continue;
            }
            if (dist(playerPosRef.current, rock.pos) < rock.radius + 10) {
              const ddx = playerPosRef.current.x - rock.pos.x;
              const ddy = playerPosRef.current.y - rock.pos.y;
              const dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
              playerVelRef.current.x += (ddx / dd) * 200;
              playerVelRef.current.y += (ddy / dd) * 200;
              handlePlayerHit();
              break;
            }
          }

          const ufo = ufoRef.current;
          if (ufo && ufo.alive && ufo.pos && dist(playerPosRef.current, ufo.pos) < 36) {
            handlePlayerHit();
          }
        }

        for (const p of particlesRef.current || []) {
          if (!p || !p.pos || !p.vel) continue;
          if (!p.maxLife || p.maxLife <= 0) {
            console.warn('Bad particle:', p);
            continue;
          }
          p.pos.x += p.vel.x * dt;
          p.pos.y += p.vel.y * dt;
          p.vel.x *= 0.93;
          p.vel.y *= 0.93;
          p.life -= dt / p.maxLife;
        }
        particlesRef.current = (particlesRef.current || []).filter(p => p && p.life > 0);

        safe('draw', draw);
        console.log('About to RAF, done=', doneRef.current, 'state=', gameStateRef.current.type);
        rafRef.current = requestAnimationFrame(gameLoop);
      } catch (err) {
        console.error('GAME LOOP ERROR:', err);
        doneRef.current = false;
        rafRef.current = requestAnimationFrame(gameLoop);
      }
    }

    const handleKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if ((e.key === ' ') && !e.repeat) {
        fireQueueRef.current++;
        return;
      }
      const k = e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(k)) {
        keysRef.current.add(k);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKeyUp);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    console.log('🔄 RAF QUEUED', {
      done: doneRef.current,
      gameOver: gameOverRef.current,
      state: gameStateRef.current.type,
      rocks: rocksRef.current?.length,
      bullets: bulletsRef.current?.length,
      ufoBullets: ufoBulletsRef.current?.length,
    });
    rafRef.current = requestAnimationFrame(gameLoop);

    return () => {
      doneRef.current = true;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKeyUp);
      if (missTimerRef.current) clearTimeout(missTimerRef.current);
      if (touchHoldTimerRef.current) clearTimeout(touchHoldTimerRef.current);
      stopAllSounds();
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

  function fireBullet() {
    const now = Date.now();
    if (now - lastFireRef.current < FIRE_COOLDOWN) return;
    lastFireRef.current = now;
    const angle = playerAngleRef.current;
    const startPos = {
      x: playerPosRef.current.x + Math.cos(angle) * 16,
      y: playerPosRef.current.y + Math.sin(angle) * 16,
    };
    bulletsRef.current.push({
      id: nextId++,
      pos: startPos,
      vel: {
        x: Math.cos(angle) * BULLET_SPEED + playerVelRef.current.x,
        y: Math.sin(angle) * BULLET_SPEED + playerVelRef.current.y,
      },
      born: now,
      history: [{ ...startPos }],
    });
    if (shootSoundRef.current) {
      shootSoundRef.current.currentTime = 0;
      shootSoundRef.current.play().catch(() => {});
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;

    if (e.touches.length >= 2) {
      if (touchHoldTimerRef.current) {
        clearTimeout(touchHoldTimerRef.current);
        touchHoldTimerRef.current = null;
      }
      fireBullet();
      return;
    }

    const t = e.touches[0];
    touchStartTimeRef.current = Date.now();
    touchStartPosRef.current = { x: t.clientX, y: t.clientY };

    const tx = t.clientX;
    if (tx < cx - 40) {
      keysRef.current.add('ArrowLeft');
    } else if (tx > cx + 40) {
      keysRef.current.add('ArrowRight');
    }

    touchHoldTimerRef.current = setTimeout(() => {
      keysRef.current.add('ArrowUp');
      touchHoldTimerRef.current = null;
    }, 120);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 0) {
      const holdDuration = Date.now() - touchStartTimeRef.current;
      if (touchHoldTimerRef.current) {
        clearTimeout(touchHoldTimerRef.current);
        touchHoldTimerRef.current = null;
        if (holdDuration < 200) {
          fireBullet();
        }
      }
      keysRef.current.delete('ArrowLeft');
      keysRef.current.delete('ArrowRight');
      keysRef.current.delete('ArrowUp');
      touchStartPosRef.current = null;
    } else if (e.touches.length === 1) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const tx = e.touches[0].clientX;
      keysRef.current.delete('ArrowLeft');
      keysRef.current.delete('ArrowRight');
      if (tx < cx - 40) keysRef.current.add('ArrowLeft');
      else if (tx > cx + 40) keysRef.current.add('ArrowRight');
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const tx = e.touches[0].clientX;
      keysRef.current.delete('ArrowLeft');
      keysRef.current.delete('ArrowRight');
      if (tx < cx - 40) keysRef.current.add('ArrowLeft');
      else if (tx > cx + 40) keysRef.current.add('ArrowRight');
    }
  };

  function handleAddLife() {
    if (gameOverRef.current || doneRef.current) return;
    if (livesRef.current >= MAX_LIVES) return;
    livesRef.current++;
    if (coinSoundRef.current) {
      coinSoundRef.current.currentTime = 0;
      coinSoundRef.current.play().catch(() => {});
    }
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-black flex flex-col items-center justify-center select-none overflow-hidden" style={{ touchAction: 'none' }}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="touch-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          style={{ display: 'block', imageRendering: 'pixelated', touchAction: 'none' }}
        />
        <div
          onClick={handleAddLife}
          onTouchEnd={(e) => { e.stopPropagation(); handleAddLife(); }}
          title="Click to add a life (max 10)"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '36%',
            height: '10%',
            cursor: 'pointer',
            zIndex: 10,
          }}
        />
      </div>
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-6 pointer-events-none md:hidden opacity-50">
        <span className="text-cyan-400 text-xs font-mono">HOLD = thrust · TAP = fire · 2 fingers = fire</span>
      </div>
      {debugMode && onQuit && (
        <button
          onClick={onQuit}
          className="absolute bottom-4 right-4 px-3 py-1.5 text-xs font-mono font-bold text-red-400 border border-red-500/50 rounded bg-black/70 hover:bg-red-900/40 hover:text-red-300 hover:border-red-400 transition-colors"
          style={{ zIndex: 50 }}
        >
          QUIT
        </button>
      )}
    </div>
  );
});

Debris.displayName = 'Debris';
export default Debris;
