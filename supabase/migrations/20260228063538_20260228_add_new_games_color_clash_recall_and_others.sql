/*
  # Register New Games: ColorClash, Recall, Superlative, TrueFalse, MultipleChoice, Tracer, Clutch, Flashbang

  ## Summary
  Registers 8 new games in the games table:
  - ColorClash (Stroop effect color identification)
  - Recall (Memory and recall challenges)
  - Superlative (Comparative reasoning)
  - TrueFalse (Binary true/false questions)
  - MultipleChoice (Three-option quiz)
  - Tracer (Shape memory and tracing)
  - Clutch (Timing-based challenge)
  - Flashbang (Pattern memory)

  ## Games Added
  - id: 17 - ColorClash
  - id: 18 - Recall
  - id: 19 - Superlative
  - id: 20 - TrueFalse
  - id: 21 - MultipleChoice
  - id: 22 - Tracer
  - id: 23 - Clutch
  - id: 24 - Flashbang

  ## Notes
  - All games are registered as active
  - Database IDs are used for playlist game_id references
  - No special tables needed - games are procedurally generated
*/

INSERT INTO games (id, name, slug, description, category, is_active)
VALUES
  (17, 'ColorClash', 'color-clash', 'Tap the button matching the ink color, not the word!', 'reflex', true),
  (18, 'Recall', 'recall', 'Remember items and answer questions about what you saw', 'memory', true),
  (19, 'Superlative', 'superlative', 'Pick which item is bigger, heavier, longer, or older', 'reasoning', true),
  (20, 'True or False', 'true-false', 'Decide if each statement is True or False', 'trivia', true),
  (21, 'Multiple Choice', 'multiple-choice', 'Pick the correct answer from three options', 'trivia', true),
  (22, 'Tracer', 'tracer', 'Memorize the shape, then trace it from memory', 'memory', true),
  (23, 'Clutch', 'clutch', 'Tap when the ring hits the sweet spot', 'reflex', true),
  (24, 'Flashbang', 'flashbang', 'Memorize the lit tiles, then tap them from memory', 'memory', true)
ON CONFLICT (id) DO NOTHING;
