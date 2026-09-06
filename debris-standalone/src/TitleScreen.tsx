interface TitleScreenProps {
  highScore: number;
  muted: boolean;
  onToggleMute: () => void;
  onPlay: () => void;
  onShowLeaderboard: () => void;
}

const LEGEND: { color: string; label: string; desc: string }[] = [
  { color: '#fbbf24', label: 'RAPID FIRE', desc: 'faster shots' },
  { color: '#ff6ec7', label: 'SPREAD SHOT', desc: 'triple shot' },
  { color: '#22d3ee', label: 'SHIELD', desc: 'blocks one hit' },
  { color: '#4ade80', label: 'EXTRA LIFE', desc: '+1 life' },
  { color: '#fb923c', label: 'VOLATILE ROCK', desc: 'chain-detonates nearby rocks' },
];

export default function TitleScreen({ highScore, muted, onToggleMute, onPlay, onShowLeaderboard }: TitleScreenProps) {
  return (
    <div className="screen title-screen">
      <div className="starfield-bg" />

      <button className="debris-icon-btn corner-btn" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
        {muted ? '🔇' : '🔊'}
      </button>

      <div className="title-content">
        <h1 className="debris-logo">DEBRIS</h1>
        <p className="tagline">a neon asteroids-style arcade shooter</p>

        {highScore > 0 && (
          <div className="high-score-badge">
            <span className="high-score-label">HIGH SCORE</span>
            <span className="high-score-value">{highScore.toLocaleString()}</span>
          </div>
        )}

        <button className="debris-btn debris-btn-primary play-btn" onClick={onPlay}>
          PLAY
        </button>

        <button className="debris-btn debris-btn-text leaderboard-link" onClick={onShowLeaderboard}>
          HIGH SCORES
        </button>

        <p className="draft-note">Clear a sector, pick an upgrade. Ship gets stronger every wave.</p>

        <div className="legend-panel">
          <p className="legend-title">POWER-UPS &amp; HAZARDS</p>
          <div className="legend-grid">
            {LEGEND.map((item) => (
              <div key={item.label} className="legend-item">
                <span className="legend-dot" style={{ background: item.color, boxShadow: `0 0 8px ${item.color}` }} />
                <span className="legend-text">
                  <strong style={{ color: item.color }}>{item.label}</strong>
                  <span className="legend-desc">{item.desc}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="controls-panel">
          <div className="controls-col">
            <p className="controls-heading">KEYBOARD</p>
            <p><kbd>&larr;</kbd><kbd>&rarr;</kbd> or <kbd>A</kbd><kbd>D</kbd> rotate</p>
            <p><kbd>&uarr;</kbd> or <kbd>W</kbd> thrust</p>
            <p><kbd>SPACE</kbd> fire &middot; <kbd>SHIFT</kbd> dash</p>
            <p><kbd>P</kbd> pause &middot; <kbd>M</kbd> mute</p>
          </div>
          <div className="controls-col">
            <p className="controls-heading">TOUCH</p>
            <p>hold either side to turn &amp; thrust</p>
            <p>tap to fire &middot; 2 fingers to fire</p>
            <p>DASH button for a phase-dash</p>
          </div>
        </div>
      </div>
    </div>
  );
}
