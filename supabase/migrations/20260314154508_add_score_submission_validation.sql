/*
  # Score Submission Validation

  ## Summary
  Adds server-side validation on leaderboard_entries to reject tampered or
  impossible score submissions before they can be persisted.

  ## Changes

  ### Trigger Function: validate_leaderboard_score()
  Runs BEFORE INSERT on leaderboard_entries. Enforces three rules:

  1. **Ownership** – user_id must exactly match auth.uid(). Belt-and-suspenders
     on top of the existing RLS policy; rejects any row where the JWT user and
     the supplied user_id differ.

  2. **Score ceiling** – each round contributes at most 300 points in theory
     (100 base + 100 perfect-score bonus + 100 time bonus, with generous
     headroom). So the maximum legitimate score is:
       round_count * 300
     Rows where score > round_count * 300 are rejected. If round_count is 0
     the ceiling is 1500 (5 rounds × 300) to handle edge cases where
     round_count was not populated.

  3. **Non-negative score** – a negative score is always invalid.

  4. **Timestamp override** – always coerce created_at to now() so clients
     cannot backdate or future-date entries.

  ### Trigger: leaderboard_entries_validate_score
  Fires BEFORE INSERT FOR EACH ROW, calling the function above.

  ## Security Notes
  - The function is defined with SECURITY DEFINER so it can compare
    auth.uid() regardless of row context, but all it does is raise an
    exception – it never grants extra access.
  - search_path is locked to public,pg_temp to prevent search-path
    hijacking.
*/

CREATE OR REPLACE FUNCTION public.validate_leaderboard_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _max_score integer;
BEGIN
  -- 1. Ownership check: submitted user_id must match the authenticated user.
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'score_validation: user_id does not match authenticated user';
  END IF;

  -- 2. Score must be non-negative.
  IF NEW.score < 0 THEN
    RAISE EXCEPTION 'score_validation: score cannot be negative';
  END IF;

  -- 3. Score ceiling: 300 points per round (generous, covers all bonuses).
  --    Fall back to 5 rounds when round_count is 0 or null.
  _max_score := GREATEST(COALESCE(NEW.round_count, 0), 5) * 300;
  IF NEW.score > _max_score THEN
    RAISE EXCEPTION 'score_validation: score % exceeds maximum allowed %', NEW.score, _max_score;
  END IF;

  -- 4. Force server-side timestamp; ignore any client-supplied value.
  NEW.created_at := now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leaderboard_entries_validate_score ON leaderboard_entries;

CREATE TRIGGER leaderboard_entries_validate_score
  BEFORE INSERT ON leaderboard_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_leaderboard_score();
