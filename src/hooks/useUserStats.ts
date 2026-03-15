import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface UserStats {
  totalGamesPlayed: number;
  bestScore: number;
  vibe: string;
  loading: boolean;
}

function getVibe(bestScore: number): string {
  if (bestScore >= 550) return '👑 Goat';
  if (bestScore >= 400) return '💥 Legend';
  if (bestScore >= 250) return '🔥 Clutch';
  if (bestScore >= 100) return '😎 Solid';
  return '🥶 Rusty';
}

const DEFAULT_STATS: UserStats = {
  totalGamesPlayed: 0,
  bestScore: 0,
  vibe: '--',
  loading: false,
};

export function useUserStats(userId: string | undefined): UserStats {
  const [stats, setStats] = useState<UserStats>({
    ...DEFAULT_STATS,
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setStats(DEFAULT_STATS);
      return;
    }

    let cancelled = false;

    const fetchStats = async () => {
      try {
        const { data: sessions, error } = await supabase
          .from('game_sessions')
          .select('total_score, session_grade, completed_at')
          .eq('user_id', userId)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false });

        if (cancelled) return;

        if (error) {
          console.error('Error fetching user stats:', error);
          setStats({ ...DEFAULT_STATS });
          return;
        }

        if (!sessions || sessions.length === 0) {
          setStats({ ...DEFAULT_STATS });
          return;
        }

        const totalGames = sessions.length;
        const bestScore = Math.max(...sessions.map(s => s.total_score || 0));

        setStats({
          totalGamesPlayed: totalGames,
          bestScore,
          vibe: getVibe(bestScore),
          loading: false,
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Error calculating stats:', error);
          setStats({ ...DEFAULT_STATS });
        }
      }
    };

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return stats;
}
