import { useCallback, useState } from 'react';
import DebrisGame, { type GameStats } from './Game';
import TitleScreen from './TitleScreen';
import GameOverScreen from './GameOverScreen';

const HIGH_SCORE_KEY = 'debris_high_score';
const MUTED_KEY = 'debris_muted';

type Screen = 'title' | 'playing' | 'gameover';

interface GameOverResult {
  score: number;
  stats: GameStats;
  isNewHigh: boolean;
}

function loadHighScore(): number {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [muted, setMuted] = useState<boolean>(loadMuted);
  const [highScore, setHighScore] = useState<number>(loadHighScore);
  const [result, setResult] = useState<GameOverResult | null>(null);
  const [gameKey, setGameKey] = useState(0);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try { localStorage.setItem(MUTED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const startGame = useCallback(() => {
    setResult(null);
    setGameKey((k) => k + 1);
    setScreen('playing');
  }, []);

  const goToTitle = useCallback(() => {
    setScreen('title');
  }, []);

  const handleGameOver = useCallback((score: number, stats: GameStats) => {
    setHighScore((prevHigh) => {
      const isNewHigh = score > prevHigh;
      const nextHigh = isNewHigh ? score : prevHigh;
      if (isNewHigh) {
        try { localStorage.setItem(HIGH_SCORE_KEY, String(score)); } catch { /* ignore */ }
      }
      setResult({ score, stats, isNewHigh });
      return nextHigh;
    });
    setScreen('gameover');
  }, []);

  return (
    <div className="app-root">
      {screen === 'title' && (
        <TitleScreen highScore={highScore} muted={muted} onToggleMute={toggleMute} onPlay={startGame} />
      )}
      {screen === 'playing' && (
        <DebrisGame
          key={gameKey}
          muted={muted}
          onToggleMute={toggleMute}
          onGameOver={handleGameOver}
          onQuit={goToTitle}
        />
      )}
      {screen === 'gameover' && result && (
        <GameOverScreen result={result} highScore={highScore} onPlayAgain={startGame} onMainMenu={goToTitle} />
      )}
    </div>
  );
}
