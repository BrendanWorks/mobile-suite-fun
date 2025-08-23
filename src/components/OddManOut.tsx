import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function OddManOut() {
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [gameState, setGameState] = useState('loading'); // loading, playing, result, error
  const [isCorrect, setIsCorrect] = useState(false);
  const [message, setMessage] = useState('');
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [usedQuestions, setUsedQuestions] = useState([]);
  const [shuffledItems, setShuffledItems] = useState([]);

  const successMessages = [
    "Excellent! You found the odd ones out!",
    "Perfect! Great logical thinking!",
    "Brilliant! You nailed it!",
    "Outstanding! You've got a keen eye!",
    "Fantastic! Well reasoned!"
  ];

  // Fetch questions from Supabase
  const fetchQuestions = async () => {
    try {
      setGameState('loading');
      
      const { data, error } = await supabase
        .from('puzzles')
        .select('*')
        .eq('game_id', 3); // Odd Man Out game ID
      
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
      setGameState('playing');
      
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
    
    // Shuffle items once when question is generated
    const items = question.prompt.split(';').map(item => item.trim());
    setShuffledItems(shuffleArray(items));
    
    setSelectedItems([]);
    setGameState('playing');
    setMessage('');
  };

  // Shuffle array function
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Handle item selection
  const handleItemClick = (item) => {
    console.log('Item clicked:', item, 'Game state:', gameState);
    if (gameState !== 'playing') return;
    
    if (selectedItems.includes(item)) {
      setSelectedItems(prev => prev.filter(selected => selected !== item));
      console.log('Item deselected, new selection:', selectedItems.filter(s => s !== item));
    } else if (selectedItems.length < 2) {
      setSelectedItems(prev => [...prev, item]);
      console.log('Item selected, new selection:', [...selectedItems, item]);
    }
  };

  // Check answer
  const checkAnswer = () => {
    console.log('🔥 CHECK ANSWER FUNCTION CALLED!');
    console.log('Selected items:', selectedItems);
    console.log('Selected items length:', selectedItems.length);
    
    if (selectedItems.length !== 2) {
      console.log('❌ Not exactly 2 items selected, returning early');
      return;
    }
    
    console.log('✅ We have 2 items, continuing...');
    console.log('Current question:', currentQuestion);
    
    if (!currentQuestion) {
      console.log('❌ No current question, returning early');
      return;
    }
    
    console.log('✅ Have current question, checking answer...');
    
    const correctAnswer = currentQuestion.correct_answer.split(';').map(item => item.trim());
    console.log('Correct answer:', correctAnswer);
    
    const isAnswerCorrect = selectedItems.length === correctAnswer.length &&
      selectedItems.every(item => correctAnswer.includes(item));
    
    console.log('Is answer correct?', isAnswerCorrect);
    
    setIsCorrect(isAnswerCorrect);
    setTotalQuestions(prev => prev + 1);
    
    if (isAnswerCorrect) {
      setScore(prev => prev + 1);
      setMessage(successMessages[Math.floor(Math.random() * successMessages.length)]);
    } else {
      setMessage("Not quite right, but here's the logic:");
    }
    
    setGameState('result');
    console.log('✅ Function completed, setting state to result');
  };

  // Initialize game
  useEffect(() => {
    fetchQuestions();
  }, []);

  // Generate first question when questions are loaded
  useEffect(() => {
    if (questions.length > 0 && !currentQuestion && gameState === 'playing') {
      generateNewQuestion();
    }
  }, [questions, currentQuestion, gameState]);

  // Loading state
  if (gameState === 'loading') {
    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
        <div className="text-lg">🎯 Loading questions...</div>
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
        <div className="text-lg">🎯 Getting ready...</div>
      </div>
    );
  }

  const correctAnswer = currentQuestion.correct_answer.split(';').map(item => item.trim());
  

  // Get logic from metadata
  let logic = 'Think about what makes them different!';
  
  if (currentQuestion.metadata) {
    // If metadata is a string, try to parse it
    if (typeof currentQuestion.metadata === 'string') {
      try {
        const parsed = JSON.parse(currentQuestion.metadata);
        logic = parsed.logic || logic;
      } catch (e) {
        console.error('Failed to parse metadata string:', e);
      }
    } 
    // If metadata is already an object
    else if (typeof currentQuestion.metadata === 'object') {
      logic = currentQuestion.metadata.logic || logic;
    }
  }

  return (
    <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
          🎯 Odd Man Out
        </h2>
        <p className="text-purple-300 text-sm mb-4">
          Pick the TWO items that don't belong with the others!
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

      {/* Instructions */}
      <div className="mb-6 p-4 bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 rounded-xl">
        <p className="text-blue-300 text-sm">
          Select exactly <strong>2 items</strong> that don't belong with the other 3.
          Think about categories, themes, or what makes them different!
        </p>
      </div>

      {/* Items Grid */}
      <div className="mb-6">
        <div className="grid grid-cols-1 gap-3">
          {shuffledItems.map((item, index) => {
            const isSelected = selectedItems.includes(item);
            const isCorrectAnswer = gameState === 'result' && correctAnswer.includes(item);
            const isWrongAnswer = gameState === 'result' && !correctAnswer.includes(item);
            
            return (
            <button
              key={index}
              onClick={() => handleItemClick(item)}
              disabled={gameState !== 'playing'}
              className={`
                p-4 rounded-xl font-medium text-left transition-all duration-200 border-2
                ${isSelected && gameState === 'playing'
                  ? 'bg-blue-500/20 border-blue-400 text-blue-300 shadow-lg shadow-blue-500/25'
                  : isCorrectAnswer
                    ? 'bg-green-500/20 border-green-400 text-green-300 shadow-lg shadow-green-500/25'
                    : isWrongAnswer
                      ? 'bg-white/10 text-gray-300 border-gray-600'
                      : 'bg-white/10 hover:bg-white/20 text-white border-purple-500/30 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/25'
                }
                ${gameState === 'playing' && !isSelected && selectedItems.length < 2
                  ? 'hover:scale-102 active:scale-98'
                  : ''
                }
                ${gameState !== 'playing' ? 'cursor-default' : 'cursor-pointer'}
              `}
            >
              {item}
            </button>
            );
          })}
        </div>
      </div>

      {/* Selected Items Display */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-purple-300 mb-2">Your Selection:</h4>
        <div className="min-h-12 bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-xl p-3">
          {selectedItems.length === 0 ? (
            <span className="text-purple-400 text-sm">Select 2 items that don't belong...</span>
          ) : (
            <div className="text-sm">
              <strong className="text-white">{selectedItems.join(' & ')}</strong>
              {selectedItems.length < 2 && (
                <span className="text-purple-400 ml-2">
                  (Select {2 - selectedItems.length} more)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Button */}
      {gameState === 'playing' ? (
        <button
          onClick={checkAnswer}
          disabled={selectedItems.length !== 2}
          className={`
            w-full py-4 px-6 rounded-xl font-semibold text-white transition-all border-2
            ${selectedItems.length === 2
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-blue-400 hover:shadow-lg hover:shadow-blue-500/25 active:scale-98'
              : 'bg-gray-600 border-gray-500 cursor-not-allowed opacity-50'
            }
          `}
        >
          {selectedItems.length === 2 ? '🎯 Check Answer' : `Select ${2 - selectedItems.length} more item${2 - selectedItems.length === 1 ? '' : 's'}`}
        </button>
      ) : (
        <div>
          {/* Result */}
          <div className={`
            mb-4 p-4 rounded-xl border-2 shadow-lg backdrop-blur-sm
            ${isCorrect 
              ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border-green-400 shadow-green-500/25' 
              : 'bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-300 border-red-400 shadow-red-500/25'
            }
          `}>
            <div className="text-lg font-bold mb-2">
              {message}
            </div>
            <div className="text-sm mb-3">
              <strong>Correct answer:</strong> <span className="text-white">{correctAnswer.join(' & ')}</span>
            </div>
            {/* Always show the explanation */}
            <div className="text-sm bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-3">
              <strong className="text-white">Explanation:</strong> <span className="text-gray-200">{logic}</span>
            </div>
          </div>

          {/* Next Question Button */}
          <button
            onClick={generateNewQuestion}
            className="w-full py-4 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-600 border-2 border-purple-400 hover:shadow-lg hover:shadow-purple-500/25 active:scale-98 transition-all"
          >
            🎲 Next Question
          </button>
        </div>
      )}
    </div>
  );
}