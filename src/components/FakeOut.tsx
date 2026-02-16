import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../lib/supabase';

interface PuzzleMetadata {
  source?: string;
  description?: string;
  difficulty?: string;
}

interface Puzzle {
  id: number;
  image_url: string;
  correct_answer: 'real' | 'fake';
  prompt: string;
  metadata: PuzzleMetadata;
}

interface FakeOutProps {
  onScoreUpdate?: (currentScore: number, maxPossibleScore: number) => void;
  onComplete?: (finalScore: number, maxScore: number) => void;
  duration?: number;
  timeRemaining?: number;
  puzzleId?: number | null;
  puzzleIds?: number[] | null;
}

const NEON_STYLES = {
  cyanGlow: { filter: 'drop-shadow(0 0 8px #00ffff)', textShadow: '0 0 10px #00ffff' },
  pinkGlow: { filter: 'drop-shadow(0 0 8px #ff00ff)', textShadow: '0 0 10px #ff00ff' },
  yellowGlow: { filter: 'drop-shadow(0 0 8px #fbbf24)', textShadow: '0 0 10px #fbbf24' },
};

const BASE_POINTS = 100;
const STREAK_BONUS = 50;

const FakeOut = forwardRef((props: FakeOutProps, ref) => {
  const { onScoreUpdate, onComplete, puzzleIds } = props;

  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [status, setStatus] = useState<'loading' | 'playing' | 'feedback' | 'finished'>('loading');
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const scoreRef = useRef(0);
  const maxScoreRef = useRef(0);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: scoreRef.current,
      maxScore: maxScoreRef.current
    }),
    onGameEnd: () => {
      console.log('FakeOut game ended');
    }
  }));

  // Load puzzles from database using puzzle_ids
  useEffect(() => {
    async function fetchPuzzles() {
      try {
        if (!puzzleIds || puzzleIds.length === 0) {
          console.error('FakeOut: No puzzle_ids provided');
          setStatus('finished');
          return;
        }

        const { data, error } = await supabase
          .from('puzzles')
          .select('id, image_url, correct_answer, prompt, metadata')
          .in('id', puzzleIds);

        if (error || !data || data.length === 0) {
          console.error('FakeOut: Error fetching puzzles:', error);
          setStatus('finished');
          return;
        }

        // Map DB rows to Puzzle interface
        const loaded: Puzzle[] = data.map(p => ({
          id: p.id,
          image_url: p.image_url,
          correct_answer: p.correct_answer as 'real' | 'fake',
          prompt: p.prompt || 'Unknown',
          metadata: p.metadata || {}
        }));

        // Shuffle for variety
        const shuffled = loaded.sort(() => Math.random() - 0.5);

        setPuzzles(shuffled);
        maxScoreRef.current = shuffled.length * (BASE_POINTS + STREAK_BONUS);
        setStatus('playing');

        console.log(`✅ FakeOut loaded ${shuffled.length} puzzles from DB`);
      } catch (err) {
        console.error('FakeOut: Exception loading puzzles:', err);
        setStatus('finished');
      }
    }

    fetchPuzzles();
  }, [puzzleIds]);

  // Preload next image
  useEffect(() => {
    if (puzzles.length > 0 && currentIndex < puzzles.length - 1) {
      const img = new Image();
      img.src = puzzles[currentIndex + 1].image_url;
    }
  }, [currentIndex, puzzles]);

  const handleAnswer = (choice: 'real' | 'fake') => {
    if (status !== 'playing') return;

    const currentPuzzle = puzzles[currentIndex];
    const isCorrect = choice === currentPuzzle.correct_answer;

    let pointsGained = isCorrect ? BASE_POINTS : 0;
    const newStreak = isCorrect ? streak + 1 : 0;

    if (isCorrect && newStreak >= 3) {
      pointsGained += STREAK_BONUS;
    }

    const newScore = score + pointsGained;

    setScore(newScore);
    setStreak(newStreak);
    scoreRef.current = newScore;

    if (onScoreUpdate) {
      onScoreUpdate(newScore, maxScoreRef.current);
    }

    // Build reveal message from DB data
    const sourceLabel = currentPuzzle.correct_answer === 'fake'
      ? `AI — ${currentPuzzle.metadata.source?.toUpperCase() || 'AI GENERATED'}`
      : `REAL — ${currentPuzzle.prompt}`;

    setLastResult({ isCorrect, message: sourceLabel });
    setStatus('feedback');

    setTimeout(() => {
      if (currentIndex === puzzles.length - 1) {
        setStatus('finished');
        if (onComplete) {
          onComplete(newScore, maxScoreRef.current);
        }
      } else {
        setCurrentIndex(prev => prev + 1);
        setStatus('playing');
        setLastResult(null);
      }
    }, 1500);
  };

  // --- RENDER ---

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full bg-black text-cyan-400">
        <p className="animate-pulse tracking-widest" style={NEON_STYLES.cyanGlow}>
          INITIALIZING SYSTEM...
        </p>
      </div>
    );
  }

  if (!puzzles.length || currentIndex >= puzzles.length) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-red-400">
        <div className="text-center">
          <p className="text-2xl font-bold mb-2">⚠️ ERROR</p>
          <p className="text-sm">No puzzles available</p>
        </div>
      </div>
    );
  }

  const currentPuzzle = puzzles[currentIndex];

  return (
    <div className="flex flex-col h-full bg-black p-2 sm:p-4 font-mono text-white select-none overflow-hidden">
      {/* Header */}
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
            IMAGE {currentIndex + 1} / {puzzles.length}
          </p>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative flex-1 flex flex-col items-center justify-center gap-4">

        {/* Streak */}
        {streak >= 3 && (
          <div className="absolute -top-2 z-10 animate-bounce">
            <span className="bg-black border-2 border-yellow-400 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold shadow-[0_0_10px_#fbbf24]">
              🔥 STREAK x{streak}
            </span>
          </div>
        )}

        {/* Image */}
        <div
          className={`relative w-full aspect-[4/3] sm:aspect-video rounded-lg overflow-hidden border-2 transition-all duration-300 ${
            status === 'feedback'
              ? lastResult?.isCorrect
                ? 'border-green-500 shadow-[0_0_20px_#22c55e]'
                : 'border-red-500 shadow-[0_0_20px_#ef4444]'
              : 'border-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.3)]'
          }`}
        >
          <img
            src={currentPuzzle.image_url}
            alt="Mystery Content"
            className="w-full h-full object-cover"
          />

          {/* Feedback Overlay */}
          {status === 'feedback' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
              <div className="text-center p-4">
                <p className={`text-2xl font-black mb-2 uppercase ${
                  lastResult?.isCorrect ? 'text-green-400' : 'text-red-400'
                }`}>
                  {lastResult?.isCorrect ? 'CORRECT' : 'WRONG'}
                </p>
                <p className="text-sm sm:text-base font-bold text-white max-w-xs leading-tight">
                  {lastResult?.message}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="w-full grid grid-cols-2 gap-4 mt-2">
          <button
            onClick={() => handleAnswer('real')}
            disabled={status === 'feedback'}
            className={`py-4 sm:py-6 border-2 rounded-md font-bold transition-all active:scale-95 flex flex-col items-center justify-center
              ${status === 'feedback' && currentPuzzle.correct_answer === 'real'
                ? 'border-green-500 text-green-500 shadow-[0_0_15px_#22c55e]'
                : 'border-cyan-400 text-cyan-400 hover:bg-cyan-400/10'}
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
              ${status === 'feedback' && currentPuzzle.correct_answer === 'fake'
                ? 'border-green-500 text-green-500 shadow-[0_0_15px_#22c55e]'
                : 'border-pink-500 text-pink-500 hover:bg-pink-500/10'}
              ${status === 'feedback' && currentPuzzle.correct_answer !== 'fake' ? 'opacity-30' : ''}
            `}
            style={status === 'playing' ? NEON_STYLES.pinkGlow : {}}
          >
            <span className="text-xl">🤖</span>
            <span>FAKE</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 border-t border-cyan-900 pt-2 flex justify-between text-[10px] sm:text-xs text-cyan-600 uppercase tracking-widest">
        <span>LVL: {currentPuzzle.metadata.difficulty || 'medium'}</span>
        <span>ACCURACY: {currentIndex > 0 ? Math.round((score / ((currentIndex + (status === 'feedback' ? 1 : 0)) * BASE_POINTS)) * 100) : 0}%</span>
      </div>
    </div>
  );
});

FakeOut.displayName = 'FakeOut';

export default FakeOut;