import type { GameStats } from './Game';

interface GameOverResult {
  score: number;
  stats: GameStats;
  isNewHigh: boolean;
}

interface GameOverScreenProps {
  result: GameOverResult;
  highScore: number;
  globalRank: number | null;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

export default function GameOverScreen({ result, highScore, globalRank, onPlayAgain, onMainMenu }: GameOverScreenProps) {
  const { score, stats, isNewHigh } = result;

  return (
    <div className="screen gameover-screen">
      <div className="starfield-bg" />
      <div className="gameover-content">
        <h2 className="gameover-heading">GAME OVER</h2>

        {globalRank != null
          ? <p className="new-high-banner">★ GLOBAL RANK #{globalRank} ★</p>
          : isNewHigh && <p className="new-high-banner">★ NEW HIGH SCORE ★</p>}

        <p className="gameover-score">{score.toLocaleString()}</p>

        <div className="gameover-stats">
          <div className="stat-box">
            <span className="stat-value">{highScore.toLocaleString()}</span>
            <span className="stat-label">HIGH SCORE</span>
          </div>
          <div className="stat-box">
            <span className="stat-value">{stats.wave}</span>
            <span className="stat-label">WAVE REACHED</span>
          </div>
          <div className="stat-box">
            <span className="stat-value">{stats.rocksDestroyed}</span>
            <span className="stat-label">ROCKS DESTROYED</span>
          </div>
        </div>

        <div className="gameover-actions">
          <button className="debris-btn debris-btn-primary" onClick={onPlayAgain}>PLAY AGAIN</button>
          <button className="debris-btn" onClick={onMainMenu}>MAIN MENU</button>
        </div>
      </div>
    </div>
  );
}
