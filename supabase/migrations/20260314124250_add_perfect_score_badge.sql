/*
  # Add Perfect Score Badge Support

  ## Summary
  Adds infrastructure for the "Perfect Score" badge, awarded to the user who
  has achieved the most rounds with a perfect score (raw_score = max_score).

  ## Changes

  ### leaderboard_entries table
  - No schema changes needed; badge is computed at query time.

  ## New Functions

  ### get_perfect_score_user_id()
  - Scans round_results for rows where raw_score = max_score AND max_score > 0.
  - Returns the user_id with the highest count of such rounds.
  - Ties broken by user_id ASC for stability.
  - Returns NULL if no perfect rounds exist.
  - SECURITY DEFINER with locked search_path.
  - Accessible to anon and authenticated roles.
*/

CREATE OR REPLACE FUNCTION get_perfect_score_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id
  FROM round_results
  WHERE max_score > 0
    AND raw_score = max_score
  GROUP BY user_id
  ORDER BY COUNT(*) DESC, user_id ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_perfect_score_user_id() TO anon, authenticated;
