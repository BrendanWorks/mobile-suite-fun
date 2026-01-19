import React from 'react';

interface SplitDecisionLoadScreenProps {
  onStart: () => void;
}

export const SplitDecisionLoadScreen: React.FC<SplitDecisionLoadScreenProps> = ({ onStart }) => {
  return (
    <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
      <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">⚡ Split Decision</h1>

      <div className="mb-8 p-6 bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-xl">
        <p className="text-lg mb-4">
          Make quick decisions to categorize items correctly!
        </p>
        <p className="text-sm text-gray-300 mb-2">
          Items will appear at the top - swipe or click to sort them into the correct category.
        </p>
        <p className="text-sm text-gray-300">
          Score points for correct answers, but be quick - time is limited!
        </p>
      </div>

      <button
        onClick={onStart}
        className="w-full py-3 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 border-2 border-green-400 hover:shadow-lg hover:shadow-green-500/25 active:scale-98 transition-all"
      >
        Start Game
      </button>
    </div>
  );
};
