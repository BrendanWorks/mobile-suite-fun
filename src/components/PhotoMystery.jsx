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
  const [currentPhotoNumber, setCurrentPhotoNumber] = useState(1); // 1, 2, or 3
  const [elapsedTime, setElapsedTime] = useState(0);

  const timerRef = useRef(null);
  const resultTimerRef = useRef(null);
  const startTimeRef = useRef(null);

  const maxPoints = 1000;
  const minPoints = 0;
  const photoDuration = 15; // 15 seconds per photo
  const totalPhotos = 3; // 3 photos per game
  const maxZoom = 2.5;
  const minZoom = 1.0;

  useImperativeHandle(ref, () => ({
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

        // Start playing immediately
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
    
    // Start fresh timer for new photo
    setTimeout(() => startGame(), 100);
  };

  const startGame = () => {
    // Clear any existing timer first
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Record start time
    startTimeRef.current = Date.now();

    // Update every 100ms for smooth animation
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setElapsedTime(elapsed);

      if (elapsed >= photoDuration) {
        // Time's up - stop the timer
        clearInterval(timerRef.current);
        timerRef.current = null;
        setElapsedTime(photoDuration);
        
        // Auto-submit with 0 points if no answer selected
        handleTimeUp();
        return;
      }

      // Calculate smooth zoom (linear from maxZoom to minZoom)
      const progress = elapsed / photoDuration;
      const currentZoom = maxZoom - (progress * (maxZoom - minZoom));
      setZoomLevel(Math.max(minZoom, currentZoom));

      // Calculate points decay (linear from maxPoints to minPoints)
      const currentPoints = maxPoints - (progress * (maxPoints - minPoints));
      setPoints(Math.max(minPoints, currentPoints));
    }, 100);
  };

  const handleTimeUp = () => {
    if (gameState !== 'playing') return; // Prevent duplicate calls
    
    // Time ran out, treat as wrong answer with 0 points
    setIsCorrect(false);
    setSelectedAnswer(null);
    setGameState('result');
    
    // Update score (stays the same since 0 points)
    if (onScoreUpdate) {
      onScoreUpdate(score, totalPhotos * maxPoints);
    }

    // Move to next photo or complete game
    resultTimerRef.current = setTimeout(() => {
      if (currentPhotoNumber < totalPhotos) {
        setCurrentPhotoNumber(currentPhotoNumber + 1);
        generateNewQuestion();
      } else {
        // Game complete
        completeGame();
      }
    }, 2500);
  };

  const handleAnswerSelect = (answer) => {
    if (gameState !== 'playing') return;

    setSelectedAnswer(answer);
    
    // Stop timer immediately when answer selected
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const correct = answer === currentQuestion.correct_answer;
    setIsCorrect(correct);

    // Update score
    const earnedPoints = correct ? Math.round(points) : 0;
    const newScore = score + earnedPoints;
    setScore(newScore);
    
    if (onScoreUpdate) {
      onScoreUpdate(newScore, totalPhotos * maxPoints);
    }

    setGameState('result');

    // Auto-advance after 2.5 seconds
    resultTimerRef.current = setTimeout(() => {
      if (currentPhotoNumber < totalPhotos) {
        // Next photo
        setCurrentPhotoNumber(currentPhotoNumber + 1);
        generateNewQuestion();
      } else {
        // All 3 photos done - complete the game
        completeGame();
      }
    }, 2500);
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
    
    // Call GameWrapper's onComplete
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

  return (
    <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
          📷 Zooma
        </h2>
        <p className="text-purple-300 text-sm mb-4">
          Guess what's in the photo as it zooms out!
        </p>

        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-purple-300">
            Score: <strong className="text-yellow-400">{score}</strong>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-cyan-400">
              Photo {currentPhotoNumber}/{totalPhotos}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border-2 ${
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

      {/* PLAYING STATE - Active gameplay */}
      {gameState === 'playing' && (
        <div className="space-y-6">
          <div className="flex justify-center items-center mb-4">
            <div className="flex items-center gap-2 text-purple-400">
              <Star size={20} />
              <span className="text-xl font-bold tabular-nums">{Math.round(points)}</span>
              <span className="text-xs text-purple-300">points</span>
            </div>
          </div>

          <div className="relative bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-xl overflow-hidden h-64 mb-6">
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={currentQuestion.prompt}
                alt="Mystery"
                className="w-full h-full object-cover"
                style={getImageStyle()}
              />
            </div>
          </div>

          <div className="grid gap-3">
            {answerOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(option)}
                className="p-4 bg-white/10 border-2 border-purple-500/30 rounded-xl font-semibold hover:border-purple-400 hover:bg-white/20 hover:shadow-lg hover:shadow-purple-500/25 transition-all text-center text-white"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RESULT STATE - Show answer */}
      {gameState === 'result' && (
        <div className="space-y-6">
          <div className={`p-6 rounded-xl border-2 shadow-lg ${
            isCorrect
              ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border-green-400 shadow-green-500/25'
              : 'bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-300 border-red-400 shadow-red-500/25'
          }`}>
            <div className="text-4xl mb-2">
              {isCorrect ? '🎉' : '😅'}
            </div>
            <div className="text-xl font-bold mb-2">
              {isCorrect ? 'Correct!' : selectedAnswer ? 'Not quite!' : 'Time\'s up!'}
            </div>
            <div className="text-sm">
              The answer was: <strong className="text-white">{currentQuestion.correct_answer}</strong>
            </div>
            {isCorrect && points > 0 && (
              <div className="text-lg font-bold text-white mt-2">
                +{Math.round(points)} points!
              </div>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-xl overflow-hidden h-64">
            <img
              src={currentQuestion.prompt}
              alt={currentQuestion.correct_answer}
              className="w-full h-full object-cover"
            />
          </div>

          {currentPhotoNumber < totalPhotos && (
            <div className="p-4 bg-purple-500/20 border border-purple-500/30 rounded-xl">
              <div className="text-sm text-purple-200">
                Next photo loading...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

PhotoMystery.displayName = 'PhotoMystery';

export default PhotoMystery;