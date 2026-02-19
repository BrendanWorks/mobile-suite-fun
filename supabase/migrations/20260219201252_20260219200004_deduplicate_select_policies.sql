/*
  # Deduplicate Permissive SELECT Policies

  ## Summary
  The `games` table has two overlapping SELECT policies that both allow anyone
  to read all rows. The `puzzles` table has three. Multiple permissive policies
  of the same type for the same roles cause Postgres to evaluate each policy
  separately and OR the results together, adding unnecessary overhead.

  Each table is reduced to a single, clearly named open-read policy.

  ## Changes
  ### games table
  - Drop: "Anyone can read games", "Public can view games"
  - Add:  "Public read access to games"

  ### puzzles table
  - Drop: "Anyone can read puzzles", "Public can view puzzles", "Users can read puzzles"
  - Add:  "Public read access to puzzles"
*/

-- games
DROP POLICY IF EXISTS "Anyone can read games" ON public.games;
DROP POLICY IF EXISTS "Public can view games" ON public.games;

CREATE POLICY "Public read access to games"
  ON public.games
  FOR SELECT
  USING (true);

-- puzzles
DROP POLICY IF EXISTS "Anyone can read puzzles" ON public.puzzles;
DROP POLICY IF EXISTS "Public can view puzzles" ON public.puzzles;
DROP POLICY IF EXISTS "Users can read puzzles" ON public.puzzles;

CREATE POLICY "Public read access to puzzles"
  ON public.puzzles
  FOR SELECT
  USING (true);
