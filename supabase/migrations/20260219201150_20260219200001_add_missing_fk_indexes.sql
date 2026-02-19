/*
  # Add Missing Foreign Key Indexes

  ## Summary
  Several tables have foreign key constraints without covering indexes, causing
  full-table scans on JOINs and ON DELETE CASCADE operations.

  ## New Indexes
  - game_events: game_id, session_id
  - playlist_rounds: game_id, puzzle_id, ranking_puzzle_id
  - puzzles: game_id
  - ranking_items: puzzle_id
  - ranking_puzzles: game_id
  - user_progress: game_id
  - user_seen_content: game_id, puzzle_id
*/

CREATE INDEX IF NOT EXISTS idx_game_events_game_id
  ON public.game_events (game_id);

CREATE INDEX IF NOT EXISTS idx_game_events_session_id
  ON public.game_events (session_id);

CREATE INDEX IF NOT EXISTS idx_playlist_rounds_game_id
  ON public.playlist_rounds (game_id);

CREATE INDEX IF NOT EXISTS idx_playlist_rounds_puzzle_id
  ON public.playlist_rounds (puzzle_id);

CREATE INDEX IF NOT EXISTS idx_playlist_rounds_ranking_puzzle_id
  ON public.playlist_rounds (ranking_puzzle_id);

CREATE INDEX IF NOT EXISTS idx_puzzles_game_id
  ON public.puzzles (game_id);

CREATE INDEX IF NOT EXISTS idx_ranking_items_puzzle_id
  ON public.ranking_items (puzzle_id);

CREATE INDEX IF NOT EXISTS idx_ranking_puzzles_game_id
  ON public.ranking_puzzles (game_id);

CREATE INDEX IF NOT EXISTS idx_user_progress_game_id
  ON public.user_progress (game_id);

CREATE INDEX IF NOT EXISTS idx_user_seen_content_game_id
  ON public.user_seen_content (game_id);

CREATE INDEX IF NOT EXISTS idx_user_seen_content_puzzle_id
  ON public.user_seen_content (puzzle_id);
