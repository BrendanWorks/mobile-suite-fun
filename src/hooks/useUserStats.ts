import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface UserStats {
  totalGamesPlayed: number;
  bestScore: number;
  averageGrade: string;
  loading: boolean;
}

const DEFAULT_STATS: UserStats = {
  totalGamesPlayed: 0,
  bestScore: 0,
  averageGrade: '--',
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

    const fetchStats = async () => {
      try {
        const { data: sessions, error } = await supabase
          .from('game_sessions')
          .select('total_score, session_grade, completed_at')
          .eq('user_id', userId)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false });

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

        const gradeOrder = ['D', 'C', 'B', 'A', 'S'];
        const gradesWithValues = sessions
          .filter(s => s.session_grade)
          .map(s => gradeOrder.indexOf(s.session_grade || 'D'));

        let averageGrade = '--';
        if (gradesWithValues.length > 0) {
          const avgGradeIndex = Math.round(
            gradesWithValues.reduce((sum, val) => sum + val, 0) / gradesWithValues.length
          );
          averageGrade = gradeOrder[Math.max(0, Math.min(avgGradeIndex, gradeOrder.length - 1))];
        }

        setStats({
          totalGamesPlayed: totalGames,
          bestScore,
          averageGrade,
          loading: false,
        });
      } catch (error) {
        console.error('Error calculating stats:', error);
        setStats({ ...DEFAULT_STATS });
      }
    };

    fetchStats();
  }, [userId]);

  return stats;
}
