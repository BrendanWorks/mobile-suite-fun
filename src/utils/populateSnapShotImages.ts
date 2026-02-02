import { supabase } from '../lib/supabase';

/**
 * Utility to list all images in the jigsaw-images bucket
 * and create puzzle records for any missing ones
 */
export async function listStorageImages() {
  console.log('Attempting to list images from jigsaw-images bucket...');

  const { data, error } = await supabase.storage
    .from('jigsaw-images')
    .list('', {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (error) {
    console.error('Error listing storage images:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return null;
  }

  console.log(`Successfully fetched ${data?.length || 0} images`);
  console.log('Images:', data);

  return data;
}

export async function getPublicUrl(fileName: string) {
  const { data } = supabase.storage
    .from('jigsaw-images')
    .getPublicUrl(fileName);

  return data.publicUrl;
}

export async function createPuzzleRecord(fileName: string, prompt: string) {
  const imageUrl = await getPublicUrl(fileName);

  const { data, error } = await supabase
    .from('puzzles')
    .insert({
      game_id: 6,
      prompt: prompt,
      image_url: imageUrl,
      correct_answer: prompt,
      difficulty: 'medium'
    })
    .select();

  if (error) {
    console.error('Error creating puzzle record:', error);
    return null;
  }

  return data;
}

export async function populateAllSnapShotImages() {
  console.log('🔍 Fetching images from storage...');
  const images = await listStorageImages();

  if (!images) {
    console.error('Failed to fetch images');
    return;
  }

  console.log(`📦 Found ${images.length} images in storage`);

  // Get existing puzzle records
  const { data: existingPuzzles } = await supabase
    .from('puzzles')
    .select('image_url')
    .eq('game_id', 6);

  const existingUrls = new Set(existingPuzzles?.map(p => p.image_url) || []);
  console.log(`✅ ${existingUrls.size} puzzles already in database`);

  // Create records for missing images
  let created = 0;
  for (const image of images) {
    if (image.name.startsWith('.')) continue; // Skip hidden files

    const imageUrl = await getPublicUrl(image.name);

    if (!existingUrls.has(imageUrl)) {
      // Extract prompt from filename (remove extension, replace dashes/underscores with spaces)
      const prompt = image.name
        .replace(/\.[^/.]+$/, '') // Remove extension
        .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
        .replace(/\b\w/g, (c) => c.toUpperCase()); // Capitalize words

      console.log(`➕ Creating record for: ${image.name} -> "${prompt}"`);
      await createPuzzleRecord(image.name, prompt);
      created++;
    }
  }

  console.log(`✨ Created ${created} new puzzle records`);

  // Verify total
  const { count } = await supabase
    .from('puzzles')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', 6);

  console.log(`🎯 Total SnapShot puzzles in database: ${count}`);
}
