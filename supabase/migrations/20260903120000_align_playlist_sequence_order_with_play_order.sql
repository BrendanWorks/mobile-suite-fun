/*
  # Align playlists.sequence_order with the app's play order

  ## Problem
  `sequence_order` had drifted from the order players actually progress
  through. The canonical order lives in src/lib/anonymousSession.ts as
  PLAYLIST_SEQUENCE (marked "DO NOT MODIFY THIS ORDER!"). In production,
  playlist 44 (Plot Twist) sat at sequence_order 50 when it should be 4 —
  which is exactly what surfaced to players as a level jumping from 3
  (Music) to 50, before the level number was derived from play position in
  code. It was the only rotation row that was wrong.

  ## Scope
  This assigns sequence_order 1..10 to the ten playlists in the rotation and
  deliberately leaves every other playlist alone.

  Production carries 22 playlists outside the rotation, and several
  sequence_order values are duplicated across them (Junk Food and Gaming &
  Geek Culture both at 2, and so on). Renumbering those was considered and
  rejected: nothing in the app depends on their values, and rewriting rows
  the maintainer did not ask to change is not worth the churn. If the
  duplicates are ever worth cleaning up, that belongs in its own migration.

  ## What reads this column
  - DebugMode lists playlists with ORDER BY sequence_order
  - PlaylistSelector does too, but is not mounted anywhere in the app
  - public.get_next_playlist_for_user() picks the first uncompleted active
    playlist by sequence_order (currently unused by the app, but it would
    hand out playlists in the wrong order if it were wired up)

  Neither the content of a playlist nor which playlists players receive
  depends on this column — that is PLAYLIST_SEQUENCE in code — and the
  player-facing level number reads play position, not this column. So this
  is list ordering and data hygiene only: no gameplay or scoring impact.

  Idempotent: already-correct rows are rewritten to the same values, so
  re-running changes nothing. The rotation is parked at a high offset first
  so a unique index on sequence_order, if one is ever added, cannot trip on
  a transient duplicate mid-statement.
*/

DO $$
DECLARE
  -- Play order from src/lib/anonymousSession.ts (PLAYLIST_SEQUENCE):
  -- 1=Wildly Inappropriate(22), 2=Junk Food(42), 3=Music(43), 4=Plot Twist(44),
  -- 5=Booze(45), 6=Sports(46), 7=Money(47), 8=Hipsters(48), 9=Health(49),
  -- 10=Crazy World(52)
  seq bigint[] := ARRAY[22, 42, 43, 44, 45, 46, 47, 48, 49, 52];
  n integer := array_length(seq, 1);
  matched integer;
BEGIN
  -- Phase 1: park the rotation above every existing value so the final
  -- assignment cannot collide with a rotation row that has not moved yet.
  UPDATE public.playlists p
  SET sequence_order = 100000 + t.position
  FROM (
    SELECT id_value AS playlist_id, ordinality::int AS position
    FROM unnest(seq) WITH ORDINALITY AS u(id_value, ordinality)
  ) t
  WHERE p.id = t.playlist_id;

  GET DIAGNOSTICS matched = ROW_COUNT;

  -- Phase 2: land the rotation on its final 1..n, in play order.
  UPDATE public.playlists p
  SET sequence_order = t.position
  FROM (
    SELECT id_value AS playlist_id, ordinality::int AS position
    FROM unnest(seq) WITH ORDINALITY AS u(id_value, ordinality)
  ) t
  WHERE p.id = t.playlist_id;

  RAISE NOTICE 'rotation: % of % playlists set to 1..% in play order', matched, n, n;

  IF matched < n THEN
    RAISE NOTICE 'Note: % playlist id(s) from PLAYLIST_SEQUENCE were not found in public.playlists',
      n - matched;
  END IF;
END $$;

-- Verify after applying:
--   SELECT id, name, sequence_order FROM public.playlists ORDER BY sequence_order LIMIT 10;
-- Should be ids 22, 42, 43, 44, 45, 46, 47, 48, 49, 52 at 1..10.
