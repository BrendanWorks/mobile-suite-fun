import React from 'react';
import { GameId } from '../App';
import { analytics } from '../lib/analytics';

interface GameMenuProps {
  onGameSelect: (gameId: GameId) => void;
}

export default function GameMenu({ onGameSelect }: GameMenuProps) {
  // Hardcoded games that exist in your components directory
  const games = [
    { id: 2, name: 'Odd Man Out', slug: 'odd-man-out', description: 'Find what doesn\'t belong' },
    { id: 3, name: 'Zooma', slug: 'photo-mystery', description: 'Guess the hidden image' },
    { id: 4, name: 'Ranky', slug: 'rank-and-roll', description: 'Sort by superlatives' },
    { id: 5, name: 'SnapShot', slug: 'snapshot', description: 'Complete the jigsaw' },
    { id: 6, name: 'Split Decision', slug: 'split-decision', description: 'Rapid categorization' },
    { id: 7, name: 'Pop', slug: 'word-rescue', description: 'Make words from falling letters' },
    { id: 8, name: 'Shape Sequence', slug: 'shape-sequence', description: 'Remember the pattern' },
    { id: 9, name: 'Fake Out', slug: 'fake-out', description: 'Real photo or AI fake?' }
  ];

  const gameIcons = {
    'odd-man-out': '🔍',
    'photo-mystery': '📷',
    'rank-and-roll': '📊',
    'snapshot': '🧩',
    'split-decision': '⚡',
    'word-rescue': '📝',
    'shape-sequence': '🔷',
    'fake-out': '🎭'
  };

  const handleGameClick = (gameId: GameId, gameName: string, numericId: number) => {
    // Track game selection
    analytics.gameSelected(gameName, numericId);
    onGameSelect(gameId);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => handleGameClick(game.slug as GameId, game.name, game.id)}
            className="bg-black text-cyan-400 font-bold py-4 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 hover:bg-cyan-400/10 border-2 border-cyan-400/40 hover:border-cyan-400 active:scale-100"
            style={{ boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)', textShadow: '0 0 8px #00ffff' }}
          >
            <div className="text-2xl mb-2">{gameIcons[game.slug as keyof typeof gameIcons] || '🎮'}</div>
            <div className="text-sm">{game.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}