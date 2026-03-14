import { useState, useEffect, useRef } from 'react';
import { Zap, Star, Flame, Trophy, Crown } from 'lucide-react';
import { fetchTopAllTime, LeaderboardEntry } from '../lib/supabaseHelpers';
import { supabase } from '../lib/supabase';
import { EagleEyeBadgeIcon } from './EagleEyeBadge';
import { WordsmithBadgeIcon } from './WordsmithBadge';

interface LeaderboardPostRoundProps {
  currentUserId: string | null;
  playerScore: number;
  onContinue: () => void;
}

const glow = (color: string, size = '20px') => `0 0 ${size} ${color}`;

function BadgeRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div className="flex items-center gap-1.5">
      {entry.badge_most_rounds && (
        <span title="Most Rounds Played">
          <Zap className="w-4 h-4 text-cyan-400" style={{ filter: 'drop-shadow(0 0 6px #00ffff)' }} />
        </span>
      )}
      {entry.badge_perfect_score && (
        <span title="Perfect Score">
          <Star className="w-4 h-4 text-yellow-400" style={{ filter: 'drop-shadow(0 0 6px #fbbf24)' }} />
        </span>
      )}
      {entry.badge_speed_demon && (
        <span title="Speed Demon">
          <Flame className="w-4 h-4 text-orange-400" style={{ filter: 'drop-shadow(0 0 6px #fb923c)' }} />
        </span>
      )}
      {entry.badge_eagle_eye && (
        <span title="Eagle Eye">
          <EagleEyeBadgeIcon size={16} />
        </span>
      )}
      {entry.badge_trivia && (
        <span title="Trivia Ace">
          <Star className="w-4 h-4" style={{ color: '#a5b4fc', filter: 'drop-shadow(0 0 6px rgba(129,140,248,0.9))' }} />
        </span>
      )}
      {entry.badge_wordsmith && (
        <span title="Wordsmith">
          <WordsmithBadgeIcon size={16} />
        </span>
      )}
    </div>
  );
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Crown className="w-4 h-4 text-yellow-400" style={{ filter: 'drop-shadow(0 0 8px #fbbf24)' }} />;
  }
  if (rank === 2) {
    return <Trophy className="w-4 h-4 text-cyan-300" style={{ filter: 'drop-shadow(0 0 6px #67e8f9)' }} />;
  }
  if (rank === 3) {
    return <Trophy className="w-4 h-4 text-cyan-400/70" />;
  }
  return (
    <span className="text-sm font-bold text-cyan-500" style={{ textShadow: glow('#00ffff', '8px') }}>
      #{rank}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-cyan-400/20 bg-white/5 animate-pulse">
      <div className="w-6 h-4 bg-cyan-400/20 rounded" />
      <div className="flex-1 h-4 bg-cyan-400/20 rounded" />
      <div className="w-16 h-4 bg-cyan-400/20 rounded" />
    </div>
  );
}

