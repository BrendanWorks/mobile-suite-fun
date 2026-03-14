import React, { useState, useEffect } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';
import { audioManager } from '../lib/audioManager';

const STORAGE_KEY = 'rowdy_sfx_level';

type SfxLevel = 'full' | 'low' | 'off';

const LEVELS: SfxLevel[] = ['full', 'low', 'off'];

const LEVEL_CONFIG: Record<SfxLevel, { sfx: number; music: number; label: string }> = {
  full: { sfx: 0.7, music: 0.12, label: 'Sound: Full' },
  low:  { sfx: 0.3, music: 0.06, label: 'Sound: Low'  },
  off:  { sfx: 0.0, music: 0.0,  label: 'Sound: Off'  },
};

export function getSavedSfxLevel(): SfxLevel {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'full' || saved === 'low' || saved === 'off') return saved;
  return 'full';
}

export function applySfxLevel(level: SfxLevel): void {
  const cfg = LEVEL_CONFIG[level];
  audioManager.setVolume(cfg.music, cfg.sfx);
  audioManager.setEnabled(level !== 'off');
}

export default function SfxVolumeControl() {
  const [level, setLevel] = useState<SfxLevel>(() => getSavedSfxLevel());

  useEffect(() => {
    applySfxLevel(level);
  }, [level]);

  const cycle = () => {
    setLevel(prev => {
      const next = LEVELS[(LEVELS.indexOf(prev) + 1) % LEVELS.length];
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const Icon = level === 'off' ? VolumeX : level === 'low' ? Volume1 : Volume2;
  const isOff = level === 'off';
  const isLow = level === 'low';

  return (
    <button
      onClick={cycle}
      title={LEVEL_CONFIG[level].label}
      className={[
        'flex items-center gap-1.5 px-4 py-3 bg-transparent border-2 font-semibold rounded-lg transition-all active:scale-95 text-sm touch-manipulation',
        isOff
          ? 'border-gray-600/50 hover:border-gray-500 text-gray-500 hover:text-gray-400'
          : isLow
          ? 'border-cyan-500/50 hover:border-cyan-400 text-cyan-500/70 hover:text-cyan-400'
          : 'border-cyan-400/50 hover:border-cyan-400 text-cyan-400/80 hover:text-cyan-400',
      ].join(' ')}
      style={
        !isOff
          ? { textShadow: '0 0 8px rgba(34,211,238,0.4)', boxShadow: '0 0 8px rgba(34,211,238,0.1)' }
          : undefined
      }
    >
      <Icon className="w-4 h-4" />
      {LEVEL_CONFIG[level].label}
    </button>
  );
}
