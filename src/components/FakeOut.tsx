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

const BASE_POINTS = 100;
const STREAK_BONUS = 50;

// SVG Icons - Camera for REAL
const CameraIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* Camera body */}
    <rect x="3" y="3" width="18" height="15" rx="2" ry="2" />
    {/* Lens circle */}
    <circle cx="12" cy="10" r="4" />
    {/* Flash */}
    <path d="M18 7h.01" />
  </svg>
);

// SVG Icons - Stars breaking box for FAKE
const StarsBurstIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5">
    {/* Box frame */}
    <rect x="2" y="3" width="20" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    
    {/* Large center 4-point star */}
    <path d="M12 7L14 12L19 12L15 15L17 20L12 17L7 20L9 15L5 12L10 12Z" fill="currentColor" />
    
    {/* Top-left small star */}
    <path d="M5 6L6 8L8 8L6.5 9L7.5 11L5.5 9.5L3.5 11L4.5 9L3 8L5 8Z" fill="currentColor" />
    
    {/* Bottom-right small star */}
    <path d="M19 17L20 19L22 19L20.5 20L21.5 22L19.5 20.5L17.5 22L18.5 20L17 19L19 19Z" fill="currentColor" />
  </svg>
);

const FakeOut = forwardRef((props: FakeOutProps, ref) => {
  const { onScoreUpdate, onComplete, puzzleIds, timeRemaining = 0 } = props;

  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [status, setStatus] = useState<'loading' | 'playing' | 'feedback' | 'finished'>('loading');
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const scoreRef = useRef(0);
  const maxScoreRef = useRef(0);
  const hasEndedRef = useRef(false);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: scoreRef.current,
      maxScore: maxScoreRef.current
    }),
    onGameEnd: () => {
      console.log('FakeOut game ended');
    },
    pauseTimer: status === 'feedback'
  }), [status]);

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

  // Handle timer expiration
  useEffect(() => {
    if (timeRemaining <= 0 && status === 'playing' && !hasEndedRef.current) {
      hasEndedRef.current = true;
      setStatus('finished');
      if (onComplete) {
        onComplete(scoreRef.current, maxScoreRef.current);
      }
    }
  }, [timeRemaining, status, onComplete]);

  const handleAnswer = (choice: 'real' | 'fake') => {
    if (status !== 'playing' || hasEndedRef.current) return;

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
      if (hasEndedRef.current) return;
      
      if (currentIndex === puzzles.length - 1) {
        hasEndedRef.current = true;
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
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-cyan-400">
          <p className="animate-pulse tracking-widest" style={{ textShadow: '0 0 10px #00ffff' }}>
            LOADING...
          </p>
        </div>
      </div>
    );
  }

  if (!puzzles.length || currentIndex >= puzzles.length) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-red-400">
          <p className="text-2xl font-bold mb-2">⚠️ ERROR</p>
          <p className="text-sm">No puzzles available</p>
        </div>
      </div>
    );
  }

  const currentPuzzle = puzzles[currentIndex];

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-2 pt-2 text-white select-none">
      <div className="text-center max-w-2xl w-full flex flex-col h-screen">

        {/* Header - icon + name left, score right (matches OddManOut) */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 255, 255, 0.6))' }}>
              <CameraIcon />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-cyan-400" style={{ textShadow: '0 0 10px #00ffff' }}>Fake Out</h2>
          </div>
          <div className="text-cyan-300 text-xs sm:text-sm">
            Score: <strong className="text-yellow-400 tabular-nums">{score.toLocaleString()}</strong>
          </div>
        </div>

        {/* Game Area - fixed height */}
        <div className="relative mb-2 flex flex-col justify-center">
          {/* Streak Indicator */}
          {streak >= 3 && (
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-10">
              <span className="inline-block bg-black border-2 border-yellow-400 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold"
                    style={{ boxShadow: '0 0 10px #fbbf24' }}>
                🔥 ×{streak}
              </span>
            </div>
          )}

          {/* Image Container */}
          <div
            className={`relative w-full h-64 sm:h-80 rounded-lg overflow-hidden border-2 transition-all duration-300 ${
              status === 'feedback'
                ? lastResult?.isCorrect
                  ? 'border-green-500'
                  : 'border-red-500'
                : 'border-cyan-400'
            }`}
            style={status === 'feedback' 
              ? lastResult?.isCorrect
                ? { boxShadow: '0 0 20px #22c55e' }
                : { boxShadow: '0 0 20px #ef4444' }
              : { boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)' }
            }
          >
            <img
              src={currentPuzzle.image_url}
              alt="Mystery Content"
              className="w-full h-full object-cover"
            />

            {/* Feedback Overlay */}
            {status === 'feedback' && lastResult && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="text-center p-4">
                  <p className={`text-2xl sm:text-3xl font-black mb-2 uppercase ${
                    lastResult.isCorrect ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {lastResult.isCorrect ? '✓ CORRECT' : '✗ WRONG'}
                  </p>
                  <p className="text-xs sm:text-sm text-cyan-300 max-w-xs leading-tight">
                    {lastResult.message}
                  </p>
                  <p className="text-[10px] text-cyan-500 mt-2 animate-pulse">Next...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Button Grid */}
        <div className="w-full grid grid-cols-2 gap-2 mb-1.5">
          {/* REAL Button with Camera Icon */}
          <button
            onClick={() => handleAnswer('real')}
            disabled={status === 'feedback'}
            className={`py-3 sm:py-4 px-2 sm:px-3 border-2 rounded-lg font-bold transition-all active:scale-95 flex flex-col items-center justify-center gap-1
              ${status === 'feedback' && currentPuzzle.correct_answer === 'real'
                ? 'border-green-500 bg-green-500/10 text-green-400'
                : status === 'feedback'
                ? 'border-cyan-400/30 text-cyan-400/40 opacity-30'
                : 'border-cyan-400 text-cyan-400 hover:bg-cyan-400/10'
              }`}
            style={status === 'playing' 
              ? { boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)', textShadow: '0 0 8px #00ffff' }
              : status === 'feedback' && currentPuzzle.correct_answer === 'real'
              ? { boxShadow: '0 0 15px #22c55e' }
              : {}
            }
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7">
              <CameraIcon />
            </div>
            <span className="text-xs sm:text-sm font-semibold">REAL</span>
          </button>

          {/* FAKE Button with Stars Icon */}
          <button
            onClick={() => handleAnswer('fake')}
            disabled={status === 'feedback'}
            className={`py-3 sm:py-4 px-2 sm:px-3 border-2 rounded-lg font-bold transition-all active:scale-95 flex flex-col items-center justify-center gap-1
              ${status === 'feedback' && currentPuzzle.correct_answer === 'fake'
                ? 'border-green-500 bg-green-500/10 text-green-400'
                : status === 'feedback'
                ? 'border-pink-500/30 text-pink-400/40 opacity-30'
                : 'border-pink-500 text-pink-400 hover:bg-pink-500/10'
              }`}
            style={status === 'playing'
              ? { boxShadow: '0 0 15px rgba(236, 72, 153, 0.3)', textShadow: '0 0 8px #ec4899' }
              : status === 'feedback' && currentPuzzle.correct_answer === 'fake'
              ? { boxShadow: '0 0 15px #22c55e' }
              : {}
            }
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7">
              <StarsBurstIcon />
            </div>
            <span className="text-xs sm:text-sm font-semibold">FAKE</span>
          </button>
        </div>

        {/* Footer Stats */}
        <div className="text-[8px] sm:text-[9px] text-cyan-600 uppercase tracking-widest">
          <span>Image {currentIndex + 1}/{puzzles.length}</span>
          {currentIndex > 0 && (
            <span className="ml-2">
              Accuracy: {Math.round((score / ((currentIndex + (status === 'feedback' ? 1 : 0)) * BASE_POINTS)) * 100)}%
            </span>
          )}
        </div>

      </div>
    </div>
  );
});

FakeOut.displayName = 'FakeOut';

export default FakeOut;