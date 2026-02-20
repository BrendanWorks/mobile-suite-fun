import React from 'react';
import { GameId } from '../App';
import { analytics } from '../lib/analytics';
import {
  Search, Camera, Triangle, Users, Check,
  ChartBar, Shuffle, CircleX, Layers, BookOpen
} from 'lucide-react';

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
    { id: 9, name: 'Fake Out', slug: 'fake-out', description: 'Real photo or AI fake?' },
    { id: 10, name: 'Hive Mind', slug: 'hive-mind', description: 'Guess what most people chose' },
    { id: 11, name: 'Superlative', slug: 'superlative', description: 'Pick the bigger, heavier, or older item' }
  ];

  const gameIcons: Record<string, React.ReactNode> = {
    'odd-man-out': <CircleX className="w-full h-full" />,
    'photo-mystery': <Search className="w-full h-full" />,
    'rank-and-roll': <ChartBar className="w-full h-full" />,
    'snapshot': <Camera className="w-full h-full" />,
    'split-decision': <Layers className="w-full h-full" />,
    'word-rescue': <BookOpen className="w-full h-full" />,
    'shape-sequence': <Triangle className="w-full h-full" />,
    'fake-out': <CircleX className="w-full h-full" />,
    'hive-mind': <Users className="w-full h-full" />,
    'superlative': <Check className="w-full h-full" />
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
            className="bg-black text-cyan-400 font-bold py-4 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 hover:bg-cyan-400/10 border-2 border-cyan-400/40 hover:border-cyan-400 active:scale-100 flex flex-col items-center justify-center"
            style={{ boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)', textShadow: '0 0 8px #00ffff' }}
          >
            <div className="w-8 h-8 mb-2 text-cyan-400 flex items-center justify-center" style={{ filter: 'drop-shadow(0 0 10px #00ffff)' }}>
              {gameIcons[game.slug as keyof typeof gameIcons]}
            </div>
            <div className="text-sm">{game.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}