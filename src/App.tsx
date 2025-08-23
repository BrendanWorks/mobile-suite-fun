import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import GameMenu from './components/GameMenu';
import EmojiMaster from './components/EmojiMaster';
import OddManOut from './components/OddManOut';
import PhotoMystery from './components/PhotoMystery';
import RankAndRoll from './components/RankAndRoll';
import DalmatianPuzzle from './components/DalmatianPuzzle';
import SplitDecision from './components/SplitDecision';
import WordRescue from './components/WordRescue';
import ShapeSequence from './components/ShapeSequence';
import PolysphereGame from './components/PolysphereGame';
import AdvancedRunner from './components/AdvancedRunner';

export type GameId = 'emoji-master' | 'micro-heist' | 'ai-doodle-duel' | 'commuter-city-builder' | 'odd-man-out' | 'photo-mystery' | 'rank-and-roll' | 'dalmatian-puzzle' | 'split-decision' | 'word-rescue' | 'shape-sequence' | 'polysphere' | 'advanced-runner' | null;

function App() {
  const [currentGame, setCurrentGame] = useState<GameId>(null);

  const handleGameSelect = (gameId: GameId) => {
    setCurrentGame(gameId);
  };

  const handleBackToMenu = () => {
    setCurrentGame(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 relative overflow-hidden">
      {/* Decorative Stars */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-16 left-8 text-yellow-400 text-2xl animate-pulse">✦</div>
        <div className="absolute top-32 right-12 text-blue-400 text-lg animate-pulse delay-300">✦</div>
        <div className="absolute top-64 left-16 text-yellow-300 text-xl animate-pulse delay-700">✦</div>
        <div className="absolute bottom-32 right-8 text-cyan-400 text-2xl animate-pulse delay-500">✦</div>
        <div className="absolute bottom-48 left-12 text-red-400 text-lg animate-pulse delay-1000">✦</div>
        <div className="absolute top-48 right-20 text-green-400 text-xl animate-pulse delay-200">✦</div>
      </div>
      
      <div className="container mx-auto px-4 py-6 max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          {/* Game Controller Icon */}
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

        {/* Game Content */}
        <div className="relative">
          {/* Menu Screen */}
          <div className={`transition-transform duration-300 ease-in-out ${
            currentGame ? '-translate-x-full opacity-0 absolute inset-0' : 'translate-x-0 opacity-100'
          }`}>
            <GameMenu onGameSelect={handleGameSelect} />
          </div>

          {/* Game Screen */}
          <div className={`transition-transform duration-300 ease-in-out ${
            currentGame ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 absolute inset-0'
          }`}>
            {currentGame && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden min-h-96">
                {/* Back Button */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <button
                    onClick={handleBackToMenu}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <ArrowLeft size={20} />
                    <span className="font-medium">Back to Menu</span>
                  </button>
                </div>

                {/* Game Content */}
                <div className="p-6">
                  {currentGame === 'emoji-master' && <EmojiMaster />}
                  {currentGame === 'odd-man-out' && <OddManOut />}
                  {currentGame === 'photo-mystery' && <PhotoMystery />}
                  {currentGame === 'rank-and-roll' && <RankAndRoll />}
                  {currentGame === 'dalmatian-puzzle' && <DalmatianPuzzle />}
                  {currentGame === 'split-decision' && <SplitDecision />}
                  {currentGame === 'word-rescue' && <WordRescue />}
                  {currentGame === 'shape-sequence' && <ShapeSequence />}
                  {currentGame === 'polysphere' && <PolysphereGame />}
                  {currentGame === 'advanced-runner' && <AdvancedRunner />}
                  {/* Future games will be added here */}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;