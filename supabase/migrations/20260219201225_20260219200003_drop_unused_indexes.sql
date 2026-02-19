/*
  # Drop Unused Indexes

  ## Summary
  The Supabase advisor flagged 13 indexes that have never been used since
  creation. Removing them reduces write overhead, storage use, and vacuum cost
  without any query-performance impact.

  ## Dropped Indexes
  - idx_playlist_rounds_superlative_puzzle_id  (playlist_rounds)
  - idx_user_profiles_email                    (user_profiles)
  - idx_user_profiles_username                 (user_profiles)
  - idx_game_sessions_created_at               (game_sessions)
  - idx_round_results_session_id               (round_results)
  - idx_user_seen_content_user_game            (user_seen_content)
  - idx_user_progress_user_id                  (user_progress)
  - idx_user_progress_session_id               (user_progress)
  - idx_game_events_user_id                    (game_events)
  - idx_game_events_created_at                 (game_events)
  - idx_superlative_puzzles_game_id            (superlative_puzzles)
  - idx_superlative_items_puzzle_id            (superlative_items)
  - idx_puzzle_items_rank                      (puzzle_items)
*/

DROP INDEX IF EXISTS public.idx_playlist_rounds_superlative_puzzle_id;
DROP INDEX IF EXISTS public.idx_user_profiles_email;
DROP INDEX IF EXISTS public.idx_user_profiles_username;
DROP INDEX IF EXISTS public.idx_game_sessions_created_at;
DROP INDEX IF EXISTS public.idx_round_results_session_id;
DROP INDEX IF EXISTS public.idx_user_seen_content_user_game;
DROP INDEX IF EXISTS public.idx_user_progress_user_id;
DROP INDEX IF EXISTS public.idx_user_progress_session_id;
DROP INDEX IF EXISTS public.idx_game_events_user_id;
DROP INDEX IF EXISTS public.idx_game_events_created_at;
DROP INDEX IF EXISTS public.idx_superlative_puzzles_game_id;
DROP INDEX IF EXISTS public.idx_superlative_items_puzzle_id;
DROP INDEX IF EXISTS public.idx_puzzle_items_rank;
