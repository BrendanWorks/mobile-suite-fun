/*
  # Add Split Decision (DisOrDat) Support

  1. Schema Updates
    - Add category columns to puzzles table
    - Add game_type column to support different puzzle types
    - Create puzzle_items table for individual categorization items
    - Update user_progress table for detailed scoring

  2. New Tables
    - `puzzle_items` - Individual items for categorization games
    
  3. Functions
    - `insert_disordat_puzzle` - Helper to insert complete puzzle sets
    - `record_disordat_response` - Record and score user responses
    
  4. Views
    - `disordat_puzzles_complete` - Easy querying of complete puzzle sets
    
  5. Security
    - RLS policies for new tables
    - Performance indexes
*/

-- First, let's modify the puzzles table to accommodate Split Decision structure
-- We'll add columns for the two categories and change the answer structure

ALTER TABLE public.puzzles 
ADD COLUMN IF NOT EXISTS category_1 TEXT,
ADD COLUMN IF NOT EXISTS category_2 TEXT,
ADD COLUMN IF NOT EXISTS game_type TEXT DEFAULT 'multiple_choice';

-- Add constraint for game_type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'puzzles_game_type_check'
    ) THEN
        ALTER TABLE public.puzzles 
        ADD CONSTRAINT puzzles_game_type_check 
        CHECK (game_type IN ('multiple_choice', 'disordat'));
    END IF;
END $$;

-- Create a new table for individual puzzle items (for DisOrDat games)
CREATE TABLE IF NOT EXISTS public.puzzle_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    puzzle_id BIGINT NOT NULL REFERENCES public.puzzles(id) ON DELETE CASCADE,
    item_text TEXT NOT NULL,
    correct_category TEXT NOT NULL,
    item_order INTEGER, -- For maintaining order of items in the set
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraint for correct_category if table was just created
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'puzzle_items_correct_category_check'
    ) THEN
        ALTER TABLE public.puzzle_items 
        ADD CONSTRAINT puzzle_items_correct_category_check 
        CHECK (correct_category IN ('category_1', 'category_2', 'both'));
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_puzzle_items_puzzle_id ON public.puzzle_items(puzzle_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_items_order ON public.puzzle_items(puzzle_id, item_order);

-- Update the user_progress table to handle DisOrDat scoring
-- Add columns to track categorization performance
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_progress' AND column_name = 'items_attempted'
    ) THEN
        ALTER TABLE public.user_progress 
        ADD COLUMN items_attempted INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_progress' AND column_name = 'items_correct'
    ) THEN
        ALTER TABLE public.user_progress 
        ADD COLUMN items_correct INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_progress' AND column_name = 'response_data'
    ) THEN
        ALTER TABLE public.user_progress 
        ADD COLUMN response_data JSONB; -- Store individual item responses
    END IF;
END $$;

