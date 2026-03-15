/**
 * SplitDecision.tsx - FIXED LAYOUT VERSION
 *
 * Key changes:
 * - Header shrunk to single-line with icon + title + score (no extra padding)
 * - Prompt question takes 20% of height, much larger font
 * - Item display box takes 50%+ of height (flex-1), text scales to 4xl-7xl
 * - Buttons reduced to 25% of height with tighter spacing
 * - Removed "Think Fast" tagline (waste of space)
 * - All padding minimized for mobile
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GameHandle } from '../lib/gameTypes';
import { playWin, playWrong } from '../lib/sounds';

interface PuzzleItem {
  id: number;
  item_text: string;
  correct_category: string;
  item_order: number;
}

interface Puzzle {
  id: number;
  prompt: string;
  category_1: string;
  category_2: string;
  items: PuzzleItem[];
}

interface SplitDecisionProps {
  userId?: string;
  roundNumber?: number;
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onTimerPause?: (paused: boolean) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
  duration?: number;
  puzzleId?: number | null;
  rankingPuzzleId?: number | null;
}

const MAX_SCORE = 1000;
const POINTS_PER_ITEM = Math.round(MAX_SCORE / 7); // ~143 points per item

const SplitDecision = forwardRef<GameHandle, SplitDecisionProps>(({ userId, roundNumber = 1, onScoreUpdate, onTimerPause, onComplete, timeRemaining, duration, puzzleId, rankingPuzzleId }, ref) => {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [puzzleIds, setPuzzleIds] = useState<number[]>([]);
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  const scoreRef = useRef(0);
  const correctCountRef = useRef(0);
  const gameCompletedRef = useRef(false);

  // Keep refs up to date
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    correctCountRef.current = correctCount;
  }, [correctCount]);

  // Load all puzzle IDs on mount
  useEffect(() => {
    const loadPuzzleIds = async () => {
      try {
        if (puzzleId) {
          setPuzzleIds([puzzleId]);
          fetchPuzzleById(puzzleId);
          return;
        }

        const { data, error } = await supabase
          .from('puzzles')
          .select('id')
          .eq('game_id', 7)
          .eq('sequence_round', 1)
          .order('id', { ascending: true });

        if (error) throw new Error(error.message);
        const ids = (data || []).map(p => p.id);
        setPuzzleIds(ids);
        if (ids.length > 0) {
          fetchPuzzleById(ids[0]);
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    };

    loadPuzzleIds();
  }, [puzzleId]);

  // Fetch puzzle and its items by ID
  const fetchPuzzleById = async (puzzleId: number) => {
    try {
      setLoading(true);

      // Get the puzzle
      const { data: puzzleData, error: puzzleError } = await supabase
        .from('puzzles')
        .select('id, prompt, category_1, category_2')
        .eq('id', puzzleId)
        .maybeSingle();

      if (puzzleError) throw new Error(puzzleError.message);
      if (!puzzleData) {
        setLoading(false);
        return;
      }

      // Get all items for this puzzle
      const { data: itemsData, error: itemsError } = await supabase
        .from('puzzle_items')
        .select('id, item_text, correct_category, item_order')
        .eq('puzzle_id', puzzleData.id)
        .order('item_order', { ascending: true });

      if (itemsError) throw new Error(itemsError.message);

      setPuzzle({
        ...puzzleData,
        items: itemsData || []
      });
      setCurrentItemIndex(0);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setFeedback(null);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  // Handle answer selection
  const handleAnswer = (category: string) => {
    if (isAnswered || !puzzle || !puzzle.items[currentItemIndex]) return;

    const currentItem = puzzle.items[currentItemIndex];
    setSelectedAnswer(category);
    setIsAnswered(true);

    // Map category buttons to correct_category values
    const categoryMap: { [key: string]: string } = {
      [puzzle.category_1]: 'category_1',
      [puzzle.category_2]: 'category_2',
      'BOTH': 'both'
    };

    const selectedCategory = categoryMap[category];
    const isCorrect = selectedCategory === currentItem.correct_category;
    setFeedback(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      playWin(0.5);
      setCorrectCount(prev => {
        correctCountRef.current = prev + 1;
        return prev + 1;
      });
      setScore(prev => {
        const newScore = prev + POINTS_PER_ITEM;
        scoreRef.current = newScore;
        if (onScoreUpdate) {
          onScoreUpdate(newScore, MAX_SCORE);
        }
        return newScore;
      });
    } else {
      playWrong(0.3);
      if (onScoreUpdate) {
        onScoreUpdate(score, MAX_SCORE);
      }
    }

    // Check if this is the last item
    const isLastItem = currentItemIndex === puzzle.items.length - 1;

    if (isLastItem) {
      // Show feedback for 1.5 seconds then trigger completion
      autoAdvanceTimer.current = setTimeout(() => {
        if (!gameCompletedRef.current) {
          gameCompletedRef.current = true;
          const callback = onCompleteRef.current;
          if (callback) {
            callback(scoreRef.current, MAX_SCORE, timeRemaining);
          }
        }
      }, 1500);
    } else {
      autoAdvanceTimer.current = setTimeout(() => {
        setCurrentItemIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setFeedback(null);
      }, 1500);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  // Expose score and loadNextPuzzle via GameHandle
  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: score,
      maxScore: MAX_SCORE,
      correctCount: correctCount,
      totalItems: puzzle?.items.length || 7
    } as any),
    onGameEnd: () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
      if (!gameCompletedRef.current) {
        gameCompletedRef.current = true;
        const callback = onCompleteRef.current;
        const finalScore = scoreRef.current;
        if (callback) {
          callback(finalScore, MAX_SCORE, timeRemaining);
        }
      }
    },
    get pauseTimer() { return isAnswered; },
    canSkipQuestion: false,
    loadNextPuzzle: () => {
      const nextIndex = currentPuzzleIndex + 1;
      if (nextIndex < puzzleIds.length) {
        setCurrentPuzzleIndex(nextIndex);
        fetchPuzzleById(puzzleIds[nextIndex]);
      }
    }
  }), [score, correctCount, currentPuzzleIndex, puzzleIds, timeRemaining, isAnswered]);

  // Early returns AFTER all hooks
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-yellow-400" style={{ textShadow: '0 0 10px #fbbf24' }}>
          <Layers className="inline-block w-5 h-5 mr-2" style={{ filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))' }} />
          Loading puzzle...
        </div>
      </div>
    );
  }

  if (!puzzle || puzzle.items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">No puzzle available for this round.</div>
      </div>
    );
  }

  const currentItem = puzzle.items[currentItemIndex];

  // Get the correct answer text for display
  const getCorrectAnswerText = () => {
    if (currentItem.correct_category === 'category_1') return puzzle.category_1;
    if (currentItem.correct_category === 'category_2') return puzzle.category_2;
    return 'BOTH';
  };

  // Determine button styling based on feedback
  const getButtonStyle = (category: string) => {
    if (!isAnswered) {
      // BOTH button gets yellow styling when not answered
      if (category === 'BOTH') {
        return 'border-4 border-yellow-400 hover:border-yellow-300 bg-black hover:bg-yellow-400/20';
      }
      return 'border-4 border-yellow-400 hover:border-yellow-300 bg-black hover:bg-yellow-400/20';
    }

    const correctAnswerText = getCorrectAnswerText();

    // If answered, highlight accordingly
    if (feedback === 'correct' && category === selectedAnswer) {
      return 'border-4 border-green-500 bg-green-500/30 animate-pulse';
    }

    if (feedback === 'wrong' && category === selectedAnswer) {
      return 'border-4 border-red-500 bg-red-500/30 animate-pulse-twice';
    }

    if (feedback === 'wrong' && category === correctAnswerText) {
      return 'border-4 border-green-500 bg-green-500/30 animate-pulse';
    }

    return 'border-4 border-gray-600 opacity-30';
  };

  return (
    <div className="flex flex-col h-full bg-black p-2 sm:p-3 overflow-hidden">
      <style>{`
        @keyframes pulse-twice {
          0%, 100% { opacity: 1; }
          25% { opacity: 0.5; }
          50% { opacity: 1; }
          75% { opacity: 0.5; }
        }
        .animate-pulse-twice { animation: pulse-twice 1s ease-in-out; }
        @media (orientation: landscape) and (max-height: 500px) {
          .split-landscape { flex-direction: row !important; gap: 8px !important; }
          .split-landscape-word { flex: 1 1 0 !important; min-height: 0; align-self: stretch; }
          .split-landscape-word > div { height: 100% !important; }
          .split-landscape-btns { flex: 0 0 44% !important; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
          .split-landscape-header { margin-bottom: 4px !important; }
          .split-landscape-prompt { font-size: 0.7rem !important; padding: 2px 0 !important; }
          .split-landscape-wordtext { font-size: clamp(1.4rem, 6vw, 2.5rem) !important; }
          .split-landscape-btn { padding-top: 6px !important; padding-bottom: 6px !important; font-size: 0.7rem !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 split-landscape-header mb-1 sm:mb-2">
        <div className="flex items-center gap-1.5">
          <Layers
            className="w-4 h-4 sm:w-5 sm:h-5"
            style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))', strokeWidth: 2 }}
          />
          <h2 className="text-xs sm:text-sm font-bold text-yellow-400" style={{ textShadow: '0 0 10px #fbbf24' }}>Split Decision</h2>
        </div>
        <div className="text-yellow-300 text-xs sm:text-sm">
          Score: <strong className="text-yellow-400 tabular-nums">{score}</strong>
        </div>
      </div>

      {/* Prompt */}
      <div className="text-center flex-shrink-0 py-1 split-landscape-prompt">
        <h3 className="text-sm sm:text-xl font-bold text-yellow-400 break-words leading-snug" style={{ textShadow: '0 0 15px #fbbf24' }}>
          {puzzle.prompt}
        </h3>
      </div>

      {/* Main area: word card + buttons — row in landscape, column in portrait */}
      <div className="flex flex-col flex-1 min-h-0 gap-2 sm:gap-3 split-landscape">

        {/* Word card */}
        <div className="split-landscape-word flex items-center justify-center" style={{ flex: '0 0 auto' }}>
          <div
            className="w-full bg-black border-2 border-yellow-500 rounded-xl px-4 py-5 sm:py-8 text-center flex items-center justify-center"
            style={{ boxShadow: '0 0 25px rgba(251, 191, 36, 0.3)' }}
          >
            <h2 className="font-bold text-yellow-400 break-words leading-tight split-landscape-wordtext" style={{ fontSize: 'clamp(1.8rem, 8vw, 3.5rem)', textShadow: '0 0 20px #fbbf24' }}>
              {currentItem.item_text}
            </h2>
          </div>
        </div>

        {/* Buttons */}
        <div className="split-landscape-btns flex-shrink-0 space-y-1.5">
          {[
            { label: puzzle.category_1, value: puzzle.category_1 },
            { label: puzzle.category_2, value: puzzle.category_2 },
            { label: 'BOTH', value: 'BOTH' },
          ].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleAnswer(value)}
              disabled={isAnswered}
              className={`split-landscape-btn w-full py-2.5 sm:py-3 px-3 rounded-lg text-sm sm:text-base font-bold transition-all text-yellow-400 uppercase tracking-wide ${getButtonStyle(value)} ${!isAnswered ? 'cursor-pointer' : 'cursor-default'}`}
              style={{ textShadow: isAnswered ? 'none' : '0 0 10px #fbbf24', boxShadow: isAnswered ? 'none' : '0 0 15px rgba(251, 191, 36, 0.3)' }}
            >
              <span className="block break-words">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

SplitDecision.displayName = 'SplitDecision';

export default React.memo(SplitDecision, (prevProps, nextProps) => {
  return (
    prevProps.puzzleId === nextProps.puzzleId &&
    prevProps.rankingPuzzleId === nextProps.rankingPuzzleId &&
    prevProps.onScoreUpdate === nextProps.onScoreUpdate &&
    prevProps.onComplete === nextProps.onComplete &&
    prevProps.timeRemaining === nextProps.timeRemaining &&
    prevProps.duration === nextProps.duration &&
    prevProps.userId === nextProps.userId
  );
});