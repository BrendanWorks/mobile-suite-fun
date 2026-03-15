import { audioManager } from "./audioManager";

type ToneOpts = {
  frequency: number;
  duration: number;
  volume?: number;
  type?: OscillatorType;
};

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (sharedAudioContext) return sharedAudioContext;

  try {
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    sharedAudioContext = new AudioContextClass();
    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

function playTone({ frequency, duration, volume = 0.18, type = "sine" }: ToneOpts): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

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
  } catch {
    // audio context unavailable — silent fallback
  }
}

export const SOUND_KEYS = {
  WIN:           "sfx-win",
  WRONG:         "sfx-wrong",
  SELECT:        "sfx-select",
  COUNTDOWN:     "sfx-countdown",
  HURRY_UP:      "sfx-hurry-up",
  TIME_UP:       "sfx-time-up",
  HIVE_MYSTERY:  "sfx-hive-mystery",
} as const;

export function preloadGameSounds(): void {
  audioManager.loadSound(SOUND_KEYS.WIN,       "/sounds/global/SmallWin.mp3",           2);
  audioManager.loadSound(SOUND_KEYS.WRONG,     "/sounds/global/wrong_optimized.mp3",    2);
  audioManager.loadSound(SOUND_KEYS.SELECT,    "/sounds/ranky/select_optimized.mp3",    3);
}

export function preloadTimerSounds(): void {
  audioManager.loadSound(SOUND_KEYS.COUNTDOWN,    "/sounds/global/SoundCountdown.mp3",        1);
  audioManager.loadSound(SOUND_KEYS.HURRY_UP,     "/sounds/global/SoundHurryUp.mp3",          1);
  audioManager.loadSound(SOUND_KEYS.TIME_UP,      "/sounds/ranky/FailOtimized.mp3",           1);
  audioManager.loadSound(SOUND_KEYS.HIVE_MYSTERY, "/sounds/hivemind/Hive_Mindmystery_1.mp3",  1);
}

export function playTimerCountdown(): void  { audioManager.play(SOUND_KEYS.COUNTDOWN,    0.35); }
export function stopTimerCountdown(): void  { audioManager.stopLoop(SOUND_KEYS.COUNTDOWN); }
export function isTimerCountdownReady(): boolean { return audioManager.isReady(SOUND_KEYS.COUNTDOWN); }
export function playHurryUp(): void         { audioManager.play(SOUND_KEYS.HURRY_UP,     0.6); }
export function stopHurryUp(): void         { audioManager.stop(SOUND_KEYS.HURRY_UP); }
export function playTimeUp(): void          { audioManager.play(SOUND_KEYS.TIME_UP,       0.7); }
export function playHiveMystery(): void     { audioManager.play(SOUND_KEYS.HIVE_MYSTERY,  0.8); }

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
