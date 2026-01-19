import React from 'react';
import GameWrapper from './GameWrapper';
import OddManOut from './OddManOut';
import PhotoMystery from './PhotoMystery.jsx';
import RankAndRoll from './RankAndRoll';
import DalmatianPuzzle from './DalmatianPuzzle';
import SplitDecision from './SplitDecision';
import WordRescue from './WordRescue';
import ShapeSequence from './ShapeSequence';

interface TestModeProps {
  onExit: () => void;
  selectedGameId: string | null;
  onSelectGame: (gameId: string) => void;
}

const TEST_GAMES = [
  { id: 'odd-man-out', name: 'Odd Man Out', icon: '🔍', duration: 60, component: OddManOut },
  { id: 'photo-mystery', name: 'Zooma', icon: '📷', duration: 15, component: PhotoMystery },
  { id: 'rank-and-roll', name: 'Ranky', icon: '📊', duration: 30, component: RankAndRoll },
  { id: 'dalmatian-puzzle', name: 'Dalmatian Puzzle', icon: '🧩', duration: 60, component: DalmatianPuzzle },
  { id: 'split-decision', name: 'Split Decision', icon: '⚡', duration: 60, component: SplitDecision },
  { id: 'word-rescue', name: 'Pop', icon: '📝', duration: 90, component: WordRescue },
  { id: 'shape-sequence', name: 'Shape Sequence', icon: '🔷', duration: 60, component: ShapeSequence },
];

export default function TestMode({ onExit, selectedGameId, onSelectGame }: TestModeProps) {
  if (selectedGameId) {
    const game = TEST_GAMES.find(g => g.id === selectedGameId);
    if (!game) return null;

    const GameComponent = game.component;

    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
          <div className="flex justify-between items-center max-w-6xl mx-auto">
            <div className="text-white">
              <p className="text-sm text-gray-400">🧪 Test Mode</p>
              <p className="text-lg font-bold">Testing {game.name}</p>
            </div>
            <button
              onClick={onExit}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Exit Test
            </button>
          </div>
        </div>
        <div className="p-6 max-w-4xl mx-auto">
          <GameWrapper
            duration={game.duration}
            onComplete={() => {}}
            gameName={game.name}
            showCompletionModal={false}
          >
            <GameComponent />
          </GameWrapper>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-2xl w-full border border-yellow-500/30">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">🧪 Test Mode</h2>
          <button
            onClick={onExit}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>
        <p className="text-gray-300 mb-6">
          Select a game to test directly without logging in:
        </p>

        <div className="grid grid-cols-2 gap-4">
          {TEST_GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => onSelectGame(game.id)}
              className="bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-6 px-4 rounded-xl shadow-lg transition-all hover:scale-105 border-2 border-blue-400/50"
            >
              <div className="text-3xl mb-2">{game.icon}</div>
              <div className="text-sm">{game.name}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-200">
            ⚠️ Note: Test mode bypasses authentication and does not save scores.
          </p>
        </div>
      </div>
    </div>
  );
}
