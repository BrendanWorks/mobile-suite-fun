// Sound effects on the Web Audio API.
//
// Why this exists: the game originally played every effect through an
// HTMLAudioElement (reset currentTime, call play()). That's fine on desktop,
// but on iOS (Safari, and Chrome, which is Safari's engine underneath) each
// play() goes through the system media pipeline, and firing it up to 30
// times a second for shots, explosions, and thrust toggles made the whole
// game stutter. Confirmed by the game being smooth with audio muted.
//
// With Web Audio each sound is decoded once into an AudioBuffer, and every
// playback is a throwaway AudioBufferSourceNode: cheap, overlaps freely
// (no more pooling explosion elements), and pitch variation is one property.
//
// The background music deliberately stays on an HTMLAudioElement in Game.tsx.
// It's a single long-lived loop that's never spammed, so it has none of the
// problem above, and an active media element is what makes iOS route audio
// through the ringer's silent switch, so these effects stay audible when
// the phone is on silent.

export const SOUND_SRC = {
  shoot: '/sounds/global/SoundShootRegularOptimized.mp3',
  disappear: '/sounds/global/disappear_Normalized.mp3',
  ufo: '/sounds/global/ufo_normalized.mp3',
  boost: '/sounds/global/BoostNormalized.mp3',
  coin: '/sounds/global/SoundCoin.mp3',
  explosion: '/sounds/debris/Explosion_Normalized.mp3',
  music: '/sounds/global/debris_music.mp3',
} as const;

export type SoundName = keyof typeof SOUND_SRC;

const SFX_NAMES: SoundName[] = ['shoot', 'disappear', 'ufo', 'boost', 'coin', 'explosion'];

export interface LoopHandle {
  stop(): void;
  setRate(rate: number): void;
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext || w.webkitAudioContext || null;
}

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers: Partial<Record<SoundName, AudioBuffer>> = {};
  private muted = false;
  private preloadStarted = false;
  private musicRouted = false;

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 1;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
    } catch {
      this.ctx = null;
      this.master = null;
    }
    return this.ctx;
  }

  // Safe to call before any user gesture: the context just starts suspended,
  // and decoding works regardless. Call early so buffers are ready by the
  // time the first shot is fired.
  preload(): void {
    if (this.preloadStarted) return;
    this.preloadStarted = true;
    const ctx = this.ensureContext();
    if (!ctx) return;
    for (const name of SFX_NAMES) {
      fetch(SOUND_SRC[name])
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((decoded) => { this.buffers[name] = decoded; })
        .catch(() => { /* sound just stays silent */ });
    }
  }

  // iOS silences plain Web Audio output (buffer sources straight to
  // destination) whenever the hardware ringer switch is set to silent --
  // but only for audio contexts that have never carried a real
  // HTMLMediaElement. An <audio> tag playing normally is exempt from that
  // mute switch. Piping the music element's output through this same
  // AudioContext (instead of letting it play on its own, separate audio
  // session) is what makes the whole context, sound effects included,
  // inherit that exemption. Call this once, right after creating the music
  // element; safe to call before any user gesture.
  routeMusicElement(el: HTMLAudioElement): void {
    if (this.musicRouted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const source = ctx.createMediaElementSource(el);
      source.connect(ctx.destination);
      this.musicRouted = true;
    } catch {
      // Already connected elsewhere, or the browser doesn't support it --
      // the element still plays fine on its own, just without the benefit.
    }
  }

  // For the ?debug=1 overlay -- turns "no sound on phone" into numbers
  // instead of another guess.
  getDebugInfo(): { ctxState: string; musicRouted: boolean; buffersReady: number; buffersTotal: number } {
    return {
      ctxState: this.ctx?.state ?? 'none',
      musicRouted: this.musicRouted,
      buffersReady: Object.keys(this.buffers).length,
      buffersTotal: SFX_NAMES.length,
    };
  }

  // Must be called from inside a user gesture (click, touch, key) at least
  // once. Idempotent and cheap, so it's fine to call on every gesture.
  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'running') return;
    ctx.resume().catch(() => {});
    // iOS reliably unlocks only if something is actually played inside the
    // gesture, so play one silent sample.
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start(0);
    } catch { /* ignore */ }
  }

  suspend(): void {
    this.ctx?.suspend().catch(() => {});
  }

  resume(): void {
    this.ctx?.resume().catch(() => {});
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 1;
  }

  // Fire-and-forget one-shot.
  play(name: SoundName, volume = 1, rate = 1): void {
    if (this.muted) return;
    const ctx = this.ctx;
    const master = this.master;
    const buffer = this.buffers[name];
    if (!ctx || !master || !buffer) return;
    if (ctx.state !== 'running') {
      // e.g. iOS put it in 'interrupted'; the next gesture's unlock() fixes it.
      ctx.resume().catch(() => {});
      return;
    }
    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      src.connect(gain).connect(master);
      src.start(0);
    } catch { /* ignore */ }
  }

  // Looping playback (engine hum, UFO drone). Keeps running silently while
  // muted, so unmuting doesn't restart it. Returns null if not ready yet.
  loop(name: SoundName, volume = 1, rate = 1): LoopHandle | null {
    const ctx = this.ctx;
    const master = this.master;
    const buffer = this.buffers[name];
    if (!ctx || !master || !buffer) return null;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      src.connect(gain).connect(master);
      src.start(0);
      let stopped = false;
      return {
        stop() {
          if (stopped) return;
          stopped = true;
          try { src.stop(); } catch { /* already stopped */ }
          try { src.disconnect(); gain.disconnect(); } catch { /* ignore */ }
        },
        setRate(r: number) {
          src.playbackRate.value = r;
        },
      };
    } catch {
      return null;
    }
  }
}

export const sfx = new SfxEngine();
