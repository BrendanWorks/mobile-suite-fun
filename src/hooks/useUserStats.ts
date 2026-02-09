import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface UserStats {
  totalGamesPlayed: number;
  bestScore: number;
  averageGrade: string;
  averageScore: number;
  loading: boolean;
}

export function useUserStats(userId: string | undefined): UserStats {
  const [stats, setStats] = useState<UserStats>({
    totalGamesPlayed: 0,
    bestScore: 0,
    averageGrade: '--',
    averageScore: 0,
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setStats({
        totalGamesPlayed: 0,
        bestScore: 0,
        averageGrade: '--',
        averageScore: 0,
        loading: false,
      });
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
          setStats(prev => ({ ...prev, loading: false }));
          return;
        }

        if (!sessions || sessions.length === 0) {
          setStats({
            totalGamesPlayed: 0,
            bestScore: 0,
            averageGrade: '--',
            averageScore: 0,
            loading: false,
          });
          return;
        }

        const totalGames = sessions.length;
        const bestScore = Math.max(...sessions.map(s => s.total_score || 0));
        const avgScore = Math.round(
          sessions.reduce((sum, s) => sum + (s.total_score || 0), 0) / totalGames
        );

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
          averageScore: avgScore,
          loading: false,
        });
      } catch (error) {
        console.error('Error calculating stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, [userId]);

  return stats;
}
