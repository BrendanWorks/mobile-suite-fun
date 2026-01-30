import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '../lib/supabase';

const PhotoMystery = forwardRef((props, ref) => {
  const { onScoreUpdate, onComplete } = props;
  const [questions, setQuestions] = useState([]);
  const [gameState, setGameState] = useState('loading');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(2.5);
  const [points, setPoints] = useState(1000);
  const [score, setScore] = useState(0);
  const [usedQuestions, setUsedQuestions] = useState([]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [puzzleIds, setPuzzleIds] = useState([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [currentPhotoNumber, setCurrentPhotoNumber] = useState(1);
  const [elapsedTime, setElapsedTime] = useState(0);

  const timerRef = useRef(null);
  const resultTimerRef = useRef(null);
  const startTimeRef = useRef(null);

  const maxPoints = 1000;
  const minPoints = 0;
  const photoDuration = 15;
  const totalPhotos = 3;
  const maxZoom = 2.5;
  const minZoom = 1.0;

  useImperativeHandle(ref, () => ({
    hideTimerBar: true,
    getGameScore: () => ({
      score: score,
      maxScore: totalPhotos * maxPoints
    }),
    onGameEnd: () => {
      console.log(`PhotoMystery ended with score: ${score}/${totalPhotos * maxPoints}`);
      clearInterval(timerRef.current);
      clearTimeout(resultTimerRef.current);
    },
    skipQuestion: () => {
      nextQuestion();
    },
    canSkipQuestion: true,
    loadNextPuzzle: () => {
      const nextIndex = currentPuzzleIndex + 1;
      if (nextIndex < puzzleIds.length) {
        setCurrentPuzzleIndex(nextIndex);
        loadQuestionById(puzzleIds[nextIndex]);
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

      const { data, error } = await supabase
        .from('puzzles')
        .select('*')
        .eq('game_id', 4);

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

      console.log(`Loaded ${data.length} photo questions from Supabase`);
      setQuestions(data);

      const ids = data.map(q => q.id);
      setPuzzleIds(ids);

      if (data.length > 0) {
        const firstQuestion = data[0];
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

    } catch (error) {
      console.error('Error fetching questions:', error);
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

    if (onScoreUpdate) {
      onScoreUpdate(score, totalPhotos * maxPoints);
    }

    resultTimerRef.current = setTimeout(() => {
      if (currentPhotoNumber < totalPhotos) {
        setCurrentPhotoNumber(currentPhotoNumber + 1);
        generateNewQuestion();
      } else {
        completeGame();
      }
    }, 2500);
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

    const earnedPoints = correct ? Math.round(points) : 0;
    const newScore = score + earnedPoints;
    setScore(newScore);

    if (onScoreUpdate) {
      onScoreUpdate(newScore, totalPhotos * maxPoints);
    }

    // Play sound based on correctness
    if (correct) {
      // Correct answer - play success sound and show feedback immediately
      playSound('correct');
      setGameState('result');
      
      resultTimerRef.current = setTimeout(() => {
        if (currentPhotoNumber < totalPhotos) {
          setCurrentPhotoNumber(currentPhotoNumber + 1);
          generateNewQuestion();
        } else {
          completeGame();
        }
      }, 2500);
    } else {
      // Wrong answer - play incorrect sound, brief pause before showing correct answer
      playSound('incorrect');
      
      // Wait 800ms before showing the correct answer feedback
      setTimeout(() => {
        setGameState('result');
        
        resultTimerRef.current = setTimeout(() => {
          if (currentPhotoNumber < totalPhotos) {
            setCurrentPhotoNumber(currentPhotoNumber + 1);
            generateNewQuestion();
          } else {
            completeGame();
          }
        }, 2500);
      }, 800);
    }
  };

  const playSound = (type) => {
    try {
      const audio = new Audio();
      if (type === 'correct') {
        // Success sound - simple positive tone
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTOH0fPTgjMGHm7A7+OZSA0PVqzn77BfGQc+ltryxnMnBSuAzvPaizsIGGS57OihUBELTKXh8bllHAU2jdXyzn0vBSh+y/HajD4JE1u07+ynVhQKQ5zi8sFuJAUuhM7z1YU1Bhxrvu7mnEwPDlOq5vCyYhsGPJPY88p2KgUme8rx3I4+CRJYsu7sp1cUCkCa4fLFcSYFK4DN89OCNQYaaMDu6KBPEQpJouDwtmQdBTiP1vLPgC8GJ37K8d2PRwoTWrPu7KlYFQlBm+HyvmwhBi1/zfPWhjUGG2vA7umnVRQKQ5vg8rx0KgUqgM3z04MyBhxqvu7mnEwODlOq5vCyYRoGO5PX8sp3KwUme8rx3I0+CRJXsu7spVYVC0Ka4fLDcSYFLIHO8tiHNwgZabvu5p5OEQpJpODwtmQcBjiP1vLPgC8GJ3/L8d2PQQkSWrLu7KlYEwpBm+HyvnAjBSx/zfPWhjUGHGrA7umnVhQLRJvh8rx0KAUqgM3zzYAyBSBuve3mnEwODlOp5vCyYRoGOpPX8sp3KwUme8rx3I0+CRJXsu3tpVYVC0Ka4fLDcSYFLIHO8tiHNwgZabvu5p1NEgpJpODwtWQdBjiP1vLPfy4GKH/L8d2PQQkSWrLu7KlYFApBm+HyvnAjBSx/zfPWhjUGHGrA7umnVhQLRJvh8rx0KAUqgM3zzYAyBhxqwO7ppFQUCkSb4fK8dCgFKoDN88iAMwYcasDs6qNUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1Q=';
      } else {
        // Error sound - subtle negative tone
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgICAgICAgICAgICAgICAgICAgICAgICAgICBhYWFhYWFhYWFhYWFhYWFhYSEhISEhISEhISEhISEhISEhIODg4ODg4ODg4ODg4ODg4ODgoODg4ODg4ODg4ODg4ODg4ODg4KCgoKCgoKCgoKCgoKCgoKCgoGBgYGBgYGBgYGBgYGBgYGBgYCAgICAgICAgICAgICAgICAgIB/f39/f39/f39/f39/f39/f35+fn5+fn5+fn5+fn5+fn5+fX19fX19fX19fX19fX19fX18fHx8fHx8fHx8fHx8fHx8fHt7e3t7e3t7e3t7e3t7e3t7enp6enp6enp6enp6enp6enp5eXl5eXl5eXl5eXl5eXl5eXh4eHh4eHh4eHh4eHh4eHh4d3d3d3d3d3d3d3d3d3d3d3d2dnZ2dnZ2dnZ2dnZ2dnZ2dXV1dXV1dXV1dXV1dXV1dXV0dHR0dHR0dHR0dHR0dHR0dHNzc3Nzc3Nzc3Nzc3Nzc3NycnJycnJycnJycnJycnJycXFxcXFxcXFxcXFxcXFxcXBwcHBwcHBwcHBwcHBwcHBvb29vb29vb29vb29vb29ubm5ubm5ubm5ubm5ubm5uBgUFBQUFBQUFBQUFBQUFBgYGBgYGBgYGBgYGBgYGBwcHBwcHBwcHBwcHBwcHCAgICAgICAgICAgICAgICAkJCQkJCQkJCQkJCQkJCQoKCgoKCgoKCgoKCgoKCgsLCwsLCwsLCwsLCwsLCwwMDAwMDAwMDAwMDAwMDA0NDQ0NDQ0NDQ0NDQ0NDQ4ODg4ODg4ODg4ODg4ODg8PDw8PDw8PDw8PDw8PDxAQEBAQEBAQEBAQEBAQEBEREREREREREREREREREREQEBAQEBAQEBAQEBAQEBAPDw8PDw8PDw8PDw8PDw8ODg4ODg4ODg4ODg4ODg4NDQ0NDQ0NDQ0NDQ0NDQ0MDAwMDAwMDAwMDAwMDAsLCwsLCwsLCwsLCwsLCwoKCgoKCgoKCgoKCgoKCQkJCQkJCQkJCQkJCQkJCAgICAgICAgICAgICAgIBwcHBwcHBwcHBwcHBwcHBgYGBgYGBgYGBgYGBgYGBQUFBQUFBQUFBQUFBQUF';
      }
      audio.volume = 0.3;
      audio.play().catch(err => console.log('Audio play failed:', err));
    } catch (err) {
      console.log('Audio error:', err);
    }
  };

  const completeGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }

    if (onComplete) {
      onComplete(score, totalPhotos * maxPoints);
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
  }, []);

  const getImageStyle = () => {
    return {
      transform: `scale(${zoomLevel})`,
      transition: 'transform 0.1s linear'
    };
  };

  const getAnswerOptions = () => {
    if (!currentQuestion) return [];

    let options = [];

    if (currentQuestion.metadata) {
      if (typeof currentQuestion.metadata === 'string') {
        try {
          const parsed = JSON.parse(currentQuestion.metadata);
          options = parsed.options || [];
        } catch (e) {
          console.error('Failed to parse metadata string:', e);
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
      <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
        <div className="text-lg">📷 Loading Zooma...</div>
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
        <div className="text-lg">📷 Getting ready...</div>
      </div>
    );
  }

  const answerOptions = getAnswerOptions();
  const timeRemaining = Math.max(0, photoDuration - elapsedTime);
  const percentage = (timeRemaining / photoDuration) * 100;

  // Match VisualTimerBar color logic
  const getBarColor = () => {
    if (percentage > 66) {
      return 'from-blue-500 to-blue-600';
    } else if (percentage > 33) {
      return 'from-amber-400 to-yellow-500';
    } else if (percentage > 10) {
      return 'from-orange-500 to-red-500';
    } else {
      return 'from-red-600 to-red-700';
    }
  };

  const isPulsing = percentage < 15;

  return (
    <div style={{ paddingTop: '44px', position: 'relative' }}>
      {/* Zooma's timer - positioned at top of container */}
      {gameState === 'playing' && (
        <div 
          style={{ 
            position: 'absolute',
            top: '12px',
            left: 0, 
            right: 0,
            width: '100%',
            height: '16px',
            margin: 0,
            padding: 0,
            zIndex: 50,
            backgroundColor: '#1f2937'
          }}
        >
          <div
            className={`bg-gradient-to-r ${getBarColor()} transition-all duration-100`}
            style={{ 
              width: `${percentage}%`,
              height: '16px'
            }}
          />
        </div>
      )}

      {/* Game content */}
      <div className="text-center max-w-2xl mx-auto p-3 sm:p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
        <div className="mb-3 sm:mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2 drop-shadow-lg">
            📷 Zooma
          </h2>
          <p className="text-purple-300 text-xs sm:text-sm mb-2 sm:mb-4">
            Guess what's in the photo as it zooms out!
          </p>

          <div className="flex justify-between items-center mb-2 sm:mb-4 text-xs sm:text-sm">
            <div className="text-purple-300">
              Score: <strong className="text-yellow-400 tabular-nums">{score}</strong>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="font-bold text-cyan-400">
                Photo {currentPhotoNumber}/{totalPhotos}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                currentQuestion.difficulty === 'easy' ? 'bg-green-500/20 text-green-300 border-green-400' :
                currentQuestion.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400' :
                currentQuestion.difficulty === 'hard' ? 'bg-red-500/20 text-red-300 border-red-400' :
                'bg-gray-500/20 text-gray-300 border-gray-400'
              }`}>
                {currentQuestion.difficulty ?
                  currentQuestion.difficulty.charAt(0).toUpperCase() + currentQuestion.difficulty.slice(1) :
                  'Unknown'
                }
              </span>
            </div>
          </div>
        </div>

        {/* Unified layout for both playing and result states */}
        {(gameState === 'playing' || gameState === 'result') && (
          <div className="space-y-3 sm:space-y-6">
            {/* Points display - always visible, frozen in result state */}
            <div className="flex justify-center items-center mb-2 sm:mb-4">
              <div className="flex items-center gap-1 sm:gap-2 text-purple-400">
                <Star size={16} className="sm:w-5 sm:h-5" />
                <span className="text-lg sm:text-xl font-bold tabular-nums">{Math.round(points)}</span>
                <span className="text-xs text-purple-300">points</span>
              </div>
            </div>

            {/* Image - stays in place at frozen zoom level */}
            <div className="relative bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-xl overflow-hidden h-48 sm:h-64 mb-3 sm:mb-6">
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src={currentQuestion.prompt}
                  alt="Mystery"
                  className="w-full h-full object-cover"
                  style={{ transform: `scale(${zoomLevel})`, transition: gameState === 'playing' ? 'transform 0.1s linear' : 'none' }}
                />
              </div>
            </div>

            {/* Answer buttons with color feedback */}
            <div className="grid gap-2 sm:gap-3">
              {answerOptions.map((option, index) => {
                const isCorrectAnswer = option === currentQuestion.correct_answer;
                const isSelectedAnswer = option === selectedAnswer;
                const showFeedback = gameState === 'result';

                let buttonClass = "p-2.5 sm:p-4 rounded-xl text-sm sm:text-base font-semibold transition-all text-center text-white";
                
                if (showFeedback) {
                  // Result state - show full feedback
                  if (isCorrectAnswer) {
                    // Correct answer - green pulse
                    buttonClass += " bg-green-500/30 border-4 border-green-500 animate-pulse shadow-lg shadow-green-500/50";
                  } else if (isSelectedAnswer) {
                    // Selected wrong answer - red pulse
                    buttonClass += " bg-red-500/30 border-4 border-red-500 animate-pulse shadow-lg shadow-red-500/50";
                  } else {
                    // Other options - dimmed
                    buttonClass += " bg-white/5 border-2 border-purple-500/10 opacity-30";
                  }
                } else if (selectedAnswer && !isCorrect) {
                  // Intermediate state - wrong answer selected, waiting to show correct
                  if (isSelectedAnswer) {
                    // Show red on wrong selection immediately
                    buttonClass += " bg-red-500/30 border-4 border-red-500 animate-pulse shadow-lg shadow-red-500/50";
                  } else {
                    // Other buttons stay normal during pause
                    buttonClass += " bg-white/10 border-2 border-purple-500/30 opacity-50";
                  }
                } else {
                  // Playing state - normal interactive buttons
                  buttonClass += " bg-white/10 border-2 border-purple-500/30 hover:border-purple-400 hover:bg-white/20 hover:shadow-lg hover:shadow-purple-500/25 active:scale-95";
                }

                return (
                  <button
                    key={index}
                    onClick={() => gameState === 'playing' ? handleAnswerSelect(option) : null}
                    disabled={gameState === 'result' || (selectedAnswer !== null)}
                    className={buttonClass}
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