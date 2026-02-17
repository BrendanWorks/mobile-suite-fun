class AudioManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private pools: Map<string, HTMLAudioElement[]> = new Map();
  private musicVolume: number = 0.25;
  private sfxVolume: number = 0.7;
  private enabled: boolean = true;
  private initialized: boolean = false;

  // Initialize on first user interaction (CRITICAL FOR iOS)
  initialize(): void {
    if (this.initialized) return;

    // Resume any suspended audio contexts
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContext.resume();

    this.initialized = true;
    console.log('🔊 Audio initialized');
  }

  async loadSound(key: string, url: string, poolSize: number = 3): Promise<void> {
    try {
      // Create pool of audio elements for this sound
      const pool: HTMLAudioElement[] = [];

      for (let i = 0; i < poolSize; i++) {
        const audio = new Audio(url);
        audio.preload = 'auto';

        // Wait for it to actually load
        await new Promise((resolve, reject) => {
          audio.addEventListener('canplaythrough', () => resolve(null), { once: true });
          audio.addEventListener('error', reject, { once: true });

          // Timeout fallback
          setTimeout(() => resolve(null), 2000);
        });

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
    let audio = pool.find(a => a.paused || a.ended);

    // If all are playing, use the first one anyway (will restart it)
    if (!audio) audio = pool[0];

    audio.currentTime = 0;
    audio.volume = volume ?? this.sfxVolume;

    // Clone the play promise to catch errors silently
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        // Silently fail - this is expected on some browsers
        console.log(`Play interrupted: ${key}`);
      });
    }
  }

  playMusic(key: string): void {
    if (!this.enabled) return;

    const music = this.sounds.get(key);
    if (music) {
      music.loop = true;
      music.volume = this.musicVolume;
      music.play().catch(err => console.log('Music play failed:', err));
    }
  }

  stopMusic(key: string): void {
    const music = this.sounds.get(key);
    if (music) {
      music.pause();
      music.currentTime = 0;
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
