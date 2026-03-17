/*
  # Fix superlative_puzzle_id FK to reference puzzles(id) + Rebuild Playlist 51

  ## Summary
  The superlative_puzzle_id column currently has a FK pointing to superlative_puzzles(id),
  which is the deprecated table. All Superlative puzzles now live in the puzzles table
  with metadata.comparisons. This migration fixes the FK and rebuilds playlist 51.

  ## Changes
  1. Null out superlative_puzzle_id on playlist 51 to allow FK swap
  2. Drop the incorrect FK (references superlative_puzzles)
  3. Add correct FK (references puzzles)
  4. Delete existing playlist 51 rounds
  5. Insert 2 rounds pointing to puzzle IDs 814 and 815

  ## Security
  No RLS changes - existing policies cover playlist_rounds
*/

UPDATE playlist_rounds
  SET superlative_puzzle_id = NULL
  WHERE playlist_id = 51;

ALTER TABLE playlist_rounds
  DROP CONSTRAINT IF EXISTS playlist_rounds_superlative_puzzle_id_fkey;

ALTER TABLE playlist_rounds
  ADD CONSTRAINT playlist_rounds_superlative_puzzle_id_fkey
  FOREIGN KEY (superlative_puzzle_id)
  REFERENCES puzzles(id)
  ON DELETE SET NULL;

DELETE FROM playlist_rounds WHERE playlist_id = 51;

INSERT INTO playlist_rounds (playlist_id, round_number, game_id, superlative_puzzle_id, metadata)
VALUES
  (51, 1, 19, 814, '{}'),
  (51, 2, 19, 815, '{}');
