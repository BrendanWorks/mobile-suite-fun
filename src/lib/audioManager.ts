class AudioManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private pools: Map<string, HTMLAudioElement[]> = new Map();
  private readyStates: Map<HTMLAudioElement, boolean> = new Map();
  private musicVolume: number = 0.12;
  private sfxVolume: number = 0.7;
  private enabled: boolean = true;
  private initialized: boolean = false;
  private audioContext: AudioContext | null = null;

  initialize(): void {
    if (this.initialized) return;

    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      this.audioContext = new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to initialize audio context:', e);
    }

    this.initialized = true;
    console.log('🔊 Audio initialized');
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
    if (!url) {
      console.warn(`Invalid URL for sound: ${key}`);
      return;
    }

    try {
      const pool: HTMLAudioElement[] = [];
      const failedInstances: HTMLAudioElement[] = [];

      for (let i = 0; i < poolSize; i++) {
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

          const timeout = setTimeout(() => {
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

      if (pool.length === 0) {
        console.warn(`Failed to load any instances of sound: ${key}`);
        return;
      }

      this.pools.set(key, pool);
      this.sounds.set(key, pool[0]);
      console.log(`✅ Loaded sound pool: ${key} (${pool.length}/${poolSize} instances ready)`);

    } catch (error) {
      console.warn(`Could not load sound: ${key}`, error);
    }
  }

  play(key: string, volume?: number): void {
    if (!this.enabled) return;

    const pool = this.pools.get(key);
    if (!pool || pool.length === 0) {
      console.warn(`Sound pool not found: ${key}`);
      return;
    }

    let audio = pool.find(a => {
      try {
        return (a.paused || a.ended) && this.readyStates.get(a);
      } catch {
        return false;
      }
    });

    if (!audio) audio = pool[0];
    if (!this.readyStates.get(audio)) {
      console.warn(`Audio not ready: ${key}`);
      return;
    }

    try {
      audio.currentTime = 0;
      audio.volume = this.clampVolume(volume ?? this.sfxVolume);
      this.handlePlayPromise(audio.play());
    } catch (error) {
      console.warn(`Could not play sound: ${key}`, error);
    }
  }

  playMusic(key: string): void {
    if (!this.enabled) return;

    const music = this.sounds.get(key);
    if (!music || !this.readyStates.get(music)) {
      console.warn(`Music not found or not ready: ${key}`);
      return;
    }

    try {
      music.loop = true;
      music.volume = this.clampVolume(this.musicVolume);
      this.handlePlayPromise(music.play());
    } catch (error) {
      console.warn('Music play failed:', error);
    }
  }

  stopMusic(key: string): void {
    const music = this.sounds.get(key);
    if (music) {
      try {
        music.pause();
        music.currentTime = 0;
      } catch (error) {
        console.warn('Could not stop music:', error);
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
}

export const audioManager = new AudioManager();