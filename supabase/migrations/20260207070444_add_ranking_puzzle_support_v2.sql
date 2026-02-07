/*
  # Add Ranking Puzzle Support for RankAndRoll
  
  1. Schema Updates
    - Add 'ranking' to game_type constraint
    - Add correct_rank column to puzzle_items table
    - Make correct_category nullable (since ranking puzzles don't use categories)
    
  2. Sample Data
    - Create sample ranking puzzles for RankAndRoll (game_id = 4)
    
  3. Security
    - Existing RLS policies will cover new data
*/

-- Update game_type constraint to include 'ranking'
ALTER TABLE public.puzzles DROP CONSTRAINT IF EXISTS puzzles_game_type_check;
ALTER TABLE public.puzzles 
ADD CONSTRAINT puzzles_game_type_check 
CHECK (game_type IN ('multiple_choice', 'disordat', 'ranking'));

-- Add correct_rank column to puzzle_items
ALTER TABLE public.puzzle_items 
ADD COLUMN IF NOT EXISTS correct_rank INTEGER;

-- Make correct_category nullable since ranking puzzles don't use it
ALTER TABLE public.puzzle_items 
ALTER COLUMN correct_category DROP NOT NULL;

-- Update the constraint to be optional
ALTER TABLE public.puzzle_items DROP CONSTRAINT IF EXISTS puzzle_items_correct_category_check;
ALTER TABLE public.puzzle_items 
ADD CONSTRAINT puzzle_items_correct_category_check 
CHECK (correct_category IS NULL OR correct_category IN ('category_1', 'category_2', 'both'));

-- Create index for better performance on ranking queries
CREATE INDEX IF NOT EXISTS idx_puzzle_items_rank ON public.puzzle_items(puzzle_id, correct_rank);

-- Insert sample ranking puzzles for RankAndRoll
DO $$
DECLARE
    puzzle1_id BIGINT;
    puzzle2_id BIGINT;
BEGIN
    -- Puzzle 1: Planets by size
    INSERT INTO public.puzzles (
        game_id, 
        prompt, 
        game_type, 
        difficulty,
        correct_answer,
        wrong_answers
    ) VALUES (
        4,
        'size (smallest to largest)',
        'ranking',
        'medium',
        'Planets by size',
        '{}'
    ) RETURNING id INTO puzzle1_id;
    
    INSERT INTO public.puzzle_items (puzzle_id, item_text, correct_rank, item_order) VALUES
    (puzzle1_id, 'Mercury', 1, 1),
    (puzzle1_id, 'Mars', 2, 2),
    (puzzle1_id, 'Earth', 3, 3),
    (puzzle1_id, 'Jupiter', 4, 4);
    
    -- Puzzle 2: Movies by release year
    INSERT INTO public.puzzles (
        game_id, 
        prompt, 
        game_type, 
        difficulty,
        correct_answer,
        wrong_answers
    ) VALUES (
        4,
        'release year (oldest to newest)',
        'ranking',
        'medium',
        'Movies by release year',
        '{}'
    ) RETURNING id INTO puzzle2_id;
    
    INSERT INTO public.puzzle_items (puzzle_id, item_text, correct_rank, item_order) VALUES
    (puzzle2_id, 'The Wizard of Oz', 1, 1),
    (puzzle2_id, 'Star Wars', 2, 2),
    (puzzle2_id, 'The Matrix', 3, 3),
    (puzzle2_id, 'Avatar', 4, 4);
    
END $$;