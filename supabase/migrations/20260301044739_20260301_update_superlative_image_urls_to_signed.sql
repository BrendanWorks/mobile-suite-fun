/*
  # Update Superlative Image URLs to Use Signed URLs from Superlative_Images Bucket

  1. Changes
    - Update all superlative_items image_url to use the signed URLs from Superlative_Images bucket
    - Replace public superlative_images bucket URLs with proper signed URLs
    
  2. Data Migration
    - Sperm whale, Jet engine, Cicada, T-rex, Library, Gas burner images now use signed URLs
*/

UPDATE superlative_items 
SET image_url = 'https://prsnmmhfaqrtzakxyokw.supabase.co/storage/v1/object/sign/Superlative_Images/SpermWhaleSmall.jpeg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV82OThiZDQwMy0xZWYyLTQxNjItYjQzYi1jY2I2YTY1MWNlMjAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJTdXBlcmxhdGl2ZV9JbWFnZXMvU3Blcm1XaGFsZVNtYWxsLmpwZWciLCJpYXQiOjE3NzIzNDAzNTYsImV4cCI6MTgwMzg3NjM1Nn0.iqU0zf-AyRCf1dM484wu0S55nCMqy8r3eMBCDmHMHAI'
WHERE name = 'Sperm whale echolocation click';

UPDATE superlative_items 
SET image_url = 'https://prsnmmhfaqrtzakxyokw.supabase.co/storage/v1/object/sign/Superlative_Images/JetEngine.jpeg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV82OThiZDQwMy0xZWYyLTQxNjItYjQzYi1jY2I2YTY1MWNlMjAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJTdXBlcmxhdGl2ZV9JbWFnZXMvSmV0RW5naW5lLmpwZWciLCJpYXQiOjE3NzIzNDAzNTYsImV4cCI6MTgwMzg3NjM1Nn0.iqU0zf-AyRCf1dM484wu0S55nCMqy8r3eMBCDmHMHAI'
WHERE name = 'Jet engine at takeoff';

UPDATE superlative_items 
SET image_url = 'https://prsnmmhfaqrtzakxyokw.supabase.co/storage/v1/object/sign/Superlative_Images/Cicada.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV82OThiZDQwMy0xZWYyLTQxNjItYjQzYi1jY2I2YTY1MWNlMjAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJTdXBlcmxhdGl2ZV9JbWFnZXMvQ2ljYWRhLmpwZyIsImlhdCI6MTc3MjM0MDM1NiwiZXhwIjoxODAzODc2MzU2fQ.iqU0zf-AyRCf1dM484wu0S55nCMqy8r3eMBCDmHMHAI'
WHERE name = 'Cicada mating call';

UPDATE superlative_items 
SET image_url = 'https://prsnmmhfaqrtzakxyokw.supabase.co/storage/v1/object/sign/Superlative_Images/Trex.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV82OThiZDQwMy0xZWYyLTQxNjItYjQzYi1jY2I2YTY1MWNlMjAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJTdXBlcmxhdGl2ZV9JbWFnZXMvVHJleC5qcGciLCJpYXQiOjE3NzIzNDAzNTYsImV4cCI6MTgwMzg3NjM1Nn0.iqU0zf-AyRCf1dM484wu0S55nCMqy8r3eMBCDmHMHAI'
WHERE name = 'T. rex roar (reconstructed)';

UPDATE superlative_items 
SET image_url = 'https://prsnmmhfaqrtzakxyokw.supabase.co/storage/v1/object/sign/Superlative_Images/Library.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV82OThiZDQwMy0xZWYyLTQxNjItYjQzYi1jY2I2YTY1MWNlMjAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJTdXBlcmxhdGl2ZV9JbWFnZXMvTGlicmFyeS5qcGciLCJpYXQiOjE3NzIzNDAzNTYsImV4cCI6MTgwMzg3NjM1Nn0.iqU0zf-AyRCf1dM484wu0S55nCMqy8r3eMBCDmHMHAI'
WHERE name = 'Quiet library';

UPDATE superlative_items 
SET image_url = 'https://prsnmmhfaqrtzakxyokw.supabase.co/storage/v1/object/sign/Superlative_Images/GasBurner.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV82OThiZDQwMy0xZWYyLTQxNjItYjQzYi1jY2I2YTY1MWNlMjAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJTdXBlcmxhdGl2ZV9JbWFnZXMvR2FzQnVybmVyLmpwZyIsImlhdCI6MTc3MjM0MDM1NiwiZXhwIjoxODAzODc2MzU2fQ.iqU0zf-AyRCf1dM484wu0S55nCMqy8r3eMBCDmHMHAI'
WHERE name = 'Home gas stove on max';