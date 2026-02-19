import React from 'react';
import GameWrapper from './GameWrapper';
import OddManOut from './OddManOut';
import PhotoMystery from './PhotoMystery.jsx';
import RankAndRoll from './RankAndRoll';
import SnapShot from './SnapShot';
import SplitDecision from './SplitDecision';
import WordRescue from './WordRescue';
import ShapeSequence from './ShapeSequence';
import Snake from './Snake';
import UpYours from './UpYours';
import FakeOut from './FakeOut';
import HiveMind from './HiveMind';
import DoubleFake from './DoubleFake';
import ZenGravity from './ZenGravity';
import Superlative from './Superlative';
import TrueFalse from './TrueFalse';

interface TestModeProps {
  onExit: () => void;
  selectedGameId: string | null;
  onSelectGame: (gameId: string) => void;
}

const TEST_GAMES = [
  { id: 'odd-man-out', name: 'Odd Man Out', icon: '🔍', duration: 60, component: OddManOut },
  { id: 'photo-mystery', name: 'Zooma', icon: '📷', duration: 15, component: PhotoMystery },
  { id: 'rank-and-roll', name: 'Ranky', icon: '📊', duration: 30, component: RankAndRoll },
  { id: 'snapshot', name: 'SnapShot', icon: '🧩', duration: 60, component: SnapShot },
  { id: 'split-decision', name: 'Split Decision', icon: '⚡', duration: 60, component: SplitDecision },
  { id: 'word-rescue', name: 'Pop', icon: '📝', duration: 90, component: WordRescue },
  { id: 'shape-sequence', name: 'Shape Sequence', icon: '🔷', duration: 60, component: ShapeSequence },
  { id: 'snake', name: 'Snake', icon: '🐍', duration: 75, component: Snake },
  { id: 'gravity-ball', name: 'Gravity Ball', icon: '🌍', duration: 90, component: UpYours },
  { id: 'fake-out', name: 'Fake Out', icon: '🎭', duration: 60, component: FakeOut },
  { id: 'hive-mind', name: 'Hive Mind', icon: '🐝', duration: 60, component: HiveMind },
  { id: 'double-fake', name: 'DoubleFake', icon: '🎨', duration: 60, component: DoubleFake },
  { id: 'zen-gravity', name: 'Balls', icon: '⚫', duration: 90, component: ZenGravity },
  { id: 'superlative', name: 'Superlative', icon: '⚡', duration: 90, component: Superlative },
  { id: 'true-false', name: 'True or False', icon: '✅', duration: 90, component: TrueFalse },
];

export default function TestMode({ onExit, selectedGameId, onSelectGame }: TestModeProps) {
  if (selectedGameId) {
    const game = TEST_GAMES.find(g => g.id === selectedGameId);
    if (!game) return null;

    const GameComponent = game.component;

    return (
      <div className="h-screen w-screen bg-gray-900 flex flex-col">
        <div className="flex-shrink-0 bg-gray-800 px-3 sm:px-6 py-2.5 sm:py-4 border-b border-gray-700">
          <div className="flex justify-between items-center max-w-6xl mx-auto gap-3">
            <div className="text-white min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-400">🧪 Test Mode</p>
              <p className="text-base sm:text-lg font-bold truncate">Testing {game.name}</p>
            </div>
            <button
              onClick={onExit}
              className="flex-shrink-0 px-3 sm:px-4 py-2 bg-red-600 active:bg-red-700 text-white rounded-lg transition-colors text-sm sm:text-base touch-manipulation"
            >
              Exit Test
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <GameWrapper
            duration={game.duration}
            onComplete={() => {}}
            gameName={game.name}
            onScoreUpdate={() => {}}
          >
            <GameComponent />
          </GameWrapper>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl sm:rounded-2xl p-6 sm:p-8 max-w-2xl w-full border border-yellow-500/30 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">🧪 Test Mode</h2>
          <button
            onClick={onExit}
            className="text-gray-400 active:text-white text-2xl touch-manipulation"
          >
            ×
          </button>
        </div>
        <p className="text-sm sm:text-base text-gray-300 mb-4 sm:mb-6">
          Select a game to test directly without logging in:
        </p>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {TEST_GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => onSelectGame(game.id)}
              className="bg-gradient-to-br from-blue-600 to-orange-600 active:from-blue-500 active:to-orange-500 text-white font-bold py-5 sm:py-6 px-3 sm:px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] border-2 border-blue-400/50 touch-manipulation"
            >
              <div className="text-2xl sm:text-3xl mb-2">{game.icon}</div>
              <div className="text-xs sm:text-sm">{game.name}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
          <p className="text-xs sm:text-sm text-yellow-200">
            ⚠️ Note: Test mode bypasses authentication and does not save scores.
          </p>
        </div>
      </div>
    </div>
  );
}
