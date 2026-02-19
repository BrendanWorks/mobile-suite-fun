/*
  # Lock Down RLS on Content Tables

  ## Summary
  Enables Row Level Security on all public content/reference tables that were
  previously unprotected. These tables (games, puzzles, levels, ranking_puzzles,
  ranking_items, playlists, playlist_rounds) contain read-only game content and
  should be publicly readable but never directly writable by any user.

  ## Changes

  ### Tables with RLS now enabled
  - `games` — game type definitions, read-only reference data
  - `puzzles` — puzzle content, read-only reference data
  - `levels` — level definitions, read-only reference data
  - `ranking_puzzles` — ranking game content, read-only reference data
  - `ranking_items` — ranking item content, read-only reference data
  - `playlists` — playlist definitions, read-only reference data
  - `playlist_rounds` — playlist round mappings, read-only reference data

  ## Security Policies
  - All tables: anonymous and authenticated users can SELECT active/public records
  - No INSERT, UPDATE, or DELETE policies — all writes must go through service role only
  - This enforces that content is managed via migrations/admin tools only, not by end users

  ## Notes
  1. The anon key (used by the frontend) will still be able to read all these tables
  2. No user, even authenticated, can modify content tables through the client
  3. Service role (used by edge functions and admin migrations) bypasses RLS entirely
*/

-- games: publicly readable
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read games"
  ON games FOR SELECT
  TO anon, authenticated
  USING (true);

-- puzzles: publicly readable
ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read puzzles"
  ON puzzles FOR SELECT
  TO anon, authenticated
  USING (true);

-- levels: publicly readable
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read levels"
  ON levels FOR SELECT
  TO anon, authenticated
  USING (true);

-- ranking_puzzles: publicly readable
ALTER TABLE ranking_puzzles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ranking puzzles"
  ON ranking_puzzles FOR SELECT
  TO anon, authenticated
  USING (true);

-- ranking_items: publicly readable
ALTER TABLE ranking_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ranking items"
  ON ranking_items FOR SELECT
  TO anon, authenticated
  USING (true);

-- playlists: publicly readable
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read playlists"
  ON playlists FOR SELECT
  TO anon, authenticated
  USING (true);

-- playlist_rounds: publicly readable
ALTER TABLE playlist_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read playlist rounds"
  ON playlist_rounds FOR SELECT
  TO anon, authenticated
  USING (true);
