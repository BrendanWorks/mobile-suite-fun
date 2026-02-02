/*
  # Add Storage Policies for Jigsaw Images

  1. Changes
    - Add policy to allow public SELECT on jigsaw-images bucket
    - Allow anyone to list and read images from the bucket
    
  2. Security
    - Public read access for all images in jigsaw-images bucket
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public can view jigsaw images'
  ) THEN
    CREATE POLICY "Public can view jigsaw images"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'jigsaw-images');
  END IF;
END $$;
