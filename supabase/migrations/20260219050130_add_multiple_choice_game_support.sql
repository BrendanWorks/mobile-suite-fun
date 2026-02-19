/*
  # Add Multiple Choice Game Support

  ## Summary
  Creates the table structure for the MultipleChoice game — a three-option quiz
  where players read a question and tap the correct answer from three choices (A, B, C).

  ## New Tables

  ### `multiple_choice_puzzles`
  - `id` - Primary key (auto-increment)
  - `question` - The question the player must answer (up to 3 lines)
  - `option_a` - First answer choice
  - `option_b` - Second answer choice
  - `option_c` - Third answer choice
  - `correct_option` - Which option is correct: 'a', 'b', or 'c'
  - `explanation` - Text shown after the answer is revealed
  - `difficulty` - easy / medium / hard
  - `is_active` - Whether this puzzle is available for play
  - `created_at` - Timestamp

  ## Security
  - RLS enabled on `multiple_choice_puzzles`
  - Authenticated and anonymous users can read active puzzles
  - Only service role can insert/update/delete

  ## Sample Data
  - 3 demo puzzles inserted for immediate playability
*/

CREATE TABLE IF NOT EXISTS multiple_choice_puzzles (
  id            serial PRIMARY KEY,
  question      text NOT NULL,
  option_a      text NOT NULL,
  option_b      text NOT NULL,
  option_c      text NOT NULL,
  correct_option text NOT NULL CHECK (correct_option IN ('a', 'b', 'c')),
  explanation   text NOT NULL DEFAULT '',
  difficulty    text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE multiple_choice_puzzles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active multiple choice puzzles"
  ON multiple_choice_puzzles FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Anon can read active multiple choice puzzles"
  ON multiple_choice_puzzles FOR SELECT
  TO anon
  USING (is_active = true);

INSERT INTO multiple_choice_puzzles (question, option_a, option_b, option_c, correct_option, explanation, difficulty) VALUES
  ('Which planet in our solar system has the most moons?',
   'Jupiter', 'Saturn', 'Uranus',
   'b',
   'Saturn leads with 146 confirmed moons as of 2024, edging out Jupiter''s 95. Many were discovered recently by telescopic surveys.',
   'medium'),
  ('What is the only country that borders both the Atlantic and Indian Oceans?',
   'Australia', 'South Africa', 'Brazil',
   'b',
   'South Africa sits at the tip of the African continent where the two great oceans meet near Cape Agulhas.',
   'hard'),
  ('Which element makes up about 78% of Earth''s atmosphere?',
   'Oxygen', 'Carbon Dioxide', 'Nitrogen',
   'c',
   'Nitrogen (N₂) makes up roughly 78% of air. Oxygen is about 21%, and all other gases including CO₂ combine for less than 1%.',
   'easy');