export default function LeaderboardPostRound({
  currentUserId,
  playerScore,
  onContinue,
}: LeaderboardPostRoundProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const cache = useRef<{ entries: LeaderboardEntry[]; playerRank: number | null } | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (cache.current) {
      setEntries(cache.current.entries);
      setPlayerRank(cache.current.playerRank);
      setIsLoading(false);
      setTimeout(() => setVisible(true), 50);
      return;
    }

    const load = async () => {
      try {
        const [leaderboardResult, rankResult] = await Promise.all([
          fetchTopAllTime(10),
          (async () => {
            if (playerScore <= 0) return null;
            const { count } = await supabase
              .from('leaderboard_entries')
              .select('id', { count: 'exact', head: true })
              .gt('score', playerScore);
            return (count ?? 0) + 1;
          })(),
        ]);

        if (cancelled) return;

        const data = leaderboardResult.data ?? [];
        cache.current = { entries: data, playerRank: rankResult };
        setEntries(data);
        setPlayerRank(rankResult);
      } catch {
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setTimeout(() => setVisible(true), 50);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [playerScore]);

  const playerInTop10 = currentUserId
    ? entries.some(e => e.user_id === currentUserId)
    : false;

  return (
    <div
      className="min-h-screen w-screen bg-black flex flex-col items-center px-4 py-6 overflow-y-auto"
      style={{
        boxShadow: 'inset 0 0 80px rgba(0, 255, 255, 0.04)',
        transition: 'opacity 300ms ease',
        opacity: visible ? 1 : 0,
      }}
    >
      {/* Header */}
      <div className="w-full max-w-lg flex-shrink-0 mb-1">
        <p
          className="text-6xl sm:text-7xl font-black text-red-500 uppercase tracking-widest text-center"
          style={{ textShadow: glow('#ef4444', '40px') }}
        >
          ROWDY
        </p>
      </div>

      <div className="w-full max-w-lg flex-shrink-0 mb-6 text-center">
        <h1
          className="text-2xl sm:text-3xl font-black text-yellow-400 uppercase tracking-widest"
          style={{ textShadow: glow('#fbbf24', '15px') }}
        >
          Leaderboard
        </h1>
        <p className="text-cyan-400/70 text-xs sm:text-sm mt-1 tracking-wider uppercase">
          How you stack up
        </p>
      </div>

      {/* Table */}
      <div className="w-full max-w-lg flex-shrink-0 flex flex-col gap-2 mb-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : entries.length === 0 ? (
          <div className="text-center text-cyan-400/50 text-sm py-8">
            Leaderboard loading...
          </div>
        ) : (
          entries.map((entry) => {
            const isCurrentPlayer = currentUserId && entry.user_id === currentUserId;
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-300 ${
                  isCurrentPlayer
                    ? 'border-cyan-400 bg-cyan-400/10'
                    : 'border-cyan-400/25 bg-white/[0.03] hover:border-cyan-400/40'
                }`}
                style={
                  isCurrentPlayer
                    ? { boxShadow: '0 0 20px rgba(0, 255, 255, 0.25), inset 0 0 15px rgba(0, 255, 255, 0.07)', animation: 'subtlePulse 2.5s ease-in-out infinite' }
                    : {}
                }
              >
                {/* Rank */}
                <div className="w-7 flex items-center justify-center flex-shrink-0">
                  <RankIcon rank={entry.rank ?? 0} />
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm sm:text-base font-semibold truncate block ${
                      isCurrentPlayer ? 'text-cyan-300' : 'text-white'
                    }`}
                    style={isCurrentPlayer ? { textShadow: glow('#00ffff', '10px') } : {}}
                  >
                    {entry.display_name}
                    {isCurrentPlayer && (
                      <span className="ml-2 text-xs text-cyan-400/70 font-normal">you</span>
                    )}
                  </span>
                </div>

                {/* Badges */}
                <BadgeRow entry={entry} />

                {/* Score */}
                <div
                  className={`text-sm sm:text-base font-bold flex-shrink-0 ${
                    isCurrentPlayer ? 'text-yellow-400' : 'text-yellow-300/80'
                  }`}
                  style={isCurrentPlayer ? { textShadow: glow('#fbbf24', '10px') } : {}}
                >
                  {entry.score.toLocaleString()}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Player not in top 10 */}
      {!isLoading && !playerInTop10 && playerScore > 0 && (
        <div className="w-full max-w-lg flex-shrink-0 mb-4">
          <div
            className="rounded-lg border border-cyan-400/30 bg-white/[0.02] px-4 py-3 flex items-center gap-3"
            style={{ boxShadow: '0 0 10px rgba(0, 255, 255, 0.08)' }}
          >
            <div className="w-7 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-cyan-500/70">
                {playerRank != null ? `#${playerRank}` : '—'}
              </span>
            </div>
            <div className="flex-1">
              <span className="text-sm text-white/60 font-semibold">You</span>
              {playerRank != null && (
                <span className="text-xs text-cyan-400/50 ml-2">ranked #{playerRank}</span>
              )}
            </div>
            <div className="text-sm font-bold text-yellow-300/60">
              {playerScore.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Badge Legend */}
      {!isLoading && (
        <div className="w-full max-w-lg flex-shrink-0 mb-6">
          <div className="flex items-center justify-center gap-5 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-cyan-400/60" /> Most Rounds
            </span>
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-400/60" /> Perfect Score
            </span>
            <span className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-400/60" /> Speed Demon
            </span>
          </div>
        </div>
      )}

      {/* Continue Button */}
      <div className="w-full max-w-lg flex-shrink-0">
        <button
          onClick={onContinue}
          disabled={isLoading}
          className="w-full py-3 sm:py-4 px-6 bg-transparent border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black font-bold rounded-lg text-base sm:text-lg transition-all active:scale-95 touch-manipulation uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            textShadow: glow('#00ffff', '15px'),
            boxShadow: '0 0 30px rgba(0, 255, 255, 0.3)',
          }}
        >
          Continue
        </button>
      </div>

      <style>{`
        @keyframes subtlePulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0,255,255,0.25), inset 0 0 15px rgba(0,255,255,0.07); }
          50% { box-shadow: 0 0 32px rgba(0,255,255,0.4), inset 0 0 20px rgba(0,255,255,0.12); }
        }
      `}</style>
    </div>
  );
}
