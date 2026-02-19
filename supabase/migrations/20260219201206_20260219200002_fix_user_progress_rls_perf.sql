/*
  # Fix user_progress RLS Policy Performance

  ## Summary
  The four RLS policies on user_progress call auth.uid() directly, causing
  Postgres to re-evaluate the function for every row scanned. Wrapping the
  call in a sub-select (select auth.uid()) causes it to be evaluated once
  per query instead, which significantly improves performance at scale.

  ## Changes
  - Drop and recreate all four user_progress RLS policies using
    `(select auth.uid())` pattern instead of bare `auth.uid()`
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can delete own progress" ON public.user_progress;

-- Recreate with sub-select pattern for single evaluation per query
CREATE POLICY "Users can view own progress"
  ON public.user_progress
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own progress"
  ON public.user_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own progress"
  ON public.user_progress
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own progress"
  ON public.user_progress
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
