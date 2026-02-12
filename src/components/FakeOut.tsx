import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js'; // Assuming supabase client is initialized elsewhere

// Types for the Puzzle Data
interface PuzzleMetadata {
  source: "midjourney" | "dall-e" | "stable-diffusion" | "photograph";
  description: string;
  difficulty: "easy" | "medium" | "hard";
}

interface Puzzle {
  id: string;
  image_url: string;
  correct_answer: "real" | "fake";
  metadata: PuzzleMetadata;
}

interface FakeOutProps {
  onScoreUpdate: (currentScore: number, maxPossibleScore: number) => void;
  onComplete: (finalScore: number, maxScore: number) => void;
  duration: number;
  timeRemaining: number;
  puzzleId?: string; // Optional specific set
}

// Neon Styles Constant for reuse
const NEON_STYLES = {
  cyanGlow: { filter: 'drop-shadow(0 0 8px #00ffff)', textShadow: '0 0 10px #00ffff' },
  pinkGlow: { filter: 'drop-shadow(0 0 8px #ff00ff)', textShadow: '0 0 10px #ff00ff' },
  yellowGlow: { filter: 'drop-shadow(0 0 8px #fbbf24)', textShadow: '0 0 10px #fbbf24' },
  greenGlow: '0 0 20px #22c55e',
  redGlow: '0 0 20px #ef4444',
};

const MAX_IMAGES = 10;
const BASE_POINTS = 100;
const STREAK_BONUS = 50;

