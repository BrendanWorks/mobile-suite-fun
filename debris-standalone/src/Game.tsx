import { useEffect, useRef, useState } from 'react';
import { sfx, SOUND_SRC, type LoopHandle } from './audio';

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

// Base logical resolution: a 4:3 box, matched to a typical desktop window.
// Every other constant and position in this file (rock spawns, wrap margins,
// HUD placement, star field) is expressed relative to W/H, so this is the
// one place a device's actual shape gets applied. Phones are nowhere near
// 4:3, so locking every device to this fixed box left big black bars above
// and below the canvas on mobile.
const BASE_W = 800;
const BASE_H = 600;

// Extends whichever side the base box is too cramped in for this device's
// aspect ratio -- taller for a portrait phone, wider for a landscape window
// -- and leaves an already-close-to-4:3 screen alone. Clamped so an extreme
// aspect ratio (an ultrawide monitor, a very elongated foldable) can't
// dilute gameplay density into an empty corridor.
function computeWorldSizeFor(vw: number, vh: number): { w: number; h: number } {
  const baseAspect = BASE_W / BASE_H;
  const aspect = (vw || BASE_W) / (vh || BASE_H);
  if (aspect >= baseAspect) {
    return { w: Math.min(BASE_W * 2, Math.round(BASE_H * aspect)), h: BASE_H };
  }
  return { w: BASE_W, h: Math.min(Math.round(BASE_H * 2.4), Math.round(BASE_W / aspect)) };
}

function computeInitialWorldSize(): { w: number; h: number } {
  if (typeof window === 'undefined') return { w: BASE_W, h: BASE_H };
  return computeWorldSizeFor(window.innerWidth, window.innerHeight);
}

// Mutable rather than const: rotating a phone mid-session has to reshape
// this, not just rescale the same shape into a differently-shaped box (see
// the resize effect below, which is what actually changes these).
const initialSize = computeInitialWorldSize();
let W = initialSize.w;
let H = initialSize.h;

function buildGridPath(): Path2D {
  const p = new Path2D();
  for (let x = 0; x < W; x += 60) { p.moveTo(x, 0); p.lineTo(x, H); }
  for (let y = 0; y < H; y += 60) { p.moveTo(0, y); p.lineTo(W, y); }
  return p;
}

let GRID_PATH = buildGridPath();

// Mirrors the `@media (hover: none) and (pointer: coarse)` query in
// index.css that shows the physical on-screen DASH button and touch hint.
// Read once: a mid-session input-mode switch (a Bluetooth mouse connecting
// to a tablet, say) repositioning the on-canvas dash readout is not worth
// tracking live.
const IS_COARSE_POINTER = typeof window !== 'undefined' && !!window.matchMedia
  && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

// Performance overlay, off by default. Open the game with ?debug=1 to show
// live frame timing and entity counts on-canvas -- the point is to get real
// numbers off a phone, where no dev tools are handy.
const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');
const FRAME_SAMPLE_COUNT = 60;
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

const MUSIC_RATE_MAX = 1.4;
// Safety valve: rocks split on death, so a deep sector's reinforcements can
// compound. Skip a reinforcement wave rather than let the entity count run
// away on a phone.
const MAX_ROCKS = 64;
const BULLET_HISTORY_LEN = 6;
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

const MAX_PARTICLES = 260;

// Physical key positions (e.code), so a held Shift or CapsLock can't change
// what a key reports between its keydown and its keyup.
const MOVE_KEY_CODES = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'];
const DRAFT_KEY_CODES = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'];
const LEFT_CODES = ['ArrowLeft', 'KeyA'];
const RIGHT_CODES = ['ArrowRight', 'KeyD'];
const THRUST_CODES = ['ArrowUp', 'KeyW'];

function anyHeld(keys: Set<string>, codes: string[]): boolean {
  for (const c of codes) if (keys.has(c)) return true;
  return false;
}

const DASH_DISTANCE = 130;
const DASH_IFRAME_MS = 350;
const DASH_COOLDOWN_MS = 3200;
const DASH_KICK_SPEED = 60;

const GAMEOVER_OVERLAY_DELAY_MS = 700;
const GAMEOVER_OVERLAY_FADE_MS = 400;

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

