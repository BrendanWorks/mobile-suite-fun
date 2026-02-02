import { useState } from 'react';
import { populateAllSnapShotImages, listStorageImages } from '../utils/populateSnapShotImages';

export default function AdminTools() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<any[]>([]);

  const handleListImages = async () => {
    setLoading(true);
    setMessage('Fetching images from storage...');

    try {
      const imageList = await listStorageImages();

      if (imageList && imageList.length > 0) {
        setImages(imageList);
        setMessage(`✅ Found ${imageList.length} images in storage`);
      } else if (imageList && imageList.length === 0) {
        setMessage('⚠️ No images found in storage bucket');
      } else {
        setMessage('❌ Failed to fetch images - check console for details');
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setLoading(false);
  };

  const handlePopulate = async () => {
    setLoading(true);
    setMessage('Populating database with images...');

    try {
      await populateAllSnapShotImages();
      setMessage('✅ Database populated successfully! Check the console for details.');
    } catch (error) {
      console.error('Error:', error);
      setMessage('❌ Error populating database. Check console.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-cyan-400 mb-8">SnapShot Admin Tools</h1>

        <div className="space-y-4 mb-8">
          <button
            onClick={handleListImages}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-semibold transition-all"
          >
            {loading ? 'Loading...' : 'List Storage Images'}
          </button>

          <button
            onClick={handlePopulate}
            disabled={loading}
            className="ml-4 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-semibold transition-all"
          >
            {loading ? 'Processing...' : 'Populate Database'}
          </button>
        </div>

        {message && (
          <div className="p-4 bg-gray-800 rounded-lg mb-8">
            <p className="text-lg">{message}</p>
          </div>
        )}

        {images.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">
              Storage Images ({images.length})
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {images.map((img, idx) => (
                <div key={idx} className="bg-gray-800 p-3 rounded flex justify-between items-center">
                  <span className="text-sm">{img.name}</span>
                  <span className="text-xs text-gray-400">
                    {(img.metadata?.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
