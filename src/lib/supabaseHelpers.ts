import { supabase } from './supabase';

const GAME_SLUG_TO_ID: Record<string, number> = {
  'emoji-master': 1,
  'odd-man-out': 3,
  'photo-mystery': 4,
  'rank-and-roll': 5,
  'dalmatian-puzzle': 6,
  'split-decision': 9,
  'word-rescue': 10,
  'shape-sequence': 11,
};

export function getGameId(slug: string): number {
  const gameId = GAME_SLUG_TO_ID[slug];
  if (!gameId) {
    console.warn(`Unknown game slug: ${slug}, defaulting to ID 1`);
    return 1;
  }
  return gameId;
}

interface CreateSessionResult {
  success: boolean;
  data?: { id: string };
  error?: string;
}

interface CompleteSessionResult {
  success: boolean;
  error?: string;
}

interface SaveRoundsResult {
  success: boolean;
  error?: string;
}

interface RoundResult {
  gameId: number;
  puzzleId: number;
  roundNumber: number;
  rawScore: number;
  maxScore: number;
  normalizedScore: number;
  grade: string;
}

export async function createUserProfile(userId: string, email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (existing) {
      return { success: true };
    }

    const { error } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        email: email,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error creating user profile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function createGameSession(userId: string): Promise<CreateSessionResult> {
  try {
    await createUserProfile(userId, '');

    const { data, error } = await supabase
      .from('game_sessions')
      .insert({
        user_id: userId,
        started_at: new Date().toISOString(),
        total_score: 0,
        max_possible_score: 500,
        percentage: 0,
        game_count: 0,
      })
      .select('id')
      .single();

    if (error) throw error;

    return { success: true, data: { id: data.id } };
  } catch (error) {
    console.error('Error creating game session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function completeGameSession(
  sessionId: string,
  totalScore: number,
  maxPossible: number,
  percentage: number,
  grade: string,
  gameCount: number,
  playtimeSeconds: number
): Promise<CompleteSessionResult> {
  try {
    const { error } = await supabase
      .from('game_sessions')
      .update({
        total_score: totalScore,
        max_possible_score: maxPossible,
        percentage: percentage,
        session_grade: grade,
        game_count: gameCount,
        completed_at: new Date().toISOString(),
        metadata: { playtime_seconds: playtimeSeconds }
      })
      .eq('id', sessionId);

    if (error) throw error;

    const { data: session } = await supabase
      .from('game_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (session?.user_id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('total_sessions, total_score, best_session_score')
        .eq('id', session.user_id)
        .maybeSingle();

      if (profile) {
        await supabase
          .from('user_profiles')
          .update({
            total_sessions: (profile.total_sessions || 0) + 1,
            total_score: (profile.total_score || 0) + totalScore,
            best_session_score: Math.max(profile.best_session_score || 0, totalScore),
            last_played_at: new Date().toISOString(),
          })
          .eq('id', session.user_id);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error completing game session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function saveAllRoundResults(
  sessionId: string,
  userId: string,
  results: RoundResult[]
): Promise<SaveRoundsResult> {
  try {
    const roundRecords = results.map(result => ({
      session_id: sessionId,
      user_id: userId,
      game_id: result.gameId,
      puzzle_id: result.puzzleId === 0 ? null : result.puzzleId,
      round_number: result.roundNumber,
      raw_score: result.rawScore,
      max_score: result.maxScore,
      normalized_score: result.normalizedScore,
      grade: result.grade,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('round_results')
      .insert(roundRecords);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error saving round results:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
