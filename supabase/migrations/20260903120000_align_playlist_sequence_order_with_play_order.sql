/*
  # Align playlists.sequence_order with the app's play order

  ## Problem
  `sequence_order` drifted away from the order players actually progress
  through. The canonical order lives in src/lib/anonymousSession.ts as
  PLAYLIST_SEQUENCE (marked "DO NOT MODIFY THIS ORDER!"), but the column was
  carrying unrelated values (one playlist sat around 50). Until the level
  number was derived from play position in code, that surfaced to players as
  a level jumping from 3 to 50.

  ## What still reads this column
  - PlaylistSelector and DebugMode list playlists with ORDER BY sequence_order
  - public.get_next_playlist_for_user() picks the first uncompleted active
    playlist by sequence_order (currently unused by the app, but it would
    hand out playlists in the wrong order if it were wired up)

  The player-facing level number no longer reads this column, so this
  migration changes list ordering only — no gameplay or scoring impact.

  ## Change
  1. The ten playlists in PLAYLIST_SEQUENCE get sequence_order 1..10 matching
     their play order.
  2. Any other playlist that would collide with 1..10 is moved above the
     rotation, keeping its relative order, so listings sort deterministically.

  Written to be idempotent and safe to re-run. Updates run in two phases via
  a temporary high offset so a unique index on sequence_order (if one exists)
  cannot trip on a transient duplicate mid-statement.
*/

DO $$
DECLARE
  -- Play order from src/lib/anonymousSession.ts (PLAYLIST_SEQUENCE):
  -- 1=Wildly Inappropriate(22), 2=Junk Food(42), 3=Music(43), 4=Plot Twist(44),
  -- 5=Booze(45), 6=Sports(46), 7=Money(47), 8=Hipsters(48), 9=Health(49),
  -- 10=Crazy World(52)
  seq bigint[] := ARRAY[22, 42, 43, 44, 45, 46, 47, 48, 49, 52];
  matched integer;
  displaced integer;
BEGIN
  -- Phase 1: park the rotation rows above every existing value so the final
  -- assignment can never collide with a row that has not been moved yet.
  UPDATE public.playlists p
  SET sequence_order = 10000 + t.position
  FROM (
    SELECT id_value AS playlist_id, ordinality::int AS position
    FROM unnest(seq) WITH ORDINALITY AS u(id_value, ordinality)
  ) t
  WHERE p.id = t.playlist_id;

  GET DIAGNOSTICS matched = ROW_COUNT;

  -- Phase 2: push any non-rotation playlist that occupies 1..10 above the
  -- rotation, preserving the relative order it already had.
  WITH others AS (
    SELECT id, row_number() OVER (ORDER BY sequence_order, id) AS rn
    FROM public.playlists
    WHERE NOT (id = ANY(seq))
      AND sequence_order IS NOT NULL
      AND sequence_order BETWEEN 1 AND array_length(seq, 1)
  )
  UPDATE public.playlists p
  SET sequence_order = array_length(seq, 1) + others.rn
  FROM others
  WHERE p.id = others.id;

  GET DIAGNOSTICS displaced = ROW_COUNT;

  -- Phase 3: land the rotation on its final 1..10.
  UPDATE public.playlists p
  SET sequence_order = t.position
  FROM (
    SELECT id_value AS playlist_id, ordinality::int AS position
    FROM unnest(seq) WITH ORDINALITY AS u(id_value, ordinality)
  ) t
  WHERE p.id = t.playlist_id;

  RAISE NOTICE 'sequence_order aligned: % of % rotation playlists updated, % non-rotation playlist(s) moved clear',
    matched, array_length(seq, 1), displaced;

  IF matched < array_length(seq, 1) THEN
    RAISE NOTICE 'Note: % playlist id(s) from PLAYLIST_SEQUENCE were not found in public.playlists',
      array_length(seq, 1) - matched;
  END IF;
END $$;

-- Verify after applying:
--   SELECT id, name, sequence_order FROM public.playlists ORDER BY sequence_order;
-- The first ten rows should be ids 22, 42, 43, 44, 45, 46, 47, 48, 49, 52.
