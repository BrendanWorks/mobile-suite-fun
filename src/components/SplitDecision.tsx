/**
 * SplitDecision.tsx - COMPLETE WITH FEEDBACK & AUTO-ADVANCE
 * 
 * Location: components/SplitDecision.tsx
 * 
 * Features:
 * - Shows items one at a time
 * - Validates answers immediately
 * - Green highlight for correct
 * - Red/Green for wrong (shows correct answer)
 * - Auto-advances after 1.5 seconds
 * - Tracks score
 * - Implements GameHandle for scoring
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { GameHandle } from '../lib/gameTypes';

interface Puzzle {
  id: number;
  prompt: string;
  category_1: string;
  category_2: string;
  correct_answer: string;
}

interface SplitDecisionProps {}

const SplitDecision = forwardRef<GameHandle, SplitDecisionProps>((_props, ref) => {
  // Mock puzzles - replace with actual data fetch
  const mockPuzzles: Puzzle[] = [
    {
      id: 1,
      prompt: 'Caligula',
      category_1: 'Boy Band Member',
      category_2: 'Roman Emperor',
      correct_answer: 'Roman Emperor'
    },
    {
      id: 2,
      prompt: 'Microwave',
      category_1: 'Kitchen Appliance',
      category_2: 'Medieval Weapon',
      correct_answer: 'Kitchen Appliance'
    },
    {
      id: 3,
      prompt: 'Expelliarmus',
      category_1: 'Harry Potter Spell',
      category_2: 'IKEA Furniture',
      correct_answer: 'Harry Potter Spell'
    },
    {
      id: 4,
      prompt: 'Jigglypuff',
      category_1: 'Pokemon',
      category_2: 'Prescription Medication',
      correct_answer: 'Pokemon'
    },
    {
      id: 5,
      prompt: 'Downward Dog',
      category_1: 'Yoga Pose',
      category_2: 'Sex Position',
      correct_answer: 'Yoga Pose'
    },
    {
      id: 6,
      prompt: 'Vicodin',
      category_1: 'Prescription Medication',
      category_2: 'Breaking Bad Character',
      correct_answer: 'Prescription Medication'
    },
    {
      id: 7,
      prompt: 'Billy Joel',
      category_1: 'Famous Piano Player',
      category_2: 'Medieval Torture Device',
      correct_answer: 'Famous Piano Player'
    }
  ];

  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);

  const currentPuzzle = mockPuzzles[currentItemIndex];

  // Handle answer selection
  const handleAnswer = (category: string) => {
    if (isAnswered) return; // Prevent changing answer

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
      if (currentItemIndex < mockPuzzles.length - 1) {
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
        <span className="text-gray-400">Item {currentItemIndex + 1} of {mockPuzzles.length}</span>
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
      {currentItemIndex === mockPuzzles.length - 1 && isAnswered && (
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
 * ✅ Shows item (prompt) to categorize
 * ✅ Two category buttons (A and B)
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
 * - Replace mockPuzzles with actual data fetch from Supabase
 * - Adjust +143/-143 scoring if needed
 * - Adjust auto-advance delay (currently 1500ms)
 */