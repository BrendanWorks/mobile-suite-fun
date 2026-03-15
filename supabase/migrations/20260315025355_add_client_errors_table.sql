/*
  # Create client_errors table

  Captures frontend errors (React error boundaries, unhandled exceptions) for
  remote debugging — especially useful when browser DevTools are unavailable
  (e.g., on mobile Safari).

  ## New Tables
  - `client_errors`
    - `id` (uuid, primary key)
    - `created_at` (timestamptz)
    - `user_id` (uuid, nullable FK to auth.users)
    - `error_message` (text) — Error.message
    - `error_stack` (text, nullable) — Error.stack
    - `component_stack` (text, nullable) — React componentStack
    - `context` (jsonb, nullable) — arbitrary context bag (playlist_id, round, game, etc.)
    - `url` (text, nullable) — window.location.href at time of error
    - `user_agent` (text, nullable)

  ## Security
  - RLS enabled; only the owning user can read their own rows.
  - Any authenticated OR anonymous (null) user can insert (so anon players
    also get logged).
*/

CREATE TABLE IF NOT EXISTS client_errors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message   text NOT NULL DEFAULT '',
  error_stack     text,
  component_stack text,
  context         jsonb,
  url             text,
  user_agent      text
);

ALTER TABLE client_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert their own errors"
  ON client_errors FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anon users can insert errors with null user_id"
  ON client_errors FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Users can read their own errors"
  ON client_errors FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS client_errors_user_id_idx ON client_errors(user_id);
CREATE INDEX IF NOT EXISTS client_errors_created_at_idx ON client_errors(created_at DESC);
