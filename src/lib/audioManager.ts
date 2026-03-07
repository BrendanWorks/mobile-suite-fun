class AudioManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private pools: Map<string, HTMLAudioElement[]> = new Map();
  private musicVolume: number = 0.12;
  private sfxVolume: number = 0.7;
  private enabled: boolean = true;
  private initialized: boolean = false;
  private audioContext: AudioContext | null = null;

  // Initialize on first user interaction (CRITICAL FOR iOS)
  initialize(): void {
    if (this.initialized) return;

    try {
      // Resume any suspended audio contexts
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

  async loadSound(key: string, url: string, poolSize: number = 3): Promise<void> {
    try {
      // Create pool of audio elements for this sound
      const pool: HTMLAudioElement[] = [];

      for (let i = 0; i < poolSize; i++) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';

        // Wait for it to load with timeout
        const loadPromise = new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            audio.removeEventListener('canplaythrough', onCanPlayThrough);
            audio.removeEventListener('error', onError);
            resolve();
          }, 3000);

          const onCanPlayThrough = () => {
            clearTimeout(timeout);
            audio.removeEventListener('canplaythrough', onCanPlayThrough);
            audio.removeEventListener('error', onError);
            resolve();
          };

          const onError = () => {
            clearTimeout(timeout);
            audio.removeEventListener('canplaythrough', onCanPlayThrough);
            audio.removeEventListener('error', onError);
            resolve();
          };

          audio.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
          audio.addEventListener('error', onError, { once: true });
          audio.src = url;
        });

        await loadPromise;
        pool.push(audio);
      }

      this.pools.set(key, pool);
      this.sounds.set(key, pool[0]); // Keep first one as reference
      console.log(`✅ Loaded sound pool: ${key} (${poolSize} instances)`);

    } catch (error) {
      console.warn(`Could not load sound: ${key}`, error);
    }
  }

  play(key: string, volume?: number): void {
    if (!this.enabled) return;

    // Get a free audio instance from pool
    const pool = this.pools.get(key);
    if (!pool || pool.length === 0) {
      console.warn(`Sound pool not found: ${key}`);
      return;
    }

    // Find an available (not playing) instance
    let audio = pool.find(a => {
      try {
        return a.paused || a.ended;
      } catch {
        return false;
      }
    });

    // If all are playing, use the first one anyway (will restart it)
    if (!audio) audio = pool[0];

    try {
      // Ensure we can modify the audio element
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, volume ?? this.sfxVolume));

      // Play with error handling
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Silent fail - expected on some platforms
        });
      }
    } catch (error) {
      console.warn(`Could not play sound: ${key}`, error);
    }
  }

  playMusic(key: string): void {
    if (!this.enabled) return;

    const music = this.sounds.get(key);
    if (music) {
      try {
        music.loop = true;
        music.volume = this.musicVolume;
        const playPromise = music.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      } catch (error) {
        console.warn('Music play failed:', error);
      }
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
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
  }
}

export const audioManager = new AudioManager();
