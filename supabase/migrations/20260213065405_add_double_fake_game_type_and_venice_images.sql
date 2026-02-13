/*
  # Add DoubleFake Game Type and Venice Images

  1. Changes
    - Update puzzles_game_type_check constraint to include 'double_fake'
    - Add Venice test images for both Fake Out and DoubleFake games
  
  2. New Data
    - Fake Out: Two separate puzzles (real Grand Canal photo, AI carnival gondola)
    - DoubleFake: One comparison puzzle with both images in metadata
  
  3. Notes
    - Game IDs 15 (Fake Out) and 16 (DoubleFake) were created in previous query
    - Image paths reference files in /public directory
*/

-- Drop existing constraint
ALTER TABLE puzzles DROP CONSTRAINT IF EXISTS puzzles_game_type_check;

-- Add updated constraint with double_fake
ALTER TABLE puzzles ADD CONSTRAINT puzzles_game_type_check 
  CHECK (game_type = ANY (ARRAY[
    'multiple_choice'::text, 
    'disordat'::text, 
    'ranking'::text, 
    'photo_mystery'::text, 
    'fake_out'::text, 
    'hive_mind'::text,
    'double_fake'::text
  ]));

-- Insert Venice puzzles for Fake Out
INSERT INTO puzzles (game_id, game_type, image_url, correct_answer, metadata, difficulty, is_playable)
VALUES 
  (
    15,
    'fake_out',
    '/Grand_canal_and_old_cathedral_in_Venice.jpg',
    'real',
    '{"source": "photograph", "description": "Grand Canal in Venice with Cathedral", "difficulty": "medium"}'::jsonb,
    'medium',
    true
  ),
  (
    15,
    'fake_out',
    '/venice-carnival-celebration_Fake_AI.jpg',
    'fake',
    '{"source": "dall-e", "description": "Venice Carnival Gondola with Decorations", "difficulty": "medium"}'::jsonb,
    'medium',
    true
  );

-- Insert Venice comparison puzzle for DoubleFake
INSERT INTO puzzles (game_id, game_type, metadata, difficulty, is_playable)
VALUES 
  (
    16,
    'double_fake',
    '{"ai_image_url": "/venice-carnival-celebration_Fake_AI.jpg", "real_image_url": "/Grand_canal_and_old_cathedral_in_Venice.jpg", "description": "Venice Scenes - Real vs AI", "difficulty": "medium", "ai_source": "dall-e"}'::jsonb,
    'medium',
    true
  );
