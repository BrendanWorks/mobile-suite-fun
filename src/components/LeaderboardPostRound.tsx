import { useState, useEffect, useRef } from 'react';
import { Zap, Star, Flame, Crown, Trophy, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LeaderboardEntry } from '../lib/supabaseHelpers';
import { EagleEyeBadgeIcon } from './EagleEyeBadge';
import { WordsmithBadgeIcon } from './WordsmithBadge';
import { ZeitgeistBadgeIcon } from './ZeitgeistBadge';
import { ArcadeKingBadgeIcon } from './ArcadeKingBadge';

interface LeaderboardPostRoundProps {
  currentUserId: string | null;
  playerName: string | null;
  playlistId: number | null;
  playerScore: number;
  onContinue: () => void;
}

const glow = (color: string, size = '20px') => `0 0 ${size} ${color}`;

function BadgeRow({ entry }: { entry: LeaderboardEntry }) {
  const badges = [
    { key: 'badge_most_rounds', show: entry.badge_most_rounds, el: <Zap className="w-3.5 h-3.5 text-cyan-400" style={{ filter: 'drop-shadow(0 0 5px #00ffff)' }} />, label: 'Most Rounds' },
    { key: 'badge_perfect_score', show: entry.badge_perfect_score, el: <Star className="w-3.5 h-3.5 text-yellow-400" style={{ filter: 'drop-shadow(0 0 5px #fbbf24)' }} />, label: 'Perfect Score' },
    { key: 'badge_speed_demon', show: entry.badge_speed_demon, el: <Flame className="w-3.5 h-3.5 text-orange-400" style={{ filter: 'drop-shadow(0 0 5px #fb923c)' }} />, label: 'Speed Demon' },
    { key: 'badge_eagle_eye', show: entry.badge_eagle_eye, el: <EagleEyeBadgeIcon size={14} />, label: 'Eagle Eye' },
    { key: 'badge_trivia', show: entry.badge_trivia, el: <Star className="w-3.5 h-3.5" style={{ color: '#a5b4fc', filter: 'drop-shadow(0 0 5px rgba(129,140,248,0.9))' }} />, label: 'Trivia Ace' },
    { key: 'badge_wordsmith', show: entry.badge_wordsmith, el: <WordsmithBadgeIcon size={14} />, label: 'Wordsmith' },
    { key: 'badge_zeitgeist', show: entry.badge_zeitgeist, el: <ZeitgeistBadgeIcon size={14} />, label: 'Zeitgeist' },
    { key: 'badge_arcade_king', show: entry.badge_arcade_king, el: <ArcadeKingBadgeIcon size={14} />, label: 'Arcade King' },
  ].filter(b => b.show);

  if (badges.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {badges.map(b => (
        <span key={b.key} title={b.label}>{b.el}</span>
      ))}
    </div>
  );
}

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" style={{ filter: 'drop-shadow(0 0 8px #fbbf24)' }} />;
  if (rank === 2) return <Trophy className="w-5 h-5 text-cyan-300" style={{ filter: 'drop-shadow(0 0 6px #67e8f9)' }} />;
  if (rank === 3) return <Trophy className="w-5 h-5" style={{ color: '#cd7f32', filter: 'drop-shadow(0 0 6px #cd7f32)' }} />;
  return (
    <span className="text-base font-black text-cyan-400" style={{ textShadow: glow('#00ffff', '8px') }}>
      {rank}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-cyan-400/15 bg-white/[0.03] animate-pulse">
      <div className="w-8 h-5 bg-cyan-400/15 rounded" />
      <div className="flex-1 h-4 bg-white/10 rounded" />
      <div className="w-14 h-4 bg-yellow-400/15 rounded" />
    </div>
  );
}

interface EntryRowProps {
  entry: LeaderboardEntry;
  isCurrentPlayer: boolean;
}

