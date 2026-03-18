/*
  # Register UpYours (Bounce) in the games table

  Inserts UpYours with slug 'gravity-ball' (matching the GAME_REGISTRY id used in the frontend)
  and assigns it id 25 (next available after 24/Flashbang).
*/

INSERT INTO games (id, name, slug, description, category, is_active)
VALUES (25, 'Bounce', 'gravity-ball', 'Tilt to steer, bounce higher on gold springs', 'arcade', true)
ON CONFLICT (id) DO NOTHING;
