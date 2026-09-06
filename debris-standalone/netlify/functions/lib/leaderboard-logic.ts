// Pure, dependency-free validation/ranking logic for the leaderboard
// function. Kept separate from leaderboard.mts (which pulls in
// @netlify/blobs) so it can be unit-tested directly with plain Node --
// `netlify dev` isn't available in every environment, and this is the
// part actually worth testing in isolation.

export interface LeaderboardEntry {
  initials: string;
  score: number;
  wave: number;
  rocksDestroyed: number;
  ts: number;
}

export const MAX_ENTRIES = 10;
const INITIALS_RE = /^[A-Z]{3}$/;
const MIN_DURATION_MS = 5000;
// Generous sustained-scoring ceiling, well above anything a real run should
// hit even with a big volatile-rock chain skewing the average upward -- this
// is meant to catch "someone POSTed a made-up number," not to model the
// scoring system precisely. See src/Game.tsx's ROCK_POINTS/UFO_SCORE/combo
// multiplier if this ever needs retuning against real play data.
const MAX_POINTS_PER_SECOND = 600;
const PLAUSIBILITY_BUFFER = 5000;

export type ValidationResult =
  | { ok: true; initials: string; score: number; wave: number; rocksDestroyed: number }
  | { ok: false; error: string };

export function validateSubmission(body: Record<string, unknown>): ValidationResult {
  const { initials, score, wave, rocksDestroyed, durationMs } = body;

  const cleanInitials = typeof initials === 'string' ? initials.trim().toUpperCase() : '';
  if (!INITIALS_RE.test(cleanInitials)) {
    return { ok: false, error: 'initials must be exactly 3 letters, A-Z' };
  }
  if (typeof score !== 'number' || !Number.isInteger(score) || score <= 0 || score > 10_000_000) {
    return { ok: false, error: 'invalid score' };
  }
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < MIN_DURATION_MS) {
    return { ok: false, error: 'invalid run duration' };
  }
  const ceiling = (durationMs / 1000) * MAX_POINTS_PER_SECOND + PLAUSIBILITY_BUFFER;
  if (score > ceiling) {
    return { ok: false, error: 'score not plausible for the reported duration' };
  }

  const cleanWave = typeof wave === 'number' && Number.isFinite(wave) ? Math.max(1, Math.round(wave)) : 1;
  const cleanRocks = typeof rocksDestroyed === 'number' && Number.isFinite(rocksDestroyed) ? Math.max(0, Math.round(rocksDestroyed)) : 0;

  return { ok: true, initials: cleanInitials, score, wave: cleanWave, rocksDestroyed: cleanRocks };
}

export function insertEntry(
  list: LeaderboardEntry[],
  entry: LeaderboardEntry,
): { list: LeaderboardEntry[]; rank: number | null } {
  const next = [...list, entry].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
  const rank = next.indexOf(entry);
  return { list: next, rank: rank === -1 ? null : rank + 1 };
}
