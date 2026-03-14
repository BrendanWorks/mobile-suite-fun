import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, RefreshCw, Clock, Infinity } from 'lucide-react';
import { fetchTopAllTime, fetchTopThisWeek, LeaderboardEntry } from '../lib/supabaseHelpers';

type Filter = 'alltime' | 'weekly';

const RANK_STYLES: Record<number, { bg: string; text: string; border: string; glow: string; label: string }> = {
  1: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-400/60', glow: '0 0 12px rgba(251,191,36,0.5)', label: 'text-yellow-300' },
  2: { bg: 'bg-slate-400/10', text: 'text-slate-300', border: 'border-slate-400/60', glow: '0 0 10px rgba(148,163,184,0.4)', label: 'text-slate-200' },
  3: { bg: 'bg-amber-700/10', text: 'text-amber-500', border: 'border-amber-600/60', glow: '0 0 10px rgba(217,119,6,0.4)', label: 'text-amber-400' },
};

const DEFAULT_STYLE = { bg: 'bg-white/5', text: 'text-gray-400', border: 'border-white/10', glow: 'none', label: 'text-gray-300' };

function RankBadge({ rank }: { rank: number }) {
  const s = RANK_STYLES[rank] ?? DEFAULT_STYLE;
  if (rank === 1) return (
    <div className="w-8 h-8 flex items-center justify-center">
      <Trophy className={`w-6 h-6 ${s.text}`} style={{ filter: `drop-shadow(${s.glow})` }} />
    </div>
  );
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${s.bg} ${s.text} ${s.border}`}>
      {rank}
    </div>
  );
}

export default function Leaderboard() {
  const [filter, setFilter] = useState<Filter>('alltime');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = filter === 'alltime'
      ? await fetchTopAllTime(25)
      : await fetchTopThisWeek(25);

    if (result.success && result.data) {
      setEntries(result.data);
    } else {
      setError(result.error ?? 'Failed to load leaderboard');
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-yellow-400" style={{ textShadow: '0 0 20px rgba(251,191,36,0.5)' }}>
          Leaderboard
        </h2>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-lg border border-white/10">
        <button
          onClick={() => setFilter('alltime')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-all ${
            filter === 'alltime'
              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-400/40'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Infinity className="w-4 h-4" />
          All Time
        </button>
        <button
          onClick={() => setFilter('weekly')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-all ${
            filter === 'weekly'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          This Week
        </button>
      </div>

      {error && (
        <div className="text-center py-8 text-red-400 text-sm">{error}</div>
      )}

      {loading && !error && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-yellow-400" />
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-sm">No entries yet.</div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="space-y-4">
          {topThree.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[topThree[1], topThree[0], topThree[2]].map((entry, visualIdx) => {
                if (!entry) return <div key={visualIdx} />;
                const actualRank = entry.rank!;
                const s = RANK_STYLES[actualRank] ?? DEFAULT_STYLE;
                const isFirst = actualRank === 1;
                return (
                  <div
                    key={entry.id}
                    className={`flex flex-col items-center p-3 rounded-xl border ${s.bg} ${s.border} ${isFirst ? 'scale-105 -mt-2' : ''} transition-transform`}
                    style={{ boxShadow: s.glow !== 'none' ? s.glow : undefined }}
                  >
                    {isFirst && (
                      <Trophy className={`w-6 h-6 mb-1 ${s.text}`} style={{ filter: `drop-shadow(0 0 8px rgba(251,191,36,0.7))` }} />
                    )}
                    {!isFirst && (
                      <div className={`text-xs font-bold mb-1 ${s.text}`}>#{actualRank}</div>
                    )}
                    <div className={`text-xs font-bold text-center truncate w-full text-center ${s.label}`}>
                      {entry.display_name}
                    </div>
                    <div className={`text-lg font-black mt-1 ${s.text}`}>
                      {entry.score.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {rest.length > 0 && (
            <div className="space-y-1.5">
              {rest.map((entry) => {
                const s = DEFAULT_STYLE;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-white/5 border border-white/8 hover:bg-white/8 transition-colors"
                  >
                    <RankBadge rank={entry.rank!} />
                    <span className="flex-1 text-sm font-medium text-gray-200 truncate">
                      {entry.display_name}
                    </span>
                    <span className="text-sm font-bold text-gray-300 tabular-nums">
                      {entry.score.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
