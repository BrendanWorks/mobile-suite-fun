import { audioManager } from "./audioManager";

type ToneOpts = {
  frequency: number;
  duration: number;
  volume?: number;
  type?: OscillatorType;
};

function playTone({ frequency, duration, volume = 0.18, type = "sine" }: ToneOpts): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000 + 0.05);
    osc.onended = () => ctx.close();
  } catch {
    // audio context unavailable — silent fallback
  }
}

export const SOUND_KEYS = {
  WIN:    "sfx-win",
  WRONG:  "sfx-wrong",
  SELECT: "sfx-select",
} as const;

export function preloadGameSounds(): void {
  audioManager.loadSound(SOUND_KEYS.WIN,    "/sounds/global/win_optimized.mp3",    2);
  audioManager.loadSound(SOUND_KEYS.WRONG,  "/sounds/global/wrong_optimized.mp3",  2);
  audioManager.loadSound(SOUND_KEYS.SELECT, "/sounds/ranky/select_optimized.mp3",  3);
}

export function playWin(volume = 0.7):   void { audioManager.play(SOUND_KEYS.WIN,    volume); }
export function playWrong(volume = 0.3): void { audioManager.play(SOUND_KEYS.WRONG,  volume); }
export function playSelect(volume = 0.4):void { audioManager.play(SOUND_KEYS.SELECT, volume); }

export function playCountdownBeep(n: number): void {
  const freq = n <= 1 ? 1046 : n === 2 ? 880 : 740;
  playTone({ frequency: freq, duration: 140, volume: 0.2, type: "sine" });
}

export function playRoundStartChime(): void {
  playTone({ frequency: 880,  duration: 100, volume: 0.18, type: "sine" });
  setTimeout(() => playTone({ frequency: 1100, duration: 160, volume: 0.22, type: "sine" }), 120);
}
