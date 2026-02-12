/*
  # Add Hive Mind Game Support

  ## Overview
  This migration adds support for the Hive Mind game type, a consensus-based trivia game where players guess what the majority chose.

  ## Changes

  ### 1. Schema Updates
  - Update `puzzles.game_type` constraint to include 'hive_mind'
  - Make `puzzles.correct_answer` nullable (consensus games don't have single correct answers)

  ### 2. Game Registration
  - Add 'Hive Mind' to the `games` table

  ### 3. Sample Content
  - Add 4 sample Hive Mind puzzles with survey questions
*/

-- Update game_type constraint to include hive_mind
DO $$
BEGIN
  ALTER TABLE puzzles DROP CONSTRAINT IF EXISTS puzzles_game_type_check;
  
  ALTER TABLE puzzles ADD CONSTRAINT puzzles_game_type_check 
    CHECK (game_type = ANY (ARRAY[
      'multiple_choice'::text, 
      'disordat'::text, 
      'ranking'::text, 
      'photo_mystery'::text, 
      'fake_out'::text,
      'hive_mind'::text
    ]));
END $$;

-- Make correct_answer nullable
DO $$
BEGIN
  ALTER TABLE puzzles ALTER COLUMN correct_answer DROP NOT NULL;
END $$;

-- Insert Hive Mind game
DO $$
BEGIN
  INSERT INTO games (name, slug, description, category, is_active)
  VALUES (
    'Hive Mind',
    'hive-mind',
    'Predict what most people chose! Match the consensus to score points.',
    'consensus',
    true
  )
  ON CONFLICT (slug) DO NOTHING;
END $$;

-- Add sample puzzles
DO $$
DECLARE
  v_game_id bigint;
BEGIN
  SELECT id INTO v_game_id FROM games WHERE slug = 'hive-mind';
  
  IF v_game_id IS NULL THEN
    RAISE EXCEPTION 'Hive Mind game not found';
  END IF;

  -- Coffee preferences
  IF NOT EXISTS (SELECT 1 FROM puzzles WHERE game_id = v_game_id AND prompt = 'Coffee Preference Survey') THEN
    INSERT INTO puzzles (game_id, game_type, prompt, metadata, is_playable)
    VALUES (
      v_game_id,
      'hive_mind',
      'Coffee Preference Survey',
      '{"questions": [
        {
          "question": "How do you like your coffee?",
          "choices": [
            {"text": "Black", "percentage": 15},
            {"text": "With cream", "percentage": 25},
            {"text": "With sugar", "percentage": 18},
            {"text": "With cream and sugar", "percentage": 42}
          ]
        },
        {
          "question": "Best time to drink coffee?",
          "choices": [
            {"text": "First thing in the morning", "percentage": 58},
            {"text": "Mid-morning", "percentage": 22},
            {"text": "After lunch", "percentage": 15},
            {"text": "Anytime", "percentage": 5}
          ]
        },
        {
          "question": "Favorite coffee drink?",
          "choices": [
            {"text": "Regular drip coffee", "percentage": 35},
            {"text": "Latte", "percentage": 28},
            {"text": "Cappuccino", "percentage": 18},
            {"text": "Espresso", "percentage": 19}
          ]
        }
      ]}'::jsonb,
      true
    );
  END IF;

  -- Social media
  IF NOT EXISTS (SELECT 1 FROM puzzles WHERE game_id = v_game_id AND prompt = 'Social Media Habits') THEN
    INSERT INTO puzzles (game_id, game_type, prompt, metadata, is_playable)
    VALUES (
      v_game_id,
      'hive_mind',
      'Social Media Habits',
      '{"questions": [
        {
          "question": "Most used social media platform?",
          "choices": [
            {"text": "Instagram", "percentage": 32},
            {"text": "TikTok", "percentage": 28},
            {"text": "Facebook", "percentage": 18},
            {"text": "Twitter/X", "percentage": 22}
          ]
        },
        {
          "question": "How often do you post?",
          "choices": [
            {"text": "Daily", "percentage": 15},
            {"text": "Few times a week", "percentage": 28},
            {"text": "Once a week", "percentage": 22},
            {"text": "Rarely or never", "percentage": 35}
          ]
        },
        {
          "question": "What do you mostly share?",
          "choices": [
            {"text": "Photos", "percentage": 45},
            {"text": "Memes", "percentage": 30},
            {"text": "Personal updates", "percentage": 15},
            {"text": "News/Articles", "percentage": 10}
          ]
        }
      ]}'::jsonb,
      true
    );
  END IF;

  -- Pizza
  IF NOT EXISTS (SELECT 1 FROM puzzles WHERE game_id = v_game_id AND prompt = 'Pizza Preferences') THEN
    INSERT INTO puzzles (game_id, game_type, prompt, metadata, is_playable)
    VALUES (
      v_game_id,
      'hive_mind',
      'Pizza Preferences',
      '{"questions": [
        {
          "question": "Favorite pizza topping?",
          "choices": [
            {"text": "Pepperoni", "percentage": 52},
            {"text": "Mushrooms", "percentage": 12},
            {"text": "Sausage", "percentage": 18},
            {"text": "Vegetables", "percentage": 18}
          ]
        },
        {
          "question": "Crust preference?",
          "choices": [
            {"text": "Thin crust", "percentage": 35},
            {"text": "Regular", "percentage": 40},
            {"text": "Thick/Deep dish", "percentage": 18},
            {"text": "Stuffed crust", "percentage": 7}
          ]
        },
        {
          "question": "When do you eat pizza?",
          "choices": [
            {"text": "Friday night", "percentage": 45},
            {"text": "Weekend lunch", "percentage": 25},
            {"text": "Anytime", "percentage": 22},
            {"text": "Late night snack", "percentage": 8}
          ]
        }
      ]}'::jsonb,
      true
    );
  END IF;

  -- Streaming
  IF NOT EXISTS (SELECT 1 FROM puzzles WHERE game_id = v_game_id AND prompt = 'Streaming Preferences') THEN
    INSERT INTO puzzles (game_id, game_type, prompt, metadata, is_playable)
    VALUES (
      v_game_id,
      'hive_mind',
      'Streaming Preferences',
      '{"questions": [
        {
          "question": "Favorite streaming service?",
          "choices": [
            {"text": "Netflix", "percentage": 42},
            {"text": "Disney+", "percentage": 18},
            {"text": "Prime Video", "percentage": 22},
            {"text": "Hulu", "percentage": 18}
          ]
        },
        {
          "question": "What do you binge watch?",
          "choices": [
            {"text": "Dramas", "percentage": 35},
            {"text": "Comedies", "percentage": 28},
            {"text": "Documentaries", "percentage": 12},
            {"text": "Reality TV", "percentage": 25}
          ]
        },
        {
          "question": "When do you watch?",
          "choices": [
            {"text": "Evening after work", "percentage": 48},
            {"text": "Weekend mornings", "percentage": 15},
            {"text": "Before bed", "percentage": 30},
            {"text": "During meals", "percentage": 7}
          ]
        }
      ]}'::jsonb,
      true
    );
  END IF;

END $$;
