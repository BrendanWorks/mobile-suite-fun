class AudioManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private pools: Map<string, HTMLAudioElement[]> = new Map();
  private readyStates: Map<HTMLAudioElement, boolean> = new Map();
  private musicVolume: number = 0.12;
  private sfxVolume: number = 0.7;
  private enabled: boolean = true;
  private initialized: boolean = false;
  private audioContext: AudioContext | null = null;
  private isIOS: boolean = false;
  private isMobile: boolean = false;
  private lastPlayTime: Map<string, number> = new Map();
  private readonly MIN_SOUND_INTERVAL = 50;
  private enabledListeners: Set<(enabled: boolean) => void> = new Set();

  initialize(): void {
    if (this.initialized) return;

    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      this.audioContext = new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
    } catch {
    }

    this.detectPlatform();
    this.setupVisibilityListener();

    this.initialized = true;
  }

  private detectPlatform(): void {
    const userAgent = navigator.userAgent;
    this.isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    this.isMobile = 'ontouchstart' in window;
  }

  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden === false && this.audioContext?.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
    });
  }

  async unlockAudio(): Promise<boolean> {
    try {
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }

      const silentWav = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==';
      const unlocker = new Audio();
      unlocker.preload = 'auto';
      unlocker.src = silentWav;
      unlocker.volume = 0;

      await unlocker.play();
      unlocker.pause();
      unlocker.currentTime = 0;

      return true;
    } catch {
      return false;
    }
  }

  private clampVolume(vol: number): number {
    return Math.max(0, Math.min(1, vol));
  }

  private handlePlayPromise(promise: Promise<void> | undefined): void {
    if (promise && typeof promise.catch === 'function') {
      promise.catch(() => {});
    }
  }

  async loadSound(key: string, url: string, poolSize: number = 3): Promise<void> {
    if (!url) return;

    const adjustedPoolSize = this.isMobile ? Math.max(1, poolSize) : poolSize;

    try {
      const pool: HTMLAudioElement[] = [];
      const failedInstances: HTMLAudioElement[] = [];

      for (let i = 0; i < adjustedPoolSize; i++) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';

        const loadPromise = new Promise<void>((resolve) => {
          let resolved = false;

          const cleanup = () => {
            audio.removeEventListener('canplaythrough', onCanPlayThrough);
            audio.removeEventListener('error', onError);
          };

          const onCanPlayThrough = () => {
            if (!resolved) {
              resolved = true;
              cleanup();
              this.readyStates.set(audio, true);
              resolve();
            }
          };

          const onError = () => {
            if (!resolved) {
              resolved = true;
              cleanup();
              this.readyStates.set(audio, false);
              failedInstances.push(audio);
              resolve();
            }
          };

          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              cleanup();
              if (audio.readyState >= 2) {
                this.readyStates.set(audio, true);
              } else {
                this.readyStates.set(audio, false);
                failedInstances.push(audio);
              }
              resolve();
            }
          }, 5000);

          audio.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
          audio.addEventListener('error', onError, { once: true });
          audio.src = url;
        });

        await loadPromise;

        if (this.readyStates.get(audio)) {
          pool.push(audio);
        }
      }

      if (pool.length === 0) return;

      this.pools.set(key, pool);
      this.sounds.set(key, pool[0]);

    } catch {
    }
  }

  play(key: string, volume?: number): void {
    if (!this.enabled) return;

    const now = Date.now();
    const lastPlay = this.lastPlayTime.get(key) || 0;
    if (now - lastPlay < this.MIN_SOUND_INTERVAL) {
      return;
    }
    this.lastPlayTime.set(key, now);

    const pool = this.pools.get(key);
    if (!pool || pool.length === 0) return;

    let audio = pool.find(a => {
      try {
        return (a.paused || a.ended) && this.readyStates.get(a);
      } catch {
        return false;
      }
    });

    if (!audio) audio = pool[0];
    if (!this.readyStates.get(audio)) return;

    try {
      if (this.isIOS) {
        audio.load();
      }
      audio.currentTime = 0;
      audio.volume = this.clampVolume(volume ?? this.sfxVolume);

      if (this.audioContext?.state === 'suspended') {
        this.audioContext.resume().then(() => {
          this.handlePlayPromise(audio.play());
        }).catch(() => {
          this.handlePlayPromise(audio.play());
        });
      } else {
        this.handlePlayPromise(audio.play());
      }
    } catch {
    }
  }

  playMusic(key: string): void {
    if (!this.enabled) return;

    const music = this.sounds.get(key);
    if (!music || !this.readyStates.get(music)) return;

    try {
      if (this.isIOS) {
        music.load();
      }
      music.loop = true;
      music.volume = this.clampVolume(this.musicVolume);

      if (this.audioContext?.state === 'suspended') {
        this.audioContext.resume().then(() => {
          this.handlePlayPromise(music.play());
        }).catch(() => {
          this.handlePlayPromise(music.play());
        });
      } else {
        this.handlePlayPromise(music.play());
      }
    } catch {
    }
  }

  stopMusic(key: string): void {
    const music = this.sounds.get(key);
    if (music) {
      try {
        music.pause();
        music.currentTime = 0;
      } catch {
      }
    }
  }

  playLoop(key: string, volume?: number): void {
    if (!this.enabled) return;

    const pool = this.pools.get(key);
    if (!pool || pool.length === 0) return;

    const audio = pool[0];
    if (!this.readyStates.get(audio)) return;

    try {
      if (!audio.paused) return;
      audio.currentTime = 0;
      audio.loop = true;
      audio.volume = this.clampVolume(volume ?? this.sfxVolume);
      this.handlePlayPromise(audio.play());
    } catch {
    }
  }

  stopLoop(key: string): void {
    const pool = this.pools.get(key);
    if (!pool || pool.length === 0) return;

    const audio = pool[0];
    try {
      audio.loop = false;
      audio.pause();
      audio.currentTime = 0;
    } catch {
    }
  }

  stop(key: string): void {
    const pool = this.pools.get(key);
    if (!pool || pool.length === 0) return;

    pool.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
      }
    });
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
    this.enabledListeners.forEach(cb => cb(enabled));
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isReady(key: string): boolean {
    const pool = this.pools.get(key);
    return !!(pool && pool.length > 0);
  }

  onEnabledChange(cb: (enabled: boolean) => void): () => void {
    this.enabledListeners.add(cb);
    return () => this.enabledListeners.delete(cb);
  }

  setVolume(music: number, sfx: number): void {
    this.musicVolume = this.clampVolume(music);
    this.sfxVolume = this.clampVolume(sfx);
  }
}

export const audioManager = new AudioManager();
