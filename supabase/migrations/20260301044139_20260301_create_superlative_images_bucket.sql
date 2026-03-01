/*
  # Create Superlative Images Storage Bucket

  1. New Storage
    - Create `superlative_images` bucket for superlative game puzzle images
    - Enable public read access for all users
    
  2. Security
    - Add policy to allow public SELECT on superlative_images bucket
    - Anyone can read images, only authenticated users/admin can upload
*/

INSERT INTO storage.buckets (id, name, public) 
VALUES ('superlative_images', 'superlative_images', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public can view superlative images'
  ) THEN
    CREATE POLICY "Public can view superlative images"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'superlative_images');
  END IF;
END $$;