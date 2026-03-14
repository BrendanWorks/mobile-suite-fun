import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, RefreshCw, Clock, Infinity, Zap, Star, Flame } from 'lucide-react';
import { fetchTopAllTime, fetchTopThisWeek, LeaderboardEntry } from '../lib/supabaseHelpers';
import { EagleEyeBadgeIcon } from './EagleEyeBadge';
import { WordsmithBadgeIcon } from './WordsmithBadge';
import { ZeitgeistBadgeIcon } from './ZeitgeistBadge';
import { ArcadeKingBadgeIcon } from './ArcadeKingBadge';

type Filter = 'alltime' | 'weekly';

const RANK_STYLES: Record<number, { bg: string; text: string; border: string; shadow: string; label: string; scoreCx: string }> = {
  1: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-300',
    border: 'border-cyan-400/70',
    shadow: '0 0 18px rgba(34,211,238,0.55), inset 0 0 12px rgba(34,211,238,0.08)',
    label: 'text-white',
    scoreCx: 'text-cyan-300',
  },
  2: {
    bg: 'bg-cyan-900/20',
    text: 'text-cyan-400/80',
    border: 'border-cyan-500/40',
    shadow: '0 0 10px rgba(34,211,238,0.25)',
    label: 'text-cyan-100',
    scoreCx: 'text-cyan-400',
  },
  3: {
    bg: 'bg-cyan-900/10',
    text: 'text-cyan-500/70',
    border: 'border-cyan-600/30',
    shadow: '0 0 8px rgba(34,211,238,0.15)',
    label: 'text-cyan-200',
    scoreCx: 'text-cyan-500',
  },
};

const DEFAULT_STYLE = {
  bg: '',
  text: 'text-cyan-600/60',
  border: 'border-cyan-900/40',
  shadow: 'none',
  label: 'text-gray-200',
  scoreCx: 'text-cyan-300',
};

function MostRoundsBadge() {
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-black tracking-wider"
      style={{
        background: 'rgba(34,211,238,0.12)',
        border: '1px solid rgba(34,211,238,0.45)',
        color: '#67e8f9',
        boxShadow: '0 0 8px rgba(34,211,238,0.35)',
        whiteSpace: 'nowrap',
      }}
      title="Most Rounds Played"
    >
      <Zap className="w-2.5 h-2.5" style={{ filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.8))' }} />
      <span style={{ fontSize: '0.6rem' }}>GRINDER</span>
    </div>
  );
}

function PerfectScoreBadge() {
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-black tracking-wider"
      style={{
        background: 'rgba(251,191,36,0.12)',
        border: '1px solid rgba(251,191,36,0.5)',
        color: '#fcd34d',
        boxShadow: '0 0 8px rgba(251,191,36,0.3)',
        whiteSpace: 'nowrap',
      }}
      title="Most Perfect Scores"
    >
      <Star className="w-2.5 h-2.5" style={{ filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.9))' }} />
      <span style={{ fontSize: '0.6rem' }}>PERFECT</span>
    </div>
  );
}

function SpeedDemonBadge() {
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-black tracking-wider"
      style={{
        background: 'rgba(249,115,22,0.12)',
        border: '1px solid rgba(249,115,22,0.5)',
        color: '#fb923c',
        boxShadow: '0 0 8px rgba(249,115,22,0.3)',
        whiteSpace: 'nowrap',
      }}
      title="Fastest Completion Time"
    >
      <Flame className="w-2.5 h-2.5" style={{ filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.9))' }} />
      <span style={{ fontSize: '0.6rem' }}>SPEEDY</span>
    </div>
  );
}

function EagleEyeLeaderboardBadge() {
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded"
      style={{
        background: 'rgba(0,255,255,0.1)',
        border: '1px solid rgba(0,255,255,0.45)',
        boxShadow: '0 0 8px rgba(0,255,255,0.35)',
        whiteSpace: 'nowrap',
      }}
      title="Eagle Eye — 85%+ accuracy on 5+ visual rounds"
    >
      <EagleEyeBadgeIcon size={16} />
      <span className="font-black tracking-wider" style={{ fontSize: '0.6rem', color: '#67e8f9', textShadow: '0 0 6px rgba(0,255,255,0.9)' }}>EAGLE EYE</span>
    </div>
  );
}

function TriviaBadge() {
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-black tracking-wider"
      style={{
        background: 'rgba(99,102,241,0.12)',
        border: '1px solid rgba(129,140,248,0.5)',
        color: '#a5b4fc',
        boxShadow: '0 0 8px rgba(99,102,241,0.3)',
        whiteSpace: 'nowrap',
      }}
      title="Trivia Ace"
    >
      <Star className="w-2.5 h-2.5" style={{ filter: 'drop-shadow(0 0 4px rgba(129,140,248,0.9))' }} />
      <span style={{ fontSize: '0.6rem' }}>TRIVIA ACE</span>
    </div>
  );
}

