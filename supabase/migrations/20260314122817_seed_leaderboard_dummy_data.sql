/*
  # Seed leaderboard with dummy player data

  ## Summary
  Inserts 19 fictional player records into the leaderboard for testing
  sorting, display, and weekly vs all-time filtering.

  Each dummy player gets a synthetic entry in auth.users (via the
  identities-free insert path) and a corresponding leaderboard_entries row.

  ## Players seeded
  John Carmack (highest score), Phil Dick, Ninja, Elton J., Don Trump,
  PewDiePie, H. Cavill, K. Reeves, Billie Eilish, Captain_Pants,
  Jablinski, Megan Fox, Dwayne Johnson, Serena Williams, Gordon Ramsay,
  Taylor Swift, Mark Zuckerberg, Snoop Dogg, Oprah

  ## Notes
  - Uses fixed UUIDs so re-running the migration is idempotent.
  - Scores span 120–9950 to exercise full sort range.
  - Mix of recent (within 7 days) and older entries to test weekly filter.
*/

DO $$
DECLARE
  players jsonb := '[
    {"uuid": "aaaaaaaa-0001-4000-8000-000000000001", "name": "John Carmack",    "score": 9950, "days_ago": 1},
    {"uuid": "aaaaaaaa-0002-4000-8000-000000000002", "name": "K. Reeves",        "score": 8800, "days_ago": 2},
    {"uuid": "aaaaaaaa-0003-4000-8000-000000000003", "name": "Dwayne Johnson",   "score": 8200, "days_ago": 3},
    {"uuid": "aaaaaaaa-0004-4000-8000-000000000004", "name": "Serena Williams",  "score": 7600, "days_ago": 5},
    {"uuid": "aaaaaaaa-0005-4000-8000-000000000005", "name": "Gordon Ramsay",    "score": 7100, "days_ago": 6},
    {"uuid": "aaaaaaaa-0006-4000-8000-000000000006", "name": "Taylor Swift",     "score": 6850, "days_ago": 4},
    {"uuid": "aaaaaaaa-0007-4000-8000-000000000007", "name": "Snoop Dogg",       "score": 6400, "days_ago": 10},
    {"uuid": "aaaaaaaa-0008-4000-8000-000000000008", "name": "PewDiePie",        "score": 5900, "days_ago": 14},
    {"uuid": "aaaaaaaa-0009-4000-8000-000000000009", "name": "Oprah",            "score": 5300, "days_ago": 20},
    {"uuid": "aaaaaaaa-0010-4000-8000-000000000010", "name": "Billie Eilish",    "score": 4750, "days_ago": 2},
    {"uuid": "aaaaaaaa-0011-4000-8000-000000000011", "name": "Megan Fox",        "score": 4200, "days_ago": 30},
    {"uuid": "aaaaaaaa-0012-4000-8000-000000000012", "name": "Ninja",            "score": 3800, "days_ago": 7},
    {"uuid": "aaaaaaaa-0013-4000-8000-000000000013", "name": "H. Cavill",        "score": 3300, "days_ago": 45},
    {"uuid": "aaaaaaaa-0014-4000-8000-000000000014", "name": "Elton J.",         "score": 2900, "days_ago": 3},
    {"uuid": "aaaaaaaa-0015-4000-8000-000000000015", "name": "Phil Dick",        "score": 2400, "days_ago": 60},
    {"uuid": "aaaaaaaa-0016-4000-8000-000000000016", "name": "Jablinski",        "score": 1950, "days_ago": 5},
    {"uuid": "aaaaaaaa-0017-4000-8000-000000000017", "name": "Mark Zuckerberg", "score": 1400, "days_ago": 90},
    {"uuid": "aaaaaaaa-0018-4000-8000-000000000018", "name": "Don Trump",        "score":  820, "days_ago": 4},
    {"uuid": "aaaaaaaa-0019-4000-8000-000000000019", "name": "Captain_Pants",    "score":  120, "days_ago": 1}
  ]'::jsonb;
  p jsonb;
  player_uuid uuid;
  player_name text;
  player_score int;
  days_ago int;
  entry_ts timestamptz;
BEGIN
  FOR p IN SELECT * FROM jsonb_array_elements(players)
  LOOP
    player_uuid  := (p->>'uuid')::uuid;
    player_name  := p->>'name';
    player_score := (p->>'score')::int;
    days_ago     := (p->>'days_ago')::int;
    entry_ts     := now() - (days_ago || ' days')::interval;

    INSERT INTO auth.users (
      id,
      instance_id,
      role,
      aud,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    VALUES (
      player_uuid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      lower(replace(player_name, ' ', '.')) || '@dummy.zooma',
      '',
      now(),
      entry_ts,
      entry_ts,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', player_name),
      false,
      '', '', '', ''
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO leaderboard_entries (user_id, score, display_name, round_count, created_at)
    VALUES (player_uuid, player_score, player_name, 10, entry_ts)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