// Mutates in place rather than returning a new object. This runs every
// frame for the player, every rock, every bullet, and every power-up --
// allocating a fresh object each call was the single biggest steady-state
// GC pressure source in the game (as opposed to the burst allocation from
// explosions, which is a separate, already-fixed issue). Desktop GCs eat
// that invisibly; mobile doesn't have the same headroom.
function wrapPos(pos: Vec2): void {
  const M = WRAP_MARGIN;
  if (pos.x < -M) pos.x += W + M * 2;
  else if (pos.x > W + M) pos.x -= W + M * 2;
  if (pos.y < -M) pos.y += H + M * 2;
  else if (pos.y > H + M) pos.y -= H + M * 2;
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

// Mid-sector reinforcements. Sector 1 keeps the sizes it always had (4/5/6
// rocks at the three escalation steps); deeper sectors add more, but stop
// scaling at sector 5 so a long run can't spiral past the frame budget.
function reinforcementSize(sector: number, intensity: number): number {
  return (intensity - 1) + Math.min(sector - 1, 4);
}

function musicRateFor(sector: number, intensity: number): number {
  return Math.min(1.0 + (sector - 1) * 0.04 + (intensity - 1) * 0.08, MUSIC_RATE_MAX);
}

function initStars(): Star[] {
  const stars: Star[] = [];
  // Scales with the arena's area so a taller (phone) or wider (ultrawide
  // window) world doesn't thin the starfield out relative to the 150-star
  // baseline; capped so an extreme aspect ratio doesn't add draw cost for
  // stars a player is unlikely to notice past a point.
  const count = Math.round(Math.min(400, Math.max(150, 150 * ((W * H) / (BASE_W * BASE_H)))));
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
  const frameTimesRef = useRef<Float32Array>(new Float32Array(FRAME_SAMPLE_COUNT));
  const frameIdxRef = useRef(0);
  const lastDbgTsRef = useRef(0);
  const rafRef = useRef(0);

  const waveRef = useRef(1);
  // Escalation step *within* the current sector (1-4), tracked separately from
  // the sector number. These used to share waveRef, which meant the ramp's
  // "step up?" test could never fire once the sector number passed 4.
  const intensityRef = useRef(1);
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

  const gameOverAtRef = useRef(0);
  const pausedRef = useRef(false);
  const mutedRef = useRef(muted);
  const doneRef = useRef(false);
  const gameOverRef = useRef(false);

  // Music stays on an HTMLAudioElement (see audio.ts for why); every other
  // sound goes through the Web Audio engine.
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicPlayingRef = useRef(false);
  const ufoLoopRef = useRef<LoopHandle | null>(null);
  const boostLoopRef = useRef<LoopHandle | null>(null);

  const onGameOverRef = useRef(onGameOver);
  const onQuitRef = useRef(onQuit);
  const onToggleMuteRef = useRef(onToggleMute);
  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);
  useEffect(() => { onQuitRef.current = onQuit; }, [onQuit]);
  useEffect(() => { onToggleMuteRef.current = onToggleMute; }, [onToggleMute]);
  useEffect(() => {
    mutedRef.current = muted;
    if (musicRef.current) musicRef.current.muted = muted;
    sfx.setMuted(muted);
  }, [muted]);

  // Only live gameplay is pausable. The game loop tests pausedRef *before* it
  // dispatches on game state, so a pause taken during the sector-clear
  // transition or the upgrade draft stranded the loop in its paused branch:
  // the transition never reached the code that spawns the upgrade cards, and
  // the frozen SECTOR CLEARED banner stayed on screen with the audio context
  // suspended under it. Nothing is simulating in those states anyway, so
  // there is nothing to pause. Unpausing is always allowed.
  function canPause() {
    const t = gameStateRef.current.type;
    return t === 'playing' || t === 'ufo';
  }

  function togglePause() {
    if (doneRef.current || gameOverRef.current) return;
    if (!pausedRef.current && !canPause()) return;
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (next) {
      musicRef.current?.pause();
      boostLoopRef.current?.stop();
      boostLoopRef.current = null;
      sfx.suspend();
    } else {
      lastFrameRef.current = performance.now();
      sfx.unlock();
      sfx.resume();
      if (!mutedRef.current && musicPlayingRef.current) musicRef.current?.play().catch(() => {});
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
    if (!ufoLoopRef.current) ufoLoopRef.current = sfx.loop('ufo', 0.6);
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
      stopLoops();
      sectorClearedRef.current = Date.now();
    }

    if (next.type === 'playing') {
      ufoTriggeredRef.current = false;
      rocksRef.current = spawnWaveRocks(next.wave, 1.3);
      waveRef.current = next.wave;
      intensityRef.current = 1;
      waveStartRef.current = Date.now();

      if (musicRef.current) {
        musicRef.current.playbackRate = musicRateFor(next.wave, 1);
        if (!musicPlayingRef.current) {
          musicRef.current.currentTime = 0;
          if (!mutedRef.current) musicRef.current.play().catch(() => {});
          musicPlayingRef.current = true;
        }
      }
    }

    if (next.type === 'gameover') {
      // Not stopAllSounds(): that pauses the music element on the spot, and a
      // paused media source wired into a context that must keep running for
      // the death sound is the exact state that stuttered for the length of
      // the death animation. Stop the effect loops, but let the music fade
      // out while its element keeps playing; the real teardown (pause,
      // release, suspend) happens together at unmount, by which point the
      // gain is already at zero.
      stopLoops();
      sfx.fadeMusicOut(1.5);
      gameOverRef.current = true;
      gameOverAtRef.current = Date.now();
      // Deliberately leaves the loop running. The ship chunks, the death
      // shake and the GAME OVER overlay all need frames to render, and
      // cancelling here meant none of them ever did -- every run ended on a
      // frozen frame. The loop stops when App switches screens and unmounts
      // this component (see the cleanup in the main effect).
    }

    return true;
  }

  function stopUfoSound() {
    ufoLoopRef.current?.stop();
    ufoLoopRef.current = null;
  }

  // Stops the looping effects but deliberately leaves the music element
  // alone. The routed music element is what holds iOS's audio session open
  // (see the routeMusicElement comment in audio.ts), so pausing and seeking
  // it at every sector boundary let the session go idle and re-establishing
  // it glitched: the element fires a `waiting` re-buffer on the restart,
  // audible as a stutter right as the sector clears. Music now plays
  // continuously across the transition and the draft, and the new sector
  // just changes its tempo.
  function stopLoops() {
    stopUfoSound();
    boostLoopRef.current?.stop();
    boostLoopRef.current = null;
  }

  function stopAllSounds() {
    stopLoops();
    if (musicRef.current) {
      // No seek here: every game builds a fresh element, so rewinding one we
      // are about to discard is pointless work, and seeking an element that
      // feeds the Web Audio graph is exactly the operation that glitches.
      musicRef.current.pause();
      musicPlayingRef.current = false;
    }
  }

  useEffect(() => {
    sfx.preload();
    const music = new Audio(SOUND_SRC.music);
    music.loop = true;
    music.volume = 0.5;
    music.muted = mutedRef.current;
    musicRef.current = music;
    sfx.routeMusicElement(music);
    return () => { stopUfoSound(); };
  }, []);

  useEffect(() => {
    rocksRef.current = spawnWaveRocks(1, 1);
    waveStartRef.current = Date.now();
    invincibleUntilRef.current = Date.now() + INVINCIBLE_MS;

    if (musicRef.current) {
      musicRef.current.playbackRate = musicRateFor(1, 1);
      if (!mutedRef.current) musicRef.current.play().catch(() => {});
      musicPlayingRef.current = true;
    }

    function playExplosion(volume: number) {
      sfx.play('explosion', volume, 0.9 + Math.random() * 0.25);
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

    // Reuses the oldest trail point instead of allocating a new {x,y} every
    // frame for every alive bullet -- same steady-state GC concern as
    // wrapPos, just for bullets instead of every entity.
    function pushHistory(b: Bullet) {
      if (!b.history) b.history = [];
      if (b.history.length >= BULLET_HISTORY_LEN) {
        const reused = b.history.shift()!;
        reused.x = b.pos.x;
        reused.y = b.pos.y;
        b.history.push(reused);
      } else {
        b.history.push({ x: b.pos.x, y: b.pos.y });
      }
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
      const count = Math.round((40 + Math.random() * 20) * sizeScale);
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

      const sparkCount = Math.round(12 * sizeScale);
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
      sfx.play('coin', 0.55);
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
      // A volatile chain takes a snapshot of its neighbours and then recurses,
      // so a rock can already have been destroyed by a deeper link by the time
      // this loop reaches it. Bail rather than paying out its score, particles
      // and fragments a second time.
      const idx = rocks.findIndex(r => r.id === rock.id);
      if (idx === -1) return;
      rocks.splice(idx, 1);

      const pts = ROCK_POINTS[rock.size];
      addScore(pts);
      spawnExplosionParticles(rock.pos, rock.size);
      spawnScoreFloater(rock.pos, pts);
      maybeSpawnPowerUp(rock);
      rocksTotalDestroyedRef.current++;

      if (rock.size === 'large') {
        rocks.push(spawnRock('medium', { ...rock.pos }));
        rocks.push(spawnRock('medium', { ...rock.pos }));
      } else if (rock.size === 'medium') {
        rocks.push(spawnRock('small', { ...rock.pos }));
        rocks.push(spawnRock('small', { ...rock.pos }));
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
      sfx.play('disappear', 0.7);
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

      if (livesRef.current <= 0 && !gameOverRef.current && !doneRef.current) {
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

      sfx.play('shoot', 0.45);

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

      const endPos = {
        x: playerPosRef.current.x + Math.cos(angle) * DASH_DISTANCE,
        y: playerPosRef.current.y + Math.sin(angle) * DASH_DISTANCE,
      };
      wrapPos(endPos);
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

    function drawDashIndicator(ctx: CanvasRenderingContext2D, now: number, scale: number) {
      const cooldown = DASH_COOLDOWN_MS * dashCooldownMultRef.current;
      const elapsed = now - lastDashRef.current;
      const ready = elapsed >= cooldown;
      const frac = Math.max(0, Math.min(1, elapsed / cooldown));
      // On a touch device the physical DASH button (60px circle, 22px inset
      // from the corner -- .debris-touch-dash in index.css) sits in real
      // screen pixels over this same corner. On the old fixed 4:3 canvas
      // that corner usually landed in the letterboxed black bar, so the two
      // never met; filling the actual viewport means the canvas now often
      // reaches that real corner too, and this label+bar was drawn right
      // under the button. Lifting it by the button's real-pixel footprint,
      // converted to world units via the current canvas scale, clears it on
      // every device regardless of how much the arena is scaled.
      const y = IS_COARSE_POINTER ? H - Math.min(H * 0.35, 95 / scale) : H - 20;
      const x = W - 16;
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
              ctx.shadowColor = COLORS.cyan;
              ctx.shadowBlur = 8;
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
            const thrusting = anyHeld(keysRef.current, THRUST_CODES);
            const speed = Math.sqrt(playerVelRef.current.x ** 2 + playerVelRef.current.y ** 2);
            const velocityRatio = Math.min(speed / PLAYER_MAX_SPEED, 1);

            if (!invincible || Math.floor(now / 120) % 2 === 0) {
              // The ship wraps at the world edge like everything else, but
              // wrapPos only snaps it back once it's WRAP_MARGIN past the
              // edge -- meaning for however long it takes to cross that gap
              // (a quarter to half a second at normal thrust speeds) it sits
              // at a coordinate outside [0,W]x[0,H] and simply isn't drawn:
              // the ship goes fully invisible mid-wrap. Asteroids-style games
              // solve this by drawing a second copy offset by the wrap
              // distance whenever the ship is within that margin of an edge,
              // so it's always visible somewhere -- sliding off one side
              // while already visible peeking in on the other, rather than
              // vanishing for that gap. Collision still only ever uses the
              // one real (playerPosRef) position; this is rendering only.
              const drawShipAt = (ox: number, oy: number) => {
                ctx.save();
                ctx.translate(ox, oy);
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
              };

              const nearLeft = px < WRAP_MARGIN;
              const nearRight = px > W - WRAP_MARGIN;
              const nearTop = py < WRAP_MARGIN;
              const nearBottom = py > H - WRAP_MARGIN;
              const dx = nearLeft ? W : nearRight ? -W : 0;
              const dy = nearTop ? H : nearBottom ? -H : 0;

              drawShipAt(px, py);
              if (dx) drawShipAt(px + dx, py);
              if (dy) drawShipAt(px, py + dy);
              if (dx && dy) drawShipAt(px + dx, py + dy);
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

      if (DEBUG) {
        const times = frameTimesRef.current;
        let sum = 0, max = 0, n = 0;
        for (let i = 0; i < FRAME_SAMPLE_COUNT; i++) {
          const t = times[i];
          if (t <= 0) continue;
          sum += t; n++;
          if (t > max) max = t;
        }
        const avg = n ? sum / n : 0;
        let liveParticles = 0;
        for (const p of particlesRef.current) if (p.life > 0) liveParticles++;
        const canvasEl = canvasRef.current;
        const audioInfo = sfx.getDebugInfo();
        const lines = [
          `fps ${avg ? (1000 / avg).toFixed(0) : '--'}  avg ${avg.toFixed(1)}ms  worst ${max.toFixed(0)}ms`,
          `rocks ${rocksRef.current.length}  bullets ${bulletsRef.current.length + ufoBulletsRef.current.length}  particles ${liveParticles}`,
          `canvas ${canvasEl ? canvasEl.width + 'x' + canvasEl.height : '?'}  dpr ${window.devicePixelRatio}`,
          `audio ctx=${audioInfo.ctxState}  routed=${audioInfo.musicRouted}  sfx=${audioInfo.buffersReady}/${audioInfo.buffersTotal}`,
        ];
        ctx.save();
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = COLORS.yellow;
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], 16, 80 + i * 14);
        ctx.restore();
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

      drawDashIndicator(ctx, now, s);

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

      // Hold the overlay back so the ship actually blows apart in the clear
      // first, then fade the scrim in over the top of the settling debris.
      if (gameOverRef.current) {
        const sinceDeath = now - gameOverAtRef.current;
        if (sinceDeath > GAMEOVER_OVERLAY_DELAY_MS) {
          const fade = Math.min(1, (sinceDeath - GAMEOVER_OVERLAY_DELAY_MS) / GAMEOVER_OVERLAY_FADE_MS);
          ctx.save();
          ctx.globalAlpha = fade;
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
          ctx.restore();
        }
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
      // Belt and braces alongside canPause(): a pause must never survive into
      // the next sector, or the loop resumes straight back into its paused
      // branch with no overlay left to clear it.
      if (pausedRef.current) {
        pausedRef.current = false;
        setPaused(false);
        sfx.resume();
        if (!mutedRef.current && musicPlayingRef.current) musicRef.current?.play().catch(() => {});
      }
      setGameState({ type: 'playing', wave: nextWave });
    }

    pickUpgradeRef.current = (id: UpgradeId) => {
      const state = gameStateRef.current;
      if (state.type !== 'draft') return;
      applyUpgrade(id);
      setDraftOptions(null);
      resetAfterUfoPhase(state.nextWave);
    };

    function updateStars(dt: number) {
      for (const star of starsRef.current) {
        star.x -= star.drift * dt;
        if (star.x < -WRAP_MARGIN) star.x += W + WRAP_MARGIN * 2;
      }
    }

    function updateRockMotion(dt: number) {
      for (let i = rocksRef.current.length - 1; i >= 0; i--) {
        const rock = rocksRef.current[i];
        if (!rock || !rock.pos || !rock.vel) continue;
        rock.pos.x += rock.vel.x * dt;
        rock.pos.y += rock.vel.y * dt;
        wrapPos(rock.pos);
        rock.angle += rock.angularVel * dt;
      }
    }

    function updateParticles(dt: number) {
      for (const p of particlesRef.current) {
        if (p.life <= 0) continue;
        p.pos.x += p.vel.x * dt;
        p.pos.y += p.vel.y * dt;
        p.vel.x *= 0.93;
        p.vel.y *= 0.93;
        p.life -= dt / p.maxLife;
      }
    }

    function updateShipChunks(dt: number) {
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
    }

    function gameLoop(ts: number) {
      if (doneRef.current) {
        return;
      }

      if (!canvasRef.current) {
        rafRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (DEBUG) {
        // Always-on timing, independent of the physics dt (which gets reset by
        // pause/hitstop), so stutter shows up here even when motion is frozen.
        if (lastDbgTsRef.current > 0) {
          frameTimesRef.current[frameIdxRef.current] = ts - lastDbgTsRef.current;
          frameIdxRef.current = (frameIdxRef.current + 1) % FRAME_SAMPLE_COUNT;
        }
        lastDbgTsRef.current = ts;
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

        // The death animation: gameplay has stopped, but the world keeps
        // drifting so the ship chunks fly apart, the shake plays out and the
        // GAME OVER overlay is actually on screen for its 2.2 seconds.
        if (state.type === 'gameover') {
          const dtOver = Math.min((ts - (lastFrameRef.current || ts)) / 1000, 0.05);
          lastFrameRef.current = ts;
          updateStars(dtOver);
          updateRockMotion(dtOver);
          updateParticles(dtOver);
          updateShipChunks(dtOver);
          safe('draw-gameover', draw);
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

        updateStars(dt);

        if (anyHeld(keys, LEFT_CODES)) playerAngleRef.current -= ROTATE_SPEED * turnRateMultRef.current * dt;
        if (anyHeld(keys, RIGHT_CODES)) playerAngleRef.current += ROTATE_SPEED * turnRateMultRef.current * dt;

        const thrusting = anyHeld(keys, THRUST_CODES);
        if (thrusting) {
          playerVelRef.current.x += Math.cos(playerAngleRef.current) * THRUST_ACCEL * engineMultRef.current * dt;
          playerVelRef.current.y += Math.sin(playerAngleRef.current) * THRUST_ACCEL * engineMultRef.current * dt;
          if (!boostLoopRef.current) boostLoopRef.current = sfx.loop('boost', 0.35);
        } else if (boostLoopRef.current) {
          boostLoopRef.current.stop();
          boostLoopRef.current = null;
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
        wrapPos(playerPosRef.current);

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

            const targetIntensity = elapsed >= 60 ? 4 : elapsed >= 40 ? 3 : elapsed >= 20 ? 2 : 1;
            if (targetIntensity > intensityRef.current) {
              intensityRef.current = targetIntensity;
              if (rocksRef.current.length < MAX_ROCKS) {
                rocksRef.current.push(...spawnWaveRocks(reinforcementSize(waveRef.current, targetIntensity), velocityBoost));
              }
              if (musicRef.current) {
                musicRef.current.playbackRate = musicRateFor(waveRef.current, targetIntensity);
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

            updateRockMotion(dt);
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
            if (offScreen && !doneRef.current && !gameOverRef.current) {
              ufoPassesCompletedRef.current++;
              ufoRef.current = null;
              ufoBurstRef.current = null;

              if (ufoPassesCompletedRef.current >= UFO_PASSES && gameStateRef.current.type === 'ufo') {
                setGameState({ type: 'transition', nextWave: waveRef.current + 1 });
                rafRef.current = requestAnimationFrame(gameLoop);
                return;
              } else if (ufoPassesCompletedRef.current < UFO_PASSES) {
                setTimeout(() => {
                  if (!doneRef.current && !gameOverRef.current) spawnUfo(ufoPassesCompletedRef.current);
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
          wrapPos(b.pos);

          pushHistory(b);

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
                if (!doneRef.current && !gameOverRef.current) spawnUfo(ufoPassesCompletedRef.current);
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
          wrapPos(b.pos);

          pushHistory(b);

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
            wrapPos(p.pos);
            if (dist(p.pos, playerPosRef.current) < POWERUP_RADIUS + 14) {
              collectPowerUp(p.type);
              continue;
            }
            alivePowerups.push(p);
          }
          powerupsRef.current = alivePowerups;
        }

        updateParticles(dt);
        updateShipChunks(dt);

        safe('draw', draw);
        rafRef.current = requestAnimationFrame(gameLoop);
      } catch (err) {
        console.error('GAME LOOP ERROR:', err);
        rafRef.current = requestAnimationFrame(gameLoop);
      }
    }

    const handleKey = (e: KeyboardEvent) => {
      sfx.unlock();
      if (doneRef.current || gameOverRef.current) return;
      const code = e.code;
      if (code === 'KeyM') {
        e.preventDefault();
        onToggleMuteRef.current?.();
        return;
      }
      const state = gameStateRef.current;
      if (state.type === 'draft') {
        const slot = DRAFT_KEY_CODES.indexOf(code);
        if (slot !== -1) {
          e.preventDefault();
          const opt = state.options[slot % 3];
          if (opt) pickUpgradeRef.current(opt.id);
        }
        return;
      }
      if (code === 'KeyP' || code === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }
      if (pausedRef.current) return;
      if ((code === 'ShiftLeft' || code === 'ShiftRight') && !e.repeat) {
        dashQueueRef.current++;
        return;
      }
      if (MOVE_KEY_CODES.includes(code) || code === 'Space') {
        e.preventDefault();
      }
      if (code === 'Space' && !e.repeat) {
        fireQueueRef.current++;
        return;
      }
      if (MOVE_KEY_CODES.includes(code)) {
        keysRef.current.add(code);
      }
    };
    // Tracked by e.code, not e.key: with Shift held for a dash, e.key reports
    // "W" while the keydown that started the thrust stored "w", so the keyup
    // never cleared it and the ship thrusted forever.
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    const handleVisibility = () => {
      if (document.hidden && !pausedRef.current && !gameOverRef.current && !doneRef.current) {
        togglePause();
      }
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('visibilitychange', handleVisibility);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(gameLoop);

    return () => {
      doneRef.current = true;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (missTimerRef.current) clearTimeout(missTimerRef.current);
      stopAllSounds();
      // Tear the graph down when the game screen goes away (game over, or quit
      // to menu). Leaving the context running with a paused, discarded media
      // element still wired to the destination gives the hardware a live graph
      // with nothing feeding it. Suspending here rather than at the moment of
      // death lets the death sound ring out first; the PLAY button's
      // sfx.unlock() resumes it inside a real gesture on the next game.
      sfx.releaseMusicElement();
      sfx.suspend();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Multiplies every live entity's position by (sx, sy) when the arena
  // reshapes (see resize() below) -- e.g. a rock at 50% across the old
  // world stays at 50% across the new one, instead of ending up outside
  // the new bounds or bunched in whatever corner its old absolute
  // coordinates happen to land in. Purely-cosmetic, short-lived effects
  // (particles, ship chunks, core flashes, score floaters) are cleared
  // instead of rescaled -- they're gone within a second regardless, and a
  // device rotation is rare enough that losing a few of them is invisible.
  function rescaleWorld(sx: number, sy: number) {
    const pos = playerPosRef.current;
    pos.x *= sx; pos.y *= sy;

    for (const r of rocksRef.current) { r.pos.x *= sx; r.pos.y *= sy; }
    for (const p of powerupsRef.current) { p.pos.x *= sx; p.pos.y *= sy; }
    for (const b of [...bulletsRef.current, ...ufoBulletsRef.current]) {
      b.pos.x *= sx; b.pos.y *= sy;
      for (const h of b.history) { h.x *= sx; h.y *= sy; }
    }
    for (const s of starsRef.current) { s.x *= sx; s.y *= sy; }

    const ufo = ufoRef.current;
    if (ufo) {
      ufo.pos.x *= sx; ufo.pos.y *= sy;
      ufo.baseY *= sy;
      ufo.startX *= sx;
      ufo.amplitude *= sy;
    }

    for (const p of particlesRef.current) p.life = 0;
    shipChunksRef.current = [];
    coreFlashesRef.current = [];
    scoreFloatersRef.current = [];
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw <= 0 || ch <= 0) return;

      // Reshape the arena itself when the container's shape genuinely
      // changes (a phone rotating, a window resized to a very different
      // aspect), rather than just re-fitting the OLD shape into the new
      // box: that fit is constrained by whichever axis is now the tight
      // one, and a landscape-sized world squeezed into a portrait box
      // renders as a tiny sliver -- reported after rotating mid-session.
      const next = computeWorldSizeFor(cw, ch);
      if (next.w !== W || next.h !== H) {
        rescaleWorld(next.w / W, next.h / H);
        W = next.w;
        H = next.h;
        GRID_PATH = buildGridPath();
      }

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
    sfx.unlock();
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
