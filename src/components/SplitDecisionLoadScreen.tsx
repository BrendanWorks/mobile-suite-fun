import React from 'react';
import { Layers, Play } from 'lucide-react';

interface SplitDecisionLoadScreenProps {
  onStart: () => void;
}

export default function SplitDecisionLoadScreen({ onStart }: SplitDecisionLoadScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-gray-900 flex items-center justify-center p-6">
      <div className="text-center max-w-2xl">
        <div className="mb-8">
          <div className="flex justify-center mb-4">
            <Layers className="w-20 h-20 text-cyan-400" style={{ filter: 'drop-shadow(0 0 20px #00ffff)' }} />
          </div>
          <h1 className="text-6xl font-bold text-white mb-2" style={{ textShadow: '0 0 20px #00ffff' }}>
            Split Decision
          </h1>
          <p className="text-2xl text-gray-300">
            Seven Questions in 60 Seconds
          </p>
        </div>

        <button
          onClick={onStart}
          className="mt-12 px-12 py-4 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl text-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg flex items-center gap-3 mx-auto"
          style={{ boxShadow: '0 0 20px rgba(0, 255, 255, 0.5)' }}
        >
          <Play className="w-6 h-6 fill-white" />
          Start Game
        </button>
      </div>
    </div>
  );
}