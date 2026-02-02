class AudioManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private musicVolume: number = 0.5;
  private sfxVolume: number = 0.7;
  private enabled: boolean = true;

  async loadSound(key: string, url: string): Promise<void> {
    try {
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.sounds.set(key, audio);

      return new Promise((resolve, reject) => {
        audio.addEventListener('canplaythrough', () => resolve(), { once: true });
        audio.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)), { once: true });
      });
    } catch (error) {
      console.warn(`Could not load sound: ${key}`, error);
    }
  }

  play(key: string, volume?: number): void {
    if (!this.enabled) return;

    const sound = this.sounds.get(key);
    if (sound) {
      // Clone the audio to allow overlapping plays
      const clone = sound.cloneNode(true) as HTMLAudioElement;
      clone.volume = volume ?? this.sfxVolume;
      clone.play().catch(err => console.log('Audio play failed:', err));
    } else {
      console.warn(`Sound not found: ${key}`);
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
      this.sounds.forEach(sound => {
        sound.pause();
        sound.currentTime = 0;
      });
    }
  }

  setVolume(music: number, sfx: number): void {
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
  }
}

// Singleton instance
export const audioManager = new AudioManager();
