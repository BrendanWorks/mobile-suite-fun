/*
  # Create Ranking Game Schema

  1. New Tables
    - `ranking_puzzles`
      - `id` (uuid, primary key)
      - `game_id` (uuid, foreign key to games table)
      - `title` (text)
      - `instruction` (text)
      - `difficulty` (text with enum constraint: easy, medium, hard)
      - `sort_order` (text)
      - `unit` (text)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)
    
    - `ranking_items`
      - `id` (uuid, primary key)
      - `puzzle_id` (uuid, foreign key to ranking_puzzles)
      - `name` (text)
      - `subtitle` (text)
      - `value` (numeric)
      - `display_value` (text)
      - `emoji` (text)
      - `correct_position` (integer)
      - `item_order` (integer)

  2. Security
    - Enable RLS on both tables
    - Add policies for public read access

  3. Relationships
    - ranking_items.puzzle_id → ranking_puzzles.id (CASCADE DELETE)
    - ranking_puzzles.game_id → games.id (CASCADE DELETE)

  4. Constraints
    - Difficulty enum constraint on ranking_puzzles
    - Unique constraints where appropriate
</sql>

-- Create ranking_puzzles table
CREATE TABLE IF NOT EXISTS ranking_puzzles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  title text NOT NULL,
  instruction text NOT NULL,
  difficulty text NOT NULL,
  sort_order text NOT NULL,
  unit text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create ranking_items table
CREATE TABLE IF NOT EXISTS ranking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id uuid NOT NULL,
  name text NOT NULL,
  subtitle text,
  value numeric NOT NULL,
  display_value text NOT NULL,
  emoji text,
  correct_position integer NOT NULL,
  item_order integer NOT NULL
);

-- Add foreign key constraints
DO $$
BEGIN
  -- Add foreign key from ranking_puzzles to games if games table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'games') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'ranking_puzzles_game_id_fkey'
    ) THEN
      ALTER TABLE ranking_puzzles 
      ADD CONSTRAINT ranking_puzzles_game_id_fkey 
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- Add foreign key from ranking_items to ranking_puzzles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ranking_items_puzzle_id_fkey'
  ) THEN
    ALTER TABLE ranking_items 
    ADD CONSTRAINT ranking_items_puzzle_id_fkey 
    FOREIGN KEY (puzzle_id) REFERENCES ranking_puzzles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add check constraint for difficulty enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'ranking_puzzles_difficulty_check'
  ) THEN
    ALTER TABLE ranking_puzzles 
    ADD CONSTRAINT ranking_puzzles_difficulty_check 
    CHECK (difficulty IN ('easy', 'medium', 'hard'));
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ranking_puzzles_game_id ON ranking_puzzles(game_id);
CREATE INDEX IF NOT EXISTS idx_ranking_puzzles_difficulty ON ranking_puzzles(difficulty);
CREATE INDEX IF NOT EXISTS idx_ranking_items_puzzle_id ON ranking_items(puzzle_id);
CREATE INDEX IF NOT EXISTS idx_ranking_items_position ON ranking_items(puzzle_id, correct_position);
CREATE INDEX IF NOT EXISTS idx_ranking_items_order ON ranking_items(puzzle_id, item_order);

-- Enable Row Level Security
ALTER TABLE ranking_puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_items ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Public can read ranking puzzles"
  ON ranking_puzzles
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can read ranking items"
  ON ranking_items
  FOR SELECT
  TO public
  USING (true);