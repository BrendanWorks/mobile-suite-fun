/*
  # Create leaderboard_entries table

  ## Summary
  Adds a leaderboard system that records per-session scores globally so
  the app can display top-10 all-time and top-10 this-week rankings.

  ## New Tables

  ### leaderboard_entries
  Stores one row per completed game session eligible for the leaderboard.

  | Column            | Type        | Description                                      |
  |-------------------|-------------|--------------------------------------------------|
  | id                | uuid PK     | Auto-generated primary key                       |
  | user_id           | uuid FK     | References auth.users – the player               |
  | score             | integer     | Total session score (normalized, with bonuses)   |
  | game_id           | integer     | Game slug ID for per-game filtering (nullable)   |
  | display_name      | text        | Player display name at time of entry             |
  | playlist_id       | integer     | Playlist played (nullable)                       |
  | round_count       | integer     | Number of rounds completed in the session        |
  | created_at        | timestamptz | When the entry was recorded                      |

  ## Security
  - RLS enabled; authenticated users can insert their own rows and read all rows.
  - Anonymous reads allowed so unauthenticated players can view the board.
  - No user can write another user's entry.

  ## Indexes
  - Index on score DESC for fast top-N queries.
  - Index on created_at DESC for weekly filtering.
  - Index on user_id for per-user history.
*/

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score        integer     NOT NULL DEFAULT 0,
  game_id      integer     NULL,
  display_name text        NOT NULL DEFAULT '',
  playlist_id  integer     NULL,
  round_count  integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read leaderboard entries"
  ON leaderboard_entries FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert own entries"
  ON leaderboard_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS leaderboard_entries_score_idx
  ON leaderboard_entries (score DESC);

CREATE INDEX IF NOT EXISTS leaderboard_entries_created_at_idx
  ON leaderboard_entries (created_at DESC);

CREATE INDEX IF NOT EXISTS leaderboard_entries_user_id_idx
  ON leaderboard_entries (user_id);
