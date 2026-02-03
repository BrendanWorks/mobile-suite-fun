import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Sparkles } from 'lucide-react';
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

    if (props.onTimerPause) {
      props.onTimerPause(false);
    }
  };

  const generateNewQuestion = () => {
    if (questions.length === 0) return;

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
      setSelectedItems(prev => prev.filter(selected => selected !== item));
    } else if (selectedItems.length < 2) {
      setSelectedItems(prev => [...prev, item]);
    } else {
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

    if (props.onTimerPause) {
      props.onTimerPause(true);
    }

    if (isAnswerCorrect) {
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
      
      autoAdvanceTimeoutRef.current = window.setTimeout(() => {
        generateNewQuestion();
      }, 10000);
    } else {
      playSound('incorrect');
      const newTotal = totalQuestions + 1;
      if (props.onScoreUpdate) {
        props.onScoreUpdate(score, newTotal * 250);
      }
      
      setTimeout(() => {
        setGameState('result');
        
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
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTOH0fPTgjMGHm7A7+OZSA0PVqzn77BfGQc+ltryxnMnBSuAzvPaizsIGGS57OihUBELTKXh8bllHAU2jdXyzn0vBSh+y/HajD4JE1u07+ynVhQKQ5zi8sFuJAUuhM7z1YU1Bhxrvu7mnEwPDlOq5vCyYhsGPJPY88p2KgUme8rx3I4+CRJYsu7sp1cUCkCa4fLFcSYFK4DN89OCNQYaaMDu6KBPEQpJouDwtmQdBTiP1vLPgC8GJ37K8d2PRwoTWrPu7KlYFQlBm+HyvmwhBi1/zfPWhjUGG2vA7umnVRQKQ5vg8rx0KgUqgM3z04MyBhxqvu7mnEwODlOq5vCyYRoGO5PX8sp3KwUme8rx3I0+CRJXsu7spVYVC0Ka4fLDcSYFLIHO8tiHNwgZabvu5p5OEQpJpODwtmQcBjiP1vLPgC8GJ3/L8d2PQQkSWrLu7KlYEwpBm+HyvnAjBSx/zfPWhjUGHGrA7umnVhQLRJvh8rx0KAUqgM3zzYAyBSBuve3mnEwODlOp5vCyYRoGOpPX8sp3KwUme8rx3I0+CRJXsu3tpVYVC0Ka4fLDcSYFLIHO8tiHNwgZabvu5p1NEgpJpODwtWQdBjiP1vLPfy4GKH/L8d2PQQkSWrLu7KlYFApBm+HyvnAjBSx/zfPWhjUGHGrA7umnVhQLRJvh8rx0KAUqgM3zzYAyBhxqwO7ppFQUCkSb4fK8dCgFKoDN88iAMwYcasDs6qNUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1Q=';
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
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-purple-400">
          <div className="text-lg" style={{ textShadow: '0 0 10px #a855f7' }}>
            <Sparkles className="inline-block w-5 h-5 mr-2" style={{ filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))' }} />
            Loading questions...
          </div>
          <div className="text-sm text-purple-300 mt-2">Connecting to database</div>
        </div>
      </div>
    );
  }

  if (gameState === 'error') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-white">
          <div className="text-lg text-red-500" style={{ textShadow: '0 0 10px #ff0066' }}>❌ Error loading questions</div>
          <div className="text-sm text-purple-300 mt-2">Check your Supabase connection</div>
          <button
            onClick={fetchQuestions}
            className="mt-4 px-6 py-3 bg-transparent border-2 border-purple-400 text-purple-400 rounded-lg font-semibold hover:bg-purple-400 hover:text-black transition-all"
            style={{ textShadow: '0 0 8px #a855f7', boxShadow: '0 0 15px rgba(168, 85, 247, 0.3)' }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-purple-400">
          <div className="text-lg" style={{ textShadow: '0 0 10px #a855f7' }}>
            <Sparkles className="inline-block w-5 h-5 mr-2" style={{ filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))' }} />
            Getting ready...
          </div>
        </div>
      </div>
    );
  }

  const correctAnswer = currentQuestion.correct_answer.split(';').map(item => item.trim());

  return (
    <div className="min-h-screen bg-black flex items-start justify-center p-2 pt-4">
      <div className="text-center max-w-2xl w-full text-white">
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
        {/* Header with Sparkles icon */}
        <h2 className="text-xl sm:text-2xl font-bold text-purple-400 mb-1 border-b border-purple-400 pb-1 flex items-center justify-center gap-2">
          <Sparkles 
            className="w-6 h-6 sm:w-7 sm:h-7" 
            style={{ 
              color: '#a855f7',
              filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))',
              strokeWidth: 2
            }} 
          />
          <span style={{ textShadow: '0 0 10px #a855f7' }}>Odd Man Out</span>
        </h2>
        
        {/* Updated tagline */}
        <p className="text-purple-300 text-xs sm:text-sm mb-2 sm:mb-4">
          Spot the Oddballs
        </p>

        {/* Score - left aligned like Zooma */}
        <div className="flex justify-start items-center mb-2 sm:mb-4 text-xs sm:text-sm">
          <div className="text-purple-300">
            Score: <strong className="text-yellow-400 tabular-nums">{score}</strong>
          </div>
        </div>
      </div>

      {/* Items grid */}
      <div className="mb-2 sm:mb-4">
        <div className="grid grid-cols-1 gap-2">
          {shuffledItems.map((item, index) => {
            const isSelected = selectedItems.includes(item);
            const isCorrectItem = correctAnswer.includes(item);
            const showFeedback = gameState === 'result';

            let buttonClass = "p-2.5 sm:p-3 rounded-lg text-sm sm:text-base font-medium text-left transition-all duration-200 border-2";

            if (showFeedback) {
              if (isCorrectItem) {
                buttonClass += " bg-green-500/20 border-green-500 animate-pulse text-white";
              } else if (isSelected) {
                buttonClass += " bg-red-500/20 border-red-500 animate-pulse-twice text-white";
              } else {
                buttonClass += " bg-black/50 border-purple-400/20 opacity-30 text-gray-500";
              }
            } else if (selectedItems.length > 0 && !isCorrect && gameState !== 'playing') {
              if (isSelected) {
                buttonClass += " bg-red-500/20 border-red-500 animate-pulse-twice text-white";
              } else {
                buttonClass += " bg-black/50 border-purple-400/30 opacity-50 text-white";
              }
            } else {
              if (isSelected) {
                buttonClass += " bg-purple-500/20 border-purple-400 text-purple-300";
              } else {
                buttonClass += " bg-black/50 hover:bg-purple-500/10 text-white border-purple-400/30 hover:border-purple-400";
              }
            }

            const glowStyle = showFeedback && isCorrectItem ? { boxShadow: '0 0 15px rgba(34, 197, 94, 0.5)' } :
                             showFeedback && isSelected && !isCorrectItem ? { boxShadow: '0 0 15px rgba(239, 68, 68, 0.5)' } :
                             isSelected && gameState === 'playing' ? { boxShadow: '0 0 10px rgba(168, 85, 247, 0.3)' } : {};

            return (
              <button
                key={index}
                onClick={() => handleItemClick(item)}
                disabled={gameState !== 'playing'}
                className={buttonClass}
                style={glowStyle}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {/* Your Answer */}
      <div className="mb-2 sm:mb-4">
        <h4 className="text-xs sm:text-sm font-medium text-purple-300 mb-1">Your Answer:</h4>
        <div className="min-h-10 sm:min-h-12 bg-black/80 border-2 border-purple-400/50 rounded-lg p-2 sm:p-3" style={{ boxShadow: '0 0 10px rgba(168, 85, 247, 0.2)' }}>
          {selectedItems.length === 0 ? (
            <span className="text-purple-400/60 text-xs sm:text-sm">Select 2 items that don't belong...</span>
          ) : (
            <div className="text-xs sm:text-sm">
              <strong className="text-purple-300">{selectedItems.join(' & ')}</strong>
              {gameState === 'playing' && selectedItems.length < 2 && (
                <span className="text-purple-400/70 ml-2">
                  (Select {2 - selectedItems.length} more)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Button/Feedback container */}
      <div>
        {gameState === 'playing' && (
          <button
            onClick={checkAnswer}
            disabled={selectedItems.length !== 2}
            className={`
              w-full py-3 sm:py-4 px-4 sm:px-6 rounded-lg text-sm sm:text-base font-semibold transition-all border-2
              ${selectedItems.length === 2
                ? 'bg-transparent border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-black'
                : 'bg-black/50 border-purple-400/30 text-purple-400/40 cursor-not-allowed'
              }
            `}
            style={selectedItems.length === 2 ? { textShadow: '0 0 8px #a855f7', boxShadow: '0 0 15px rgba(168, 85, 247, 0.3)' } : {}}
          >
            {selectedItems.length === 2 ? '✨ Check Answer' : `Select ${2 - selectedItems.length} more item${2 - selectedItems.length === 1 ? '' : 's'}`}
          </button>
        )}

        {gameState === 'result' && (
          <div className={`
            p-2 sm:p-3 rounded-lg border-2
            ${isCorrect
              ? 'bg-green-500/20 text-green-400 border-green-500'
              : 'bg-red-500/20 text-red-400 border-red-500'
            }
          `}
          style={{
            boxShadow: isCorrect ? '0 0 20px rgba(34, 197, 94, 0.4)' : '0 0 20px rgba(239, 68, 68, 0.4)'
          }}>
            {isCorrect && (
              <div className="text-base sm:text-lg font-bold mb-1.5">
                {message}
              </div>
            )}

            {!isCorrect && (
              <div className="text-xs sm:text-sm mb-1.5">
                <strong>Correct Answer:</strong> <span className="text-white">{correctAnswer.join(' & ')}</span>
              </div>
            )}

            <div className="text-xs sm:text-sm bg-black/40 border border-white/20 rounded-lg p-2">
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
        )}
      </div>
      </div>
    </div>
  );
});

OddManOut.displayName = 'OddManOut';

export default OddManOut;