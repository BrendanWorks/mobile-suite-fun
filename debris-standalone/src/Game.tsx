import { useEffect, useRef, useState } from 'react';

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
  volatile: boolean;
}

interface Bullet {
  id: number;
  pos: Vec2;
  vel: Vec2;
  born: number;
  history: Vec2[];
  pierce?: number;
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
  born: number;
  duration: number;
}

interface CoreFlash {
  pos: Vec2;
  born: number;
  duration: number;
}

interface ShipChunk {
  pos: Vec2;
  vel: Vec2;
  angle: number;
  angularVel: number;
  life: number;
  maxLife: number;
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

type PowerUpType = 'rapid' | 'spread' | 'shield' | 'life';

interface PowerUp {
  id: number;
  pos: Vec2;
  vel: Vec2;
  type: PowerUpType;
  born: number;
}

interface Star {
  x: number; y: number; r: number;
  baseAlpha: number; twinkleSpeed: number; phase: number; drift: number;
}

export interface GameStats {
  wave: number;
  rocksDestroyed: number;
}

interface DebrisGameProps {
  muted: boolean;
  onToggleMute: () => void;
  onGameOver: (score: number, stats: GameStats) => void;
  onQuit: () => void;
}

const W = 800;
const H = 600;

const GRID_PATH = (() => {
  const p = new Path2D();
  for (let x = 0; x < W; x += 60) { p.moveTo(x, 0); p.lineTo(x, H); }
  for (let y = 0; y < H; y += 60) { p.moveTo(0, y); p.lineTo(W, y); }
  return p;
})();
const BULLET_SPEED = 480;
const BULLET_LIFE = 3000;
const FIRE_COOLDOWN = 80;
const RAPID_FIRE_COOLDOWN = 34;
const PLAYER_MAX_SPEED = 200;
const THRUST_ACCEL = 250;
const FRICTION = 0.994;
const ROTATE_SPEED = 3.5;
const INVINCIBLE_MS = 1500;
const TOTAL_LIVES = 5;
const MAX_LIVES = 10;
const WRAP_MARGIN = 80;
const UFO_SCORE = 400;
const UFO_SPEED = 160;
const UFO_PASSES = 3;
const UFO_FIRE_INTERVAL = 2200;
const UFO_BULLET_SPEED = 220;
const UFO_BURST_COUNT = 3;
const UFO_BURST_INTERVAL = 180;
const UFO_TRIGGER_SECONDS = 60;

const MUSIC_RATES: Record<number, number> = { 1: 1.0, 2: 1.08, 3: 1.16, 4: 1.25 };
const MUSIC_RATE_MAX = 1.4;
const BULLET_HISTORY_LEN = 4;
const ROCK_SPAWN_FADE_MS = 200;

const ROCK_RADII = { large: 46, medium: 28, small: 14 };
const ROCK_POINTS = { large: 50, medium: 100, small: 200 };

const POWERUP_RADIUS = 14;
const POWERUP_LIFETIME = 9000;
const POWERUP_BUFF_DURATION = 9000;
const SHIELD_DURATION = 6000;
const POWERUP_DROP_CHANCE = { large: 0.22, medium: 0.14, small: 0.05 };

const VOLATILE_CHANCE = 0.15;
const VOLATILE_COLOR = '#fb923c';
const VOLATILE_COLOR_DIM = 'rgba(251,146,60,0.18)';
const VOLATILE_BLAST_RADIUS = 95;
const VOLATILE_CHAIN_DEPTH_CAP = 5;

const MAX_PARTICLES = 160;

const DASH_DISTANCE = 130;
const DASH_IFRAME_MS = 350;
const DASH_COOLDOWN_MS = 3200;
const DASH_KICK_SPEED = 60;

const SHIELD_REGEN_KILLS = 20;

const COLORS = {
  bg: '#000000',
  cyan: '#22d3ee',
  cyanDim: 'rgba(34,211,238,0.15)',
  cyanMid: 'rgba(34,211,238,0.5)',
  magenta: '#f0f',
  pink: '#f472b6',
  pinkBright: '#ff6ec7',
  ufoRed: '#ff2020',
  ufoRedDim: 'rgba(255,32,32,0.2)',
  white: '#e0f7ff',
  yellow: '#fbbf24',
  green: '#4ade80',
  gray: '#334155',
};

const POWERUP_COLORS: Record<PowerUpType, string> = {
  rapid: COLORS.yellow,
  spread: COLORS.pinkBright,
  shield: COLORS.cyan,
  life: COLORS.green,
};

const POWERUP_LABELS: Record<PowerUpType, string> = {
  rapid: 'RAPID FIRE',
  spread: 'SPREAD SHOT',
  shield: 'SHIELD',
  life: 'EXTRA LIFE',
};

type UpgradeId = 'turnRate' | 'engine' | 'reload' | 'pierce' | 'shieldRegen' | 'heal' | 'dashCooldown';

interface UpgradeDef {
  id: UpgradeId;
  label: string;
  desc: string;
  color: string;
  maxStacks: number;
}

const UPGRADE_DEFS: UpgradeDef[] = [
  { id: 'turnRate', label: 'GYROSCOPE', desc: '+18% turn rate', color: COLORS.cyan, maxStacks: 3 },
  { id: 'engine', label: 'ENGINE UPGRADE', desc: '+15% thrust & top speed', color: COLORS.pinkBright, maxStacks: 3 },
  { id: 'reload', label: 'AUTOLOADER', desc: '-15% weapon cooldown', color: COLORS.yellow, maxStacks: 3 },
  { id: 'pierce', label: 'PIERCING ROUNDS', desc: 'shots punch through +1 rock', color: '#a78bfa', maxStacks: 3 },
  { id: 'shieldRegen', label: 'SHIELD CAPACITOR', desc: `auto-shield every ${SHIELD_REGEN_KILLS} kills`, color: COLORS.cyan, maxStacks: 1 },
  { id: 'heal', label: 'HULL REPAIR', desc: '+1 life now', color: COLORS.green, maxStacks: 99 },
  { id: 'dashCooldown', label: 'THRUSTER COOLING', desc: '-20% dash cooldown', color: COLORS.pinkBright, maxStacks: 3 },
];

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
  const spread = Math.PI * 0.15;
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
    volatile: !pos && size === 'large' && Math.random() < VOLATILE_CHANCE,
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

function initStars(): Star[] {
  const stars: Star[] = [];
  const count = 90;
  for (let i = 0; i < count; i++) {
    const layer = Math.random() < 0.55 ? 0 : Math.random() < 0.85 ? 1 : 2;
    stars.push({
      x: Math.random() * (W + WRAP_MARGIN * 2) - WRAP_MARGIN,
      y: Math.random() * (H + WRAP_MARGIN * 2) - WRAP_MARGIN,
      r: layer === 0 ? 0.5 + Math.random() * 0.5 : layer === 1 ? 0.9 + Math.random() * 0.7 : 1.3 + Math.random() * 1.0,
      baseAlpha: layer === 0 ? 0.2 + Math.random() * 0.2 : layer === 1 ? 0.35 + Math.random() * 0.25 : 0.5 + Math.random() * 0.35,
      twinkleSpeed: 0.4 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      drift: (layer + 1) * (4 + Math.random() * 4),
    });
  }
  return stars;
}

// Fixed-size ring buffer, not push/filter, so an explosion never triggers a
// burst of object allocation or a per-frame array copy (both are real
// stutter sources on mobile GC). Dead slots just have life <= 0.
function initParticlePool(): Particle[] {
  return Array.from({ length: MAX_PARTICLES }, () => ({
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    life: 0,
    maxLife: 1,
    color: '#000',
    size: 1,
  }));
}

export default function DebrisGame({ muted, onToggleMute, onGameOver, onQuit }: DebrisGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [paused, setPaused] = useState(false);
  const [draftOptions, setDraftOptions] = useState<UpgradeDef[] | null>(null);

  const scoreRef = useRef(0);
  const livesRef = useRef(TOTAL_LIVES);
  type GameState =
    | { type: 'playing'; wave: number }
    | { type: 'ufo'; passesDone: number }
    | { type: 'transition'; nextWave: number }
    | { type: 'draft'; nextWave: number; options: UpgradeDef[] }
    | { type: 'gameover' };

  const gameStateRef = useRef<GameState>({ type: 'playing', wave: 1 });

  const playerPosRef = useRef<Vec2>({ x: W / 2, y: H / 2 });
  const playerVelRef = useRef<Vec2>({ x: 0, y: 0 });
  const playerAngleRef = useRef(0);
  const invincibleUntilRef = useRef(Date.now() + INVINCIBLE_MS);
  const playerVisibleRef = useRef(true);

  const rocksRef = useRef<Rock[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>(initParticlePool());
  const particleCursorRef = useRef(0);
  const scoreFloatersRef = useRef<ScoreFloater[]>([]);
  const coreFlashesRef = useRef<CoreFlash[]>([]);
  const shipChunksRef = useRef<ShipChunk[]>([]);
  const powerupsRef = useRef<PowerUp[]>([]);
  const starsRef = useRef<Star[]>(initStars());
  const ufoRef = useRef<Ufo | null>(null);
  const ufoPassesCompletedRef = useRef(0);
  const ufoSoundPlayingRef = useRef(false);
  const ufoTriggeredRef = useRef(false);
  const ufoBurstRef = useRef<{ count: number; lastShot: number } | null>(null);

  const ufoBulletsRef = useRef<Bullet[]>([]);
  const lastUfoFireRef = useRef(0);

  const rapidUntilRef = useRef(0);
  const spreadUntilRef = useRef(0);
  const shieldUntilRef = useRef(0);

  const hitstopUntilRef = useRef(0);

  const turnRateMultRef = useRef(1);
  const engineMultRef = useRef(1);
  const fireCooldownMultRef = useRef(1);
  const pierceCountRef = useRef(0);
  const shieldRegenOwnedRef = useRef(false);
  const killsSinceShieldRef = useRef(0);
  const dashCooldownMultRef = useRef(1);
  const upgradeStacksRef = useRef<Partial<Record<UpgradeId, number>>>({});
  const pickUpgradeRef = useRef<(id: UpgradeId) => void>(() => {});

  const dashQueueRef = useRef(0);
  const lastDashRef = useRef(-DASH_COOLDOWN_MS);

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
  const multPulseRef = useRef(0);

  const rocksTotalDestroyedRef = useRef(0);
  const sectorClearedRef = useRef(0);
  const transitionTimerRef = useRef<number | null>(null);

  const scaleRef = useRef(1);

  const shakeRef = useRef({ offsetX: 0, offsetY: 0, endTime: 0, maxDisp: 0, duration: 0 });
  const hitFlashRef = useRef({ opacity: 0, endTime: 0 });

  const pausedRef = useRef(false);
  const mutedRef = useRef(muted);
  const doneRef = useRef(false);
  const gameOverRef = useRef(false);

  const shootSoundRef = useRef<HTMLAudioElement | null>(null);
  const disappearSoundRef = useRef<HTMLAudioElement | null>(null);
  const ufoSoundRef = useRef<HTMLAudioElement | null>(null);
  const boostSoundRef = useRef<HTMLAudioElement | null>(null);
  const coinSoundRef = useRef<HTMLAudioElement | null>(null);
  const pickupSoundRef = useRef<HTMLAudioElement | null>(null);
  const explosionPoolRef = useRef<HTMLAudioElement[]>([]);
  const explosionPoolIdxRef = useRef(0);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicPlayingRef = useRef(false);
  const boostSoundPlayingRef = useRef(false);

  const onGameOverRef = useRef(onGameOver);
  const onQuitRef = useRef(onQuit);
  const onToggleMuteRef = useRef(onToggleMute);
  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);
  useEffect(() => { onQuitRef.current = onQuit; }, [onQuit]);
  useEffect(() => { onToggleMuteRef.current = onToggleMute; }, [onToggleMute]);
  useEffect(() => {
    mutedRef.current = muted;
    const audios = [
      musicRef.current, ufoSoundRef.current, boostSoundRef.current,
      shootSoundRef.current, disappearSoundRef.current, coinSoundRef.current,
      pickupSoundRef.current, ...explosionPoolRef.current,
    ];
    for (const a of audios) {
      if (a) a.muted = muted;
    }
  }, [muted]);

  function togglePause() {
    if (doneRef.current) return;
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (next) {
      musicRef.current?.pause();
      ufoSoundRef.current?.pause();
      boostSoundRef.current?.pause();
      boostSoundPlayingRef.current = false;
    } else {
      lastFrameRef.current = performance.now();
      if (!mutedRef.current) {
        if (musicPlayingRef.current) musicRef.current?.play().catch(() => {});
        if (ufoSoundPlayingRef.current) ufoSoundRef.current?.play().catch(() => {});
      }
    }
  }

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
    if (!ufoSoundPlayingRef.current && ufoSoundRef.current && !mutedRef.current) {
      ufoSoundRef.current.play().catch(() => {});
      ufoSoundPlayingRef.current = true;
    } else if (!ufoSoundPlayingRef.current) {
      ufoSoundPlayingRef.current = true;
    }
  }