export default function FakeOut({ onScoreUpdate, onComplete, duration, timeRemaining, puzzleId }: FakeOutProps) {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [status, setStatus] = useState<'loading' | 'playing' | 'feedback' | 'finished'>('loading');
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; message: string } | null>(null);

  // Supabase Client (Placeholder - should ideally be imported from your config)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. Load Data
  useEffect(() => {
    async function fetchPuzzles() {
      let query = supabase
        .from('puzzles')
        .select('*')
        .eq('game_type', 'fake_out')
        .limit(MAX_IMAGES);

      if (puzzleId) {
        query = query.eq('id', puzzleId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching puzzles:", error);
        return;
      }

      setPuzzles(data as Puzzle[]);
      setStatus('playing');
    }

    fetchPuzzles();
  }, [puzzleId]);

  // 2. Preload Next Image
  useEffect(() => {
    if (currentIndex < puzzles.length - 1) {
      const img = new Image();
      img.src = puzzles[currentIndex + 1].image_url;
    }
  }, [currentIndex, puzzles]);

  // 3. Scoring Logic
  const handleAnswer = (choice: 'real' | 'fake') => {
    if (status !== 'playing') return;

    const currentPuzzle = puzzles[currentIndex];
    const isCorrect = choice === currentPuzzle.correct_answer;
    
    // Calculate Score
    let pointsGained = isCorrect ? BASE_POINTS : 0;
    const newStreak = isCorrect ? streak + 1 : 0;
    
    if (isCorrect && newStreak >= 3) {
      pointsGained += STREAK_BONUS;
    }

    const newScore = score + pointsGained;
    const maxScore = MAX_IMAGES * (BASE_POINTS + STREAK_BONUS); // Rough estimate

    setScore(newScore);
    setStreak(newStreak);
    onScoreUpdate(newScore, maxScore);

    // Feedback Reveal
    const sourceLabel = currentPuzzle.correct_answer === 'fake' 
      ? `AI - Made with ${currentPuzzle.metadata.source.toUpperCase()}`
      : `REAL - ${currentPuzzle.metadata.description}`;

    setLastResult({ isCorrect, message: sourceLabel });
    setStatus('feedback');

    // Advance after 1.5s
    setTimeout(() => {
      if (currentIndex === puzzles.length - 1) {
        setStatus('finished');
        onComplete(newScore, maxScore);
      } else {
        setCurrentIndex(prev => prev + 1);
        setStatus('playing');
        setLastResult(null);
      }
    }, 1500);
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full bg-black text-cyan-400">
        <p className="animate-pulse tracking-widest" style={NEON_STYLES.cyanGlow}>INITIALIZING SYSTEM...</p>
      </div>
    );
  }

  const currentPuzzle = puzzles[currentIndex];

  return (
    <div className="flex flex-col h-full bg-black p-2 sm:p-4 font-mono text-white select-none overflow-hidden">
      {/* Header Info */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold italic text-cyan-400" style={NEON_STYLES.cyanGlow}>
            🎭 FAKE OUT
          </h1>
          <p className="text-[10px] sm:text-xs text-cyan-700">Real photo or AI fake?</p>
        </div>
        <div className="text-right">
          <p className="text-yellow-400 text-lg sm:text-xl font-black" style={NEON_STYLES.yellowGlow}>
            {score.toLocaleString()}
          </p>
          <p className="text-xs text-cyan-400 opacity-70 tracking-tighter">
            IMAGE {currentIndex + 1} / {MAX_IMAGES}
          </p>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative flex-1 flex flex-col items-center justify-center gap-4">
        
        {/* Streak Indicator */}
        {streak >= 3 && (
          <div className="absolute -top-2 z-10 animate-bounce">
            <span className="bg-black border-2 border-yellow-400 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold shadow-[0_0_10px_#fbbf24]">
              🔥 STREAK x{streak}
            </span>
          </div>
        )}

        {/* Image Container */}
        <div 
          className={`relative w-full aspect-[4/3] sm:aspect-video rounded-lg overflow-hidden border-2 transition-all duration-300 ${
            status === 'feedback' 
              ? (lastResult?.isCorrect ? 'border-green-500 shadow-[0_0_20px_#22c55e]' : 'border-red-500 shadow-[0_0_20px_#ef4444]')
              : 'border-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.3)]'
          }`}
        >
          <img 
            src={currentPuzzle.image_url} 
            alt="Mystery Content"
            className="w-full h-full object-cover"
          />
          
          {/* Feedback Overlay Text */}
          {status === 'feedback' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
              <div className="text-center p-4">
                <p className={`text-2xl font-black mb-2 uppercase ${lastResult?.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                  {lastResult?.isCorrect ? 'CORRECT' : 'WRONG'}
                </p>
                <p className="text-sm sm:text-base font-bold text-white max-w-xs leading-tight">
                  {lastResult?.message}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="w-full grid grid-cols-2 gap-4 mt-2">
          <button
            onClick={() => handleAnswer('real')}
            disabled={status === 'feedback'}
            className={`py-4 sm:py-6 border-2 rounded-md font-bold transition-all active:scale-95 flex flex-col items-center justify-center
              ${status === 'feedback' && currentPuzzle.correct_answer === 'real' ? 'border-green-500 text-green-500 shadow-[0_0_15px_#22c55e]' : 'border-cyan-400 text-cyan-400 hover:bg-cyan-400/10'}
              ${status === 'feedback' && currentPuzzle.correct_answer !== 'real' ? 'opacity-30' : ''}
            `}
            style={status === 'playing' ? NEON_STYLES.cyanGlow : {}}
          >
            <span className="text-xl">📷</span>
            <span>REAL</span>
          </button>

          <button
            onClick={() => handleAnswer('fake')}
            disabled={status === 'feedback'}
            className={`py-4 sm:py-6 border-2 rounded-md font-bold transition-all active:scale-95 flex flex-col items-center justify-center
              ${status === 'feedback' && currentPuzzle.correct_answer === 'fake' ? 'border-green-500 text-green-500 shadow-[0_0_15px_#22c55e]' : 'border-pink-500 text-pink-500 hover:bg-pink-500/10'}
              ${status === 'feedback' && currentPuzzle.correct_answer !== 'fake' ? 'opacity-30' : ''}
            `}
            style={status === 'playing' ? NEON_STYLES.pinkGlow : {}}
          >
            <span className="text-xl">🤖</span>
            <span>FAKE</span>
          </button>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="mt-4 border-t border-cyan-900 pt-2 flex justify-between text-[10px] sm:text-xs text-cyan-600 uppercase tracking-widest">
        <span>LVL: {currentPuzzle.metadata.difficulty}</span>
        <span>ACCURACY: {Math.round((score / ((currentIndex + 1) * 100)) * 100) || 0}%</span>
      </div>
    </div>
  );
}