import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

interface UserProgress {
  id: number;
  user_id: string;
  game_id: number;
  puzzle_id?: number;
  score: number;
  completed_at: string;
}

interface GameStats {
  totalScore: number;
  gamesPlayed: number;
  averageScore: number;
  bestScore: number;
}

export function useUserProgress() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveProgress = async (gameId: number, score: number, puzzleId?: number) => {
    if (!user) return { error: 'User not authenticated' };

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('user_progress')
        .insert({
          user_id: user.id,
          game_id: gameId,
          puzzle_id: puzzleId,
          score: score,
        })
        .select()
        .single();

      if (error) throw error;

      setLoading(false);
      return { data, error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setLoading(false);
      return { data: null, error: errorMessage };
    }
  };

  const getGameStats = async (gameId: number): Promise<GameStats | null> => {
    if (!user) return null;

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('score')
        .eq('user_id', user.id)
        .eq('game_id', gameId);

      if (error) throw error;

      if (!data || data.length === 0) {
        setLoading(false);
        return {
          totalScore: 0,
          gamesPlayed: 0,
          averageScore: 0,
          bestScore: 0,
        };
      }

      const scores = data.map(record => record.score);
      const totalScore = scores.reduce((sum, score) => sum + score, 0);
      const gamesPlayed = scores.length;
      const averageScore = Math.round(totalScore / gamesPlayed);
      const bestScore = Math.max(...scores);

      setLoading(false);
      return {
        totalScore,
        gamesPlayed,
        averageScore,
        bestScore,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setLoading(false);
      return null;
    }
  };

  const getUserProgress = async (gameId?: number) => {
    if (!user) return { data: null, error: 'User not authenticated' };

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      if (gameId) {
        query = query.eq('game_id', gameId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLoading(false);
      return { data, error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setLoading(false);
      return { data: null, error: errorMessage };
    }
  };

  return {
    loading,
    error,
    saveProgress,
    getGameStats,
    getUserProgress,
  };
}