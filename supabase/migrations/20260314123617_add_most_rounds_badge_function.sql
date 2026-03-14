/*
  # Add Most Rounds Played Badge Support

  ## Summary
  Creates a database function that identifies the single user who has played
  the most total rounds across all their round_results entries. This powers
  the "Most Rounds Played" badge shown on the leaderboard.

  ## New Functions

  ### get_most_rounds_user_id()
  - Returns the user_id (uuid) of the player with the highest COUNT(*) of
    rows in round_results.
  - Ties are broken by picking the earliest user_id alphabetically (stable).
  - Returns NULL if round_results is empty.
  - Marked STABLE so Supabase can cache the result within a transaction.
  - Search path is locked to public for security.

  ## Security
  - Function is accessible to anon and authenticated roles so the leaderboard
    (which allows public reads) can call it without extra auth.
*/

CREATE OR REPLACE FUNCTION get_most_rounds_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id
  FROM round_results
  GROUP BY user_id
  ORDER BY COUNT(*) DESC, user_id ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_most_rounds_user_id() TO anon, authenticated;
