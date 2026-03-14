/*
  # Add Speed Demon Badge Support

  ## Summary
  Adds a completion_time_seconds column to round_results so each round can
  track how long the player took to answer. Creates a database function that
  identifies the player with the lowest average completion time across all
  their rounds, awarding them the "Speed Demon" badge on the leaderboard.

  ## Changes

  ### round_results table
  - New column `completion_time_seconds` (numeric, nullable) — time in seconds
    the player took to complete the round. NULL means timing was not recorded.

  ## New Functions

  ### get_speed_demon_user_id()
  - Considers only rows where completion_time_seconds IS NOT NULL and > 0
    and the user has played at least 5 timed rounds (to prevent outliers).
  - Returns the user_id with the lowest AVG(completion_time_seconds).
  - Ties broken by user_id ASC for stability.
  - Returns NULL if no qualifying data exists.
  - SECURITY DEFINER with locked search_path.
  - Accessible to anon and authenticated roles.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'round_results' AND column_name = 'completion_time_seconds'
  ) THEN
    ALTER TABLE round_results ADD COLUMN completion_time_seconds numeric NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS round_results_completion_time_idx
  ON round_results (completion_time_seconds)
  WHERE completion_time_seconds IS NOT NULL;

CREATE OR REPLACE FUNCTION get_speed_demon_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id
  FROM round_results
  WHERE completion_time_seconds IS NOT NULL
    AND completion_time_seconds > 0
  GROUP BY user_id
  HAVING COUNT(*) >= 5
  ORDER BY AVG(completion_time_seconds) ASC, user_id ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_speed_demon_user_id() TO anon, authenticated;
