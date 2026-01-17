import React, { useState } from 'react';
import { ArrowLeft, Play, Gamepad2 } from 'lucide-react';
import GameMenu from './components/GameMenu';
import GameSession from './components/GameSession';
import OddManOut from './components/OddManOut';
import PhotoMystery from './components/PhotoMystery';
import RankAndRoll from './components/RankAndRoll';
import DalmatianPuzzle from './components/DalmatianPuzzle';
import SplitDecision from './components/SplitDecision';
import WordRescue from './components/WordRescue';
import ShapeSequence from './components/ShapeSequence';

export type GameId = 'micro-heist' | 'ai-doodle-duel' | 'commuter-city-builder' | 'odd-man-out' | 'photo-mystery' | 'rank-and-roll' | 'dalmatian-puzzle' | 'split-decision' | 'word-rescue' | 'shape-sequence' | null;

type AppMode = 'main-menu' | 'game-session' | 'practice-mode' | 'single-game';

function App() {
  const [mode, setMode] = useState<AppMode>('main-menu');
  const [currentGame, setCurrentGame] = useState<GameId>(null);

  const handleGameSelect = (gameId: GameId) => {
    setCurrentGame(gameId);
    setMode('single-game');
  };

  const handleBackToMenu = () => {
    setCurrentGame(null);
    setMode('main-menu');
  };

  const handleBackToPractice = () => {
    setCurrentGame(null);
    setMode('practice-mode');
  };

  const startGameSession = () => {
    setMode('game-session');
  };

  const startPracticeMode = () => {
    setMode('practice-mode');
  };

  if (mode === 'game-session') {
    return <GameSession onExit={handleBackToMenu} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-16 left-8 text-yellow-400 text-2xl animate-pulse">✦</div>
        <div className="absolute top-32 right-12 text-blue-400 text-lg animate-pulse delay-300">✦</div>
        <div className="absolute top-64 left-16 text-yellow-300 text-xl animate-pulse delay-700">✦</div>
        <div className="absolute bottom-32 right-8 text-cyan-400 text-2xl animate-pulse delay-500">✦</div>
        <div className="absolute bottom-48 left-12 text-red-400 text-lg animate-pulse delay-1000">✦</div>
        <div className="absolute top-48 right-20 text-green-400 text-xl animate-pulse delay-200">✦</div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-md relative z-10">
        <div className="text-center mb-12">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="w-16 h-12 bg-blue-600 rounded-2xl border-4 border-blue-500 shadow-lg">
                <div className="absolute top-2 left-3 w-2 h-2 bg-blue-400 rounded-full"></div>
                <div className="absolute top-2 right-3 w-2 h-2 bg-red-500 rounded-full"></div>
                <div className="absolute bottom-2 left-2 w-3 h-1 bg-blue-400 rounded"></div>
                <div className="absolute bottom-2 right-2 w-3 h-1 bg-blue-400 rounded"></div>
              </div>
            </div>
          </div>

          <h1 className="text-5xl font-bold text-white mb-4 tracking-wide">
            <span className="bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent drop-shadow-2xl">
              Game Box
            </span>
          </h1>
          <p className="text-yellow-300 text-lg font-medium tracking-wider">
            Tap into mischief
          </p>
        </div>

        <div className="relative">
          {mode === 'main-menu' && (
            <div className="space-y-4">
              <button
                onClick={startGameSession}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-6 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 border-2 border-green-400/50"
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Play size={32} fill="white" />
                  <span className="text-3xl">Play Game</span>
                </div>
                <p className="text-sm text-green-100">5 rounds of random minigames</p>
              </button>

              <button
                onClick={startPracticeMode}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-6 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 border-2 border-white/30"
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Gamepad2 size={28} />
                  <span className="text-2xl">Practice Mode</span>
                </div>
                <p className="text-sm text-gray-300">Try individual games</p>
              </button>
            </div>
          )}

          {mode === 'practice-mode' && (
            <div>
              <button
                onClick={handleBackToMenu}
                className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors mb-4"
              >
                <ArrowLeft size={20} />
                <span className="font-medium">Back</span>
              </button>
              <GameMenu onGameSelect={handleGameSelect} />
            </div>
          )}

          {mode === 'single-game' && currentGame && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden min-h-96">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <button
                  onClick={handleBackToPractice}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <ArrowLeft size={20} />
                  <span className="font-medium">Back to Practice</span>
                </button>
              </div>

              <div className="p-6">
                {currentGame === 'odd-man-out' && <OddManOut />}
                {currentGame === 'photo-mystery' && <PhotoMystery />}
                {currentGame === 'rank-and-roll' && <RankAndRoll />}
                {currentGame === 'dalmatian-puzzle' && <DalmatianPuzzle />}
                {currentGame === 'split-decision' && <SplitDecision />}
                {currentGame === 'word-rescue' && <WordRescue />}
                {currentGame === 'shape-sequence' && <ShapeSequence />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;