  function setGameState(next: GameState): boolean {
    const prev = gameStateRef.current;
    gameStateRef.current = next;

    if (prev.type === 'ufo') {
      stopUfoSound();
      ufoRef.current = null;
      ufoBulletsRef.current = [];
      ufoBurstRef.current = null;
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
      ufoTriggeredRef.current = false;
      rocksRef.current = spawnWaveRocks(next.wave, 1.3);
      waveRef.current = next.wave;
      waveStartRef.current = Date.now();

      if (musicRef.current) {
        musicRef.current.playbackRate = MUSIC_RATES[1];
        if (!musicPlayingRef.current) {
          musicRef.current.currentTime = 0;
          if (!mutedRef.current) musicRef.current.play().catch(() => {});
          musicPlayingRef.current = true;
        }
      }
    }

    if (next.type === 'gameover') {
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
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.currentTime = 0;
      musicPlayingRef.current = false;
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
    pickupSoundRef.current = new Audio('/sounds/global/SoundCoin.mp3');
    explosionPoolRef.current = Array.from({ length: 5 }, () => new Audio('/sounds/debris/Explosion_Normalized.mp3'));
    musicRef.current = new Audio('/sounds/global/debris_music.mp3');
    if (musicRef.current) {
      musicRef.current.loop = true;
      musicRef.current.volume = 0.5;
    }
    if (coinSoundRef.current) coinSoundRef.current.volume = 0.7;
    if (pickupSoundRef.current) pickupSoundRef.current.volume = 0.55;
    if (shootSoundRef.current) shootSoundRef.current.volume = 0.45;
    if (disappearSoundRef.current) disappearSoundRef.current.volume = 0.7;

    const allAudio = [
      shootSoundRef.current, disappearSoundRef.current, ufoSoundRef.current, boostSoundRef.current,
      coinSoundRef.current, pickupSoundRef.current, musicRef.current, ...explosionPoolRef.current,
    ];
    for (const a of allAudio) {
      if (a) a.muted = mutedRef.current;
    }

    return () => { stopUfoSound(); };
  }, []);

