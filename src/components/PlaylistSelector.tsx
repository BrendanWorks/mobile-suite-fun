/**
 * PlaylistSelector.tsx - TEST COMPONENT
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Star } from 'lucide-react';

interface Playlist {
  id: number;
  name: string;
  description: string;
  difficulty: string;
  sequence_order: number;
}

interface PlaylistSelectorProps {
  onSelectPlaylist: (playlistId: number) => void;
  onBack: () => void;
}

export default function PlaylistSelector({ onSelectPlaylist, onBack }: PlaylistSelectorProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlaylists = async () => {
      try {
        const { data, error } = await supabase
          .from('playlists')
          .select('id, name, description, difficulty, sequence_order')
          .eq('is_active', true)
          .order('sequence_order');

        if (error) throw error;
        setPlaylists(data || []);
      } catch (error) {
        console.error('Error loading playlists:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPlaylists();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Star className="w-16 h-16 text-cyan-400 animate-pulse" style={{ filter: 'drop-shadow(0 0 20px #00ffff)' }} />
      </div>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'text-green-400 border-green-400';
      case 'medium': return 'text-yellow-400 border-yellow-400';
      case 'hard': return 'text-red-400 border-red-400';
      default: return 'text-cyan-400 border-cyan-400';
    }
  };

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-cyan-400 mb-2" style={{ textShadow: '0 0 20px #00ffff' }}>
            Choose Your Playlist
          </h1>
          <p className="text-cyan-300 text-sm sm:text-base">
            5 rounds of curated games
          </p>
        </div>

        {/* Playlists Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => onSelectPlaylist(playlist.id)}
              className="bg-black border-2 border-cyan-400/50 rounded-lg p-4 text-left transition-all hover:border-cyan-400 hover:shadow-lg active:scale-95"
              style={{ boxShadow: '0 0 10px rgba(0, 255, 255, 0.2)' }}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-bold text-cyan-400 flex-1" style={{ textShadow: '0 0 10px #00ffff' }}>
                  {playlist.name}
                </h3>
                <span className={`text-xs px-2 py-1 border rounded uppercase font-semibold ${getDifficultyColor(playlist.difficulty)}`}>
                  {playlist.difficulty}
                </span>
              </div>
              <p className="text-cyan-300 text-sm">
                {playlist.description}
              </p>
            </button>
          ))}
        </div>

        {/* Back Button */}
        <div className="text-center">
          <button
            onClick={onBack}
            className="px-6 py-3 bg-transparent border-2 border-pink-500 text-pink-400 font-semibold rounded-lg text-sm transition-all hover:bg-pink-500 hover:text-black active:scale-95"
            style={{ textShadow: '0 0 8px #ec4899', boxShadow: '0 0 10px rgba(236, 72, 153, 0.3)' }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}