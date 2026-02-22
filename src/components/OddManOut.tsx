/**
 * OddManOut.tsx - UPDATED FOR PLAYLIST SYSTEM with Multi-Puzzle Support
 * FIXED HEADER: Matches SplitDecision layout (compact, name left, score right)
 */

import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { CircleX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GameHandle } from '../lib/gameTypes';
import { audioManager } from '../lib/audioManager';

interface OddManOutProps {
  puzzleId?: number | null;
  puzzleIds?: number[] | null;  // NEW: Array of puzzle IDs
  rankingPuzzleId?: number | null;
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onTimerPause?: (paused: boolean) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
  duration?: number;
}

const MAX_QUESTIONS = 4;

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
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const autoAdvanceTimeoutRef = React.useRef<number | null>(null);
  const onCompleteRef = React.useRef(props.onComplete);

  React.useEffect(() => {
    onCompleteRef.current = props.onComplete;
  }, [props.onComplete]);

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
      maxScore: MAX_QUESTIONS * 250
    }),
    onGameEnd: () => {
      console.log('OddManOut: onGameEnd called (time ran out)');
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
      const callback = onCompleteRef.current;
      console.log('OddManOut: Time up! Calling onComplete with score:', score);
      if (callback) {
        callback(score, MAX_QUESTIONS * 250, props.timeRemaining);
      }
    },
    skipQuestion: () => {
      generateNewQuestion();
    },
    canSkipQuestion: true,
    pauseTimer: gameState === 'result' && !isGameComplete,
    loadNextPuzzle: () => {
      const nextIndex = currentPuzzleIndex + 1;
      if (nextIndex < questions.length) {
        setCurrentPuzzleIndex(nextIndex);
        loadQuestionById(questions[nextIndex].id);
      }
    }
  }), [score, gameState, currentPuzzleIndex, questions, isGameComplete, props.timeRemaining]);

  const fetchQuestions = async () => {
    try {
      setGameState('loading');
      
      // NEW: Multiple puzzle IDs mode (playlist with array)
      if (props.puzzleIds && Array.isArray(props.puzzleIds) && props.puzzleIds.length > 0) {
        console.log('🎯 OddManOut: Loading specific puzzles from array:', props.puzzleIds);
        
        const { data, error } = await supabase
          .from('puzzles')
          .select('*')
          .in('id', props.puzzleIds);
        
        if (error) {
          console.error('Supabase error loading puzzles:', error);
          await loadRandomPuzzles();
          return;
        }
        
        if (!data || data.length === 0) {
          console.error('No puzzles found with ids:', props.puzzleIds);
          await loadRandomPuzzles();
          return;
        }
        
        console.log(`✅ OddManOut: Loaded ${data.length} playlist puzzles`);
        setQuestions(data);
        setGameState('playing');
        return;
      }
      
      // SINGLE PUZZLE MODE (old behavior - repeats 3x)
      if (props.puzzleId) {
        console.log('🎯 OddManOut: Loading single puzzle:', props.puzzleId);
        
        const { data, error } = await supabase
          .from('puzzles')
          .select('*')
          .eq('id', props.puzzleId)
          .single();
        
        if (error) {
          console.error('Supabase error loading puzzle:', error);
          await loadRandomPuzzles();
          return;
        }
        
        if (!data) {
          console.error('No puzzle found with id:', props.puzzleId);
          await loadRandomPuzzles();
          return;
        }
        
        console.log('✅ OddManOut: Loaded single playlist puzzle (will repeat 3x):', data);
        setQuestions([data, data, data]);
        setGameState('playing');
        return;
      }
      
      // RANDOM MODE (backwards compatibility)
      await loadRandomPuzzles();
      
    } catch (error) {
      console.error('Error fetching questions:', error);
      setGameState('error');
    }
  };

  const loadRandomPuzzles = async () => {
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
    
    console.log(`✅ OddManOut: Loaded ${data.length} random questions from Supabase`);
    setQuestions(data);
    setGameState('playing');
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

    audioManager.play('oddman-select');

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
    const newTotalQuestions = totalQuestions + 1;
    setTotalQuestions(newTotalQuestions);

    console.log('OddManOut: Question answered', {
      questionNum: newTotalQuestions,
      isCorrect: isAnswerCorrect,
      isLastQuestion: newTotalQuestions >= MAX_QUESTIONS,
      puzzleId: props.puzzleId || props.puzzleIds || 'random'
    });

    if (props.onTimerPause) {
      props.onTimerPause(true);
    }

    if (isAnswerCorrect) {
      audioManager.play('oddman-win');
      const newScore = score + 250;
      setScore(newScore);
      
      if (props.onScoreUpdate) {
        props.onScoreUpdate(newScore, MAX_QUESTIONS * 250);
      }
      
      setMessage(successMessages[Math.floor(Math.random() * successMessages.length)]);
      setGameState('result');

      if (newTotalQuestions >= MAX_QUESTIONS) {
        console.log('OddManOut: ✅ LAST QUESTION (CORRECT) - Calling onComplete after delay');
        setIsGameComplete(true);
        autoAdvanceTimeoutRef.current = window.setTimeout(() => {
          const callback = onCompleteRef.current;
          if (callback) {
            callback(newScore, MAX_QUESTIONS * 250, props.timeRemaining);
          }
        }, 6000);
      } else {
        console.log('OddManOut: Correct answer, moving to question', newTotalQuestions + 1, 'after 6s');
        autoAdvanceTimeoutRef.current = window.setTimeout(() => {
          generateNewQuestion();
        }, 6000);
      }
    } else {
      audioManager.play('global-wrong');

      if (props.onScoreUpdate) {
        props.onScoreUpdate(score, MAX_QUESTIONS * 250);
      }

      setTimeout(() => {
        setGameState('result');

        if (newTotalQuestions >= MAX_QUESTIONS) {
          console.log('OddManOut: ❌ LAST QUESTION (WRONG) - Calling onComplete after delay');
          setIsGameComplete(true);
          autoAdvanceTimeoutRef.current = window.setTimeout(() => {
            const callback = onCompleteRef.current;
            if (callback) {
              callback(score, MAX_QUESTIONS * 250, props.timeRemaining);
            }
          }, 6000);
        } else {
          console.log('OddManOut: Wrong answer, moving to question', newTotalQuestions + 1, 'after 6s');
          autoAdvanceTimeoutRef.current = window.setTimeout(() => {
            generateNewQuestion();
          }, 6000);
        }
      }, 800);
    }
  };

  useEffect(() => {
    const loadAudio = async () => {
      await audioManager.loadSound('oddman-select', '/sounds/ranky/select_optimized.mp3', 3);
      await audioManager.loadSound('oddman-win', '/sounds/global/win_optimized.mp3', 2);
      await audioManager.loadSound('global-wrong', '/sounds/global/wrong_optimized.mp3', 2);
    };
    loadAudio();
  }, []);

  useEffect(() => {
    fetchQuestions();
    
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, [props.puzzleId, props.puzzleIds]);

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
            <CircleX className="inline-block w-5 h-5 mr-2" style={{ filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))' }} />
            Loading puzzle...
          </div>
          {(props.puzzleId || props.puzzleIds) && (
            <div className="text-xs text-purple-300 mt-2">
              {props.puzzleIds ? `Loading ${props.puzzleIds.length} puzzles` : `Puzzle ID: ${props.puzzleId}`}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'error') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-white">
          <div className="text-lg text-red-500" style={{ textShadow: '0 0 10px #ff0066' }}>❌ Error loading puzzle</div>
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
            <CircleX className="inline-block w-5 h-5 mr-2" style={{ filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))' }} />
            Getting ready...
          </div>
        </div>
      </div>
    );
  }

  const correctAnswer = currentQuestion.correct_answer.split(';').map(item => item.trim());

  return (
    <div className="min-h-screen bg-black flex items-start justify-center p-3 sm:p-4 pt-3 sm:pt-4">
      <div className="text-center max-w-2xl w-full text-white space-y-3">
        {/* Header - single line, compact (matches SplitDecision) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CircleX
              className="w-4 h-4 sm:w-5 sm:h-5"
              style={{
                color: '#a855f7',
                filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))',
                strokeWidth: 2
              }}
            />
            <h2 className="text-xs sm:text-sm font-bold text-purple-400" style={{ textShadow: '0 0 10px #a855f7' }}>Odd Man Out</h2>
          </div>
          <div className="text-purple-300 text-xs sm:text-sm">
            Score: <strong className="text-yellow-400 tabular-nums">{score}</strong>
          </div>
        </div>

        {/* Item options grid */}
        <div>
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

        {/* Your Answer display */}
        <div>
          <h4 className="text-xs sm:text-sm font-medium text-purple-300 mb-1 text-left">Your Answer:</h4>
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

        {/* Check Answer / Result */}
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
              p-2 sm:p-3 rounded-lg border-2 animate-fade-in-up
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