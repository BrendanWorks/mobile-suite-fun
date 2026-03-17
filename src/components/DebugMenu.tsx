interface Props {
  onLoadPlaylist: (id: number) => void
}

export default function DebugMenu({ onLoadPlaylist }: Props) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">

        <div className="text-center mb-10">
          <p className="text-cyan-400/50 text-xs tracking-widest uppercase mb-2">Developer Tools</p>
          <h1
            className="text-white font-black text-4xl"
            style={{ textShadow: '0 0 20px rgba(0,255,255,0.5)' }}
          >
            Debug Menu
          </h1>
        </div>

        <div
          className="rounded-2xl border-2 p-6"
          style={{
            borderColor: 'rgba(34,211,238,0.2)',
            background: 'rgba(34,211,238,0.04)',
            boxShadow: '0 0 30px rgba(0,255,255,0.06)',
          }}
        >
          <p className="text-cyan-400/60 text-xs uppercase tracking-widest mb-1">Superlative</p>
          <h2 className="text-white font-bold text-lg mb-1">Playlist 51 — Full Test</h2>
          <p className="text-white/40 text-xs mb-5">
            18 puzzles: Louder, Faster, Hotter, Saltier, Taller, Shorter, Pricier
          </p>

          <button
            onClick={() => onLoadPlaylist(51)}
            className="w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95"
            style={{
              background: 'transparent',
              border: '2px solid #22d3ee',
              color: '#22d3ee',
              textShadow: '0 0 8px #22d3ee',
              boxShadow: '0 0 20px rgba(34,211,238,0.25)',
              cursor: 'pointer',
            }}
          >
            Load All 18 Superlatives
          </button>
        </div>

        <p className="text-white/20 text-xs text-center mt-8">
          game-platform · superlative debug
        </p>
      </div>
    </div>
  )
}
