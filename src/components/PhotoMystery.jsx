import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Star, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

const PhotoMystery = forwardRef((props, ref) => {
  const { onScoreUpdate, onComplete, puzzleId, puzzleIds, rankingPuzzleId } = props;
  const [questions, setQuestions] = useState([]);
  const [gameState, setGameState] = useState('loading');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(2.5);
  const [points, setPoints] = useState(333);
  const [correctCount, setCorrectCount] = useState(0);
  const [usedQuestions, setUsedQuestions] = useState([]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [currentPhotoNumber, setCurrentPhotoNumber] = useState(1);
  const [elapsedTime, setElapsedTime] = useState(0);

  const timerRef = useRef(null);
  const resultTimerRef = useRef(null);
  const startTimeRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  const onScoreUpdateRef = useRef(onScoreUpdate);
  const correctCountRef = useRef(0);
  const hasCalledOnCompleteRef = useRef(false);

  const maxPoints = 333;
  const minPoints = 0;
  const photoDuration = 15;
  const totalPhotos = 3;
  const maxZoom = 2.5;
  const minZoom = 1.0;

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onScoreUpdateRef.current = onScoreUpdate;
  }, [onScoreUpdate]);

  useEffect(() => {
    correctCountRef.current = correctCount;
  }, [correctCount]);

  useImperativeHandle(ref, () => ({
    hideTimer: true,
    getGameScore: () => ({
      score: correctCountRef.current,
      maxScore: totalPhotos
    }),
    onGameEnd: () => {
      if (hasCalledOnCompleteRef.current) return;
      clearInterval(timerRef.current);
      clearTimeout(resultTimerRef.current);
      const callback = onCompleteRef.current;
      const finalCorrect = correctCountRef.current;
      if (callback) {
        hasCalledOnCompleteRef.current = true;
        callback(finalCorrect, totalPhotos);
      }
    },
    skipQuestion: () => {
      nextQuestion();
    },
    canSkipQuestion: true,
    loadNextPuzzle: () => {
      const nextIndex = currentPuzzleIndex + 1;
      if (nextIndex < questions.length) {
        setCurrentPuzzleIndex(nextIndex);
        loadQuestionById(questions[nextIndex].id);
      }
    },
    startPlaying: () => {
      if (gameState !== 'playing') {
        setGameState('playing');
        startGame();
      }
    }
  }));

  const fetchQuestions = async () => {
    try {
      setGameState('loading');

      // NEW: Check for multiple puzzle IDs first (playlist mode with array)
      if (puzzleIds && Array.isArray(puzzleIds) && puzzleIds.length > 0) {
        const { data, error } = await supabase
          .from('puzzles')
          .select('*')
          .in('id', puzzleIds)
          .in('game_type', ['multiple_choice', 'photo_mystery']);

        if (error || !data || data.length === 0) {
          setGameState('error');
          return;
        }

        const validQuestions = data.filter(q => {
          const hasImageUrl = q.prompt && (q.prompt.startsWith('http://') || q.prompt.startsWith('https://'));
          const hasOptions = q.metadata && (
            (typeof q.metadata === 'object' && q.metadata.options && Array.isArray(q.metadata.options)) ||
            (typeof q.metadata === 'string' && q.metadata.includes('options'))
          );
          return hasImageUrl && hasOptions;
        });

        if (validQuestions.length === 0) {
          setGameState('error');
          return;
        }

        setQuestions(validQuestions);
        
        const firstQuestion = validQuestions[0];
        if (!firstQuestion.difficulty) {
          firstQuestion.difficulty = 'unknown';
        }
        setCurrentQuestion(firstQuestion);
        setUsedQuestions([firstQuestion.id]);
        setSelectedAnswer(null);
        setZoomLevel(maxZoom);
        setPoints(maxPoints);
        setElapsedTime(0);
        setCurrentPhotoNumber(1);

        setGameState('playing');
        setTimeout(() => startGame(), 100);
        return;
      }

      // SINGLE PUZZLE MODE (old behavior - repeats 3x)
      if (puzzleId) {
        const { data, error } = await supabase
          .from('puzzles')
          .select('*')
          .eq('id', puzzleId)
          .single();

        if (error || !data) {
          setGameState('error');
          return;
        }

        setQuestions([data, data, data]);
        
        const firstQuestion = data;
        if (!firstQuestion.difficulty) {
          firstQuestion.difficulty = 'unknown';
        }
        setCurrentQuestion(firstQuestion);
        setUsedQuestions([firstQuestion.id]);
        setSelectedAnswer(null);
        setZoomLevel(maxZoom);
        setPoints(maxPoints);
        setElapsedTime(0);
        setCurrentPhotoNumber(1);

        setGameState('playing');
        setTimeout(() => startGame(), 100);
        return;
      }

      // RANDOM MODE (no puzzle ID provided)
      let query = supabase
        .from('puzzles')
        .select('*')
        .eq('game_id', 4)
        .in('game_type', ['multiple_choice', 'photo_mystery']);

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        setGameState('error');
        return;
      }

      const validQuestions = data.filter(q => {
        const hasImageUrl = q.prompt && (q.prompt.startsWith('http://') || q.prompt.startsWith('https://'));
        const hasOptions = q.metadata && (
          (typeof q.metadata === 'object' && q.metadata.options && Array.isArray(q.metadata.options)) ||
          (typeof q.metadata === 'string' && q.metadata.includes('options'))
        );
        return hasImageUrl && hasOptions;
      });

      if (validQuestions.length === 0) {
        setGameState('error');
        return;
      }

      setQuestions(validQuestions);

      if (validQuestions.length > 0) {
        const firstQuestion = validQuestions[0];
        if (!firstQuestion.difficulty) {
          firstQuestion.difficulty = 'unknown';
        }
        setCurrentQuestion(firstQuestion);
        setUsedQuestions([firstQuestion.id]);
        setSelectedAnswer(null);
        setZoomLevel(maxZoom);
        setPoints(maxPoints);
        setElapsedTime(0);
        setCurrentPhotoNumber(1);

        setGameState('playing');
        setTimeout(() => startGame(), 100);
      }

    } catch {
      setGameState('error');
    }
  };

  const loadQuestionById = (questionId) => {
    const question = questions.find(q => q.id === questionId);
    if (!question) return;

    if (!question.difficulty) {
      question.difficulty = 'unknown';
    }

    setCurrentQuestion(question);
    setUsedQuestions(prev => [...prev, question.id]);
    setSelectedAnswer(null);
    setZoomLevel(maxZoom);
    setPoints(maxPoints);
    setElapsedTime(0);
    setGameState('playing');
    setTimeout(() => startGame(), 100);
  };

  const generateNewQuestion = () => {
    if (questions.length === 0) return;

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
    setSelectedAnswer(null);
    setZoomLevel(maxZoom);
    setPoints(maxPoints);
    setElapsedTime(0);
    setGameState('playing');

    setTimeout(() => startGame(), 100);
  };

  const startGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setElapsedTime(elapsed);

      if (elapsed >= photoDuration) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setElapsedTime(photoDuration);

        handleTimeUp();
        return;
      }

      const progress = elapsed / photoDuration;
      const currentZoom = maxZoom - (progress * (maxZoom - minZoom));
      setZoomLevel(Math.max(minZoom, currentZoom));

      const currentPoints = maxPoints - (progress * (maxPoints - minPoints));
      setPoints(Math.max(minPoints, currentPoints));
    }, 100);
  };

  const handleTimeUp = () => {
    if (gameState !== 'playing') return;

    setIsCorrect(false);
    setSelectedAnswer(null);
    setGameState('result');

    if (onScoreUpdateRef.current) {
      onScoreUpdateRef.current(correctCount, totalPhotos);
    }

    if (currentPhotoNumber >= totalPhotos) {
      completeGame();
    } else {
      resultTimerRef.current = setTimeout(() => {
        setCurrentPhotoNumber(currentPhotoNumber + 1);
        generateNewQuestion();
      }, 2500);
    }
  };

  const handleAnswerSelect = (answer) => {
    if (gameState !== 'playing') return;

    setSelectedAnswer(answer);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const correct = answer === currentQuestion.correct_answer;
    setIsCorrect(correct);

    if (correct) {
      const newCorrectCount = correctCount + 1;
      setCorrectCount(newCorrectCount);

      if (onScoreUpdateRef.current) {
        onScoreUpdateRef.current(newCorrectCount, totalPhotos);
      }

      playSound('correct');
      setGameState('result');

      if (currentPhotoNumber >= totalPhotos) {
        completeGame();
      } else {
        resultTimerRef.current = setTimeout(() => {
          setCurrentPhotoNumber(currentPhotoNumber + 1);
          generateNewQuestion();
        }, 2500);
      }
    } else {
      if (onScoreUpdateRef.current) {
        onScoreUpdateRef.current(correctCount, totalPhotos);
      }

      playSound('incorrect');

      setTimeout(() => {
        setGameState('result');

        if (currentPhotoNumber >= totalPhotos) {
          completeGame();
        } else {
          resultTimerRef.current = setTimeout(() => {
            setCurrentPhotoNumber(currentPhotoNumber + 1);
            generateNewQuestion();
          }, 2500);
        }
      }, 800);
    }
  };

  const playSound = (type) => {
    try {
      const audio = new Audio();
      if (type === 'correct') {
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTOH0fPTgjMGHm7A7+OZSA0PVqzn77BfGQc+ltryxnMnBSuAzvPaizsIGGS57OihUBELTKXh8bllHAU2jdXyzn0vBSh+y/HajD4JE1u07+ynVhQKQ5zi8sFuJAUuhM7z1YU1Bhxrvu7mnEwPDlOq5vCyYhsGPJPY88p2KgUme8rx3I4+CRJYsu7sp1cUCkCa4fLFcSYFLIHO8tiHNwgZabvu5p5OEQpJpODwtmQdBjiP1vLPgC8GJ37K8d2PQQkSWrLu7KlYFQpBm+HyvnAjBSx/zfPWhjUGHGrA7umnVhQLRJvh8rx0KAUqgM3zzYAyBhxqwO7ppFQUCkSb4fK8dCgFKoDN88iAMwYcasDs6qNUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1Q=';
      } else {
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgICAgICAgICAgICAgICAgICAgICAgICAgICBhYWFhYWFhYWFhYWFhYWFhYSEhISEhISEhISEhISEhISEhIODg4ODg4ODg4ODg4ODg4ODgoODg4ODg4ODg4ODg4ODg4ODg4KCgoKCgoKCgoKCgoKCgoKCgoGBgYGBgYGBgYGBgYGBgYGBgYCAgICAgICAgICAgICAgICAgIB/f39/f39/f39/f39/f39/f35+fn5+fn5+fn5+fn5+fn5+fX19fX19fX19fX19fX19fX18fHx8fHx8fHx8fHx8fHx8fHt7e3t7e3t7e3t7e3t7e3t7enp6enp6enp6enp6enp6enp5eXl5eXl5eXl5eXl5eXl5eXh4eHh4eHh4eHh4eHh4eHh4d3d3d3d3d3d3d3d3d3d3d3d2dnZ2dnZ2dnZ2dnZ2dnZ2dXV1dXV1dXV1dXV1dXV1dXV0dHR0dHR0dHR0dHR0dHR0dHNzc3Nzc3Nzc3Nzc3Nzc3NycnJycnJycnJycnJycnJycXFxcXFxcXFxcXFxcXFxcXBwcHBwcHBwcHBwcHBwcHBvb29vb29vb29vb29vb29ubm5ubm5ubm5ubm5ubm5uBgUFBQUFBQUFBQUFBQUFBgYGBgYGBgYGBgYGBgYGBwcHBwcHBwcHBwcHBwcHCAgICAgICAgICAgICAgICAkJCQkJCQkJCQkJCQkJCQoKCgoKCgoKCgoKCgoKCgsLCwsLCwsLCwsLCwsLCwwMDAwMDAwMDAwMDAwMDA0NDQ0NDQ0NDQ0NDQ0NDQ4ODg4ODg4ODg4ODg4ODg8PDw8PDw8PDw8PDw8PDxAQEBAQEBAQEBAQEBAQEBEREREREREREREREREREREQEBAQEBAQEBAQEBAQEBAPDw8PDw8PDw8PDw8PDw8ODg4ODg4ODg4ODg4ODg4NDQ0NDQ0NDQ0NDQ0NDQ0MDAwMDAwMDAwMDAwMDAsLCwsLCwsLCwsLCwsLCwoKCgoKCgoKCgoKCgoKCQkJCQkJCQkJCQkJCQkJCAgICAgICAgICAgICAgIBwcHBwcHBwcHBwcHBwcHBgYGBgYGBgYGBgYGBgYGBQUFBQUFBQUFBQUFBQUF';
      }
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {
    }
  };

  const completeGame = () => {
    const finalCorrect = correctCountRef.current;
    if (hasCalledOnCompleteRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }

    const callback = onCompleteRef.current;
    if (callback) {
      hasCalledOnCompleteRef.current = true;
      callback(finalCorrect, totalPhotos);
    }
  };

  const nextQuestion = () => {
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (currentPhotoNumber < totalPhotos) {
      setCurrentPhotoNumber(currentPhotoNumber + 1);
      generateNewQuestion();
    } else {
      completeGame();
    }
  };

  const handleTerryTest = () => {
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const nextIndex = (currentPuzzleIndex + 1) % questions.length;
    setCurrentPuzzleIndex(nextIndex);

    const nextQuestionData = questions[nextIndex];
    if (!nextQuestionData.difficulty) {
      nextQuestionData.difficulty = 'unknown';
    }

    setCurrentQuestion(nextQuestionData);
    setSelectedAnswer(null);
    setZoomLevel(maxZoom);
    setPoints(maxPoints);
    setElapsedTime(0);
    setGameState('playing');

    setTimeout(() => startGame(), 100);
  };

  useEffect(() => {
    fetchQuestions();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (resultTimerRef.current) {
        clearTimeout(resultTimerRef.current);
      }
    };
  }, [puzzleId, puzzleIds]);

  const getAnswerOptions = () => {
    if (!currentQuestion) return [];

    let options = [];

    if (currentQuestion.metadata) {
      if (typeof currentQuestion.metadata === 'string') {
        try {
          const parsed = JSON.parse(currentQuestion.metadata);
          options = parsed.options || [];
        } catch {
        }
      }
      else if (typeof currentQuestion.metadata === 'object') {
        options = currentQuestion.metadata.options || [];
      }
    }

    if (options.length === 0) {
      options = [currentQuestion.correct_answer, "Unknown", "Mystery"];
    }

    return options;
  };

  if (gameState === 'loading') {
    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-black text-cyan-400">
        <div className="text-lg" style={{ textShadow: '0 0 10px #00ffff' }}>
          <Search className="inline-block w-5 h-5 mr-2" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 255, 255, 0.6))' }} />
          Loading Zooma...
        </div>
        <div className="text-sm text-cyan-300 mt-2">Connecting to database</div>
      </div>
    );
  }

  if (gameState === 'error') {
    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-black text-white border-2 border-red-500 rounded-lg" style={{ boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)' }}>
        <div className="text-lg text-red-400 font-bold mb-4" style={{ textShadow: '0 0 10px #ff0066' }}>❌ Error Loading Zooma Puzzles</div>
        <div className="text-left text-sm text-cyan-300 bg-black/50 border border-cyan-400/30 rounded-lg p-4 mb-4">
          <p className="font-bold text-yellow-400 mb-2">Check the browser console for details.</p>
          <p className="mb-2">Puzzles must have:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><strong>prompt:</strong> Image URL (e.g., "https://...")</li>
            <li><strong>metadata.options:</strong> Array of choices (e.g., ["Cat", "Dog", "Rabbit"])</li>
            <li><strong>correct_answer:</strong> One of the options</li>
            <li><strong>game_id:</strong> 4 (for Zooma)</li>
            <li><strong>game_type:</strong> "multiple_choice" or "photo_mystery"</li>
          </ul>
        </div>
        <button
          onClick={fetchQuestions}
          className="mt-2 px-6 py-3 bg-transparent border-2 border-cyan-400 text-cyan-400 rounded-lg font-semibold hover:bg-cyan-400 hover:text-black transition-all"
          style={{ textShadow: '0 0 8px #00ffff', boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-black text-cyan-400">
        <div className="text-lg" style={{ textShadow: '0 0 10px #00ffff' }}>
          <Search className="inline-block w-5 h-5 mr-2" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 255, 255, 0.6))' }} />
          Getting ready...
        </div>
      </div>
    );
  };

  const answerOptions = getAnswerOptions();
  const timeRemaining = Math.max(0, photoDuration - elapsedTime);
  const percentage = (timeRemaining / photoDuration) * 100;

  return (
    <div style={{ paddingTop: '44px', position: 'relative' }}>
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

      {gameState === 'playing' && (
        <div 
          style={{ 
            position: 'absolute',
            top: '12px',
            left: 0, 
            right: 0,
            width: '100%',
            height: '8px',
            margin: 0,
            padding: 0,
            zIndex: 50,
            backgroundColor: '#000',
            border: '2px solid #00ffff',
            borderRadius: '8px',
            boxShadow: '0 0 15px rgba(0, 255, 255, 0.4), inset 0 0 10px rgba(0, 255, 255, 0.1)'
          }}
        >
          <div
            style={{ 
              width: `${percentage}%`,
              height: '100%',
              background: '#00ffff',
              boxShadow: '0 0 20px #00ffff',
              transition: 'width 0.3s linear'
            }}
          />
        </div>
      )}

      <div className="text-center max-w-2xl mx-auto p-3 sm:p-4 bg-black text-white space-y-3 sm:space-y-4">
        {/* Header - icon + name left, score right (matches other games) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Search 
              className="w-4 h-4 sm:w-5 sm:h-5" 
              style={{ 
                color: '#00ffff',
                filter: 'drop-shadow(0 0 8px rgba(0, 255, 255, 0.6))',
                strokeWidth: 2
              }} 
            />
            <h2 className="text-xs sm:text-sm font-bold text-cyan-400" style={{ textShadow: '0 0 10px #00ffff' }}>Zooma</h2>
          </div>
          <div className="text-cyan-300 text-xs sm:text-sm">
            Correct: <strong className="text-yellow-400 tabular-nums">{correctCount}/{totalPhotos}</strong>
          </div>
        </div>

        {(gameState === 'playing' || gameState === 'result') && (
          <div className="space-y-2 sm:space-y-3">
            {/* Points display */}
            <div className="flex justify-center items-center">
              <div className="flex items-center gap-1 sm:gap-2 text-cyan-400" style={{ textShadow: '0 0 10px #00ffff' }}>
                <Star size={16} className="sm:w-5 sm:h-5" />
                <span className="text-lg sm:text-xl font-bold tabular-nums">{Math.round(points)}</span>
                <span className="text-xs text-cyan-300">points</span>
              </div>
            </div>

            {/* Image display */}
            <div className="relative bg-black border-2 border-cyan-400 rounded-lg overflow-hidden h-40 sm:h-56" style={{ boxShadow: '0 0 15px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1)' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src={currentQuestion.prompt}
                  alt="Mystery"
                  className="w-full h-full object-cover"
                  style={{ transform: `scale(${zoomLevel})`, transition: gameState === 'playing' ? 'transform 0.1s linear' : 'none' }}
                />
              </div>
            </div>

            {/* Answer options */}
            <div className="grid gap-2">
              {answerOptions.map((option, index) => {
                const isCorrectAnswer = option === currentQuestion.correct_answer;
                const isSelectedAnswer = option === selectedAnswer;
                const showFeedback = gameState === 'result';

                let buttonClass = "p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm font-semibold transition-all text-center text-white border-2";
                let glowStyle = {};
                
                if (showFeedback) {
                  if (isCorrectAnswer) {
                    buttonClass += " bg-green-500/20 border-green-500 animate-pulse";
                    glowStyle = { boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)' };
                  } else if (isSelectedAnswer) {
                    buttonClass += " bg-red-500/20 border-red-500 animate-pulse-twice";
                    glowStyle = { boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)' };
                  } else {
                    buttonClass += " bg-black/50 border-cyan-400/20 opacity-30";
                  }
                } else if (selectedAnswer && !isCorrect) {
                  if (isSelectedAnswer) {
                    buttonClass += " bg-red-500/20 border-red-500 animate-pulse-twice";
                    glowStyle = { boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)' };
                  } else {
                    buttonClass += " bg-black/50 border-cyan-400/30 opacity-50";
                  }
                } else {
                  buttonClass += " bg-black/50 border-cyan-400/30 hover:border-cyan-400 hover:bg-cyan-500/10";
                  if (gameState === 'playing') {
                    glowStyle = { boxShadow: '0 0 10px rgba(0, 255, 255, 0.2)' };
                  }
                }

                return (
                  <button
                    key={index}
                    onClick={() => gameState === 'playing' ? handleAnswerSelect(option) : null}
                    disabled={gameState === 'result' || (selectedAnswer !== null)}
                    className={buttonClass}
                    style={glowStyle}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

PhotoMystery.displayName = 'PhotoMystery';

export default PhotoMystery;