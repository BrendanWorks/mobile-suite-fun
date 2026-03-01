/*
  # Add explanation field to superlative_items

  1. Changes
    - Add `explanation` column to `superlative_items` table
    - Allows storing additional context about each item

  2. Notes
    - Column is nullable to support existing data
    - Will be populated with descriptions from existing items
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'superlative_items' AND column_name = 'explanation'
  ) THEN
    ALTER TABLE superlative_items ADD COLUMN explanation text;
  END IF;
END $$;