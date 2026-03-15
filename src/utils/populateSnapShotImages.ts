import { supabase } from '../lib/supabase';

export async function listStorageImages() {
  const { data, error } = await supabase.storage
    .from('jigsaw-images')
    .list('', {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (error) return null;

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

  if (error) return null;

  return data;
}

export async function populateAllSnapShotImages() {
  const images = await listStorageImages();

  if (!images) return;

  const { data: existingPuzzles } = await supabase
    .from('puzzles')
    .select('image_url')
    .eq('game_id', 6);

  const existingUrls = new Set(existingPuzzles?.map(p => p.image_url) || []);

  for (const image of images) {
    if (image.name.startsWith('.')) continue;

    const imageUrl = await getPublicUrl(image.name);

    if (!existingUrls.has(imageUrl)) {
      const prompt = image.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      await createPuzzleRecord(image.name, prompt);
    }
  }
}