function EntryRow({ entry, isCurrentPlayer }: EntryRowProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-xl border"
      style={
        isCurrentPlayer
          ? {
              borderColor: '#00ffff',
              background: 'rgba(0,255,255,0.07)',
              boxShadow: '0 0 24px rgba(0,255,255,0.22), inset 0 0 16px rgba(0,255,255,0.06)',
              animation: 'lbPulse 2.8s ease-in-out infinite',
            }
          : {
              borderColor: 'rgba(0,255,255,0.18)',
              background: 'rgba(255,255,255,0.025)',
            }
      }
    >
      <div className="w-8 flex items-center justify-center flex-shrink-0">
        <RankDisplay rank={entry.rank ?? 0} />
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className="text-sm sm:text-base font-semibold truncate"
          style={
            isCurrentPlayer
              ? { color: '#00ffff', textShadow: glow('#00ffff', '8px') }
              : { color: '#ffffff' }
          }
        >
          {entry.display_name}
          {isCurrentPlayer && (
            <span className="ml-2 text-xs font-normal" style={{ color: 'rgba(0,255,255,0.55)' }}>you</span>
          )}
        </span>
        <BadgeRow entry={entry} />
      </div>

      <div
        className="text-sm sm:text-base font-black flex-shrink-0 tabular-nums"
        style={
          isCurrentPlayer
            ? { color: '#facc15', textShadow: glow('#fbbf24', '10px') }
            : { color: 'rgba(250,204,21,0.75)' }
        }
      >
        {entry.score.toLocaleString()}
      </div>
    </div>
  );
}

