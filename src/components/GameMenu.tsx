import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { GameId } from '../App';
import * as THREE from 'three'

export interface LevelConfig {
  id: string;
  name: string;
  svgPath: string;
  shardCount: number;
  palette: string[];
  targetQuaternion?: THREE.Quaternion;
  toleranceDeg: number;
}

// Load levels from Supabase
export async function loadLevelsFromSupabase(): Promise<LevelConfig[]> {
  try {
    const { data, error } = await supabase
      .from('levels')
      .select('*')
      .order('level_number', { ascending: true });
    
    if (error) {
      console.error('Error loading levels from Supabase:', error);
      return FALLBACK_LEVELS;
    }
    
    if (!data || data.length === 0) {
      console.log('No levels found in Supabase, using fallback levels');
      return FALLBACK_LEVELS;
    }
    
    // Transform Supabase data to LevelConfig format
    const transformedLevels = data.map(level => {
      const levelData = level.level_data;
      
      // Create target quaternion if specified
      let targetQuaternion = new THREE.Quaternion(); // Default identity quaternion
      if (levelData.targetQuaternion) {
        const tq = levelData.targetQuaternion;
        if (tq.axis && typeof tq.angle === 'number') {
          targetQuaternion.setFromAxisAngle(
            new THREE.Vector3(tq.axis.x || 0, tq.axis.y || 0, tq.axis.z || 0),
            tq.angle
          );
        } else if (tq.x !== undefined && tq.y !== undefined && tq.z !== undefined && tq.w !== undefined) {
          targetQuaternion.set(tq.x, tq.y, tq.z, tq.w);
        }
      }
      
      return {
        id: levelData.id || `level_${level.level_number}`,
        name: levelData.name || `Level ${level.level_number}`,
        svgPath: levelData.svgPath || "M -50 -50 L 50 -50 L 50 50 L -50 50 Z",
        shardCount: levelData.shardCount || 1,
        palette: levelData.palette || ["#808080"],
        targetQuaternion: targetQuaternion,
        toleranceDeg: levelData.toleranceDeg || 25
      };
    });
    
    console.log(`Loaded ${transformedLevels.length} levels from Supabase`);
    return transformedLevels;
    
  } catch (error) {
    console.error('Failed to load levels from Supabase:', error);
    return FALLBACK_LEVELS;
  }
}

// Fallback levels (renamed from LEVELS)
const FALLBACK_LEVELS: LevelConfig[] = [
  {
    id: "heart",
    name: "Test Cube",
    svgPath: "M -50 -50 L 50 -50 L 50 50 L -50 50 Z",
    shardCount: 1,
    palette: ["#808080"],
    targetQuaternion: new THREE.Quaternion(), // Identity quaternion - yellow face forward to win
    toleranceDeg: 25
  },
  {
    id: "star",
    name: "Star", 
    svgPath: "M -60 0 L -45 -10 L -30 0 L -15 -10 L 0 0 L 15 -10 L 30 0 L 45 -10 L 60 0 L 45 10 L 30 0 L 15 10 L 0 0 L -15 10 L -30 0 L -45 10 Z",
    shardCount: 5,
    palette: ["#f9ca24", "#f0932b", "#eb4d4b"],
    targetQuaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 4),
    toleranceDeg: 30
  },
  {
    id: "diamond",
    name: "Diamond",
    svgPath: "M 0 -40 L 30 0 L 0 40 L -30 0 Z",
    shardCount: 8,
    palette: ["#4ecdc4", "#45b7d1", "#96ceb4"],
    targetQuaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 6),
    toleranceDeg: 12
  },
  {
    id: "flower",
    name: "Flower",
    svgPath: "M 0 -25 C 15 -35 35 -15 25 0 C 35 15 15 35 0 25 C -15 35 -35 15 -25 0 C -35 -15 -15 -35 0 -25 Z",
    shardCount: 10,
    palette: ["#fd79a8", "#fdcb6e", "#6c5ce7"],
    targetQuaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 3),
    toleranceDeg: 9
  }
]

interface GameMenuProps {
  onGameSelect: (gameId: GameId) => void;
}

export default function GameMenu({ onGameSelect }: GameMenuProps) {
  // Hardcoded games that exist in your components directory
  const games = [
    { id: 1, name: 'Emoji Master', slug: 'emoji-master', description: 'Decode emoji puzzles' },
    { id: 2, name: 'Odd Man Out', slug: 'odd-man-out', description: 'Find what doesn\'t belong' },
    { id: 3, name: 'Photo Mystery', slug: 'photo-mystery', description: 'Guess the hidden image' },
    { id: 4, name: 'Rank & Roll', slug: 'rank-and-roll', description: 'Sort by superlatives' },
    { id: 5, name: 'Dalmatian Puzzle', slug: 'dalmatian-puzzle', description: 'Complete the jigsaw' },
    { id: 6, name: 'Split Decision', slug: 'split-decision', description: 'Rapid categorization' },
    { id: 7, name: 'Word Rescue', slug: 'word-rescue', description: 'Make words from falling letters' },
    { id: 8, name: 'Shape Sequence', slug: 'shape-sequence', description: 'Remember the pattern' },
    { id: 9, name: 'Polysphere', slug: 'polysphere', description: 'Rotate to reveal the image' }
  ];

  const gameIcons = {
    'emoji-master': '🎯',
    'odd-man-out': '🔍',
    'photo-mystery': '📷',
    'rank-and-roll': '📊',
    'dalmatian-puzzle': '🧩',
    'split-decision': '⚡',
    'word-rescue': '📝',
    'shape-sequence': '🔷',
    'polysphere': '🌐'
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => onGameSelect(game.slug as GameId)}
            className="bg-white/10 text-white font-bold py-4 px-4 rounded-lg shadow-md transition-transform duration-200 transform hover:scale-105 hover:bg-white/20 border-2 border-purple-500/30 hover:border-purple-400"
          >
            <div className="text-2xl mb-2">{gameIcons[game.slug as keyof typeof gameIcons] || '🎮'}</div>
            <div className="text-sm">{game.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export { FALLBACK_LEVELS as LEVELS };
export type { LevelConfig };