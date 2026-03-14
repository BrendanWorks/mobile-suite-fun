import { supabase } from './supabase';

const GAME_SLUG_TO_ID: Record<string, number> = {
  'emoji-master': 1,
  'odd-man-out': 3,
  'photo-mystery': 4,
  'rank-and-roll': 5,
  'snapshot': 6,
  'split-decision': 9,
  'word-rescue': 10,
  'shape-sequence': 11,
  'snake': 12,
  'fake-out': 13,
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

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  score: number;
  game_id: number | null;
  display_name: string;
  playlist_id: number | null;
  round_count: number;
  created_at: string;
  rank?: number;
  badge_most_rounds?: boolean;
  badge_perfect_score?: boolean;
  badge_speed_demon?: boolean;
  badge_eagle_eye?: boolean;
  badge_trivia?: boolean;
  badge_wordsmith?: boolean;
  badge_zeitgeist?: boolean;
  badge_arcade_king?: boolean;
}

export async function fetchMostRoundsUserId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_most_rounds_user_id');
    if (error) throw error;
    return data as string | null;
  } catch {
    return null;
  }
}

export async function fetchPerfectScoreUserId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_perfect_score_user_id');
    if (error) throw error;
    return data as string | null;
  } catch {
    return null;
  }
}

export async function fetchSpeedDemonUserId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_speed_demon_user_id');
    if (error) throw error;
    return data as string | null;
  } catch {
    return null;
  }
}

export interface InsertLeaderboardEntryParams {
  userId: string;
  score: number;
  displayName: string;
  gameId?: number | null;
  playlistId?: number | null;
  roundCount?: number;
}

export async function insertLeaderboardEntry(
  params: InsertLeaderboardEntryParams
): Promise<{ success: boolean; error?: string; rateLimited?: boolean }> {
  try {
    const { error } = await supabase.from('leaderboard_entries').insert({
      user_id: params.userId,
      score: Math.round(params.score),
      display_name: params.displayName,
      game_id: params.gameId ?? null,
      playlist_id: params.playlistId ?? null,
      round_count: params.roundCount ?? 0,
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isRateLimit = message.includes('rate_limit');
    const isValidation = message.includes('score_validation');
    if (!isRateLimit && !isValidation) {
      console.error('Error inserting leaderboard entry:', error);
    }
    return {
      success: false,
      error: isRateLimit
        ? 'Score not saved: too many submissions. Please wait a moment.'
        : isValidation
          ? 'Score not saved: submission failed validation.'
          : message,
      rateLimited: isRateLimit,
    };
  }
}

export async function fetchTopLeaderboard(
  limit = 10,
  since?: Date
): Promise<{ success: boolean; data?: LeaderboardEntry[]; error?: string }> {
  try {
    let query = supabase
      .from('leaderboard_entries')
      .select('id, user_id, score, game_id, display_name, playlist_id, round_count, created_at, badge_eagle_eye, badge_trivia, badge_wordsmith, badge_zeitgeist, badge_arcade_king')
      .order('score', { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gte('created_at', since.toISOString());
    }

    const [{ data, error }, mostRoundsUserId, perfectScoreUserId, speedDemonUserId] = await Promise.all([
      query,
      fetchMostRoundsUserId(),
      fetchPerfectScoreUserId(),
      fetchSpeedDemonUserId(),
    ]);

    if (error) throw error;

    const entries: LeaderboardEntry[] = (data ?? []).map((row, idx) => ({
      ...row,
      rank: idx + 1,
      badge_most_rounds: mostRoundsUserId != null && row.user_id === mostRoundsUserId,
      badge_perfect_score: perfectScoreUserId != null && row.user_id === perfectScoreUserId,
      badge_speed_demon: speedDemonUserId != null && row.user_id === speedDemonUserId,
      badge_eagle_eye: row.badge_eagle_eye ?? false,
      badge_trivia: row.badge_trivia ?? false,
      badge_wordsmith: row.badge_wordsmith ?? false,
      badge_zeitgeist: row.badge_zeitgeist ?? false,
      badge_arcade_king: row.badge_arcade_king ?? false,
    }));

    return { success: true, data: entries };
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function fetchTopAllTime(limit = 10) {
  return fetchTopLeaderboard(limit);
}

export async function fetchTopThisWeek(limit = 10) {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  return fetchTopLeaderboard(limit, since);
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
