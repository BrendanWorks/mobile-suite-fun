// AudioManager.ts - Mobile-optimized version (2026 fixes)

class AudioManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private pools: Map<string, HTMLAudioElement[]> = new Map();
  private readyStates: Map<HTMLAudioElement, boolean> = new Map();
  private musicVolume: number = 0.12;
  private sfxVolume: number = 0.7;
  private enabled: boolean = true;
  private initialized: boolean = false;
  private audioContext: AudioContext | null = null;

  // Detect mobile once
  private isMobile: boolean = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  private defaultPoolSize: number = this.isMobile ? 2 : 3;

  initialize(): void {
    if (this.initialized) return;

    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      this.audioContext = new AudioContextClass();

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      // Handle page visibility / background resume (helps both contexts and HTMLAudio)
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    } catch (e) {
      console.warn('Failed to initialize audio context:', e);
    }

    this.initialized = true;
    console.log('🔊 AudioManager initialized (mobile mode:', this.isMobile, ')');
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      if (this.audioContext?.state === 'suspended') {
        this.audioContext.resume().catch(err => console.warn('Resume on foreground failed:', err));
      }
      // Optional: you could prime one audio here too, but better from gesture
    }
  }

  private clampVolume(vol: number): number {
    return Math.max(0, Math.min(1, vol));
  }

  private handlePlayPromise(promise: Promise<void> | undefined, key?: string): void {
    if (!promise) return;
    promise.catch(err => {
      console.warn(`Play promise rejected for ${key || 'unknown'}:`, err.name, err.message);
      // Common iOS error after unlock failure
      if (err.name === 'NotAllowedError') {
        console.warn('NotAllowedError - audio likely needs user gesture unlock');
      }
    });
  }

  // Call this from a real user gesture (touchend/click) in your top-level component
  async unlockAudio(silent: boolean = true): Promise<boolean> {
    if (!this.initialized) this.initialize();

    let success = false;

    // 1. Resume context
    if (this.audioContext?.state === 'suspended') {
      try {
        await this.audioContext.resume();
        success = true;
      } catch (err) {
        console.warn('AudioContext resume failed during unlock:', err);
      }
    }

    // 2. Prime HTMLAudioElement - critical for Safari
    const primer = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    primer.volume = silent ? 0 : 0.01;

    try {
      primer.currentTime = 0;
      await primer.play();
      primer.pause();
      success = true;
      console.log('🔓 Audio unlocked via HTMLAudio prime');
    } catch (err) {
      console.warn('HTMLAudio unlock prime failed:', err);
    }

    return success;
  }

  async loadSound(key: string, url: string, poolSize: number = this.defaultPoolSize): Promise<void> {
    if (!url) {
      console.warn(`Invalid URL for sound: ${key}`);
      return;
    }

    try {
      const pool: HTMLAudioElement[] = [];
      const failed: HTMLAudioElement[] = [];

      for (let i = 0; i < poolSize; i++) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';

        const loadPromise = new Promise<void>((resolve) => {
          let resolved = false;

          const cleanup = () => {
            audio.removeEventListener('canplaythrough', onCanPlay);
            audio.removeEventListener('error', onError);
            audio.removeEventListener('loadeddata', onLoadedData);
          };

          const onCanPlay = () => {
            if (!resolved) {
              resolved = true;
              cleanup();
              this.readyStates.set(audio, true);
              resolve();
            }
          };

          const onLoadedData = () => {
            // Fallback trigger - sometimes canplaythrough never fires on mobile
            if (!resolved && audio.readyState >= 2) {
              resolved = true;
              cleanup();
              this.readyStates.set(audio, true);
              resolve();
            }
          };

          const onError = (e: Event) => {
            if (!resolved) {
              resolved = true;
              cleanup();
              this.readyStates.set(audio, false);
              failed.push(audio);
              console.warn(`Audio load error for ${key} instance ${i+1}:`, (e.target as HTMLAudioElement)?.error);
              resolve();
            }
          };

          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              cleanup();
              const ready = audio.readyState >= 2;
              this.readyStates.set(audio, ready);
              if (!ready) failed.push(audio);
              resolve();
            }
          }, 8000); // longer timeout for mobile networks

          audio.addEventListener('canplaythrough', onCanPlay, { once: true });
          audio.addEventListener('loadeddata', onLoadedData, { once: true });
          audio.addEventListener('error', onError, { once: true });
          audio.src = url;
        });

        await loadPromise;

        if (this.readyStates.get(audio)) {
          pool.push(audio);
        }
      }

      if (pool.length === 0) {
        console.warn(`Failed to load any instances of ${key}`);
        return;
      }

      this.pools.set(key, pool);
      this.sounds.set(key, pool[0]);
      console.log(`✅ Loaded ${key} pool: ${pool.length}/${poolSize} ready`);
    } catch (error) {
      console.warn(`Load failed for ${key}:`, error);
    }
  }

  play(key: string, volume?: number): void {
    if (!this.enabled) return;

    const pool = this.pools.get(key);
    if (!pool || pool.length === 0) {
      console.warn(`No pool for sound: ${key}`);
      return;
    }

    let audio = pool.find(a => (a.paused || a.ended) && this.readyStates.get(a)) ?? pool[0];

    if (!this.readyStates.get(audio)) {
      console.warn(`No ready instance for ${key}`);
      return;
    }

    try {
      // Safari/iOS fix: reload before play to prevent skipping/clipping on repeats
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        audio.load();
      }

      audio.currentTime = 0;
      audio.volume = this.clampVolume(volume ?? this.sfxVolume);

      const promise = audio.play();
      this.handlePlayPromise(promise, key);
    } catch (error) {
      console.warn(`Play sync error for ${key}:`, error);
    }
  }

  playMusic(key: string): void {
    if (!this.enabled) return;

    const music = this.sounds.get(key);
    if (!music || !this.readyStates.get(music)) {
      console.warn(`Music not ready: ${key}`);
      return;
    }

    try {
      // Same iOS reset
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        music.load();
      }

      music.loop = true;
      music.volume = this.clampVolume(this.musicVolume);

      const promise = music.play();
      this.handlePlayPromise(promise, `${key} [music]`);
    } catch (error) {
      console.warn(`Music play sync error:`, error);
    }
  }

  stopMusic(key: string): void {
    const music = this.sounds.get(key);
    if (music) {
      try {
        music.pause();
        music.currentTime = 0;
      } catch (error) {
        console.warn('Stop music error:', error);
      }
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.pools.forEach(pool => {
        pool.forEach(audio => {
          audio.pause();
          audio.currentTime = 0;
        });
      });
    }
  }

  setVolume(music: number, sfx: number): void {
    this.musicVolume = this.clampVolume(music);
    this.sfxVolume = this.clampVolume(sfx);
  }

  // Optional: call this after first gesture if you want to reload all pools
  async reloadAll(): Promise<void> {
    for (const [key, pool] of this.pools.entries()) {
      for (const audio of pool) {
        audio.load();
        await new Promise(r => audio.addEventListener('loadeddata', r, { once: true }));
      }
    }
  }
}

export const audioManager = new AudioManager();