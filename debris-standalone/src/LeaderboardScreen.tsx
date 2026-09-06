import type { LeaderboardEntry } from './leaderboard';

interface LeaderboardScreenProps {
  entries: LeaderboardEntry[];
  loading: boolean;
  playerInitials: string | null;
  onBack: () => void;
}

export default function LeaderboardScreen({ entries, loading, playerInitials, onBack }: LeaderboardScreenProps) {
  return (
    <div className="screen leaderboard-screen">
      <div className="starfield-bg" />
      <div className="leaderboard-content">
        <h2 className="leaderboard-heading">HIGH SCORES</h2>

        {loading ? (
          <p className="leaderboard-status">LOADING&hellip;</p>
        ) : entries.length === 0 ? (
          <p className="leaderboard-status">NO SCORES YET &mdash; BE THE FIRST</p>
        ) : (
          <ol className="leaderboard-list">
            {entries.map((e, i) => {
              const isPlayerScore = playerInitials && e.initials === playerInitials;
              return (
                <li key={`${e.ts}-${i}`} className={`leaderboard-row ${isPlayerScore ? 'player-score' : ''}`}>
                  <span className="leaderboard-rank">{i + 1}</span>
                  <span className="leaderboard-initials">{e.initials}{isPlayerScore && ' ★'}</span>
                  <span className="leaderboard-score">{e.score.toLocaleString()}</span>
                  <span className="leaderboard-wave">WAVE {e.wave}</span>
                </li>
              );
            })}
          </ol>
        )}

        <button className="debris-btn debris-btn-primary" onClick={onBack}>BACK</button>
      </div>
    </div>
  );
}
