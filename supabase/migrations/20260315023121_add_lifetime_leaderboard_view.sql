/*
  # Add Lifetime Leaderboard View

  ## Summary
  Creates a view that aggregates all leaderboard_entries per user into a single
  lifetime total, so the leaderboard shows cumulative points across all sessions
  rather than just the most recent or best single session.

  ## New Views
  - `leaderboard_lifetime` — aggregates leaderboard_entries by user_id, summing
    scores and merging badge flags (any session having a badge grants it lifetime).
    Returns one row per user with their total lifetime score and display_name from
    their most recent entry.

  ## Notes
  - No data is deleted or modified; this is a read-only view.
  - Badge columns are OR'd across all entries so a badge earned once persists.
  - display_name uses the most recent entry's name (latest created_at).
*/

CREATE OR REPLACE VIEW leaderboard_lifetime AS
SELECT
  user_id,
  SUM(score)::integer AS lifetime_score,
  (
    SELECT display_name
    FROM leaderboard_entries le2
    WHERE le2.user_id = le.user_id
    ORDER BY le2.created_at DESC
    LIMIT 1
  ) AS display_name,
  BOOL_OR(badge_eagle_eye)    AS badge_eagle_eye,
  BOOL_OR(badge_trivia)       AS badge_trivia,
  BOOL_OR(badge_wordsmith)    AS badge_wordsmith,
  BOOL_OR(badge_zeitgeist)    AS badge_zeitgeist,
  BOOL_OR(badge_arcade_king)  AS badge_arcade_king,
  MAX(created_at)             AS last_played_at,
  COUNT(*)::integer           AS session_count
FROM leaderboard_entries le
GROUP BY user_id;
