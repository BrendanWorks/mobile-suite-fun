/**
 * SplitDecision.tsx - WITH LOAD NEXT PUZZLE
 *
 * Location: components/SplitDecision.tsx
 *
 * Features:
 * - Fetches real puzzles and puzzle items from Supabase
 * - Three categories: A, B, and BOTH
 * - Immediate visual feedback on answer
 * - Green highlight for correct
 * - Red/Green for wrong (shows correct answer)
 * - Auto-advances after 1.5 seconds
 * - Tracks score
 * - loadNextPuzzle() to load next puzzle in sequence
 * - Implements GameHandle for scoring
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
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
}

const SplitDecision = forwardRef<GameHandle, SplitDecisionProps>(({ userId, roundNumber = 1 }, ref) => {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSequenceOrder, setCurrentSequenceOrder] = useState(0);
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);
  const earlyCompleteCallback = useRef<(() => void) | null>(null);

  // Fetch puzzle and its items from Supabase
  const fetchPuzzleByIndex = async (puzzleIndex: number) => {
    try {
      setLoading(true);

      // First, get the puzzle using offset
      const { data: puzzleData, error: puzzleError } = await supabase
        .from('puzzles')
        .select('id, prompt, category_1, category_2')
        .eq('game_id', 7) // Split Decision game_id
        .eq('sequence_round', 1) // Always use sequence_round 1 (all puzzles are here)
        .order('id', { ascending: true })
        .offset(puzzleIndex)
        .limit(1)
        .maybeSingle();

      if (puzzleError) throw puzzleError;
      if (!puzzleData) {
        setLoading(false);
        return;
      }

      // Then, get all items for this puzzle
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
      setCurrentSequenceOrder(puzzleIndex);
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

  // Initial puzzle load
  useEffect(() => {
    fetchPuzzleByIndex(0);
  }, [roundNumber]);

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
      setScore(prev => prev + 143); // +143 for correct
    } else {
      setScore(prev => Math.max(0, prev - 143)); // -143 for wrong, min 0
    }

    // Check if this is the last item
    const isLastItem = currentItemIndex === puzzle.items.length - 1;

    // If this is the last item, trigger early completion
    if (isLastItem && earlyCompleteCallback.current) {
      earlyCompleteCallback.current();
    }

    // Auto-advance after 1.5 seconds
    autoAdvanceTimer.current = setTimeout(() => {
      if (currentItemIndex < puzzle.items.length - 1) {
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
    getGameScore: () => {
      const maxPossibleScore = puzzle ? puzzle.items.length * 143 : 1001;
      return {
        score: Math.round((score / maxPossibleScore) * 100), // Normalize to 0-100
        maxScore: 100
      };
    },
    onGameEnd: () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    },
    onEarlyComplete: (callback: () => void) => {
      earlyCompleteCallback.current = callback;
    },
    loadNextPuzzle: () => {
      fetchPuzzleByIndex(currentSequenceOrder + 1);
    }
  }));

  // Early returns AFTER all hooks
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading puzzle...</div>
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
      return 'border-2 border-blue-400 hover:border-blue-300 bg-blue-900/30 hover:bg-blue-900/50';
    }

    const correctAnswerText = getCorrectAnswerText();

    // If answered, highlight accordingly
    if (feedback === 'correct' && category === selectedAnswer) {
      return 'border-2 border-green-400 bg-green-900/50';
    }

    if (feedback === 'wrong' && category === selectedAnswer) {
      return 'border-2 border-red-400 bg-red-900/50';
    }

    if (feedback === 'wrong' && category === correctAnswerText) {
      return 'border-2 border-green-400 bg-green-900/50';
    }

    return 'border-2 border-gray-600 opacity-50';
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Puzzle Question Header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-2 break-words">{puzzle.prompt}</h3>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Item {currentItemIndex + 1} of {puzzle.items.length}</span>
          <span className="text-xl font-bold text-cyan-400">Score: {score}</span>
        </div>
      </div>

      {/* Item to categorize */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full bg-gradient-to-r from-blue-900/40 to-cyan-900/40 border border-cyan-500/30 rounded-2xl p-12 text-center">
          <h2 className="text-6xl font-bold text-white">{currentItem.item_text}</h2>
        </div>
      </div>

      {/* Category buttons */}
      <div className="space-y-4">
        {/* Category A */}
        <button
          onClick={() => handleAnswer(puzzle.category_1)}
          disabled={isAnswered}
          className={`
            w-full p-4 rounded-xl text-base font-bold transition-all
            text-white uppercase tracking-normal
            ${getButtonStyle(puzzle.category_1)}
            ${!isAnswered && 'cursor-pointer'}
            ${isAnswered && 'cursor-default'}
          `}
        >
          <span className="block break-words hyphens-auto leading-tight">{puzzle.category_1}</span>
          {feedback === 'correct' && selectedAnswer === puzzle.category_1 && (
            <span className="ml-2">✓</span>
          )}
          {feedback === 'wrong' && selectedAnswer === puzzle.category_1 && (
            <span className="ml-2">✗</span>
          )}
        </button>

        {/* Category B */}
        <button
          onClick={() => handleAnswer(puzzle.category_2)}
          disabled={isAnswered}
          className={`
            w-full p-4 rounded-xl text-base font-bold transition-all
            text-white uppercase tracking-normal
            ${getButtonStyle(puzzle.category_2)}
            ${!isAnswered && 'cursor-pointer'}
            ${isAnswered && 'cursor-default'}
          `}
        >
          <span className="block break-words hyphens-auto leading-tight">{puzzle.category_2}</span>
          {feedback === 'correct' && selectedAnswer === puzzle.category_2 && (
            <span className="ml-2">✓</span>
          )}
          {feedback === 'wrong' && selectedAnswer === puzzle.category_2 && (
            <span className="ml-2">✗</span>
          )}
        </button>

        {/* BOTH Category */}
        <button
          onClick={() => handleAnswer('BOTH')}
          disabled={isAnswered}
          className={`
            w-full p-4 rounded-xl text-base font-bold transition-all
            text-yellow-300 uppercase tracking-normal
            border-2 border-yellow-500
            ${getButtonStyle('BOTH')}
            ${!isAnswered && 'cursor-pointer hover:border-yellow-400 hover:bg-yellow-900/30'}
            ${isAnswered && 'cursor-default'}
          `}
        >
          <span className="block">BOTH</span>
          {feedback === 'correct' && selectedAnswer === 'BOTH' && (
            <span className="ml-2">✓</span>
          )}
          {feedback === 'wrong' && selectedAnswer === 'BOTH' && (
            <span className="ml-2">✗</span>
          )}
        </button>

        {/* Feedback message */}
        {isAnswered && (
          <div className={`
            text-center py-4 rounded-lg font-bold text-lg transition-all
            ${feedback === 'correct'
              ? 'bg-green-900/50 text-green-300'
              : 'bg-red-900/50 text-red-300'
            }
          `}>
            {feedback === 'correct' ? '✓ Correct!' : '✗ Wrong'}
            {feedback === 'wrong' && (
              <div className="text-sm mt-1">
                Answer: <span className="text-green-300">{getCorrectAnswerText()}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress indicator */}
      {currentItemIndex === puzzle.items.length - 1 && isAnswered && (
        <div className="text-center text-gray-400 text-sm">
          Round complete!
        </div>
      )}
    </div>
  );
});

SplitDecision.displayName = 'SplitDecision';

export default SplitDecision;