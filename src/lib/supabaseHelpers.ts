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
  'hive-mind': 13,
  'fake-out': 15,
  'double-fake': 16,
  'color-clash': 17,
  'recall': 18,
  'superlative': 19,
  'true-false': 20,
  'multiple-choice': 21,
  'tracer': 22,
  'clutch': 23,
  'flashbang': 24,
};

export function getGameId(slug: string): number {
  const gameId = GAME_SLUG_TO_ID[slug];
  if (!gameId) {
    return 3;
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
  gameId: number | string;
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

async function fetchBadgeHelpers(): Promise<{ mostRoundsUserId: string | null; perfectScoreUserId: string | null; speedDemonUserId: string | null }> {
  const [mostRoundsUserId, perfectScoreUserId, speedDemonUserId] = await Promise.all([
    fetchMostRoundsUserId(),
    fetchPerfectScoreUserId(),
    fetchSpeedDemonUserId(),
  ]);
  return { mostRoundsUserId, perfectScoreUserId, speedDemonUserId };
}

export async function fetchTopAllTime(
  limit = 25
): Promise<{ success: boolean; data?: LeaderboardEntry[]; error?: string }> {
  try {
    const [{ data, error }, { mostRoundsUserId, perfectScoreUserId, speedDemonUserId }] = await Promise.all([
      supabase
        .from('leaderboard_lifetime')
        .select('user_id, lifetime_score, display_name, badge_eagle_eye, badge_trivia, badge_wordsmith, badge_zeitgeist, badge_arcade_king, last_played_at')
        .order('lifetime_score', { ascending: false })
        .limit(limit),
      fetchBadgeHelpers(),
    ]);

    if (error) throw error;

    const entries: LeaderboardEntry[] = (data ?? []).map((row, idx) => ({
      id: row.user_id,
      user_id: row.user_id,
      score: row.lifetime_score,
      game_id: null,
      display_name: row.display_name ?? 'Anonymous',
      playlist_id: null,
      round_count: 0,
      created_at: row.last_played_at,
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function fetchTopThisWeek(
  limit = 25
): Promise<{ success: boolean; data?: LeaderboardEntry[]; error?: string }> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [{ data, error }, { mostRoundsUserId, perfectScoreUserId, speedDemonUserId }] = await Promise.all([
      supabase
        .from('leaderboard_entries')
        .select('user_id, score, display_name, badge_eagle_eye, badge_trivia, badge_wordsmith, badge_zeitgeist, badge_arcade_king, created_at')
        .gte('created_at', since.toISOString())
        .order('score', { ascending: false }),
      fetchBadgeHelpers(),
    ]);

    if (error) throw error;

    const aggregated = new Map<string, { score: number; display_name: string; badge_eagle_eye: boolean; badge_trivia: boolean; badge_wordsmith: boolean; badge_zeitgeist: boolean; badge_arcade_king: boolean; last_played_at: string }>();
    for (const row of data ?? []) {
      const existing = aggregated.get(row.user_id);
      if (existing) {
        existing.score += row.score;
        existing.badge_eagle_eye = existing.badge_eagle_eye || (row.badge_eagle_eye ?? false);
        existing.badge_trivia = existing.badge_trivia || (row.badge_trivia ?? false);
        existing.badge_wordsmith = existing.badge_wordsmith || (row.badge_wordsmith ?? false);
        existing.badge_zeitgeist = existing.badge_zeitgeist || (row.badge_zeitgeist ?? false);
        existing.badge_arcade_king = existing.badge_arcade_king || (row.badge_arcade_king ?? false);
        if (row.created_at > existing.last_played_at) {
          existing.display_name = row.display_name ?? existing.display_name;
          existing.last_played_at = row.created_at;
        }
      } else {
        aggregated.set(row.user_id, {
          score: row.score,
          display_name: row.display_name ?? 'Anonymous',
          badge_eagle_eye: row.badge_eagle_eye ?? false,
          badge_trivia: row.badge_trivia ?? false,
          badge_wordsmith: row.badge_wordsmith ?? false,
          badge_zeitgeist: row.badge_zeitgeist ?? false,
          badge_arcade_king: row.badge_arcade_king ?? false,
          last_played_at: row.created_at,
        });
      }
    }

    const sorted = Array.from(aggregated.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, limit);

    const entries: LeaderboardEntry[] = sorted.map(([userId, agg], idx) => ({
      id: userId,
      user_id: userId,
      score: agg.score,
      game_id: null,
      display_name: agg.display_name,
      playlist_id: null,
      round_count: 0,
      created_at: agg.last_played_at,
      rank: idx + 1,
      badge_most_rounds: mostRoundsUserId != null && userId === mostRoundsUserId,
      badge_perfect_score: perfectScoreUserId != null && userId === perfectScoreUserId,
      badge_speed_demon: speedDemonUserId != null && userId === speedDemonUserId,
      badge_eagle_eye: agg.badge_eagle_eye,
      badge_trivia: agg.badge_trivia,
      badge_wordsmith: agg.badge_wordsmith,
      badge_zeitgeist: agg.badge_zeitgeist,
      badge_arcade_king: agg.badge_arcade_king,
    }));

    return { success: true, data: entries };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