-- Create a function to insert a complete DisOrDat puzzle set
CREATE OR REPLACE FUNCTION insert_disordat_puzzle(
    p_game_id BIGINT,
    p_prompt TEXT,
    p_category_1 TEXT,
    p_category_2 TEXT,
    p_items JSONB, -- Array of {text: "item", category: "category_1|category_2|both"}
    p_difficulty TEXT DEFAULT 'medium',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS BIGINT AS $$
DECLARE
    puzzle_id BIGINT;
    item JSONB;
    item_counter INTEGER := 1;
BEGIN
    -- Insert the main puzzle record
    INSERT INTO public.puzzles (
        game_id, 
        prompt, 
        category_1, 
        category_2, 
        game_type, 
        difficulty, 
        metadata,
        correct_answer, -- Keep this for compatibility, store summary
        wrong_answers   -- Keep this empty for DisOrDat
    ) VALUES (
        p_game_id,
        p_prompt,
        p_category_1,
        p_category_2,
        'disordat',
        p_difficulty,
        p_metadata,
        format('%s vs %s', p_category_1, p_category_2),
        '{}'
    ) RETURNING id INTO puzzle_id;
    
    -- Insert each item
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.puzzle_items (
            puzzle_id,
            item_text,
            correct_category,
            item_order
        ) VALUES (
            puzzle_id,
            item->>'text',
            item->>'category',
            item_counter
        );
        item_counter := item_counter + 1;
    END LOOP;
    
    RETURN puzzle_id;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy querying of complete DisOrDat puzzles
CREATE OR REPLACE VIEW disordat_puzzles_complete AS
SELECT 
    p.id,
    p.game_id,
    p.prompt,
    p.category_1,
    p.category_2,
    p.difficulty,
    p.metadata,
    p.created_at,
    jsonb_agg(
        jsonb_build_object(
            'id', pi.id,
            'text', pi.item_text,
            'correct_category', pi.correct_category,
            'order', pi.item_order
        ) ORDER BY pi.item_order
    ) as items
FROM public.puzzles p
LEFT JOIN public.puzzle_items pi ON p.id = pi.puzzle_id
WHERE p.game_type = 'disordat'
GROUP BY p.id, p.game_id, p.prompt, p.category_1, p.category_2, p.difficulty, p.metadata, p.created_at;

-- Function to record user responses for DisOrDat
CREATE OR REPLACE FUNCTION record_disordat_response(
    p_user_id UUID,
    p_puzzle_id BIGINT,
    p_responses JSONB -- Array of {item_id: number, selected_category: "category_1|category_2|both"}
)
RETURNS JSONB AS $$
DECLARE
    correct_count INTEGER := 0;
    total_count INTEGER := 0;
    response JSONB;
    item_id BIGINT;
    selected_category TEXT;
    correct_category TEXT;
    game_id BIGINT;
    score_percentage INTEGER;
    result JSONB;
BEGIN
    -- Get the game_id for this puzzle
    SELECT p.game_id INTO game_id FROM public.puzzles p WHERE p.id = p_puzzle_id;
    
    -- Count total items and correct responses
    FOR response IN SELECT * FROM jsonb_array_elements(p_responses)
    LOOP
        item_id := (response->>'item_id')::BIGINT;
        selected_category := response->>'selected_category';
        
        -- Get the correct category for this item
        SELECT pi.correct_category INTO correct_category 
        FROM public.puzzle_items pi 
        WHERE pi.id = item_id;
        
        total_count := total_count + 1;
        
        IF selected_category = correct_category THEN
            correct_count := correct_count + 1;
        END IF;
    END LOOP;
    
    -- Calculate score percentage
    score_percentage := CASE 
        WHEN total_count > 0 THEN (correct_count * 100 / total_count)
        ELSE 0 
    END;
    
    -- Insert or update user progress
    INSERT INTO public.user_progress (
        user_id,
        game_id,
        puzzle_id,
        score,
        items_attempted,
        items_correct,
        response_data
    ) VALUES (
        p_user_id,
        game_id,
        p_puzzle_id,
        score_percentage,
        total_count,
        correct_count,
        p_responses
    )
    ON CONFLICT (user_id, puzzle_id) 
    DO UPDATE SET 
        score = EXCLUDED.score,
        items_attempted = EXCLUDED.items_attempted,
        items_correct = EXCLUDED.items_correct,
        response_data = EXCLUDED.response_data,
        completed_at = NOW();
    
    -- Return results
    result := jsonb_build_object(
        'total_items', total_count,
        'correct_items', correct_count,
        'score_percentage', score_percentage,
        'responses', p_responses
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies if you're using Row Level Security
-- Allow users to read all puzzles and puzzle items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'puzzles' AND policyname = 'Users can read puzzles'
    ) THEN
        CREATE POLICY "Users can read puzzles" ON public.puzzles FOR SELECT USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'puzzle_items' AND policyname = 'Users can read puzzle items'
    ) THEN
        CREATE POLICY "Users can read puzzle items" ON public.puzzle_items FOR SELECT USING (true);
    END IF;
END $$;

-- Enable RLS on puzzle_items
ALTER TABLE public.puzzle_items ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_puzzles_game_type ON public.puzzles(game_type);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_game ON public.user_progress(user_id, game_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_puzzle ON public.user_progress(puzzle_id);