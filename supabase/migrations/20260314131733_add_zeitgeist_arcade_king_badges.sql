/*
  # Add Zeitgeist and Arcade King badge columns

  ## Summary
  Adds two new named badge columns to leaderboard_entries for the Zeitgeist
  (pop culture / word speed mastery) and Arcade King (procedural / reflex game
  mastery) achievements. Awards the badges to the designated players.

  ## Changes

  ### leaderboard_entries table
  - `badge_zeitgeist` (boolean, default false) — awarded for 90%+ on 5+ pop culture & word speed rounds
  - `badge_arcade_king` (boolean, default false) — awarded for 80%+ avg on 5+ procedural reflex rounds

  ## Data Updates
  - Elton J. gets badge_zeitgeist = true
  - PewDiePie gets badge_arcade_king = true
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leaderboard_entries' AND column_name = 'badge_zeitgeist'
  ) THEN
    ALTER TABLE leaderboard_entries ADD COLUMN badge_zeitgeist boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leaderboard_entries' AND column_name = 'badge_arcade_king'
  ) THEN
    ALTER TABLE leaderboard_entries ADD COLUMN badge_arcade_king boolean NOT NULL DEFAULT false;
  END IF;
END $$;

UPDATE leaderboard_entries
SET badge_zeitgeist = true
WHERE display_name = 'Elton J.';

UPDATE leaderboard_entries
SET badge_arcade_king = true
WHERE display_name = 'PewDiePie';
