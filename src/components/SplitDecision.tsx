/**
 * SplitDecision.tsx - UPDATED WITH BRANDING
 *
 * Location: components/SplitDecision.tsx
 *
 * Features:
 * - Zap icon with yellow glow
 * - "Think Fast" tagline
 * - Score left-aligned
 * - One puzzle (7 items) per round
 * - Three categories: A, B, and BOTH
 * - Immediate visual feedback on answer
 * - Green highlight for correct
 * - Red/Green for wrong (shows correct answer)
 * - Auto-advances after 1.5 seconds
 * - No timer pause - keeps moving fast
 * - No penalty for wrong answers
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GameHandle } from '../lib/gameTypes';

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
  onComplete?: (score: number, maxScore: number) => void;
}

const MAX_SCORE = 1000;
const POINTS_PER_ITEM = Math.round(MAX_SCORE / 7); // ~143 points per item

const SplitDecision = forwardRef<GameHandle, SplitDecisionProps>(({ userId, roundNumber = 1, onScoreUpdate, onTimerPause, onComplete }, ref) => {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [puzzleIds, setPuzzleIds] = useState<number[]>([]);
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  const scoreRef = useRef(0);

  // Keep refs up to date
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // Load all puzzle IDs on mount
  useEffect(() => {
    const loadPuzzleIds = async () => {
      try {
        const { data, error } = await supabase
          .from('puzzles')
          .select('id')
          .eq('game_id', 7)
          .eq('sequence_round', 1)
          .order('id', { ascending: true });

        if (error) throw error;
        const ids = (data || []).map(p => p.id);
        setPuzzleIds(ids);
        if (ids.length > 0) {
          fetchPuzzleById(ids[0]);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading puzzle IDs:', error);
        setLoading(false);
      }
    };

    loadPuzzleIds();
  }, []);

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

      if (puzzleError) throw puzzleError;
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

      if (itemsError) throw itemsError;

      setPuzzle({
        ...puzzleData,
        items: itemsData || []
      });
      console.log('SplitDecision: Loaded puzzle with', itemsData?.length || 0, 'items');
      setCurrentItemIndex(0);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setFeedback(null);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching puzzle data:', error);
      setLoading(false);
    }
  };

  // Handle answer selection
  const handleAnswer = (category: string) => {
    console.log('SplitDecision: handleAnswer called, currentItemIndex:', currentItemIndex, 'category:', category);
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
      setScore(prev => {
        const newScore = prev + POINTS_PER_ITEM;
        scoreRef.current = newScore; // Update ref immediately
        if (onScoreUpdate) {
          onScoreUpdate(newScore, MAX_SCORE);
        }
        return newScore;
      });
    } else {
      // Wrong answer: no points, no penalty
      if (onScoreUpdate) {
        onScoreUpdate(score, MAX_SCORE);
      }
      // scoreRef.current is already up to date (no change)
    }

    // Check if this is the last item
    const isLastItem = currentItemIndex === puzzle.items.length - 1;
    console.log('SplitDecision: Item', currentItemIndex + 1, 'of', puzzle.items.length, '- isLastItem:', isLastItem);

    // Auto-advance after 1.5 seconds
    autoAdvanceTimer.current = setTimeout(() => {
      if (isLastItem) {
        // Puzzle complete - call onComplete with latest score
        const callback = onCompleteRef.current;
        const finalScore = scoreRef.current;
        console.log('SplitDecision: Last item timeout fired!');
        console.log('SplitDecision: Puzzle complete, calling onComplete with score:', finalScore);
        console.log('SplitDecision: onComplete callback exists:', !!callback);
        if (callback) {
          callback(finalScore, MAX_SCORE);
          console.log('SplitDecision: onComplete called successfully');
        } else {
          console.error('SplitDecision: onComplete callback is undefined!');
        }
      } else {
        // More items - advance to next
        console.log('SplitDecision: Advancing to next item');
        setCurrentItemIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setFeedback(null);
      }
    }, 1500);
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
      maxScore: MAX_SCORE
    }),
    onGameEnd: () => {
      console.log('SplitDecision: onGameEnd called, clearing timer');
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
        console.log('SplitDecision: Timer cleared');
      }
    },
    canSkipQuestion: false,
    loadNextPuzzle: () => {
      const nextIndex = currentPuzzleIndex + 1;
      if (nextIndex < puzzleIds.length) {
        setCurrentPuzzleIndex(nextIndex);
        fetchPuzzleById(puzzleIds[nextIndex]);
      }
    }
  }), [score, currentPuzzleIndex, puzzleIds]);

  // Early returns AFTER all hooks
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-yellow-400" style={{ textShadow: '0 0 10px #fbbf24' }}>
          <Zap className="inline-block w-5 h-5 mr-2" style={{ filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))' }} />
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
    <div className="flex flex-col h-full bg-black p-3 sm:p-6 space-y-3 sm:space-y-6">
      {/* Add custom animation for double pulse */}
      <style>{`
        @keyframes pulse-twice {
          0%, 100% {
            opacity: 1;
          }
          25% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
          75% {
            opacity: 0.5;
          }
        }
        .animate-pulse-twice {
          animation: pulse-twice 1s ease-in-out;
        }
      `}</style>

      {/* Header - Updated with icon and branding */}
      <div className="mb-3 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-yellow-400 mb-1 border-b border-yellow-400 pb-1 flex items-center justify-center gap-2">
          <Zap 
            className="w-6 h-6 sm:w-7 sm:h-7" 
            style={{ 
              color: '#fbbf24',
              filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))',
              strokeWidth: 2
            }} 
          />
          <span style={{ textShadow: '0 0 10px #fbbf24' }}>Split Decision</span>
        </h2>
        
        {/* Tagline */}
        <p className="text-yellow-300 text-xs sm:text-sm mb-2 sm:mb-4 text-center">
          Think Fast
        </p>

        {/* Score and Progress */}
        <div className="flex justify-between items-center mb-2 sm:mb-4 text-xs sm:text-sm">
          <div className="text-yellow-300">
            Score: <strong className="text-yellow-400 tabular-nums">{score}</strong>
          </div>
          <div className="text-yellow-400">
            Item {currentItemIndex + 1} of {puzzle.items.length}
          </div>
        </div>
      </div>

      {/* Puzzle Question Header */}
      <div className="text-center">
        <h3 className="text-lg sm:text-2xl font-bold text-yellow-400 mb-2 sm:mb-4 break-words" style={{ textShadow: '0 0 15px #fbbf24' }}>{puzzle.prompt}</h3>
      </div>

      {/* Item to categorize */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="w-full bg-black border-2 border-yellow-500 rounded-2xl p-4 sm:p-12 text-center" style={{ boxShadow: '0 0 25px rgba(251, 191, 36, 0.3)' }}>
          <h2 className="text-3xl sm:text-6xl font-bold text-yellow-400 break-words" style={{ textShadow: '0 0 20px #fbbf24' }}>{currentItem.item_text}</h2>
        </div>
      </div>

      {/* Category buttons */}
      <div className="space-y-2 sm:space-y-4">
        {/* Category A */}
        <button
          onClick={() => handleAnswer(puzzle.category_1)}
          disabled={isAnswered}
          className={`
            w-full p-2.5 sm:p-4 rounded-xl text-sm sm:text-base font-bold transition-all
            text-yellow-400 uppercase tracking-normal
            ${getButtonStyle(puzzle.category_1)}
            ${!isAnswered && 'cursor-pointer'}
            ${isAnswered && 'cursor-default'}
          `}
          style={{ textShadow: isAnswered ? 'none' : '0 0 10px #fbbf24', boxShadow: isAnswered ? 'none' : '0 0 15px rgba(251, 191, 36, 0.3)' }}
        >
          <span className="block break-words hyphens-auto leading-tight">{puzzle.category_1}</span>
        </button>

        {/* Category B */}
        <button
          onClick={() => handleAnswer(puzzle.category_2)}
          disabled={isAnswered}
          className={`
            w-full p-2.5 sm:p-4 rounded-xl text-sm sm:text-base font-bold transition-all
            text-yellow-400 uppercase tracking-normal
            ${getButtonStyle(puzzle.category_2)}
            ${!isAnswered && 'cursor-pointer'}
            ${isAnswered && 'cursor-default'}
          `}
          style={{ textShadow: isAnswered ? 'none' : '0 0 10px #fbbf24', boxShadow: isAnswered ? 'none' : '0 0 15px rgba(251, 191, 36, 0.3)' }}
        >
          <span className="block break-words hyphens-auto leading-tight">{puzzle.category_2}</span>
        </button>

        {/* BOTH Category */}
        <button
          onClick={() => handleAnswer('BOTH')}
          disabled={isAnswered}
          className={`
            w-full p-2.5 sm:p-4 rounded-xl text-sm sm:text-base font-bold transition-all
            uppercase tracking-normal
            text-yellow-400
            ${getButtonStyle('BOTH')}
            ${!isAnswered && 'cursor-pointer'}
            ${isAnswered && 'cursor-default'}
          `}
          style={{ textShadow: isAnswered ? 'none' : '0 0 10px #fbbf24', boxShadow: isAnswered ? 'none' : '0 0 15px rgba(251, 191, 36, 0.3)' }}
        >
          <span className="block">BOTH</span>
        </button>
      </div>
    </div>
  );
});

SplitDecision.displayName = 'SplitDecision';

export default SplitDecision;