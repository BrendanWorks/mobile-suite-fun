/*
  # Add Fake Out Game Support
  
  1. Schema Updates
    - Add 'fake_out' to game_type constraint to support AI vs Real photo detection
    - Add image_url column to puzzles table for storing image URLs
    - Add metadata column support for storing source, description, and difficulty
    
  2. Changes
    - Update game_type constraint to include 'fake_out' and existing types
    - Ensure image_url column exists for image storage
    - Metadata JSON column to store puzzle-specific data (source, description, etc.)
    
  3. Security
    - Existing RLS policies will cover new data
*/

-- Update game_type constraint to include 'fake_out' and all existing types
ALTER TABLE public.puzzles DROP CONSTRAINT IF EXISTS puzzles_game_type_check;
ALTER TABLE public.puzzles 
ADD CONSTRAINT puzzles_game_type_check 
CHECK (game_type IN ('multiple_choice', 'disordat', 'ranking', 'photo_mystery', 'fake_out'));

-- Ensure image_url column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'puzzles' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE public.puzzles 
        ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Ensure metadata column exists (should already be there but checking)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'puzzles' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.puzzles 
        ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;