function WordsmithLeaderboardBadge() {
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded"
      style={{
        background: 'linear-gradient(135deg, rgba(0,255,255,0.08) 0%, rgba(251,191,36,0.08) 100%)',
        border: '1px solid rgba(0,255,255,0.4)',
        boxShadow: '0 0 8px rgba(0,255,255,0.25)',
        whiteSpace: 'nowrap',
      }}
      title="Wordsmith — word puzzle master"
    >
      <WordsmithBadgeIcon size={16} />
      <span className="font-black tracking-wider" style={{ fontSize: '0.6rem', color: '#67e8f9', textShadow: '0 0 6px rgba(0,255,255,0.8)' }}>WORDSMITH</span>
    </div>
  );
}

function ZeitgeistLeaderboardBadge() {
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded"
      style={{
        background: 'linear-gradient(135deg, rgba(0,255,255,0.08) 0%, rgba(255,0,255,0.08) 100%)',
        border: '1px solid rgba(255,0,255,0.45)',
        boxShadow: '0 0 8px rgba(255,0,255,0.3)',
        whiteSpace: 'nowrap',
      }}
      title="Zeitgeist — pop culture & word speed master"
    >
      <ZeitgeistBadgeIcon size={16} />
      <span className="font-black tracking-wider" style={{ fontSize: '0.6rem', background: 'linear-gradient(90deg, #00ffff, #ff00ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ZEITGEIST</span>
    </div>
  );
}

function ArcadeKingLeaderboardBadge() {
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded"
      style={{
        background: 'linear-gradient(135deg, rgba(0,255,255,0.07) 0%, rgba(251,191,36,0.1) 100%)',
        border: '1px solid rgba(251,191,36,0.5)',
        boxShadow: '0 0 8px rgba(251,191,36,0.3)',
        whiteSpace: 'nowrap',
      }}
      title="Arcade King — procedural reflex game master"
    >
      <ArcadeKingBadgeIcon size={16} />
      <span className="font-black tracking-wider" style={{ fontSize: '0.6rem', background: 'linear-gradient(90deg, #00ffff, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ARCADE KING</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const s = RANK_STYLES[rank] ?? DEFAULT_STYLE;
  if (rank <= 3) {
    return (
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border ${s.bg} ${s.text} ${s.border}`}
        style={{ boxShadow: s.shadow }}
      >
        {rank === 1 ? <Trophy className="w-4 h-4" /> : `#${rank}`}
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-cyan-700 border border-cyan-900/40 bg-cyan-950/30">
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
    <div
      className="w-full max-w-2xl mx-auto px-5 py-6 rounded-2xl relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #030d12 0%, #020a10 60%, #01080d 100%)',
        boxShadow: '0 0 40px rgba(34,211,238,0.12), inset 0 0 60px rgba(34,211,238,0.03)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(34,211,238,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2
              className="text-3xl font-black tracking-wider text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(90deg, #22d3ee, #67e8f9, #a5f3fc)',
                textShadow: 'none',
                filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.6))',
              }}
            >
              LEADERBOARD
            </h2>
            <div className="h-0.5 mt-1 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.8), transparent)', width: '80%' }} />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 text-cyan-500 hover:text-cyan-300 transition-colors disabled:opacity-30"
            style={{ filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.4))' }}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div
          className="flex gap-1 mb-6 p-1 rounded-lg border"
          style={{
            background: 'rgba(34,211,238,0.04)',
            borderColor: 'rgba(34,211,238,0.15)',
          }}
        >
          <button
            onClick={() => setFilter('alltime')}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold tracking-wide transition-all"
            style={filter === 'alltime' ? {
              background: 'rgba(34,211,238,0.15)',
              color: '#67e8f9',
              boxShadow: '0 0 12px rgba(34,211,238,0.3), inset 0 0 8px rgba(34,211,238,0.05)',
              border: '1px solid rgba(34,211,238,0.4)',
            } : {
              color: 'rgba(34,211,238,0.35)',
              border: '1px solid transparent',
            }}
          >
            <Infinity className="w-4 h-4" />
            ALL TIME
          </button>
          <button
            onClick={() => setFilter('weekly')}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold tracking-wide transition-all"
            style={filter === 'weekly' ? {
              background: 'rgba(34,211,238,0.15)',
              color: '#67e8f9',
              boxShadow: '0 0 12px rgba(34,211,238,0.3), inset 0 0 8px rgba(34,211,238,0.05)',
              border: '1px solid rgba(34,211,238,0.4)',
            } : {
              color: 'rgba(34,211,238,0.35)',
              border: '1px solid transparent',
            }}
          >
            <Clock className="w-4 h-4" />
            THIS WEEK
          </button>
        </div>

        {error && (
          <div className="text-center py-8 text-red-400 text-sm">{error}</div>
        )}

        {loading && !error && (
          <div className="flex justify-center py-12">
            <div
              className="h-10 w-10 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin"
              style={{ boxShadow: '0 0 12px rgba(34,211,238,0.5)' }}
            />
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-12 text-cyan-700 text-sm tracking-widest uppercase">No entries yet</div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="space-y-4">
            {topThree.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {([topThree[1], topThree[0], topThree[2]] as (LeaderboardEntry | undefined)[]).map((entry, visualIdx) => {
                  if (!entry) return <div key={visualIdx} />;
                  const actualRank = entry.rank!;
                  const s = RANK_STYLES[actualRank] ?? DEFAULT_STYLE;
                  const isFirst = actualRank === 1;
                  return (
                    <div
                      key={entry.id}
                      className={`flex flex-col items-center p-4 rounded-xl border ${isFirst ? '-mt-3' : ''} transition-all`}
                      style={{
                        background: isFirst
                          ? 'linear-gradient(160deg, rgba(34,211,238,0.12) 0%, rgba(34,211,238,0.04) 100%)'
                          : 'rgba(34,211,238,0.04)',
                        borderColor: isFirst ? 'rgba(34,211,238,0.6)' : 'rgba(34,211,238,0.2)',
                        boxShadow: s.shadow,
                      }}
                    >
                      {isFirst ? (
                        <Trophy
                          className="w-7 h-7 mb-2 text-cyan-300"
                          style={{ filter: 'drop-shadow(0 0 10px rgba(34,211,238,0.9))' }}
                        />
                      ) : (
                        <div
                          className="text-xs font-black mb-2"
                          style={{ color: s.text.replace('text-', ''), filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.5))' }}
                        >
                          <span className={s.text}>#{actualRank}</span>
                        </div>
                      )}
                      <div className={`text-xs font-bold text-center truncate w-full ${s.label}`}>
                        {entry.display_name}
                      </div>
                      <div
                        className={`text-base font-black mt-1.5 tabular-nums tracking-tight ${s.scoreCx}`}
                        style={{ textShadow: isFirst ? '0 0 10px rgba(34,211,238,0.7)' : 'none' }}
                      >
                        {entry.score.toLocaleString()}
                      </div>
                      {(entry.badge_most_rounds || entry.badge_perfect_score || entry.badge_speed_demon || entry.badge_eagle_eye || entry.badge_trivia || entry.badge_wordsmith || entry.badge_zeitgeist || entry.badge_arcade_king) && (
                        <div className="mt-2 flex flex-col gap-1 items-center">
                          {entry.badge_most_rounds && <MostRoundsBadge />}
                          {entry.badge_perfect_score && <PerfectScoreBadge />}
                          {entry.badge_speed_demon && <SpeedDemonBadge />}
                          {entry.badge_eagle_eye && <EagleEyeLeaderboardBadge />}
                          {entry.badge_trivia && <TriviaBadge />}
                          {entry.badge_wordsmith && <WordsmithLeaderboardBadge />}
                          {entry.badge_zeitgeist && <ZeitgeistLeaderboardBadge />}
                          {entry.badge_arcade_king && <ArcadeKingLeaderboardBadge />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {rest.length > 0 && (
              <div className="space-y-1">
                {rest.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors"
                    style={{
                      background: idx % 2 === 0 ? 'rgba(34,211,238,0.025)' : 'transparent',
                      borderBottom: '1px solid rgba(34,211,238,0.06)',
                    }}
                  >
                    <RankBadge rank={entry.rank!} />
                    <span className="flex-1 text-sm font-medium text-gray-300 truncate">
                      {entry.display_name}
                    </span>
                    {entry.badge_most_rounds && <MostRoundsBadge />}
                    {entry.badge_perfect_score && <PerfectScoreBadge />}
                    {entry.badge_speed_demon && <SpeedDemonBadge />}
                    {entry.badge_eagle_eye && <EagleEyeLeaderboardBadge />}
                    {entry.badge_trivia && <TriviaBadge />}
                    {entry.badge_wordsmith && <WordsmithLeaderboardBadge />}
                    {entry.badge_zeitgeist && <ZeitgeistLeaderboardBadge />}
                    {entry.badge_arcade_king && <ArcadeKingLeaderboardBadge />}
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: 'rgba(34,211,238,0.7)' }}
                    >
                      {entry.score.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
