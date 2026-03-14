/*
  # Add named badges to leaderboard_entries

  ## Summary
  Adds three new boolean badge columns directly on leaderboard_entries rows
  so that specific players can be assigned badges without relying on aggregate
  round_results functions (which the dummy seed data doesn't populate).

  ## Changes

  ### leaderboard_entries table
  - `badge_eagle_eye` (boolean, default false) — awarded for visual/spatial puzzle mastery
  - `badge_trivia` (boolean, default false) — awarded for trivia excellence
  - `badge_wordsmith` (boolean, default false) — awarded for word puzzle mastery

  ## Data Updates
  - Billie Eilish gets badge_eagle_eye = true
  - Mark Zuckerberg gets badge_trivia = true and display_name = 'Zuck'
  - Phil Dick gets badge_wordsmith = true
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leaderboard_entries' AND column_name = 'badge_eagle_eye'
  ) THEN
    ALTER TABLE leaderboard_entries ADD COLUMN badge_eagle_eye boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leaderboard_entries' AND column_name = 'badge_trivia'
  ) THEN
    ALTER TABLE leaderboard_entries ADD COLUMN badge_trivia boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leaderboard_entries' AND column_name = 'badge_wordsmith'
  ) THEN
    ALTER TABLE leaderboard_entries ADD COLUMN badge_wordsmith boolean NOT NULL DEFAULT false;
  END IF;
END $$;

UPDATE leaderboard_entries
SET badge_eagle_eye = true
WHERE display_name = 'Billie Eilish';

UPDATE leaderboard_entries
SET badge_trivia = true,
    display_name = 'Zuck'
WHERE display_name = 'Mark Zuckerberg';

UPDATE leaderboard_entries
SET badge_wordsmith = true
WHERE display_name = 'Phil Dick';
