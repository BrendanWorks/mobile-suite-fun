/*
  # Register Debris Game

  Adds Debris (Asteroids-style action game) to the games registry.

  - id: 27
  - slug: debris
  - name: Debris
  - No database content dependency (procedural game)
*/

INSERT INTO games (id, name, slug)
VALUES (27, 'Debris', 'debris')
ON CONFLICT (id) DO NOTHING;