function GuestRow({ rank, score }: { rank: number | null; score: number }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-xl border"
      style={{
        borderColor: 'rgba(0,255,255,0.35)',
        background: 'rgba(0,255,255,0.05)',
        boxShadow: '0 0 18px rgba(0,255,255,0.15)',
        animation: 'lbPulse 2.8s ease-in-out infinite',
      }}
    >
      <div className="w-8 flex items-center justify-center flex-shrink-0">
        {rank != null ? (
          <span className="text-base font-black text-cyan-400" style={{ textShadow: glow('#00ffff', '8px') }}>
            {rank}
          </span>
        ) : (
          <span className="text-base font-black text-cyan-400/40">—</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-sm sm:text-base font-semibold italic" style={{ color: '#00cccc' }}>
          Your Name Here
        </span>
        <span className="ml-2 text-xs font-normal" style={{ color: 'rgba(0,255,255,0.45)' }}>guest</span>
      </div>

      <div
        className="text-sm sm:text-base font-black flex-shrink-0 tabular-nums"
        style={{ color: '#facc15', textShadow: glow('#fbbf24', '10px') }}
      >
        {score.toLocaleString()}
      </div>
    </div>
  );
}

export default function LeaderboardPostRound({
  currentUserId,
  playerName,
  playlistId,
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
        const fetchEntries = async (): Promise<LeaderboardEntry[]> => {
          let query = supabase
            .from('leaderboard_entries')
            .select('*')
            .order('score', { ascending: false })
            .limit(20);

          if (playlistId != null) {
            query = query.eq('playlist_id', playlistId);
          }

          const { data, error } = await query;
          if (error) throw error;

          return (data ?? []).map((row, idx) => ({
            id: row.id,
            user_id: row.user_id,
            score: row.score,
            game_id: row.game_id,
            display_name: row.display_name ?? 'Anonymous',
            playlist_id: row.playlist_id,
            round_count: row.round_count ?? 0,
            created_at: row.created_at,
            rank: idx + 1,
            badge_most_rounds: row.badge_most_rounds ?? false,
            badge_perfect_score: row.badge_perfect_score ?? false,
            badge_speed_demon: row.badge_speed_demon ?? false,
            badge_eagle_eye: row.badge_eagle_eye ?? false,
            badge_trivia: row.badge_trivia ?? false,
            badge_wordsmith: row.badge_wordsmith ?? false,
            badge_zeitgeist: row.badge_zeitgeist ?? false,
            badge_arcade_king: row.badge_arcade_king ?? false,
          }));
        };

        const fetchRank = async (): Promise<number | null> => {
          if (playerScore <= 0) return null;
          let query = supabase
            .from('leaderboard_entries')
            .select('id', { count: 'exact', head: true })
            .gt('score', playerScore);

          if (playlistId != null) {
            query = query.eq('playlist_id', playlistId);
          }

          const { count } = await query;
          return (count ?? 0) + 1;
        };

        const [data, rank] = await Promise.all([fetchEntries(), fetchRank()]);

        if (cancelled) return;

        cache.current = { entries: data, playerRank: rank };
        setEntries(data);
        setPlayerRank(rank);
      } catch {
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setTimeout(() => setVisible(true), 60);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [playerScore, playlistId]);

  const playerInList = currentUserId
    ? entries.some(e => e.user_id === currentUserId)
    : false;

  const showPlayerRow = !isLoading && playerScore > 0 && !playerInList;

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col overflow-hidden"
      style={{
        boxShadow: 'inset 0 0 100px rgba(0,255,255,0.04)',
        transition: 'opacity 300ms ease',
        opacity: visible ? 1 : 0,
      }}
    >
      <style>{`
        @keyframes lbPulse {
          0%, 100% { box-shadow: 0 0 24px rgba(0,255,255,0.22), inset 0 0 16px rgba(0,255,255,0.06); }
          50% { box-shadow: 0 0 38px rgba(0,255,255,0.38), inset 0 0 22px rgba(0,255,255,0.11); }
        }
        @keyframes lbFadeSlide {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lb-row-enter {
          animation: lbFadeSlide 0.35s ease both;
        }
      `}</style>

      {/* Header — fixed height, never scrolls */}
      <div className="flex-shrink-0 pt-safe px-5 pt-6 pb-3 text-center">
        <p
          className="text-5xl sm:text-6xl font-black uppercase tracking-widest leading-none"
          style={{ color: '#ef4444', textShadow: '0 0 40px #ef4444, 0 0 80px rgba(239,68,68,0.4)' }}
        >
          ROWDY
        </p>
        <h1
          className="text-xl sm:text-2xl font-black uppercase tracking-widest mt-1"
          style={{ color: '#facc15', textShadow: glow('#fbbf24', '14px') }}
        >
          Leaderboard
        </h1>
        <p
          className="text-xs sm:text-sm uppercase tracking-widest mt-0.5"
          style={{ color: 'rgba(0,255,255,0.55)' }}
        >
          How you stack up
        </p>
      </div>

      {/* Scrollable leaderboard list */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
        <div className="flex flex-col gap-2 w-full max-w-lg mx-auto py-2">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
          ) : entries.length === 0 ? (
            <div className="text-center py-10" style={{ color: 'rgba(0,255,255,0.4)' }}>
              <p className="text-sm uppercase tracking-wider">No scores yet</p>
              <p className="text-xs mt-1 opacity-60">Be the first on the board!</p>
            </div>
          ) : (
            entries.map((entry, idx) => {
              const isCurrent = !!currentUserId && entry.user_id === currentUserId;
              return (
                <div
                  key={entry.id}
                  className="lb-row-enter"
                  style={{ animationDelay: `${idx * 45}ms` }}
                >
                  <EntryRow entry={entry} isCurrentPlayer={isCurrent} />
                </div>
              );
            })
          )}

          {/* Player row — always on screen if not already in list */}
          {showPlayerRow && (
            <>
              {entries.length > 0 && (
                <div className="flex items-center gap-3 py-1 px-2">
                  <div className="flex-1 border-t" style={{ borderColor: 'rgba(0,255,255,0.2)' }} />
                  <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(0,255,255,0.35)' }} />
                  <div className="flex-1 border-t" style={{ borderColor: 'rgba(0,255,255,0.2)' }} />
                </div>
              )}
              <div className="lb-row-enter" style={{ animationDelay: `${entries.length * 45}ms` }}>
                {currentUserId ? (
                  <EntryRow
                    entry={{
                      id: '__player__',
                      user_id: currentUserId,
                      score: playerScore,
                      game_id: null,
                      display_name: playerName ?? 'You',
                      playlist_id: playlistId,
                      round_count: 0,
                      created_at: new Date().toISOString(),
                      rank: playerRank ?? undefined,
                    }}
                    isCurrentPlayer={true}
                  />
                ) : (
                  <GuestRow rank={playerRank} score={playerScore} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sticky footer — always visible */}
      <div
        className="flex-shrink-0 px-4 pb-safe"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
          paddingTop: '12px',
          background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.95) 30%)',
        }}
      >
        <div className="w-full max-w-lg mx-auto">
          <button
            onClick={onContinue}
            disabled={isLoading}
            className="w-full py-4 px-6 font-black uppercase tracking-widest text-base sm:text-lg rounded-xl transition-all duration-150 active:scale-95 touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'transparent',
              border: '2px solid #00ffff',
              color: '#00ffff',
              textShadow: glow('#00ffff', '10px'),
              boxShadow: '0 0 28px rgba(0,255,255,0.28), inset 0 0 12px rgba(0,255,255,0.05)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#00ffff';
              (e.currentTarget as HTMLButtonElement).style.color = '#000000';
              (e.currentTarget as HTMLButtonElement).style.textShadow = 'none';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#00ffff';
              (e.currentTarget as HTMLButtonElement).style.textShadow = glow('#00ffff', '10px');
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
