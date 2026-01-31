import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { supabase } from '../lib/supabase';
import { GameHandle } from '../lib/gameTypes';

interface OddManOutProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onTimerPause?: (paused: boolean) => void;
}

const OddManOut = forwardRef<GameHandle, OddManOutProps>((props, ref) => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [gameState, setGameState] = useState('loading');
  const [isCorrect, setIsCorrect] = useState(false);
  const [message, setMessage] = useState('');
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [usedQuestions, setUsedQuestions] = useState([]);
  const [shuffledItems, setShuffledItems] = useState([]);
  const [puzzleIds, setPuzzleIds] = useState<number[]>([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const autoAdvanceTimeoutRef = React.useRef<number | null>(null);

  const successMessages = [
    "Excellent! You found the odd ones out!",
    "Perfect! Great logical thinking!",
    "Brilliant! You nailed it!",
    "Outstanding! You've got a keen eye!",
    "Fantastic! Well reasoned!"
  ];

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: score,
      maxScore: totalQuestions > 0 ? totalQuestions * 250 : 250
    }),
    onGameEnd: () => {
      console.log(`OddManOut ended with score: ${score}/${totalQuestions * 250}`);
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
    },
    skipQuestion: () => {
      generateNewQuestion();
    },
    canSkipQuestion: true,
    loadNextPuzzle: () => {
      const nextIndex = currentPuzzleIndex + 1;
      if (nextIndex < puzzleIds.length) {
        setCurrentPuzzleIndex(nextIndex);
        loadQuestionById(puzzleIds[nextIndex]);
      }
    }
  }));

  const fetchQuestions = async () => {
    try {
      setGameState('loading');
      
      const { data, error } = await supabase
        .from('puzzles')
        .select('*')
        .eq('game_id', 3);
      
      if (error) {
        console.error('Supabase error:', error);
        setGameState('error');
        return;
      }
      
      if (!data || data.length === 0) {
        console.error('No questions found');
        setGameState('error');
        return;
      }
      
      console.log(`Loaded ${data.length} questions from Supabase`);
      setQuestions(data);
      
      const ids = data.map(q => q.id);
      setPuzzleIds(ids);
      
      setGameState('playing');
      
    } catch (error) {
      console.error('Error fetching questions:', error);
      setGameState('error');
    }
  };

  const loadQuestionById = (questionId: number) => {
    const question = questions.find(q => q.id === questionId);
    if (!question) return;

    // Clear any existing auto-advance timeout
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }

    if (!question.difficulty) {
      question.difficulty = 'unknown';
    }

    setCurrentQuestion(question);
    setUsedQuestions(prev => [...prev, question.id]);

    const items = question.prompt.split(';').map(item => item.trim());
    setShuffledItems(shuffleArray(items));

    setSelectedItems([]);
    setGameState('playing');
    setMessage('');
    setIsCorrect(false);

    // Resume the timer for the new question
    if (props.onTimerPause) {
      props.onTimerPause(false);
    }
  };

  const generateNewQuestion = () => {
    if (questions.length === 0) return;

    // Clear any existing auto-advance timeout
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }

    let availableQuestions = questions.filter(q => !usedQuestions.includes(q.id));
    if (availableQuestions.length === 0) {
      availableQuestions = questions;
      setUsedQuestions([]);
    }

    const question = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

    if (!question.difficulty) {
      question.difficulty = 'unknown';
    }

    setCurrentQuestion(question);
    setUsedQuestions(prev => [...prev, question.id]);

    const items = question.prompt.split(';').map(item => item.trim());
    setShuffledItems(shuffleArray(items));

    setSelectedItems([]);
    setGameState('playing');
    setMessage('');
    setIsCorrect(false);

    // Resume the timer for the new question
    if (props.onTimerPause) {
      props.onTimerPause(false);
    }
  };

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleItemClick = (item) => {
    if (gameState !== 'playing') return;

    if (selectedItems.includes(item)) {
      // Deselect if already selected
      setSelectedItems(prev => prev.filter(selected => selected !== item));
    } else if (selectedItems.length < 2) {
      // Add if less than 2 selected
      setSelectedItems(prev => [...prev, item]);
    } else {
      // Already have 2 selected - drop the oldest, keep the most recent + add new
      // This assumes the most recent choice is their best choice
      setSelectedItems(prev => [prev[1], item]);
    }
  };

  const checkAnswer = () => {
    if (selectedItems.length !== 2 || !currentQuestion) return;

    const correctAnswer = currentQuestion.correct_answer.split(';').map(item => item.trim());
    const isAnswerCorrect = selectedItems.length === correctAnswer.length &&
      selectedItems.every(item => correctAnswer.includes(item));

    setIsCorrect(isAnswerCorrect);
    setTotalQuestions(prev => prev + 1);

    // Pause the timer while showing feedback
    if (props.onTimerPause) {
      props.onTimerPause(true);
    }

    if (isAnswerCorrect) {
      // Correct - play sound and show feedback immediately
      playSound('correct');
      setScore(prev => {
        const newScore = prev + 250;
        const newTotal = totalQuestions + 1;
        if (props.onScoreUpdate) {
          props.onScoreUpdate(newScore, newTotal * 250);
        }
        return newScore;
      });
      setMessage(successMessages[Math.floor(Math.random() * successMessages.length)]);
      setGameState('result');
      
      // Auto-advance after 10 seconds
      autoAdvanceTimeoutRef.current = window.setTimeout(() => {
        generateNewQuestion();
      }, 10000);
    } else {
      // Wrong - play sound, brief pause before showing correct
      playSound('incorrect');
      const newTotal = totalQuestions + 1;
      if (props.onScoreUpdate) {
        props.onScoreUpdate(score, newTotal * 250);
      }
      
      // 800ms pause before showing correct answer
      setTimeout(() => {
        setGameState('result');
        
        // Then auto-advance after 10 seconds
        autoAdvanceTimeoutRef.current = window.setTimeout(() => {
          generateNewQuestion();
        }, 10000);
      }, 800);
    }
  };

  const playSound = (type: string) => {
    try {
      const audio = new Audio();
      if (type === 'correct') {
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTOH0fPTgjMGHm7A7+OZSA0PVqzn77BfGQc+ltryxnMnBSuAzvPaizsIGGS57OihUBELTKXh8bllHAU2jdXyzn0vBSh+y/HajD4JE1u07+ynVhQKQ5zi8sFuJAUuhM7z1YU1Bhxrvu7mnEwPDlOq5vCyYhsGPJPY88p2KgUme8rx3I4+CRJYsu7sp1cUCkCa4fLFcSYFK4DN89OCNQYaaMDu6KBPEQpJouDwtmQdBTiP1vLPgC8GJ37K8d2PRwoTWrPu7KlYFQlBm+HyvmwhBi1/zfPWhjUGG2vA7umnVRQKQ5vg8rx0KgUqgM3z04MyBhxqvu7mnEwODlOq5vCyYRoGO5PX8sp3KwUme8rx3I0+CRJXsu7spVYVC0Ka4fLDcSYFLIHO8tiHNwgZabvu5p5OEQpJpODwtmQcBjiP1vLPgC8GJ3/L8d2PQQkSWrLu7KlYEwpBm+HyvnAjBSx/zfPWhjUGHGrA7umnVhQLRJvh8rx0KAUqgM3zzYAyBSBuve3mnEwODlOp5vCyYRoGOpPX8sp3KwUme8rx3I0+CRJXsu3tpVYVC0Ka4fLDcSYFLIHO8tiHNwgZabvu5p1NEgpJpODwtWQdBjiP1vLPfy4GKH/L8d2PQQkSWrLu7KlYFApBm+HyvnAjBSx/zfPWhjUGHGrA7umnVhQLRJvh8rx0KAUqgM3zzYAyBhxqwO7ppFQUCkSb4fK8dCgFKoDN88iAMwYcasDs6qNUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1Q=';
      } else {
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgICAgICAgICAgICAgICAgICAgICAgICAgICBhYWFhYWFhYWFhYWFhYWFhYSEhISEhISEhISEhISEhISEhIODg4ODg4ODg4ODg4ODg4ODgoODg4ODg4ODg4ODg4ODg4ODg4KCgoKCgoKCgoKCgoKCgoKCgoGBgYGBgYGBgYGBgYGBgYGBgYCAgICAgICAgICAgICAgICAgIB/f39/f39/f39/f39/f39/f35+fn5+fn5+fn5+fn5+fn5+fX19fX19fX19fX19fX19fX18fHx8fHx8fHx8fHx8fHx8fHt7e3t7e3t7e3t7e3t7e3t7enp6enp6enp6enp6enp6enp5eXl5eXl5eXl5eXl5eXl5eXh4eHh4eHh4eHh4eHh4eHh4d3d3d3d3d3d3d3d3d3d3d3d2dnZ2dnZ2dnZ2dnZ2dnZ2dXV1dXV1dXV1dXV1dXV1dXV0dHR0dHR0dHR0dHR0dHR0dHNzc3Nzc3Nzc3Nzc3Nzc3NycnJycnJycnJycnJycnJycXFxcXFxcXFxcXFxcXFxcXBwcHBwcHBwcHBwcHBwcHBvb29vb29vb29vb29vb29ubm5ubm5ubm5ubm5ubm5uBgUFBQUFBQUFBQUFBQUFBgYGBgYGBgYGBgYGBgYGBwcHBwcHBwcHBwcHBwcHCAgICAgICAgICAgICAgICAkJCQkJCQkJCQkJCQkJCQoKCgoKCgoKCgoKCgoKCgsLCwsLCwsLCwsLCwsLCwwMDAwMDAwMDAwMDAwMDA0NDQ0NDQ0NDQ0NDQ0NDQ4ODg4ODg4ODg4ODg4ODg8PDw8PDw8PDw8PDw8PDxAQEBAQEBAQEBAQEBAQEBEREREREREREREREREREREQEBAQEBAQEBAQEBAQEBAPDw8PDw8PDw8PDw8PDw8ODg4ODg4ODg4ODg4ODg4NDQ0NDQ0NDQ0NDQ0NDQ0MDAwMDAwMDAwMDAwMDAsLCwsLCwsLCwsLCwsLCwoKCgoKCgoKCgoKCgoKCQkJCQkJCQkJCQkJCQkJCAgICAgICAgICAgICAgIBwcHBwcHBwcHBwcHBwcHBgYGBgYGBgYGBgYGBgYGBQUFBQUFBQUFBQUFBQUF';
      }
      audio.volume = 0.3;
      audio.play().catch(err => console.log('Audio play failed:', err));
    } catch (err) {
      console.log('Audio error:', err);
    }
  };

  useEffect(() => {
    fetchQuestions();
    
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (questions.length > 0 && !currentQuestion && gameState === 'playing') {
      generateNewQuestion();
    }
  }, [questions, currentQuestion, gameState]);

  if (gameState === 'loading') {
    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
        <div className="text-lg">🎯 Loading questions...</div>
        <div className="text-sm text-purple-300 mt-2">Connecting to database</div>
      </div>
    );
  }

  if (gameState === 'error') {
    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
        <div className="text-lg text-red-400">❌ Error loading questions</div>
        <div className="text-sm text-purple-300 mt-2">Check your Supabase connection</div>
        <button
          onClick={fetchQuestions}
          className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all border-2 border-blue-400"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
        <div className="text-lg">🎯 Getting ready...</div>
      </div>
    );
  }

  const correctAnswer = currentQuestion.correct_answer.split(';').map(item => item.trim());

  return (
    <div className="text-center max-w-2xl mx-auto p-3 sm:p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
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

      <div className="mb-3 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2 drop-shadow-lg">
          🎯 Odd Man Out
        </h2>
        <p className="text-purple-300 text-xs sm:text-sm mb-2 sm:mb-4">
          Pick the TWO items that don't belong with the others!
        </p>
      </div>

      {/* Items grid - stays in same position */}
      <div className="mb-3 sm:mb-6">
        <div className="grid grid-cols-1 gap-2 sm:gap-3">
          {shuffledItems.map((item, index) => {
            const isSelected = selectedItems.includes(item);
            const isCorrectItem = correctAnswer.includes(item);
            const showFeedback = gameState === 'result';

            let buttonClass = "p-2.5 sm:p-4 rounded-xl text-sm sm:text-base font-medium text-left transition-all duration-200";

            if (showFeedback) {
              // Result state - full feedback
              if (isCorrectItem) {
                buttonClass += " bg-green-500/30 border-4 border-green-500 animate-pulse shadow-lg shadow-green-500/50 text-white";
              } else if (isSelected) {
                buttonClass += " bg-red-500/30 border-2 border-red-500 animate-pulse-twice shadow-lg shadow-red-500/50 text-white";
              } else {
                buttonClass += " bg-white/5 border-2 border-purple-500/10 opacity-30 text-gray-300";
              }
            } else if (selectedItems.length > 0 && !isCorrect && gameState !== 'playing') {
              // Intermediate 800ms pause - show red on wrong selections only
              if (isSelected) {
                buttonClass += " bg-red-500/30 border-2 border-red-500 animate-pulse-twice shadow-lg shadow-red-500/50 text-white";
              } else {
                buttonClass += " bg-white/10 border-2 border-purple-500/30 opacity-50 text-white";
              }
            } else {
              // Playing state - normal or selected
              if (isSelected) {
                buttonClass += " bg-blue-500/20 border-2 border-blue-400 text-blue-300 shadow-lg shadow-blue-500/25";
              } else {
                buttonClass += " bg-white/10 border-2 hover:bg-white/20 text-white border-purple-500/30 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/25";
              }
            }

            return (
              <button
                key={index}
                onClick={() => handleItemClick(item)}
                disabled={gameState !== 'playing'}
                className={`${buttonClass} ${gameState === 'playing' && !isSelected && selectedItems.length < 2 ? 'hover:scale-102 active:scale-98' : ''} ${gameState !== 'playing' ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {/* Your Answer - stays visible and frozen */}
      <div className="mb-3 sm:mb-6">
        <h4 className="text-xs sm:text-sm font-medium text-purple-300 mb-1 sm:mb-2">Your Answer:</h4>
        <div className="min-h-10 sm:min-h-12 bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-xl p-2 sm:p-3">
          {selectedItems.length === 0 ? (
            <span className="text-purple-400 text-xs sm:text-sm">Select 2 items that don't belong...</span>
          ) : (
            <div className="text-xs sm:text-sm">
              <strong className="text-white">{selectedItems.join(' & ')}</strong>
              {gameState === 'playing' && selectedItems.length < 2 && (
                <span className="text-purple-400 ml-2">
                  (Select {2 - selectedItems.length} more)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Check Answer button or Placeholder - always takes up space */}
      {gameState === 'playing' ? (
        <button
          onClick={checkAnswer}
          disabled={selectedItems.length !== 2}
          className={`
            w-full py-3 sm:py-4 px-4 sm:px-6 rounded-xl text-sm sm:text-base font-semibold text-white transition-all border-2 mb-3 sm:mb-6
            ${selectedItems.length === 2
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-blue-400 hover:shadow-lg hover:shadow-blue-500/25 active:scale-98'
              : 'bg-gray-600 border-gray-500 cursor-not-allowed opacity-50'
            }
          `}
        >
          {selectedItems.length === 2 ? '🎯 Check Answer' : `Select ${2 - selectedItems.length} more item${2 - selectedItems.length === 1 ? '' : 's'}`}
        </button>
      ) : (
        // Invisible placeholder that takes up the same space as the button
        <div className="w-full py-3 sm:py-4 px-4 sm:px-6 mb-3 sm:mb-6 opacity-0">
          <div className="text-sm sm:text-base">Placeholder</div>
        </div>
      )}

      {/* Explanation card area - always rendered to reserve space */}
      {gameState === 'result' ? (
        <div className={`
          p-3 sm:p-4 rounded-xl border-2 shadow-lg backdrop-blur-sm
          ${isCorrect
            ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border-green-400 shadow-green-500/25'
            : 'bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-300 border-red-400 shadow-red-500/25'
          }
        `}>
          {/* Show success message only if correct */}
          {isCorrect && (
            <div className="text-base sm:text-lg font-bold mb-2">
              {message}
            </div>
          )}
          
          {/* Show correct answer with label */}
          <div className="text-xs sm:text-sm mb-2">
            <strong>Correct Answer:</strong> <span className="text-white">{correctAnswer.join(' & ')}</span>
          </div>
          
          {/* Logic explanation */}
          <div className="text-xs sm:text-sm bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-2 sm:p-3">
            <span className="text-gray-200">
              {currentQuestion.metadata && (
                typeof currentQuestion.metadata === 'string' 
                  ? (() => {
                      try {
                        const parsed = JSON.parse(currentQuestion.metadata);
                        return parsed.logic || 'Think about what makes them different!';
                      } catch (e) {
                        return 'Think about what makes them different!';
                      }
                    })()
                  : currentQuestion.metadata.logic || 'Think about what makes them different!'
              )}
            </span>
          </div>
        </div>
      ) : (
        // Invisible placeholder that reserves space for the feedback card
        <div className="p-3 sm:p-4 rounded-xl border-2 opacity-0 pointer-events-none">
          <div className="text-base sm:text-lg font-bold mb-2">Placeholder message</div>
          <div className="text-xs sm:text-sm mb-2">
            <strong>Correct Answer:</strong> <span>Placeholder & Placeholder</span>
          </div>
          <div className="text-xs sm:text-sm bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-2 sm:p-3">
            <span>Placeholder explanation text that takes up space</span>
          </div>
        </div>
      )}
    </div>
  );
});

OddManOut.displayName = 'OddManOut';

export default OddManOut;