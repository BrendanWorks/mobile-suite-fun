import React, { useState, useEffect, useRef } from 'react';
import { Timer, Eye, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function PhotoMystery() {
  const [questions, setQuestions] = useState([]);
  const [gameState, setGameState] = useState('loading'); // loading, ready, countdown, playing, result, error
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(12);
  const [points, setPoints] = useState(1000);
  const [revealLevel, setRevealLevel] = useState(0); // 0 = most zoomed, 4 = fully revealed
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [usedQuestions, setUsedQuestions] = useState([]);
  const [isCorrect, setIsCorrect] = useState(false);
  
  const timerRef = useRef(null);
  const revealTimerRef = useRef(null);

  const maxTime = 15;
  const maxPoints = 1000;

  // Fetch questions from Supabase
  const fetchQuestions = async () => {
    try {
      setGameState('loading');
      
      const { data, error } = await supabase
        .from('puzzles')
        .select('*')
        .eq('game_id', 4); // Photo Mystery game ID
      
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
      setGameState('ready');
      
    } catch (error) {
      console.error('Error fetching questions:', error);
      setGameState('error');
    }
  };

  // Generate new question
  const generateNewQuestion = () => {
    if (questions.length === 0) return;
    
    // Get questions not yet used, or reset if all used
    let availableQuestions = questions.filter(q => !usedQuestions.includes(q.id));
    if (availableQuestions.length === 0) {
      availableQuestions = questions;
      setUsedQuestions([]);
    }
    
    const question = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    setCurrentQuestion(question);
    setUsedQuestions(prev => [...prev, question.id]);
    setSelectedAnswer(null);
    setRevealLevel(0);
    setGameState('ready');
  };

  // Start the game countdown
  const startGame = () => {
    setGameState('countdown');
    let countdown = 3;
    
    const countdownTimer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(countdownTimer);
        setGameState('playing');
        startGameTimer();
      }
    }, 1000);
  };

  // Start the main game timer and reveal mechanism
  const startGameTimer = () => {
    setTimeLeft(15);
    setPoints(maxPoints);
    setRevealLevel(0);

    // Main timer - counts down time and points
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          clearInterval(revealTimerRef.current);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
      
      setPoints(prev => Math.max(50, prev - 67)); // Minimum 50 points, decrease by 67 per second
    }, 1000);

    // Reveal timer - gradually shows more of the image
    revealTimerRef.current = setInterval(() => {
      setRevealLevel(prev => Math.min(4, prev + 1));
    }, 3000); // Reveal more every 3 seconds (15s / 5 levels)
  };

  // Handle time running out
  const handleTimeUp = () => {
    setGameState('result');
    setIsCorrect(false);
    setTotalQuestions(prev => prev + 1);
  };

  // Handle answer selection
  const handleAnswerSelect = (answer) => {
    if (gameState !== 'playing') return;
    
    setSelectedAnswer(answer);
    clearInterval(timerRef.current);
    clearInterval(revealTimerRef.current);
    
    const correct = answer === currentQuestion.correct_answer;
    setIsCorrect(correct);
    setTotalQuestions(prev => prev + 1);
    
    if (correct) {
      setScore(prev => prev + Math.round(points));
    }
    
    setGameState('result');
  };

  // Next question
  const nextQuestion = () => {
    generateNewQuestion();
  };

  // Initialize game
  useEffect(() => {
    fetchQuestions();
  }, []);

  // Generate first question when questions are loaded
  useEffect(() => {
    if (questions.length > 0 && !currentQuestion && gameState === 'ready') {
      generateNewQuestion();
    }
  }, [questions, currentQuestion, gameState]);

  // Get zoom/crop style based on reveal level
  const getImageStyle = () => {
    const scales = [3, 2.2, 1.6, 1.2, 1];
    const scale = scales[revealLevel] || 1;
    
    return {
      transform: `scale(${scale})`,
      transition: 'transform 0.5s ease-out'
    };
  };

  // Get reveal progress
  const getRevealProgress = () => {
    return (revealLevel / 4) * 100;
  };

  // Parse answer options from metadata
  const getAnswerOptions = () => {
    if (!currentQuestion) return [];
    
    let options = [];
    
    if (currentQuestion.metadata) {
      // If metadata is a string, try to parse it
      if (typeof currentQuestion.metadata === 'string') {
        try {
          const parsed = JSON.parse(currentQuestion.metadata);
          options = parsed.options || [];
        } catch (e) {
          console.error('Failed to parse metadata string:', e);
        }
      } 
      // If metadata is already an object
      else if (typeof currentQuestion.metadata === 'object') {
        options = currentQuestion.metadata.options || [];
      }
    }
    
    // If no options in metadata, create some defaults
    if (options.length === 0) {
      options = [currentQuestion.correct_answer, "Unknown", "Mystery"];
    }
    
    return options;
  };

  // Loading state
  if (gameState === 'loading') {
    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
        <div className="text-lg">📷 Loading photo questions...</div>
        <div className="text-sm text-purple-300 mt-2">Connecting to database</div>
      </div>
    );
  }

  // Error state
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

  // No current question
  if (!currentQuestion) {
    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
        <div className="text-lg">📷 Getting ready...</div>
      </div>
    );
  }

  const answerOptions = getAnswerOptions();
  const timerPercentage = (timeLeft / 15) * 100;

  return (
    <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
          📷 Photo Mystery
        </h2>
        <p className="text-purple-300 text-sm mb-4">
          Guess what's in the photo before time runs out!
        </p>
        
        {/* Score */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-purple-300">
            Score: {score}/{totalQuestions}
            {totalQuestions > 0 && ` (${Math.round((score/totalQuestions) * 100)}%)`}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-400">
              {questions.length} questions loaded
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border-2 ${
              currentQuestion.difficulty === 'easy' ? 'bg-green-500/20 text-green-300 border-green-400' :
              currentQuestion.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400' :
              'bg-red-500/20 text-red-300 border-red-400'
            }`}>
              {currentQuestion.difficulty.charAt(0).toUpperCase() + currentQuestion.difficulty.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Ready State - Show Image Area and Options */}
      {gameState === 'ready' && (
        <div className="space-y-6">
          {/* Image Area - Empty but ready */}
          <div className="relative bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-xl overflow-hidden h-64 mb-6 flex items-center justify-center">
            <div className="text-center text-purple-300">
              <div className="text-4xl mb-2">📷</div>
              <div className="text-lg font-semibold">Get Ready!</div>
              <div className="text-sm">The mystery image will appear here</div>
            </div>
          </div>

          {/* Answer Options - Always Visible */}
          <div className="grid gap-3 mb-6">
            <div className="text-sm text-purple-300 text-center mb-2">What do you think it could be?</div>
            {answerOptions.map((option, index) => (
              <div
                key={index}
                className="p-4 bg-white/10 border-2 border-purple-500/30 rounded-xl font-semibold text-purple-300 text-center"
              >
                {option}
              </div>
            ))}
          </div>
          
          <div className="p-4 bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 rounded-xl">
            <p className="text-blue-300 text-sm mb-4">
              🎯 <strong>1000 points</strong> to start, but they decrease over time!<br/>
              ⏱️ You have 15 seconds - the image will gradually reveal more details<br/>
              🧠 Balance seeing more vs. keeping points!
            </p>
            <button
              onClick={startGame}
              className="w-full py-3 px-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold border-2 border-green-400 hover:shadow-lg hover:shadow-green-500/25 transition-all"
            >
              🚀 Start the Timer!
            </button>
          </div>
        </div>
      )}

      {/* Countdown State */}
      {gameState === 'countdown' && (
        <div className="space-y-6">
          {/* Image Area - Still Empty During Countdown */}
          <div className="relative bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-xl overflow-hidden h-64 mb-6 flex items-center justify-center">
            <div className="text-8xl font-bold text-purple-400 animate-pulse drop-shadow-lg">3</div>
          </div>

          {/* Answer Options - Still Visible */}
          <div className="grid gap-3">
            {answerOptions.map((option, index) => (
              <div
                key={index}
                className="p-4 bg-white/10 border-2 border-purple-500/30 rounded-xl font-semibold text-purple-300 text-center"
              >
                {option}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Playing State */}
      {gameState === 'playing' && (
        <div className="space-y-6">
          {/* Timer, Points, and Progress */}
          <div className="flex justify-center items-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <div className={`text-xl font-bold ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-cyan-400'}`}>
                ⏰ {timeLeft}s
              </div>
              <div className="w-16 h-2 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-100 ${
                    timeLeft <= 5 ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-cyan-400 to-blue-500'
                  }`}
                  style={{ width: `${(timeLeft / 15) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 text-purple-400">
              <Star size={20} />
              <span className="text-xl font-bold">{Math.round(points)}</span>
            </div>
          </div>

          {/* Reveal Progress */}
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

          {/* Image */}
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

          {/* Answer Options - Now Clickable */}
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

      {/* Result State */}
      {gameState === 'result' && (
        <div className="space-y-6">
          {/* Result Message */}
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

          {/* Final Image */}
          <div className="bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-xl overflow-hidden h-64">
            <img
              src={currentQuestion.prompt}
              alt={currentQuestion.correct_answer}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Next Button */}
          <button
            onClick={nextQuestion}
            className="w-full py-3 px-6 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold border-2 border-purple-400 hover:shadow-lg hover:shadow-purple-500/25 transition-all"
          >
            📷 Next Photo →
          </button>
        </div>
      )}
    </div>
  );
}