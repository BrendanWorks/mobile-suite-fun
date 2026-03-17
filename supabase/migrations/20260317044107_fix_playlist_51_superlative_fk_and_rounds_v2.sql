/*
  # Fix playlist_rounds.superlative_puzzle_id FK + Rebuild Playlist 51

  ## Problem
  The superlative_puzzle_id column had a FK pointing to puzzles(id), but the
  Superlative game component queries superlative_puzzles(id) with that value.
  The FK was wrong. Additionally playlist 51's rounds had round_number = null
  and referenced non-existent superlative_puzzles IDs.

  ## Changes
  1. Null out the broken values on playlist 51 so the FK swap doesn't conflict
  2. Drop the incorrect FK (references puzzles)
  3. Add correct FK (references superlative_puzzles)
  4. Delete the broken placeholder rows for playlist 51
  5. Insert 5 properly-numbered rounds with valid superlative_puzzles IDs
*/

UPDATE playlist_rounds
  SET superlative_puzzle_id = NULL
  WHERE playlist_id = 51;

ALTER TABLE playlist_rounds
  DROP CONSTRAINT IF EXISTS playlist_rounds_superlative_puzzle_id_fkey;

ALTER TABLE playlist_rounds
  ADD CONSTRAINT playlist_rounds_superlative_puzzle_id_fkey
  FOREIGN KEY (superlative_puzzle_id)
  REFERENCES superlative_puzzles(id)
  ON DELETE SET NULL;

DELETE FROM playlist_rounds WHERE playlist_id = 51;

INSERT INTO playlist_rounds (playlist_id, round_number, game_id, superlative_puzzle_id, metadata)
VALUES
  (51, 1, 19, 2,  '{}'),
  (51, 2, 19, 5,  '{}'),
  (51, 3, 19, 8,  '{}'),
  (51, 4, 19, 11, '{}'),
  (51, 5, 19, 3,  '{}');
