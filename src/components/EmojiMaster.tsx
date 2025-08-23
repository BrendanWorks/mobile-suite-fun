import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { puzzleData as fallbackPuzzles } from '../data/emojiPuzzles';
import { useAuth } from '../hooks/useAuth';
import { useUserProgress } from '../hooks/useUserProgress';
import AuthModal from './AuthModal';
import { User, Trophy, TrendingUp } from 'lucide-react';

// Fun wrong answer messages
const wrongMessages = [
  "Not even close, rookie.",
  "Bold guess… boldly wrong.",
  "You just gave the emojis a good laugh.",
  "Swing and a miss, Master-in-training.",
  "That's… creative. Not correct, though.",
  "Oh no. The emojis are shaking their heads.",
  "Wrong. But at least you tried.",
  "Emoji Master? More like Emoji Apprentice.",
  "Close-ish… but still wrong.",
  "You're going to have to try harder than that.",
  "Oof. That one hurt my pixels.",
  "Nope. Even the coffee cup emoji saw that coming.",
  "Incorrect. But you looked confident doing it."
];

const nearMissMessages = [
  "Ooh — close! That's on the right track.",
  "Almost — you nearly cracked it!",
  "Very close — small tweak and you've got it."
];

// Choose a message (optionally pass 'near' for near-miss)
function pickWrongMessage(kind = 'normal') {
  const pool = (kind === 'near') ? nearMissMessages : wrongMessages;
  return pool[Math.floor(Math.random() * pool.length)];
}

interface Puzzle {
  emojis: string;
  answer: string;
  options: string[];
  difficulty?: string;
}

// Function to load puzzles from Supabase
async function loadEmojiMasterPuzzles() {
  const { data, error } = await supabase
    .from('puzzles')
    .select(`
      emojis,
      correct_answer,
      wrong_answers,
      difficulty
    `)
    .eq('game_id', (
      await supabase
        .from('games')
        .select('id')
        .eq('slug', 'emoji-master')
        .single()
    ).data?.id)
    .limit(25)

  if (error) {
    console.error('Error fetching puzzles:', error)
    return []
  }
  
  // Transform database format to component format
  return data.map(puzzle => ({
    emojis: puzzle.emojis,
    answer: puzzle.correct_answer,
    options: [puzzle.correct_answer, ...puzzle.wrong_answers].sort(() => Math.random() - 0.5),
    difficulty: puzzle.difficulty
  }))
}

