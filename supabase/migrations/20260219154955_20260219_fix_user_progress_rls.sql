/*
  # Fix user_progress RLS Policies

  ## Summary
  The user_progress table had two overlapping FOR ALL policies using the public
  role instead of authenticated. This replaces them with explicit, scoped policies
  for each operation using the authenticated role only.

  ## Changes
  - Drop the two broad FOR ALL / public role policies
  - Add explicit SELECT, INSERT, UPDATE, DELETE policies for authenticated users only
  - Each policy checks that auth.uid() matches the user_id column
*/

DROP POLICY IF EXISTS "Users can manage own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can track their own progress" ON user_progress;

CREATE POLICY "Users can view own progress"
  ON user_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON user_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON user_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress"
  ON user_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
