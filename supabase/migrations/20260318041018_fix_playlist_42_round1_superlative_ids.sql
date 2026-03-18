/*
  # Fix playlist 42 round 1 to use superlative_puzzle_ids

  Points playlist 42 round 1 at superlative_puzzles IDs [11,12,13] (Saltier)
  instead of puzzle_id 818 which has no images and wrong comparison_type.
*/

UPDATE playlist_rounds
SET
  metadata = '{"superlative_puzzle_ids": [11, 12, 13]}'::jsonb,
  puzzle_id = NULL
WHERE id = 117;
