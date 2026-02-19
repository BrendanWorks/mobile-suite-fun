/*
  # Add True/False Game Support

  ## Summary
  Creates the table structure for the TrueFalse game — a simple True or False quiz
  where players read a statement and tap True (green) or False (red).

  ## New Tables

  ### `true_false_puzzles`
  - `id` - Primary key (auto-increment)
  - `statement` - The statement the player judges as true or false (up to 3 lines)
  - `correct_answer` - Boolean: true = correct answer is True, false = correct answer is False
  - `explanation` - Text shown after the answer is revealed (the "reveal note")
  - `difficulty` - easy / medium / hard
  - `is_active` - Whether this puzzle is available for play
  - `created_at` - Timestamp

  ## Security
  - RLS enabled on `true_false_puzzles`
  - Authenticated users can read active puzzles
  - Only service role can insert/update/delete

  ## Sample Data
  - 3 demo puzzles inserted for immediate playability
*/

CREATE TABLE IF NOT EXISTS true_false_puzzles (
  id          serial PRIMARY KEY,
  statement   text NOT NULL,
  correct_answer boolean NOT NULL,
  explanation text NOT NULL DEFAULT '',
  difficulty  text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE true_false_puzzles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active true false puzzles"
  ON true_false_puzzles FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Anon can read active true false puzzles"
  ON true_false_puzzles FOR SELECT
  TO anon
  USING (is_active = true);

INSERT INTO true_false_puzzles (statement, correct_answer, explanation, difficulty) VALUES
  ('Honey never spoils. Edible honey has been found in Egyptian tombs over 3,000 years old.',
   true,
   'Honey''s low moisture content and acidic pH create an inhospitable environment for bacteria. Archaeologists have indeed eaten 3,000-year-old honey from ancient Egyptian tombs.',
   'easy'),
  ('The Great Wall of China is visible from space with the naked eye.',
   false,
   'This is one of the most persistent myths in history. The wall is only about 15–30 feet wide — far too narrow to be seen from orbit without optical aids. Even Chinese astronaut Yang Liwei confirmed he could not see it.',
   'easy'),
  ('A day on Venus is longer than a year on Venus.',
   true,
   'Venus rotates so slowly on its axis that one full day (243 Earth days) is actually longer than its year — the time it takes to orbit the Sun (225 Earth days).',
   'hard');
