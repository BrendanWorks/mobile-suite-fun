import React from 'react';
import { GameId } from '../App';

interface GameMenuProps {
  onGameSelect: (gameId: GameId) => void;
}

export default function GameMenu({ onGameSelect }: GameMenuProps) {
  // Hardcoded games that exist in your components directory
  const games = [
    { id: 2, name: 'Odd Man Out', slug: 'odd-man-out', description: 'Find what doesn\'t belong' },
    { id: 3, name: 'Zooma', slug: 'photo-mystery', description: 'Guess the hidden image' },
    { id: 4, name: 'Ranky', slug: 'rank-and-roll', description: 'Sort by superlatives' },
    { id: 5, name: 'Dalmatian Puzzle', slug: 'dalmatian-puzzle', description: 'Complete the jigsaw' },
    { id: 6, name: 'Split Decision', slug: 'split-decision', description: 'Rapid categorization' },
    { id: 7, name: 'Word Rescue', slug: 'word-rescue', description: 'Make words from falling letters' },
    { id: 8, name: 'Shape Sequence', slug: 'shape-sequence', description: 'Remember the pattern' }
  ];

  const gameIcons = {
    'odd-man-out': '🔍',
    'photo-mystery': '📷',
    'rank-and-roll': '📊',
    'dalmatian-puzzle': '🧩',
    'split-decision': '⚡',
    'word-rescue': '📝',
    'shape-sequence': '🔷'
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