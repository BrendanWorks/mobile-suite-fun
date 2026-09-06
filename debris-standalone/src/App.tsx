import { useCallback, useEffect, useState } from 'react';
import DebrisGame, { type GameStats } from './Game';
import { sfx } from './audio';
import TitleScreen from './TitleScreen';
import GameOverScreen from './GameOverScreen';
import InitialsEntry from './InitialsEntry';
import LeaderboardScreen from './LeaderboardScreen';
import { fetchLeaderboard, flushQueue, qualifies, submitScore, type LeaderboardEntry } from './leaderboard';

const HIGH_SCORE_KEY = 'debris_high_score';
const MUTED_KEY = 'debris_muted';

type Screen = 'title' | 'playing' | 'gameover' | 'initials' | 'leaderboard';

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

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [submittedInitials, setSubmittedInitials] = useState<string | null>(null);
  const [submittingScore, setSubmittingScore] = useState(false);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try { localStorage.setItem(MUTED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Decode the sound effects while the title screen is up so they're ready
  // for the first shot. Safe before any tap; the audio context just sits
  // suspended until PLAY (a real gesture) unlocks it.
  useEffect(() => { sfx.preload(); }, []);

  // Warm the leaderboard cache up front so the game-over qualifying check
  // (see handleGameOver) has real data instead of guessing, and flush any
  // score that got queued from a previous offline session -- on load, and
  // again whenever connectivity actually returns.
  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard().then((list) => {
      if (!cancelled) { setLeaderboard(list); setLeaderboardLoading(false); }
    });
    void flushQueue();
    const onOnline = () => { void flushQueue(); };
    window.addEventListener('online', onOnline);
    return () => { cancelled = true; window.removeEventListener('online', onOnline); };
  }, []);

  const startGame = useCallback(() => {
    sfx.unlock();
    setResult(null);
    setGlobalRank(null);
    setSubmittedInitials(null);
    setGameKey((k) => k + 1);
    setScreen('playing');
  }, []);

  const goToTitle = useCallback(() => {
    setScreen('title');
  }, []);

  const showLeaderboard = useCallback(() => {
    setScreen('leaderboard');
    setLeaderboardLoading(true);
    fetchLeaderboard().then((list) => {
      setLeaderboard(list);
      setLeaderboardLoading(false);
    });
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
    // qualifies() is only a UX gate against best-effort cached data, so the
    // initials ceremony isn't shown to a run that's obviously not close --
    // the server is the real authority on whether it survives into the
    // persisted top 10 (see submitScore/handleInitialsSubmit below).
    setScreen(qualifies(score, leaderboard) ? 'initials' : 'gameover');
  }, [leaderboard]);

  const handleInitialsSubmit = useCallback(async (initials: string) => {
    if (!result) return;
    setSubmittingScore(true);
    const outcome = await submitScore({
      initials,
      score: result.score,
      wave: result.stats.wave,
      rocksDestroyed: result.stats.rocksDestroyed,
      durationMs: result.stats.durationMs,
    });
    setSubmittedInitials(initials);
    if (outcome) {
      setLeaderboard(outcome.list);
      setGlobalRank(outcome.rank);
    } else {
      // Offline, or the function was unreachable -- submitScore already
      // queued it for later (flushed on the next load or 'online' event).
      setGlobalRank(null);
    }
    setSubmittingScore(false);
    setScreen('gameover');
  }, [result]);

  const handleInitialsSkip = useCallback(() => {
    setGlobalRank(null);
    setScreen('gameover');
  }, []);

  return (
    <div className="app-root">
      {screen === 'title' && (
        <TitleScreen highScore={highScore} muted={muted} onToggleMute={toggleMute} onPlay={startGame} onShowLeaderboard={showLeaderboard} />
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
      {screen === 'initials' && result && (
        <InitialsEntry score={result.score} onSubmit={handleInitialsSubmit} onSkip={handleInitialsSkip} submitting={submittingScore} />
      )}
      {screen === 'gameover' && result && (
        <GameOverScreen result={result} highScore={highScore} globalRank={globalRank} submittedInitials={submittedInitials} onPlayAgain={startGame} onMainMenu={goToTitle} />
      )}
      {screen === 'leaderboard' && (
        <LeaderboardScreen entries={leaderboard} loading={leaderboardLoading} playerInitials={submittedInitials} onBack={goToTitle} />
      )}
    </div>
  );
}