  useEffect(() => {
    rocksRef.current = spawnWaveRocks(1, 1);
    waveStartRef.current = Date.now();
    invincibleUntilRef.current = Date.now() + INVINCIBLE_MS;

    if (musicRef.current) {
      musicRef.current.playbackRate = MUSIC_RATES[1];
      if (!mutedRef.current) musicRef.current.play().catch(() => {});
      musicPlayingRef.current = true;
    }

    function playSound(audio: HTMLAudioElement | null) {
      if (!audio || mutedRef.current) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }

    function playExplosion(volume: number) {
      if (mutedRef.current) return;
      const pool = explosionPoolRef.current;
      if (!pool.length) return;
      const a = pool[explosionPoolIdxRef.current];
      explosionPoolIdxRef.current = (explosionPoolIdxRef.current + 1) % pool.length;
      try {
        a.currentTime = 0;
        a.volume = volume;
        a.playbackRate = 0.9 + Math.random() * 0.25;
        a.play().catch(() => {});
      } catch { /* ignore */ }
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
      scoreRef.current += earned;
    }

    function triggerShake(maxDisp: number, duration: number) {
      const now = Date.now();
      shakeRef.current = { offsetX: 0, offsetY: 0, endTime: now + duration, maxDisp, duration };
    }

    function triggerHitFlash() {
      hitFlashRef.current = { opacity: 0.4, endTime: Date.now() + 200 };
    }

    function triggerHitstop(ms: number) {
      hitstopUntilRef.current = Math.max(hitstopUntilRef.current, Date.now() + ms);
    }

    function allocParticle(): Particle {
      const arr = particlesRef.current;
      const p = arr[particleCursorRef.current];
      particleCursorRef.current = (particleCursorRef.current + 1) % arr.length;
      return p;
    }

    function setParticle(p: Particle, pos: Vec2, vx: number, vy: number, maxLife: number, color: string, size: number) {
      p.pos.x = pos.x;
      p.pos.y = pos.y;
      p.vel.x = vx;
      p.vel.y = vy;
      p.life = 1;
      p.maxLife = maxLife;
      p.color = color;
      p.size = size;
    }

    function spawnExplosionParticles(pos: Vec2, rockSize: 'large' | 'medium' | 'small') {
      const sizeScale = rockSize === 'large' ? 1.0 : rockSize === 'medium' ? 0.8 : 0.6;
      const count = Math.round((18 + Math.random() * 10) * sizeScale);
      const minSpeed = 200 * sizeScale;
      const maxSpeed = 400 * sizeScale;

      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = minSpeed + Math.random() * (maxSpeed - minSpeed);
        setParticle(
          allocParticle(), pos,
          Math.cos(a) * s, Math.sin(a) * s,
          0.15 + Math.random() * 0.25, '#00ffff', 2 + Math.random() * 4,
        );
      }

      const sparkCount = Math.round(5 * sizeScale);
      for (let i = 0; i < sparkCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 150 + Math.random() * 200;
        setParticle(
          allocParticle(), pos,
          Math.cos(a) * s, Math.sin(a) * s,
          0.4 + Math.random() * 0.3, '#ffffff', 1.5 + Math.random() * 2.5,
        );
      }

      coreFlashesRef.current.push({ pos: { ...pos }, born: Date.now(), duration: 100 });
      playExplosion(rockSize === 'large' ? 0.55 : rockSize === 'medium' ? 0.45 : 0.35);
    }

    function spawnParticles(pos: Vec2, count: number, color: string, speed = 120) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.9);
        setParticle(
          allocParticle(), pos,
          Math.cos(a) * s, Math.sin(a) * s,
          0.6 + Math.random() * 0.6, color, 1.5 + Math.random() * 2,
        );
      }
    }

    function spawnScoreFloater(pos: Vec2, pts: number) {
      const now = Date.now();
      const text = `+${pts}`;
      if (scoreFloatersRef.current.length >= 10) scoreFloatersRef.current.shift();
      scoreFloatersRef.current.push({
        id: nextId++,
        pos: { x: pos.x + (Math.random() - 0.5) * 20, y: pos.y },
        text,
        born: now,
        duration: 1200,
      });
    }

    function spawnShipChunks(pos: Vec2) {
      const chunkCount = 6;
      for (let i = 0; i < chunkCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 150 + Math.random() * 250;
        shipChunksRef.current.push({
          pos: { ...pos },
          vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
          angle: Math.random() * Math.PI * 2,
          angularVel: (3 + Math.random() * 4) * randomSign(),
          life: 1,
          maxLife: 0.8 + Math.random() * 0.4,
        });
      }
    }

    function maybeSpawnPowerUp(rock: Rock) {
      const chance = POWERUP_DROP_CHANCE[rock.size];
      if (Math.random() >= chance) return;
      const roll = Math.random();
      let type: PowerUpType = roll < 0.35 ? 'rapid' : roll < 0.65 ? 'spread' : roll < 0.87 ? 'shield' : 'life';
      if (type === 'life' && livesRef.current >= MAX_LIVES) type = 'shield';
      powerupsRef.current.push({
        id: nextId++,
        pos: { ...rock.pos },
        vel: { x: rock.vel.x * 0.12, y: rock.vel.y * 0.12 },
        type,
        born: Date.now(),
      });
    }

    function collectPowerUp(type: PowerUpType) {
      const now = Date.now();
      spawnParticles(playerPosRef.current, 18, POWERUP_COLORS[type], 170);
      playSound(pickupSoundRef.current);
      if (type === 'rapid') {
        rapidUntilRef.current = Math.max(rapidUntilRef.current, now) + POWERUP_BUFF_DURATION;
      } else if (type === 'spread') {
        spreadUntilRef.current = Math.max(spreadUntilRef.current, now) + POWERUP_BUFF_DURATION;
      } else if (type === 'shield') {
        shieldUntilRef.current = Math.max(shieldUntilRef.current, now) + SHIELD_DURATION;
      } else if (type === 'life') {
        if (livesRef.current < MAX_LIVES) livesRef.current++;
      }
    }

    function destroyRock(rock: Rock, rocks: Rock[], chainDepth = 0) {
      const idx = rocks.findIndex(r => r.id === rock.id);
      if (idx !== -1) rocks.splice(idx, 1);

      const pts = ROCK_POINTS[rock.size];
      addScore(pts);
      spawnExplosionParticles(rock.pos, rock.size);
      spawnScoreFloater(rock.pos, pts);
      maybeSpawnPowerUp(rock);

      if (rock.size === 'large') {
        rocks.push(spawnRock('medium', { ...rock.pos }));
        rocks.push(spawnRock('medium', { ...rock.pos }));
        rocksTotalDestroyedRef.current++;
      } else if (rock.size === 'medium') {
        rocks.push(spawnRock('small', { ...rock.pos }));
        rocks.push(spawnRock('small', { ...rock.pos }));
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

      const baseHitstop = rock.size === 'large' ? 45 : rock.size === 'medium' ? 25 : 10;

      if (shieldRegenOwnedRef.current) {
        killsSinceShieldRef.current++;
        if (killsSinceShieldRef.current >= SHIELD_REGEN_KILLS) {
          killsSinceShieldRef.current = 0;
          shieldUntilRef.current = Math.max(shieldUntilRef.current, Date.now()) + SHIELD_DURATION;
        }
      }

      if (rock.volatile) {
        spawnParticles(rock.pos, 36, VOLATILE_COLOR, 300);
        coreFlashesRef.current.push({ pos: { ...rock.pos }, born: Date.now(), duration: 160 });
        triggerShake(chainDepth === 0 ? 20 : 10, 170);
        triggerHitstop(Math.max(baseHitstop, chainDepth === 0 ? 55 : 30));
        playExplosion(0.7);

        if (chainDepth < VOLATILE_CHAIN_DEPTH_CAP) {
          const nearby = rocks.filter(r => dist(r.pos, rock.pos) < VOLATILE_BLAST_RADIUS);
          for (const nr of nearby) {
            destroyRock(nr, rocks, chainDepth + 1);
          }
        }
      } else {
        triggerHitstop(baseHitstop);
      }
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
      const now = Date.now();
      if (now < invincibleUntilRef.current) return;
      if (now < shieldUntilRef.current) {
        spawnParticles(playerPosRef.current, 20, COLORS.cyan, 200);
        shieldUntilRef.current = now - 1;
        triggerHitFlash();
        return;
      }
      livesRef.current--;
      playerVisibleRef.current = false;
      spawnShipChunks(playerPosRef.current);
      playSound(disappearSoundRef.current);
      invincibleUntilRef.current = Date.now() + INVINCIBLE_MS;
      comboRef.current = 0;
      multiplierRef.current = 1.0;
      triggerShake(30, 150);
      triggerHitFlash();

      setTimeout(() => {
        playerVisibleRef.current = true;
      }, 800);

      playerPosRef.current = { x: W / 2, y: H / 2 };
      playerVelRef.current = { x: 0, y: 0 };
      clearSafeZone();

      if (livesRef.current <= 0 && !doneRef.current) {
        gameOverRef.current = true;
        setGameState({ type: 'gameover' });
        setTimeout(() => {
          onGameOverRef.current?.(Math.round(scoreRef.current), {
            wave: waveRef.current,
            rocksDestroyed: rocksTotalDestroyedRef.current,
          });
        }, 2200);
      }
    }

    function fire() {
      const now = Date.now();
      const baseCooldown = now < rapidUntilRef.current ? RAPID_FIRE_COOLDOWN : FIRE_COOLDOWN;
      const cooldown = baseCooldown * fireCooldownMultRef.current;
      if (now - lastFireRef.current < cooldown) return;
      lastFireRef.current = now;

      const baseAngle = playerAngleRef.current;
      const spreadActive = now < spreadUntilRef.current;
      const angles = spreadActive ? [baseAngle - 0.22, baseAngle, baseAngle + 0.22] : [baseAngle];

      for (const angle of angles) {
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
          pierce: pierceCountRef.current,
        });
      }

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

    function tryDash() {
      const now = Date.now();
      const cooldown = DASH_COOLDOWN_MS * dashCooldownMultRef.current;
      if (now - lastDashRef.current < cooldown) return;
      if (gameStateRef.current.type !== 'playing' && gameStateRef.current.type !== 'ufo') return;
      lastDashRef.current = now;

      const angle = playerAngleRef.current;
      spawnParticles(playerPosRef.current, 16, COLORS.pinkBright, 140);

      const endPos = wrapPos({
        x: playerPosRef.current.x + Math.cos(angle) * DASH_DISTANCE,
        y: playerPosRef.current.y + Math.sin(angle) * DASH_DISTANCE,
      });
      playerPosRef.current = endPos;
      playerVelRef.current.x += Math.cos(angle) * DASH_KICK_SPEED;
      playerVelRef.current.y += Math.sin(angle) * DASH_KICK_SPEED;
      invincibleUntilRef.current = Math.max(invincibleUntilRef.current, now + DASH_IFRAME_MS);

      spawnParticles(endPos, 16, COLORS.pinkBright, 140);
      triggerShake(6, 80);
    }

    function applyUpgrade(id: UpgradeId) {
      upgradeStacksRef.current[id] = (upgradeStacksRef.current[id] || 0) + 1;
      if (id === 'turnRate') turnRateMultRef.current *= 1.18;
      else if (id === 'engine') engineMultRef.current *= 1.15;
      else if (id === 'reload') fireCooldownMultRef.current *= 0.85;
      else if (id === 'pierce') pierceCountRef.current += 1;
      else if (id === 'shieldRegen') shieldRegenOwnedRef.current = true;
      else if (id === 'heal') livesRef.current = Math.min(livesRef.current + 1, MAX_LIVES);
      else if (id === 'dashCooldown') dashCooldownMultRef.current *= 0.8;
    }

    function rollUpgradeOptions(): UpgradeDef[] {
      const eligible = UPGRADE_DEFS.filter(u => (upgradeStacksRef.current[u.id] || 0) < u.maxStacks);
      const pool = eligible.length >= 3 ? eligible : UPGRADE_DEFS;
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 3);
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

      ctx.shadowBlur = 0;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(i * 8, 8, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,80,80,${0.6 * pulse})`;
        ctx.fill();
      }

      ctx.restore();
    }

    function drawPowerUp(ctx: CanvasRenderingContext2D, p: PowerUp, now: number) {
      const age = now - p.born;
      const remain = POWERUP_LIFETIME - age;
      if (remain <= 0) return;
      const fadeIn = Math.min(1, age / 200);
      const fadeOut = remain < 1200 ? Math.max(0, remain / 1200) : 1;
      const blink = remain < 1200 ? (Math.floor(now / 100) % 2 === 0 ? 1 : 0.3) : 1;
      const alpha = fadeIn * fadeOut * blink;
      if (alpha <= 0) return;
      const pulse = 0.85 + 0.15 * Math.sin(now / 200);
      const color = POWERUP_COLORS[p.type];

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.pos.x, p.pos.y);
      ctx.scale(pulse, pulse);

      ctx.beginPath();
      ctx.arc(0, 0, POWERUP_RADIUS + 4, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.stroke();

      ctx.save();
      ctx.shadowBlur = 0;
      ctx.rotate(now / 900);
      ctx.beginPath();
      ctx.arc(0, 0, POWERUP_RADIUS + 4, 0, Math.PI * 1.3);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.shadowBlur = 6;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (p.type === 'rapid') {
        ctx.beginPath();
        ctx.moveTo(2, -8); ctx.lineTo(-4, 1); ctx.lineTo(0, 1); ctx.lineTo(-2, 8); ctx.lineTo(5, -1); ctx.lineTo(1, -1);
        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'spread') {
        for (const a of [-0.5, 0, 0.5]) {
          ctx.save();
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(0, 4);
          ctx.lineTo(0, -7);
          ctx.stroke();
          ctx.restore();
        }
      } else if (p.type === 'shield') {
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(6, -4);
        ctx.lineTo(6, 3);
        ctx.lineTo(0, 8);
        ctx.lineTo(-6, 3);
        ctx.lineTo(-6, -4);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
        ctx.moveTo(0, -6); ctx.lineTo(0, 6);
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawBuffBar(ctx: CanvasRenderingContext2D, index: number, type: PowerUpType, remain: number, total: number) {
      const y = H - 20 - index * 18;
      const color = POWERUP_COLORS[type];
      ctx.save();
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.fillText(POWERUP_LABELS[type], 16, y);
      const barX = 118, barW = 60, barH = 6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, y - 8, barW, barH);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(barX, y - 8, barW * Math.max(0, Math.min(1, remain / total)), barH);
      ctx.restore();
    }

    function drawDashIndicator(ctx: CanvasRenderingContext2D, now: number) {
      const cooldown = DASH_COOLDOWN_MS * dashCooldownMultRef.current;
      const elapsed = now - lastDashRef.current;
      const ready = elapsed >= cooldown;
      const frac = Math.max(0, Math.min(1, elapsed / cooldown));
      const x = W - 16, y = H - 20;
      const barW = 60, barH = 6;
      const barX = x - barW;

      ctx.save();
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = ready ? COLORS.pinkBright : 'rgba(255,110,199,0.4)';
      ctx.shadowColor = COLORS.pinkBright;
      ctx.shadowBlur = ready ? 6 : 0;
      ctx.fillText(ready ? 'DASH READY' : 'DASH', x, y);
      ctx.strokeStyle = COLORS.pinkBright;
      ctx.globalAlpha = ready ? 1 : 0.5;
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, y - 8, barW, barH);
      ctx.fillStyle = COLORS.pinkBright;
      ctx.globalAlpha = ready ? 0.9 : 0.5;
      ctx.fillRect(barX, y - 8, barW * frac, barH);
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

      for (const star of starsRef.current) {
        const alpha = star.baseAlpha * (0.55 + 0.45 * Math.sin(now / 1000 * star.twinkleSpeed + star.phase));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224,247,255,${Math.max(0, alpha)})`;
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(34,211,238,0.04)';
      ctx.lineWidth = 1;
      ctx.stroke(GRID_PATH);

      for (const rock of rocksRef.current || []) {
        try {
          if (!rock || !rock.pos || !rock.vertices || rock.vertices.length === 0) continue;
          const age = now - rock.spawnTime;
          if (typeof age !== 'number' || !isFinite(age)) continue;
          const fadeAlpha = Math.min(1.0, age / ROCK_SPAWN_FADE_MS);
          const glowAlpha = age < 100 ? (1 - age / 100) : 0;

          ctx.save();
          ctx.globalAlpha = fadeAlpha;
          if (typeof rock.pos.x === 'number' && typeof rock.pos.y === 'number' && isFinite(rock.pos.x) && isFinite(rock.pos.y)) {
            ctx.translate(rock.pos.x, rock.pos.y);
          } else {
            ctx.restore();
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

            const volatilePulse = rock.volatile ? 0.7 + 0.3 * Math.sin(now / 160) : 1;
            const strokeColor = rock.volatile ? VOLATILE_COLOR : COLORS.cyan;
            const fillColor = rock.volatile ? VOLATILE_COLOR_DIM : COLORS.cyanDim;

            if (glowAlpha > 0) {
              ctx.shadowColor = rock.volatile ? VOLATILE_COLOR : '#00ffff';
              ctx.shadowBlur = 16 * glowAlpha;
            } else if (rock.volatile) {
              ctx.shadowColor = strokeColor;
              ctx.shadowBlur = 6 * volatilePulse;
            } else {
              ctx.shadowBlur = 0;
            }

            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = rock.volatile ? 2 : 1.5;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.fillStyle = fillColor;
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
          ctx.globalAlpha = alpha * 0.55;
          if (typeof flash.pos.x === 'number' && typeof flash.pos.y === 'number' && isFinite(flash.pos.x) && isFinite(flash.pos.y)) {
            ctx.beginPath();
            ctx.arc(flash.pos.x, flash.pos.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = '#00ffff';
            ctx.fill();
            ctx.globalAlpha = alpha * 0.9;
            ctx.beginPath();
            ctx.arc(flash.pos.x, flash.pos.y, radius * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          }
          ctx.restore();
        } catch (e) {
          console.warn('Error drawing flash:', e, flash);
          ctx.restore();
        }
      }
      coreFlashesRef.current = (coreFlashesRef.current || []).filter(f => f && now - f.born < f.duration);

      for (const chunk of shipChunksRef.current || []) {
        try {
          if (!chunk || !chunk.pos) continue;
          const lifeT = Math.max(0, chunk.life);
          ctx.save();
          ctx.globalAlpha = lifeT;
          ctx.translate(chunk.pos.x, chunk.pos.y);
          ctx.rotate(chunk.angle);
          ctx.strokeStyle = COLORS.magenta;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = COLORS.magenta;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(6, 0);
          ctx.lineTo(-4, -3);
          ctx.lineTo(-2, 0);
          ctx.lineTo(-4, 3);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        } catch (e) {
          console.warn('Error drawing ship chunk:', e, chunk);
          ctx.restore();
        }
      }

      if (ufoRef.current?.alive) {
        drawUfo(ctx, ufoRef.current);
      }

      for (const p of powerupsRef.current || []) {
        try { drawPowerUp(ctx, p, now); } catch (e) { console.warn('Error drawing powerup:', e); }
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
            ctx.fill();
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
            ctx.fill();
          }
        } catch (e) {
          console.warn('Error drawing UFO bullet:', e, b);
        }
      }

      for (const p of particlesRef.current) {
        if (p.life <= 0) continue;
        try {
          if (!isFinite(p.pos.x) || !isFinite(p.pos.y)) continue;
          const lifeT = p.life;
          ctx.globalAlpha = lifeT;
          const easedSize = p.size * (0.5 + 0.5 * lifeT);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.pos.x - easedSize / 2, p.pos.y - easedSize / 2, easedSize, easedSize);
        } catch (e) {
          console.warn('Error drawing particle:', e, p);
        }
      }
      ctx.globalAlpha = 1;

      const invincible = now < invincibleUntilRef.current;
      const shielded = now < shieldUntilRef.current;
      if (!gameOverRef.current && playerVisibleRef.current && playerPosRef.current) {
        try {
          const px = playerPosRef.current.x;
          const py = playerPosRef.current.y;
          const pa = playerAngleRef.current;

          if (typeof px !== 'number' || typeof py !== 'number' || !isFinite(px) || !isFinite(py)) {
            // skip invalid state
          } else {
            const thrusting = keysRef.current.has('ArrowUp') || keysRef.current.has('w');
            const speed = Math.sqrt(playerVelRef.current.x ** 2 + playerVelRef.current.y ** 2);
            const velocityRatio = Math.min(speed / PLAYER_MAX_SPEED, 1);

            if (!invincible || Math.floor(now / 120) % 2 === 0) {
              ctx.save();
              ctx.translate(px, py);
              ctx.rotate(pa);

              if (shielded) {
                const shieldPulse = 0.8 + 0.2 * Math.sin(now / 120);
                ctx.save();
                ctx.rotate(-pa);
                ctx.beginPath();
                ctx.arc(0, 0, 22 * shieldPulse, 0, Math.PI * 2);
                ctx.strokeStyle = COLORS.cyan;
                ctx.lineWidth = 1.5;
                ctx.shadowColor = COLORS.cyan;
                ctx.shadowBlur = 12;
                ctx.globalAlpha = 0.7;
                ctx.stroke();
                ctx.restore();
              }

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

          let scale = 1;
          let alpha = 1;

          if (t < 0.3) {
            scale = 0.6 + (t / 0.3) * 0.4;
            alpha = (t / 0.3) * 0.8;
          } else if (t < 0.8) {
            scale = 1;
            alpha = 0.8;
          } else {
            alpha = 0.8 * (1 - (t - 0.8) / 0.2);
          }

          const rise = t * 50;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(floater.pos.x, floater.pos.y - rise);
          ctx.scale(scale, scale);
          ctx.font = `bold 21px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffff00';
          ctx.fillText(floater.text, 0, 0);
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

      let buffIndex = 0;
      if (now < rapidUntilRef.current) drawBuffBar(ctx, buffIndex++, 'rapid', rapidUntilRef.current - now, POWERUP_BUFF_DURATION);
      if (now < spreadUntilRef.current) drawBuffBar(ctx, buffIndex++, 'spread', spreadUntilRef.current - now, POWERUP_BUFF_DURATION);
      if (now < shieldUntilRef.current) drawBuffBar(ctx, buffIndex++, 'shield', shieldUntilRef.current - now, SHIELD_DURATION);

      drawDashIndicator(ctx, now);

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
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 40;
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
        ctx.fillStyle = COLORS.yellow;
        ctx.textAlign = 'center';
        ctx.shadowColor = COLORS.yellow;
        ctx.shadowBlur = 30;
        ctx.fillText('GAME OVER', W / 2, H / 2 - 20);
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

      if (gameStateRef.current.type === 'draft') {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, W, H);
      }

      if (pausedRef.current) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
      }
    }

    function resetAfterUfoPhase(nextWave: number) {
      bulletsRef.current.length = 0;
      for (const p of particlesRef.current) p.life = 0;
      scoreFloatersRef.current.length = 0;
      coreFlashesRef.current.length = 0;
      lastUfoFireRef.current = 0;
      transitionTimerRef.current = null;
      lastFrameRef.current = performance.now();
      setGameState({ type: 'playing', wave: nextWave });
    }

    pickUpgradeRef.current = (id: UpgradeId) => {
      const state = gameStateRef.current;
      if (state.type !== 'draft') return;
      applyUpgrade(id);
      setDraftOptions(null);
      resetAfterUfoPhase(state.nextWave);
    };

    function gameLoop(ts: number) {
      if (doneRef.current) {
        return;
      }

      if (!canvasRef.current) {
        rafRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      try {
        if (pausedRef.current) {
          lastFrameRef.current = ts;
          safe('draw-paused', draw);
          rafRef.current = requestAnimationFrame(gameLoop);
          return;
        }

        if (Date.now() < hitstopUntilRef.current) {
          lastFrameRef.current = ts;
          safe('draw-hitstop', draw);
          rafRef.current = requestAnimationFrame(gameLoop);
          return;
        }

        const state = gameStateRef.current;

        if (state.type === 'transition') {
          if (!transitionTimerRef.current) {
            transitionTimerRef.current = Date.now();
          }

          const elapsedMs = Date.now() - transitionTimerRef.current;
          if (elapsedMs > 1200) {
            transitionTimerRef.current = null;
            sectorClearedRef.current = 0;
            const nextWave = waveRef.current + 1;
            const options = rollUpgradeOptions();
            setDraftOptions(options);
            setGameState({ type: 'draft', nextWave, options });
          }

          safe('draw-transition', draw);
          rafRef.current = requestAnimationFrame(gameLoop);
          return;
        }

        if (state.type === 'draft') {
          lastFrameRef.current = ts;
          safe('draw-draft', draw);
          rafRef.current = requestAnimationFrame(gameLoop);
          return;
        }

        if (state.type !== 'playing' && state.type !== 'ufo') {
          rafRef.current = requestAnimationFrame(gameLoop);
          return;
        }

        const dt = Math.min((ts - (lastFrameRef.current || ts)) / 1000, 0.05);
        lastFrameRef.current = ts;
        const keys = keysRef.current;
        const now = Date.now();

        for (const star of starsRef.current) {
          star.x -= star.drift * dt;
          if (star.x < -WRAP_MARGIN) star.x += W + WRAP_MARGIN * 2;
        }

        if (keys.has('ArrowLeft') || keys.has('a')) playerAngleRef.current -= ROTATE_SPEED * turnRateMultRef.current * dt;
        if (keys.has('ArrowRight') || keys.has('d')) playerAngleRef.current += ROTATE_SPEED * turnRateMultRef.current * dt;

        const thrusting = keys.has('ArrowUp') || keys.has('w');
        if (thrusting) {
          playerVelRef.current.x += Math.cos(playerAngleRef.current) * THRUST_ACCEL * engineMultRef.current * dt;
          playerVelRef.current.y += Math.sin(playerAngleRef.current) * THRUST_ACCEL * engineMultRef.current * dt;
          if (!boostSoundPlayingRef.current && boostSoundRef.current && !mutedRef.current) {
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

        const maxSpeed = PLAYER_MAX_SPEED * engineMultRef.current;
        const spd = Math.sqrt(playerVelRef.current.x ** 2 + playerVelRef.current.y ** 2);
        if (spd > maxSpeed) {
          const scale = maxSpeed / spd;
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
        while (dashQueueRef.current > 0) {
          dashQueueRef.current--;
          tryDash();
        }

        if (state.type === 'playing') {
          try {
            if (!rocksRef.current) rocksRef.current = [];

            const elapsed = (now - waveStartRef.current) / 1000;
            let velocityBoost = 1;
            if (elapsed >= 60) velocityBoost = 1.4;
            else if (elapsed >= 40) velocityBoost = 1.25;
            else if (elapsed >= 20) velocityBoost = 1.1;

            const targetWave = elapsed >= 60 ? 4 : elapsed >= 40 ? 3 : elapsed >= 20 ? 2 : 1;
            if (targetWave > waveRef.current) {
              waveRef.current = targetWave;
              rocksRef.current.push(...spawnWaveRocks(targetWave - 1, velocityBoost));
              if (musicRef.current) {
                const rate = MUSIC_RATES[targetWave] ?? Math.min(1.0 + (targetWave - 1) * 0.08, MUSIC_RATE_MAX);
                musicRef.current.playbackRate = rate;
              }
            }

            if (rocksRef.current.length === 0) {
              rocksRef.current = spawnWaveRocks(waveRef.current, velocityBoost);
            }

            if (elapsed >= UFO_TRIGGER_SECONDS && !ufoTriggeredRef.current) {
              ufoTriggeredRef.current = true;
              if (triggerUfoPhase()) {
                rafRef.current = requestAnimationFrame(gameLoop);
                return;
              }
            }

            for (let i = rocksRef.current.length - 1; i >= 0; i--) {
              const rock = rocksRef.current[i];
              if (!rock || !rock.pos || !rock.vel) continue;
              rock.pos.x += rock.vel.x * dt;
              rock.pos.y += rock.vel.y * dt;
              rock.pos = wrapPos(rock.pos);
              rock.angle += rock.angularVel * dt;
            }
          } catch (e) {
            console.error('CRASH IN PLAYING STATE:', e);
            setGameState({ type: 'playing', wave: waveRef.current });
          }
        } else if (state.type === 'ufo') {
          const ufo = ufoRef.current;
          if (ufo && ufo.alive) {
            const totalDist = Math.abs(W + 120);
            const travelFrac = Math.abs(ufo.pos.x - ufo.startX) / totalDist;
            ufo.pos.x += ufo.vel.x * dt;
            ufo.pos.y = ufo.baseY + Math.sin(travelFrac * Math.PI * 3 + ufo.phaseOffset) * ufo.amplitude;

            if (!ufoBurstRef.current && now - lastUfoFireRef.current > UFO_FIRE_INTERVAL) {
              ufoBurstRef.current = { count: 0, lastShot: now - UFO_BURST_INTERVAL };
              lastUfoFireRef.current = now;
            }

            if (ufoBurstRef.current && now - ufoBurstRef.current.lastShot >= UFO_BURST_INTERVAL) {
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
              ufoBurstRef.current.count++;
              ufoBurstRef.current.lastShot = now;
              if (ufoBurstRef.current.count >= UFO_BURST_COUNT) {
                ufoBurstRef.current = null;
              }
            }

            const offScreen = (ufo.vel.x > 0 && ufo.pos.x > W + 70) || (ufo.vel.x < 0 && ufo.pos.x < -70);
            if (offScreen && !doneRef.current) {
              ufoPassesCompletedRef.current++;
              ufoRef.current = null;
              ufoBurstRef.current = null;

              if (ufoPassesCompletedRef.current >= UFO_PASSES && gameStateRef.current.type === 'ufo') {
                setGameState({ type: 'transition', nextWave: waveRef.current + 1 });
                rafRef.current = requestAnimationFrame(gameLoop);
                return;
              } else if (ufoPassesCompletedRef.current < UFO_PASSES) {
                setTimeout(() => {
                  if (!doneRef.current) spawnUfo(ufoPassesCompletedRef.current);
                }, 1800);
              }
            }
          }
        }

        const aliveBullets: Bullet[] = [];
        for (const b of bulletsRef.current || []) {
          if (!b) continue;
          if (now - b.born > BULLET_LIFE) continue;
          if (!b.pos || !b.vel) continue;
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
            playExplosion(0.6);
            ufo.alive = false;
            ufoRef.current = null;
            ufoBurstRef.current = null;
            ufoPassesCompletedRef.current++;

            if (ufoPassesCompletedRef.current >= UFO_PASSES && gameStateRef.current.type === 'ufo') {
              setGameState({ type: 'transition', nextWave: waveRef.current + 1 });
              rafRef.current = requestAnimationFrame(gameLoop);
              return;
            } else if (ufoPassesCompletedRef.current < UFO_PASSES) {
              setTimeout(() => {
                if (!doneRef.current) spawnUfo(ufoPassesCompletedRef.current);
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
                if ((b.pierce ?? 0) > 0) {
                  b.pierce = (b.pierce ?? 0) - 1;
                } else {
                  hit = true;
                }
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
          if (!b.pos || !b.vel) continue;
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
            if (!rock || !rock.pos || !rock.radius) continue;
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

        if (powerupsRef.current.length) {
          const alivePowerups: PowerUp[] = [];
          for (const p of powerupsRef.current) {
            if (!p || !p.pos) continue;
            const age = now - p.born;
            if (age > POWERUP_LIFETIME) continue;
            p.pos.x += p.vel.x * dt;
            p.pos.y += p.vel.y * dt;
            p.pos = wrapPos(p.pos);
            if (dist(p.pos, playerPosRef.current) < POWERUP_RADIUS + 14) {
              collectPowerUp(p.type);
              continue;
            }
            alivePowerups.push(p);
          }
          powerupsRef.current = alivePowerups;
        }

        for (const p of particlesRef.current) {
          if (p.life <= 0) continue;
          p.pos.x += p.vel.x * dt;
          p.pos.y += p.vel.y * dt;
          p.vel.x *= 0.93;
          p.vel.y *= 0.93;
          p.life -= dt / p.maxLife;
        }

        for (const chunk of shipChunksRef.current || []) {
          if (!chunk || !chunk.pos || !chunk.vel || !chunk.maxLife || chunk.maxLife <= 0) continue;
          chunk.pos.x += chunk.vel.x * dt;
          chunk.pos.y += chunk.vel.y * dt;
          chunk.vel.x *= 0.88;
          chunk.vel.y *= 0.88;
          chunk.angle += chunk.angularVel * dt;
          chunk.life -= dt / chunk.maxLife;
        }
        shipChunksRef.current = (shipChunksRef.current || []).filter(c => c && c.life > 0);

        safe('draw', draw);
        rafRef.current = requestAnimationFrame(gameLoop);
      } catch (err) {
        console.error('GAME LOOP ERROR:', err);
        rafRef.current = requestAnimationFrame(gameLoop);
      }
    }

    const handleKey = (e: KeyboardEvent) => {
      if (doneRef.current) return;
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        onToggleMuteRef.current?.();
        return;
      }
      const state = gameStateRef.current;
      if (state.type === 'draft') {
        if (['1', '2', '3'].includes(e.key)) {
          e.preventDefault();
          const opt = state.options[parseInt(e.key, 10) - 1];
          if (opt) pickUpgradeRef.current(opt.id);
        }
        return;
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }
      if (pausedRef.current) return;
      if (e.key === 'Shift' && !e.repeat) {
        dashQueueRef.current++;
        return;
      }
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
    rafRef.current = requestAnimationFrame(gameLoop);

    return () => {
      doneRef.current = true;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKeyUp);
      if (missTimerRef.current) clearTimeout(missTimerRef.current);
      stopAllSounds();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function pointerDash() {
    dashQueueRef.current++;
  }

  const touchHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartTimeRef = useRef(0);

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
      fireQueueRef.current++;
      return;
    }

    const t = e.touches[0];
    touchStartTimeRef.current = Date.now();

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
          fireQueueRef.current++;
        }
      }
      keysRef.current.delete('ArrowLeft');
      keysRef.current.delete('ArrowRight');
      keysRef.current.delete('ArrowUp');
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

  return (
    <div ref={containerRef} className="debris-stage">
      <div className="debris-canvas-wrap">
        <canvas
          ref={canvasRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          style={{ display: 'block', imageRendering: 'pixelated', touchAction: 'none' }}
        />
      </div>

      <div className="debris-hud-buttons">
        <button className="debris-icon-btn" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title="Mute (M)">
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="debris-icon-btn" onClick={togglePause} aria-label={paused ? 'Resume' : 'Pause'} title="Pause (P)">
          {paused ? '▶' : '❚❚'}
        </button>
      </div>

      {paused && (
        <div className="debris-pause-menu">
          <h2 className="pause-heading">PAUSED</h2>
          <p className="pause-hint">P or ESC to resume</p>
          <button className="debris-btn debris-btn-primary" onClick={togglePause}>RESUME</button>
          <button className="debris-btn" onClick={() => onQuitRef.current?.()}>QUIT TO MENU</button>
        </div>
      )}

      {draftOptions && (
        <div className="debris-draft-menu">
          <h2 className="draft-heading">SECTOR CLEARED</h2>
          <p className="draft-hint">Choose one upgrade</p>
          <div className="draft-cards">
            {draftOptions.map((opt, i) => {
              const stacks = upgradeStacksRef.current[opt.id] || 0;
              return (
                <button
                  key={opt.id}
                  className="draft-card"
                  style={{ borderColor: opt.color }}
                  onClick={() => pickUpgradeRef.current(opt.id)}
                >
                  <span className="draft-card-key">{i + 1}</span>
                  <span className="draft-card-label" style={{ color: opt.color }}>
                    {opt.label}{stacks > 0 ? ` (${stacks}/${opt.maxStacks})` : ''}
                  </span>
                  <span className="draft-card-desc">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        className="debris-touch-dash"
        onPointerDown={(e) => { e.preventDefault(); pointerDash(); }}
      >DASH</button>

      <div className="debris-touch-hint">HOLD = thrust &middot; TAP = fire &middot; 2 fingers = fire</div>
    </div>
  );
}
