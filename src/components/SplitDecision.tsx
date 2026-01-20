/**
 * SplitDecision.tsx - COMPLETE WITH SUPABASE DATA + BOTH CATEGORY
 * 
 * Location: components/SplitDecision.tsx
 * 
 * Features:
 * - Fetches real puzzles from Supabase
 * - Three categories: A, B, and BOTH
 * - Immediate visual feedback on answer
 * - Green highlight for correct
 * - Red/Green for wrong (shows correct answer)
 * - Auto-advances after 1.5 seconds
 * - Tracks score
 * - Implements GameHandle for scoring
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../lib/supabase';
import { GameHandle } from '../lib/gameTypes';

interface Puzzle {
  id: number;
  prompt: string;
  category_1: string;
  category_2: string;
  correct_answer: string;
}

interface SplitDecisionProps {
  userId?: string;
  roundNumber?: number;
}

const SplitDecision = forwardRef<GameHandle, SplitDecisionProps>(({ userId, roundNumber = 1 }, ref) => {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [loading, setLoading] = useState(true);
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch puzzles from Supabase
  useEffect(() => {
    const fetchPuzzles = async () => {
      try {
        const { data, error } = await supabase
          .from('puzzles')
          .select('*')
          .eq('game_id', 7) // Split Decision game_id
          .eq('sequence_round', roundNumber)
          .order('sequence_order', { ascending: true });

        if (error) throw error;

        setPuzzles(data || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching puzzles:', error);
        setLoading(false);
      }
    };

    fetchPuzzles();
  }, [roundNumber]);

  // Handle answer selection
  const handleAnswer = (category: string) => {
    if (isAnswered || !puzzles[currentItemIndex]) return;

    const currentPuzzle = puzzles[currentItemIndex];
    setSelectedAnswer(category);
    setIsAnswered(true);

    const isCorrect = category === currentPuzzle.correct_answer;
    setFeedback(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      setScore(prev => prev + 143); // +143 for correct
    } else {
      setScore(prev => Math.max(0, prev - 143)); // -143 for wrong, min 0
    }

    // Auto-advance after 1.5 seconds
    autoAdvanceTimer.current = setTimeout(() => {
      if (currentItemIndex < puzzles.length - 1) {
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

  // Expose score via GameHandle
  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: Math.round((score / 1001) * 100), // Normalize to 0-100
      maxScore: 100
    }),
    onGameEnd: () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    }
  }));

  // Early returns AFTER all hooks
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading puzzles...</div>
      </div>
    );
  }

  if (puzzles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">No puzzles available for this round.</div>
      </div>
    );
  }

  const currentPuzzle = puzzles[currentItemIndex];

  // Determine button styling based on feedback
  const getButtonStyle = (category: string) => {
    if (!isAnswered) {
      return 'border-2 border-blue-400 hover:border-blue-300 bg-blue-900/30 hover:bg-blue-900/50';
    }

    // If answered, highlight accordingly
    if (feedback === 'correct' && category === selectedAnswer) {
      return 'border-2 border-green-400 bg-green-900/50';
    }

    if (feedback === 'wrong' && category === selectedAnswer) {
      return 'border-2 border-red-400 bg-red-900/50';
    }

    if (feedback === 'wrong' && category === currentPuzzle.correct_answer) {
      return 'border-2 border-green-400 bg-green-900/50';
    }

    return 'border-2 border-gray-600 opacity-50';
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <span className="text-gray-400">Item {currentItemIndex + 1} of {puzzles.length}</span>
        <span className="text-2xl font-bold text-cyan-400">Score: {score}</span>
      </div>

      {/* Item to categorize */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-2xl p-12 text-center">
          <h2 className="text-5xl font-bold text-white">{currentPuzzle.prompt}</h2>
        </div>
      </div>

      {/* Category buttons */}
      <div className="space-y-4">
        {/* Category A */}
        <button
          onClick={() => handleAnswer(currentPuzzle.category_1)}
          disabled={isAnswered}
          className={`
            w-full p-6 rounded-xl text-xl font-bold transition-all
            text-white uppercase tracking-wide
            ${getButtonStyle(currentPuzzle.category_1)}
            ${!isAnswered && 'cursor-pointer'}
            ${isAnswered && 'cursor-default'}
          `}
        >
          <div className="text-sm opacity-75 mb-2">Category A</div>
          {currentPuzzle.category_1}
          {feedback === 'correct' && selectedAnswer === currentPuzzle.category_1 && (
            <span className="ml-2">✓</span>
          )}
          {feedback === 'wrong' && selectedAnswer === currentPuzzle.category_1 && (
            <span className="ml-2">✗</span>
          )}
        </button>

        {/* Category B */}
        <button
          onClick={() => handleAnswer(currentPuzzle.category_2)}
          disabled={isAnswered}
          className={`
            w-full p-6 rounded-xl text-xl font-bold transition-all
            text-white uppercase tracking-wide
            ${getButtonStyle(currentPuzzle.category_2)}
            ${!isAnswered && 'cursor-pointer'}
            ${isAnswered && 'cursor-default'}
          `}
        >
          <div className="text-sm opacity-75 mb-2">Category B</div>
          {currentPuzzle.category_2}
          {feedback === 'correct' && selectedAnswer === currentPuzzle.category_2 && (
            <span className="ml-2">✓</span>
          )}
          {feedback === 'wrong' && selectedAnswer === currentPuzzle.category_2 && (
            <span className="ml-2">✗</span>
          )}
        </button>

        {/* BOTH Category */}
        <button
          onClick={() => handleAnswer('BOTH')}
          disabled={isAnswered}
          className={`
            w-full p-6 rounded-xl text-xl font-bold transition-all
            text-yellow-300 uppercase tracking-wide
            border-2 border-yellow-500
            ${getButtonStyle('BOTH')}
            ${!isAnswered && 'cursor-pointer hover:border-yellow-400 hover:bg-yellow-900/30'}
            ${isAnswered && 'cursor-default'}
          `}
        >
          <div className="text-sm opacity-75 mb-2">Special Category</div>
          BOTH
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
                Answer: <span className="text-green-300">{currentPuzzle.correct_answer}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress indicator */}
      {currentItemIndex === puzzles.length - 1 && isAnswered && (
        <div className="text-center text-gray-400 text-sm">
          Advancing to results...
        </div>
      )}
    </div>
  );
});

SplitDecision.displayName = 'SplitDecision';

export default SplitDecision;

/**
 * FEATURES:
 * 
 * ✅ Fetches real puzzles from Supabase (game_id 7)
 * ✅ Three category buttons: Category A, Category B, BOTH
 * ✅ Immediate visual feedback
 * ✅ Correct answer: green highlight + checkmark
 * ✅ Wrong answer: red highlight on choice, green on correct answer
 * ✅ Shows text feedback ("Correct!" or "Wrong: [answer]")
 * ✅ Auto-advances after 1.5 seconds
 * ✅ Tracks score (+143 correct, -143 wrong)
 * ✅ Implements GameHandle for integration with GameSession
 * ✅ Prevents changing answer after selection
 * 
 * NEXT STEPS:
 * - Adjust +143/-143 scoring if needed
 * - Adjust auto-advance delay (currently 1500ms)
 */