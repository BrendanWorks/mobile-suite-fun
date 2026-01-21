import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Eye, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';

const PhotoMystery = forwardRef((props, ref) => {
  const [questions, setQuestions] = useState([]);
  const [gameState, setGameState] = useState('loading');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [revealLevel, setRevealLevel] = useState(0);
  const [points, setPoints] = useState(1000);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [usedQuestions, setUsedQuestions] = useState([]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [puzzleIds, setPuzzleIds] = useState([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const pointsTimerRef = useRef(null);
  const revealTimerRef = useRef(null);
  const resultTimerRef = useRef(null);

  const maxPoints = 1000;
  const minPoints = 50;

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: score,
      maxScore: totalQuestions * maxPoints
    }),
    onGameEnd: () => {
      console.log(`PhotoMystery ended with score: ${score}`);
      clearInterval(pointsTimerRef.current);
      clearInterval(revealTimerRef.current);
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
      // Called by GameWrapper when countdown finishes
      setHasStarted(true);
    }
  }));

  // Auto-start points countdown after global countdown (7 seconds)
  // Start zoom-out 2 seconds after that (9 seconds total)
  useEffect(() => {
    if (gameState === 'ready' && !hasStarted) {
      // Start points countdown at 7 seconds (when global countdown finishes)
      const pointsStartTimer = setTimeout(() => {
        setHasStarted(true);
        setGameState('playing');
        
        // Start points decay immediately
        pointsTimerRef.current = setInterval(() => {
          setPoints(prev => Math.max(minPoints, prev - 63));
        }, 1000);
        
        // Start zoom-out 2 seconds later
        setTimeout(() => {
          revealTimerRef.current = setInterval(() => {
            setRevealLevel(prev => Math.min(4, prev + 1));
          }, 3000);
        }, 2000);
      }, 7000);
      
      return () => clearTimeout(pointsStartTimer);
    }
  }, [gameState, hasStarted]);

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
      
      // Extract and store puzzle IDs
      const ids = data.map(q => q.id);
      setPuzzleIds(ids);
      
      // Load first question but don't start timers yet - wait for global countdown
      if (data.length > 0) {
        const firstQuestion = data[0];
        if (!firstQuestion.difficulty) {
          firstQuestion.difficulty = 'unknown';
        }
        setCurrentQuestion(firstQuestion);
        setUsedQuestions([firstQuestion.id]);
        setSelectedAnswer(null);
        setRevealLevel(0);
        setPoints(maxPoints);
        setGameState('ready');
        // Don't call startQuestionTimers() here - wait for round to actually start
      }

    } catch (error) {
      console.error('Error fetching questions:', error);
      setGameState('error');
    }
  };

  // Load a specific question by ID
  const loadQuestionById = (questionId) => {
    const question = questions.find(q => q.id === questionId);
    if (!question) return;

    if (!question.difficulty) {
      question.difficulty = 'unknown';
    }

    setCurrentQuestion(question);
    setUsedQuestions(prev => [...prev, question.id]);
    setSelectedAnswer(null);
    
    // If round has started, begin playing immediately with timers
    if (hasStarted) {
      setGameState('playing');
      startQuestionTimers();
    } else {
      // Otherwise wait for auto-start
      setRevealLevel(0);
      setPoints(maxPoints);
      setGameState('ready');
    }
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
    
    // If round has started, begin playing immediately with timers
    if (hasStarted) {
      setGameState('playing');
      startQuestionTimers();
    } else {
      // Otherwise wait for auto-start
      setRevealLevel(0);
      setPoints(maxPoints);
      setGameState('ready');
    }
  };

  const startQuestionTimers = () => {
    // Clear any existing timers
    clearInterval(pointsTimerRef.current);
    clearInterval(revealTimerRef.current);

    // Reset to starting values
    setPoints(maxPoints);
    setRevealLevel(0);

    // Start points decay - drops from 1000 to 50 over ~15 seconds
    pointsTimerRef.current = setInterval(() => {
      setPoints(prev => Math.max(minPoints, prev - 63));
    }, 1000);

    // Gradually reveal image over time (zoom out)
    // Start after 2 second delay to match initial timing
    setTimeout(() => {
      revealTimerRef.current = setInterval(() => {
        setRevealLevel(prev => Math.min(4, prev + 1));
      }, 3000);
    }, 2000);
  };

  const handleAnswerSelect = (answer) => {
    if (gameState !== 'playing') return;

    setSelectedAnswer(answer);
    
    // Stop timers
    clearInterval(pointsTimerRef.current);
    clearInterval(revealTimerRef.current);

    const correct = answer === currentQuestion.correct_answer;
    setIsCorrect(correct);
    const newTotal = totalQuestions + 1;
    setTotalQuestions(newTotal);

    if (correct) {
      setScore(prev => prev + Math.round(points));
    }

    setGameState('result');

    // Auto-advance to next question after 1.5 seconds
    resultTimerRef.current = setTimeout(() => {
      generateNewQuestion();
    }, 1500);
  };

  const nextQuestion = () => {
    clearTimeout(resultTimerRef.current);
    clearInterval(pointsTimerRef.current);
    clearInterval(revealTimerRef.current);
    generateNewQuestion();
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const getImageStyle = () => {
    const scales = [3, 2.2, 1.6, 1.2, 1];
    const scale = scales[revealLevel] || 1;

    return {
      transform: `scale(${scale})`,
      transition: 'transform 0.5s ease-out'
    };
  };

  const getRevealProgress = () => {
    return (revealLevel / 4) * 100;
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
              Question {totalQuestions + 1}
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

      {gameState === 'ready' && (
        <div className="space-y-6">
          <div className="flex justify-center items-center mb-4">
            <div className="flex items-center gap-2 text-purple-400">
              <Star size={20} />
              <span className="text-xl font-bold">{Math.round(points)}</span>
              <span className="text-xs text-purple-300">points</span>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye size={16} className="text-purple-300" />
              <span className="text-sm text-purple-300">Revealed: {Math.round(getRevealProgress())}%</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500 shadow-lg shadow-blue-500/25"
                style={{ width: `${getRevealProgress()}%` }}
              ></div>
            </div>
          </div>

          <div className="relative bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-xl overflow-hidden h-64 mb-6">
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={currentQuestion.prompt}
                alt="Mystery"
                className="w-full h-full object-cover"
                style={getImageStyle()}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="hidden w-full h-full bg-white/10 items-center justify-center text-purple-300">
                <div className="text-center">
                  <div className="text-4xl mb-2">🖼️</div>
                  <div>Image Loading...</div>
                  <div className="text-xs mt-1">URL: {currentQuestion.prompt}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {answerOptions.map((option, index) => (
              <button
                key={index}
                disabled
                className="p-4 bg-white/10 border-2 border-purple-500/30 rounded-xl font-semibold text-white text-center opacity-70 cursor-not-allowed"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="space-y-6">
          <div className="flex justify-center items-center mb-4">
            <div className="flex items-center gap-2 text-purple-400">
              <Star size={20} />
              <span className="text-xl font-bold">{Math.round(points)}</span>
              <span className="text-xs text-purple-300">points</span>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye size={16} className="text-purple-300" />
              <span className="text-sm text-purple-300">Revealed: {Math.round(getRevealProgress())}%</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500 shadow-lg shadow-blue-500/25"
                style={{ width: `${getRevealProgress()}%` }}
              ></div>
            </div>
          </div>

          <div className="relative bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-xl overflow-hidden h-64 mb-6">
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={currentQuestion.prompt}
                alt="Mystery"
                className="w-full h-full object-cover"
                style={getImageStyle()}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="hidden w-full h-full bg-white/10 items-center justify-center text-purple-300">
                <div className="text-center">
                  <div className="text-4xl mb-2">🖼️</div>
                  <div>Image Loading...</div>
                  <div className="text-xs mt-1">URL: {currentQuestion.prompt}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {answerOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(option)}
                className="p-4 bg-white/10 border-2 border-purple-500/30 rounded-xl font-semibold hover:border-purple-400 hover:bg-white/20 hover:shadow-lg hover:shadow-purple-500/25 transition-all text-left text-white"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

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
              {isCorrect ? 'Correct!' : 'Not quite!'}
            </div>
            <div className="text-sm">
              The answer was: <strong className="text-white">{currentQuestion.correct_answer}</strong>
            </div>
            {isCorrect && (
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

          <div className="p-4 bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 rounded-xl">
            <div className="text-sm text-blue-300">
              Next question loading automatically...
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

PhotoMystery.displayName = 'PhotoMystery';

export default PhotoMystery;