export default function EmojiDetective() {
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [wrongMessage, setWrongMessage] = useState<string>('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [gameStats, setGameStats] = useState(null);
  const [currentScore, setCurrentScore] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);

  const { user } = useAuth();
  const { saveProgress, getGameStats } = useUserProgress();

  // Load puzzles from Supabase on component mount
  useEffect(() => {
    const fetchPuzzles = async () => {
      setLoading(true);
      const puzzles = await loadEmojiMasterPuzzles();
      
      if (puzzles && puzzles.length > 0) {
        // Now you can pass `puzzles` to your game logic
        setPuzzles(puzzles);
      } else {
        // Fallback to local data if database is empty or error
        console.log('Using fallback puzzles');
        setPuzzles(fallbackPuzzles);
      }
      setLoading(false);
    };

    fetchPuzzles();
  }, []);

  // Load user stats when user changes
  useEffect(() => {
    if (user) {
      loadUserStats();
    } else {
      setGameStats(null);
    }
  }, [user]);

  const loadUserStats = async () => {
    const stats = await getGameStats(1); // Emoji Master game ID is 1
    setGameStats(stats);
  };

  // Generate a new random puzzle
  const generateNewPuzzle = () => {
    if (puzzles.length === 0) return;
    
    const shuffled = [...puzzles].sort(() => Math.random() - 0.5);
    const puzzle = shuffled[0];
    
    // Shuffle the options
    const shuffledOptions = [...puzzle.options].sort(() => Math.random() - 0.5);
    
    setCurrentPuzzle({
      ...puzzle,
      options: shuffledOptions
    });
    setSelectedAnswer(null);
    setShowResult(false);
    setIsCorrect(false);
    setWrongMessage('');
  };

  // Handle answer selection
  const handleAnswerSelect = async (answer: string) => {
    if (showResult) return; // Prevent selection after showing result
    
    setSelectedAnswer(answer);
    const correct = answer === currentPuzzle?.answer;
    setIsCorrect(correct);
    
    // Generate a fun wrong message if incorrect
    setTotalAnswers(prev => prev + 1);
    
    if (!correct) {
      // Simple heuristic for "near miss" - if the wrong answer contains some words from the correct answer
      const correctWords = currentPuzzle.answer.toLowerCase().split(' ');
      const selectedWords = answer.toLowerCase().split(' ');
      const hasCommonWords = correctWords.some(word => 
        selectedWords.some(selectedWord => 
          word.length > 3 && selectedWord.includes(word)
        )
      );
      
      setWrongMessage(pickWrongMessage(hasCommonWords ? 'near' : 'normal'));
    } else {
      setCorrectAnswers(prev => prev + 1);
      setCurrentScore(prev => prev + 100); // 100 points per correct answer
    }
    
    setShowResult(true);
    
    // Save progress if user is authenticated and answer is correct
    if (user && correct) {
      await saveProgress(1, 100); // Emoji Master game ID is 1, 100 points per correct answer
      await loadUserStats(); // Refresh stats
    }
  };

  const resetGameStats = () => {
    setCurrentScore(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
  };

  // Initialize with first puzzle
  useEffect(() => {
    if (puzzles.length > 0) {
      generateNewPuzzle();
    }
  }, [puzzles]);

  if (loading) {
    return (
      <div className="text-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl p-8">
        <div className="text-lg font-medium text-white mb-2">Loading puzzles...</div>
        <div className="text-sm text-purple-300">Fetching fresh challenges from the cloud!</div>
      </div>
    );
  }

  if (!currentPuzzle) {
    return (
      <div className="text-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl p-8">
        <div className="text-lg font-medium text-white mb-2">No puzzles available</div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="text-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl p-6 text-white">
      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      
      {/* Game Title */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
          🎯 Emoji Master
        </h2>
        <p className="text-purple-300 text-sm">
          Master the art of emoji interpretation!
        </p>
        
        {/* User Stats Bar */}
        <div className="mt-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-2 text-sm">
                <User size={16} className="text-green-400" />
                <span className="text-green-400">Signed In</span>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 px-3 py-1 rounded-full border border-blue-400 transition-colors"
              >
                <User size={16} />
                Sign In to Save Progress
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Trophy size={16} className="text-yellow-400" />
              <span>Session: {currentScore}</span>
            </div>
            <div className="text-purple-300">
              {correctAnswers}/{totalAnswers} correct
            </div>
          </div>
        </div>
        
        {/* User Game Stats */}
        {user && gameStats && (
          <div className="mt-3 p-3 bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-xl">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1">
                <TrendingUp size={16} className="text-cyan-400" />
                <span className="text-cyan-400">Your Stats:</span>
              </div>
              <div className="flex gap-4">
                <span>Games: {gameStats.gamesPlayed}</span>
                <span>Best: {gameStats.bestScore}</span>
                <span>Avg: {gameStats.averageScore}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Emoji Puzzle */}
      <div className="mb-8">
        <div className="bg-gradient-to-br from-indigo-800/50 to-purple-800/50 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-8 mb-4 shadow-lg shadow-purple-500/10">
          <div className="text-4xl mb-4 leading-relaxed">
            {currentPuzzle.emojis}
          </div>
          <p className="text-purple-300 text-sm">
            What's the story here?
          </p>
        </div>
      </div>

      {/* Answer Options */}
      <div className="space-y-3 mb-8">
        {currentPuzzle.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleAnswerSelect(option)}
            disabled={showResult}
            className={`
              w-full p-4 rounded-xl font-medium text-left transition-all duration-200 border-2
              ${showResult
                ? option === currentPuzzle.answer
                  ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border-green-400 shadow-lg shadow-green-500/25'
                  : option === selectedAnswer
                    ? 'bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-300 border-red-400 shadow-lg shadow-red-500/25'
                    : 'bg-white/10 text-gray-300 border-gray-600'
                : 'bg-white/10 text-white border-purple-500/30 hover:bg-white/20 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/25 active:scale-98'
              }
            `}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Result Message */}
      {showResult && (
        <div className={`
          p-6 rounded-xl mb-6 text-center border-2 shadow-lg
          ${isCorrect 
            ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border-green-400 shadow-green-500/25' 
            : 'bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-300 border-red-400 shadow-red-500/25'
          }
        `}>
          {isCorrect ? (
            <div>
              <div className="text-lg font-bold mb-1">
                🕵️ You cracked the case!
              </div>
              <div className="text-sm">
                Great detective work!
              </div>
            </div>
          ) : (
            <div>
              <div className="text-lg font-bold mb-1">
                🤔 {wrongMessage}
              </div>
              <div className="text-sm">
                The answer was: <strong className="text-white">{currentPuzzle.answer}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Next Puzzle Button */}
      <button
        onClick={() => {
          generateNewPuzzle();
          if (showResult && isCorrect) {
            // Don't reset stats on correct answers, just continue
          }
        }}
        className={`
          w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 border-2
          ${showResult
            ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-blue-400 hover:shadow-lg hover:shadow-blue-500/25 active:scale-98'
            : 'bg-gray-600 border-gray-500 cursor-not-allowed opacity-50'
          }
        `}
        disabled={!showResult}
      >
        {showResult ? '🎲 Next Puzzle' : 'Select an answer first'}
      </button>
      
      {/* Reset Session Button */}
      {(correctAnswers > 0 || totalAnswers > 0) && (
        <button
          onClick={resetGameStats}
          className="w-full mt-3 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-xl transition-colors"
        >
          Reset Session Stats
        </button>
      )}
    </div>
  );
}