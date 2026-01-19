/**
 * SplitDecisionLoadScreen.tsx
 * 
 * Clean load screen for Split Decision
 * Location: components/SplitDecisionLoadScreen.tsx
 * 
 * Paste this into bolt.new
 */

import React from 'react';

interface SplitDecisionLoadScreenProps {
  onStart: () => void;
}

export default function SplitDecisionLoadScreen({ onStart }: SplitDecisionLoadScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-gray-900 flex items-center justify-center p-6">
      <div className="text-center max-w-2xl">
        {/* Game Title with Icon */}
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-white mb-2">
            ⚡ Split Decision
          </h1>
          <p className="text-2xl text-gray-300">
            Seven Questions in 60 Seconds
          </p>
        </div>

        {/* Start Button */}
        <button
          onClick={onStart}
          className="mt-12 px-12 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg"
        >
          🎯 Start Game
        </button>
      </div>
    </div>
  );
}

/**
 * USAGE IN SPLIT DECISION:
 * 
 * In your SplitDecision.tsx component:
 * 
 * const [gameStarted, setGameStarted] = useState(false);
 * 
 * if (!gameStarted) {
 *   return (
 *     <SplitDecisionLoadScreen onStart={() => setGameStarted(true)} />
 *   );
 * }
 * 
 * // Rest of game logic...
 */