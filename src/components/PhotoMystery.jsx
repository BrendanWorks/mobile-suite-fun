import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Star, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

const PhotoMystery = forwardRef((props, ref) => {
  const { onScoreUpdate, onComplete } = props;
  const [questions, setQuestions] = useState([]);
  const [gameState, setGameState] = useState('loading');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(2.5);
  const [points, setPoints] = useState(333);
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
  const onCompleteRef = useRef(onComplete);
  const onScoreUpdateRef = useRef(onScoreUpdate);
  const scoreRef = useRef(0);

  const maxPoints = 333; // ~1000 points total across 3 photos
  const minPoints = 0;
  const photoDuration = 15;
  const totalPhotos = 3;
  const maxZoom = 2.5;
  const minZoom = 1.0;
  const totalMaxScore = 1000; // Normalized total score

  // Keep callback refs up to date
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onScoreUpdateRef.current = onScoreUpdate;
  }, [onScoreUpdate]);

  // Keep score ref in sync
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useImperativeHandle(ref, () => ({
    hideTimer: true, // Zooma manages its own per-photo timers
    getGameScore: () => ({
      score: scoreRef.current,
      maxScore: totalMaxScore
    }),
    onGameEnd: () => {
      console.log('Zooma: onGameEnd called (GameWrapper timer hit 0)');
      clearInterval(timerRef.current);
      clearTimeout(resultTimerRef.current);
      // GameWrapper timer ran out - complete with current score
      const callback = onCompleteRef.current;
      const finalScore = scoreRef.current;
      console.log('Zooma: GameWrapper time up! Calling onComplete with score:', finalScore);
      if (callback) {
        callback(finalScore, totalMaxScore);
      } else {
        console.error('Zooma: onComplete callback is undefined in onGameEnd!');
      }
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
    console.log('Zooma: startGame called for photo', currentPhotoNumber);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    startTimeRef.current = Date.now();
    console.log('Zooma: Timer started at', startTimeRef.current);

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setElapsedTime(elapsed);

      if (elapsed >= photoDuration) {
        console.log('Zooma: Photo timer expired, elapsed:', elapsed);
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
    console.log('Zooma: handleTimeUp called, gameState:', gameState, 'photo:', currentPhotoNumber);
    if (gameState !== 'playing') return;

    setIsCorrect(false);
    setSelectedAnswer(null);
    setGameState('result');

    console.log('Zooma: Time up on photo', currentPhotoNumber, 'current score:', score);
    
    if (onScoreUpdateRef.current) {
      onScoreUpdateRef.current(score, totalMaxScore);
    }

    // Check if this was the last photo
    if (currentPhotoNumber >= totalPhotos) {
      console.log('Zooma: Last photo complete, calling completeGame immediately');
      completeGame();
    } else {
      resultTimerRef.current = setTimeout(() => {
        console.log('Zooma: Moving to photo', currentPhotoNumber + 1);
        setCurrentPhotoNumber(currentPhotoNumber + 1);
        generateNewQuestion();
      }, 2500);
    }
  };

  const handleAnswerSelect = (answer) => {
    console.log('Zooma: Answer selected:', answer, 'correct:', currentQuestion.correct_answer, 'photo:', currentPhotoNumber);
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

    console.log('Zooma: Photo', currentPhotoNumber, correct ? 'CORRECT' : 'WRONG', 'earned:', earnedPoints, 'new score:', newScore);

    if (onScoreUpdateRef.current) {
      onScoreUpdateRef.current(newScore, totalMaxScore);
    }

    if (correct) {
      playSound('correct');
      setGameState('result');

      // Check if this was the last photo
      if (currentPhotoNumber >= totalPhotos) {
        console.log('Zooma: Last photo complete (correct), calling completeGame immediately');
        completeGame();
      } else {
        resultTimerRef.current = setTimeout(() => {
          console.log('Zooma: Moving to photo', currentPhotoNumber + 1);
          setCurrentPhotoNumber(currentPhotoNumber + 1);
          generateNewQuestion();
        }, 2500);
      }
    } else {
      playSound('incorrect');
      
      setTimeout(() => {
        setGameState('result');

        // Check if this was the last photo
        if (currentPhotoNumber >= totalPhotos) {
          console.log('Zooma: Last photo complete (incorrect), calling completeGame immediately');
          completeGame();
        } else {
          resultTimerRef.current = setTimeout(() => {
            console.log('Zooma: Moving to photo', currentPhotoNumber + 1);
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
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTOH0fPTgjMGHm7A7+OZSA0PVqzn77BfGQc+ltryxnMnBSuAzvPaizsIGGS57OihUBELTKXh8bllHAU2jdXyzn0vBSh+y/HajD4JE1u07+ynVhQKQ5zi8sFuJAUuhM7z1YU1Bhxrvu7mnEwPDlOq5vCyYhsGPJPY88p2KgUme8rx3I4+CRJYsu7sp1cUCkCa4fLFcSYFK4DN89OCNQYaaMDu6KBPEQpJouDwtmQdBTiP1vLPgC8GJ37K8d2PRwoTWrPu7KlYFQlBm+HyvmwhBi1/zfPWhjUGG2vA7umnVRQKQ5vg8rx0KgUqgM3z04MyBhxqvu7mnEwODlOq5vCyYRoGO5PX8sp3KwUme8rx3I0+CRJXsu7spVYVC0Ka4fLDcSYFLIHO8tiHNwgZabvu5p5OEQpJpODwtmQcBjiP1vLPgC8GJ3/L8d2PQQkSWrLu7KlYEwpBm+HyvnAjBSx/zfPWhjUGHGrA7umnVhQLRJvh8rx0KAUqgM3zzYAyBSBuve3mnEwODlOp5vCyYRoGOpPX8sp3KwUme8rx3I0+CRJXsu3tpVYVC0Ka4fLDcSYFLIHO8tiHNwgZabvu5p1NEgpJpODwtWQdBjiP1vLPfy4GKH/L8d2PQQkSWrLu7KlYFApBm+HyvnAjBSx/zfPWhjUGHGrA7umnVhQLRJvh8rx0KAUqgM3zzYAyBhxqwO7ppFQUCkSb4fK8dCgFKoDN88iAMwYcasDs6qNUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1QUCkSb4fK8dCgFKoDN88iAMwYcasDu6aRUFApEm+HyvHQoBSqAzfPIgDMGHGrA7OqjVBQKRJvh8rx0KAUqgM3zyIAzBhxqwOzqo1Q=';
      } else {
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgICAgICAgICAgICAgICAgICAgICAgICAgICBhYWFhYWFhYWFhYWFhYWFhYSEhISEhISEhISEhISEhISEhIODg4ODg4ODg4ODg4ODg4ODgoODg4ODg4ODg4ODg4ODg4ODg4KCgoKCgoKCgoKCgoKCgoKCgoGBgYGBgYGBgYGBgYGBgYGBgYCAgICAgICAgICAgICAgICAgIB/f39/f39/f39/f39/f39/f35+fn5+fn5+fn5+fn5+fn5+fX19fX19fX19fX19fX19fX18fHx8fHx8fHx8fHx8fHx8fHt7e3t7e3t7e3t7e3t7e3t7enp6enp6enp6enp6enp6enp5eXl5eXl5eXl5eXl5eXl5eXh4eHh4eHh4eHh4eHh4eHh4d3d3d3d3d3d3d3d3d3d3d3d2dnZ2dnZ2dnZ2dnZ2dnZ2dXV1dXV1dXV1dXV1dXV1dXV0dHR0dHR0dHR0dHR0dHR0dHNzc3Nzc3Nzc3Nzc3Nzc3NycnJycnJycnJycnJycnJycXFxcXFxcXFxcXFxcXFxcXBwcHBwcHBwcHBwcHBwcHBvb29vb29vb29vb29vb29ubm5ubm5ubm5ubm5ubm5uBgUFBQUFBQUFBQUFBQUFBgYGBgYGBgYGBgYGBgYGBwcHBwcHBwcHBwcHBwcHCAgICAgICAgICAgICAgICAkJCQkJCQkJCQkJCQkJCQoKCgoKCgoKCgoKCgoKCgsLCwsLCwsLCwsLCwsLCwwMDAwMDAwMDAwMDAwMDA0NDQ0NDQ0NDQ0NDQ0NDQ4ODg4ODg4ODg4ODg4ODg8PDw8PDw8PDw8PDw8PDxAQEBAQEBAQEBAQEBAQEBEREREREREREREREREREREQEBAQEBAQEBAQEBAQEBAPDw8PDw8PDw8PDw8PDw8ODg4ODg4ODg4ODg4ODg4NDQ0NDQ0NDQ0NDQ0NDQ0MDAwMDAwMDAwMDAwMDAsLCwsLCwsLCwsLCwsLCwoKCgoKCgoKCgoKCgoKCQkJCQkJCQkJCQkJCQkJCAgICAgICAgICAgICAgIBwcHBwcHBwcHBwcHBwcHBgYGBgYGBgYGBgYGBgYGBQUFBQUFBQUFBQUFBQUF';
      }
      audio.volume = 0.3;
      audio.play().catch(err => console.log('Audio play failed:', err));
    } catch (err) {
      console.log('Audio error:', err);
    }
  };

  const completeGame = () => {
    const finalScore = scoreRef.current;
    console.log('Zooma: completeGame called, final score:', finalScore);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }

    const callback = onCompleteRef.current;
    console.log('Zooma: Calling onComplete with score:', finalScore, 'max:', totalMaxScore);
    if (callback) {
      callback(finalScore, totalMaxScore);
    } else {
      console.error('Zooma: onComplete callback is undefined!');
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
      <div className="text-center max-w-2xl mx-auto p-6 bg-black rounded-lg text-cyan-400">
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
      <div className="text-center max-w-2xl mx-auto p-6 bg-black rounded-lg text-white">
        <div className="text-lg text-red-500" style={{ textShadow: '0 0 10px #ff0066' }}>❌ Error loading questions</div>
        <div className="text-sm text-cyan-300 mt-2">Check your Supabase connection</div>
        <button
          onClick={fetchQuestions}
          className="mt-4 px-6 py-3 bg-transparent border-2 border-cyan-400 text-cyan-400 rounded-lg font-semibold hover:bg-cyan-400 hover:text-black transition-all"
          style={{ textShadow: '0 0 8px #00ffff', boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-black rounded-lg text-cyan-400">
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

      {/* Timer bar - cyan neon */}
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

      {/* Game content */}
      <div className="text-center max-w-2xl mx-auto p-3 sm:p-6 bg-black rounded-lg text-white" style={{ border: '2px solid #00ffff40' }}>
        <div className="mb-3 sm:mb-6">
          {/* Icon + Title with neon glow */}
          <h2 className="text-xl sm:text-2xl font-bold text-cyan-400 mb-1 border-b border-cyan-400 pb-1 flex items-center justify-center gap-2">
            <Search 
              className="w-6 h-6 sm:w-7 sm:h-7" 
              style={{ 
                color: '#00ffff',
                filter: 'drop-shadow(0 0 8px rgba(0, 255, 255, 0.6))',
                strokeWidth: 2
              }} 
            />
            <span style={{ textShadow: '0 0 10px #00ffff' }}>Zooma</span>
          </h2>
          
          <p className="text-cyan-300 text-xs sm:text-sm mb-2 sm:mb-4">
            What's in the photo?
          </p>

          {/* Score and Progress */}
          <div className="flex justify-between items-center mb-2 sm:mb-4 text-xs sm:text-sm">
            <div className="text-cyan-300">
              Score: <strong className="text-yellow-400 tabular-nums">{score}</strong>
            </div>
            <div className="text-cyan-400">
              Photo {currentPhotoNumber} of {totalPhotos}
            </div>
          </div>
        </div>

        {(gameState === 'playing' || gameState === 'result') && (
          <div className="space-y-3 sm:space-y-6">
            {/* Points display */}
            <div className="flex justify-center items-center mb-2 sm:mb-4">
              <div className="flex items-center gap-1 sm:gap-2 text-cyan-400" style={{ textShadow: '0 0 10px #00ffff' }}>
                <Star size={16} className="sm:w-5 sm:h-5" />
                <span className="text-lg sm:text-xl font-bold tabular-nums">{Math.round(points)}</span>
                <span className="text-xs text-cyan-300">points</span>
              </div>
            </div>

            {/* Image */}
            <div className="relative bg-black border-2 border-cyan-400 rounded-lg overflow-hidden h-48 sm:h-64 mb-3 sm:mb-6" style={{ boxShadow: '0 0 15px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1)' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src={currentQuestion.prompt}
                  alt="Mystery"
                  className="w-full h-full object-cover"
                  style={{ transform: `scale(${zoomLevel})`, transition: gameState === 'playing' ? 'transform 0.1s linear' : 'none' }}
                />
              </div>
            </div>

            {/* Answer buttons */}
            <div className="grid gap-2 sm:gap-3">
              {answerOptions.map((option, index) => {
                const isCorrectAnswer = option === currentQuestion.correct_answer;
                const isSelectedAnswer = option === selectedAnswer;
                const showFeedback = gameState === 'result';

                let buttonClass = "p-2.5 sm:p-3 rounded-lg text-sm sm:text-base font-semibold transition-all text-center text-white border-2";
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