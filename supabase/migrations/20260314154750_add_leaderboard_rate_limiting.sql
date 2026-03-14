/*
  # Leaderboard Score Submission Rate Limiting

  ## Summary
  Adds a server-side sliding-window rate limit on leaderboard_entries inserts.
  No client library changes are required; enforcement happens in Postgres before
  any row is committed.

  ## How It Works

  ### Trigger Function: check_leaderboard_rate_limit()
  Fires BEFORE INSERT on leaderboard_entries (after the existing score-validation
  trigger, because trigger names are executed alphabetically and
  "check_leaderboard_rate_limit" sorts before "leaderboard_entries_validate_score" --
  actually the new trigger name sorts BEFORE the validate trigger, so we name it
  with a "z_" prefix to guarantee ordering).

  The function:
  1. Counts how many rows the authenticated user has inserted in the last 60 seconds.
  2. If that count >= 10, raises an exception with a clear rate-limit message.
  3. Otherwise allows the insert to proceed.

  ### Why a Sliding Window in SQL
  - No extra table needed; we query leaderboard_entries itself using the
    server-set created_at column (which clients cannot spoof, per the
    validate_leaderboard_score trigger).
  - The query is covered by the existing leaderboard_entries_user_id_idx and
    the created_at index, so it is cheap even under load.

  ### Trigger Name Convention
  Named "z_leaderboard_rate_limit" so it sorts AFTER
  "leaderboard_entries_validate_score" alphabetically. This ensures the
  ownership/score-ceiling checks run first; the rate limit fires only for
  submissions that are otherwise valid.

  ## Security Notes
  - SECURITY DEFINER so auth.uid() is always available inside the function.
  - search_path locked to public, pg_temp to prevent hijacking.
  - Rate-limit window and ceiling are intentionally conservative (10/min).
    Legitimate players finish one game session every several minutes.
*/

CREATE OR REPLACE FUNCTION public.check_leaderboard_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _recent_count integer;
  _rate_limit   integer := 10;
  _window_secs  integer := 60;
BEGIN
  SELECT COUNT(*)
    INTO _recent_count
    FROM public.leaderboard_entries
   WHERE user_id    = auth.uid()
     AND created_at >= (now() - (_window_secs || ' seconds')::interval);

  IF _recent_count >= _rate_limit THEN
    RAISE EXCEPTION
      'rate_limit: too many score submissions (% in last % seconds, max %)',
      _recent_count, _window_secs, _rate_limit;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS z_leaderboard_rate_limit ON leaderboard_entries;

CREATE TRIGGER z_leaderboard_rate_limit
  BEFORE INSERT ON leaderboard_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.check_leaderboard_rate_limit();
