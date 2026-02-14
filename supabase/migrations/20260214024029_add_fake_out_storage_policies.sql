/*
  # Add Storage Policies for Fake_Out Bucket

  1. Security
    - Add public read access policy for Fake_Out bucket
    - Allows all users to view images in the bucket
  
  2. Notes
    - The bucket was created as public but had no policies
    - This enables the FakeOut game to load images from storage
*/

-- Allow public read access to Fake_Out bucket
CREATE POLICY "Public read access for Fake_Out images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'Fake_Out');
