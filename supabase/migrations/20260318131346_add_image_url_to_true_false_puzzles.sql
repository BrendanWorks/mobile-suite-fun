/*
  # Add image_url to true_false_puzzles

  Adds an optional image URL column to the true_false_puzzles table.
  Puzzles without an image continue to work exactly as before.

  ## Changes
  - `true_false_puzzles`: new nullable `image_url` text column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'true_false_puzzles' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE true_false_puzzles ADD COLUMN image_url text DEFAULT NULL;
  END IF;
END $$;
