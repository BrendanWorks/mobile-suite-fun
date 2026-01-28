import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { analytics } from '../lib/analytics';
import VisualTimerBar from './VisualTimerBar';
import SplitDecisionGame from './SplitDecisionGame';
import RankyGame from './RankyGame';
import OddManOutGame from './OddManOutGame';
import PhotoMysteryGame from './PhotoMysteryGame';
import DalmatianPuzzleGame from './DalmatianPuzzleGame';
import ShapeSequenceGame from './ShapeSequenceGame';
import WordRescueGame from './WordRescueGame';
import PopGame from './PopGame';

interface GameWrapperProps {
  gameId: number;
  userId: string;
  onQuit: () => void;
}

const GAME_COMPONENTS: Record<number, any> = {
  7: SplitDecisionGame,
  8: RankyGame,
  9: OddManOutGame,
  10: PhotoMysteryGame,
  11: DalmatianPuzzleGame,
  12: ShapeSequenceGame,
  13: WordRescueGame,
  14: PopGame,
};

const GAME_NAMES: Record<number, string> = {
  7: 'Split Decision',
  8: 'Ranky',
  9: 'Odd Man Out',
  10: 'PhotoMystery',
  11: 'Dalmatian Puzzle',
  12: 'Shape Sequence',
  13: 'Word Rescue',
  14: 'Pop',
};

export default function GameWrapper({ gameId, userId, onQuit }: GameWrapperProps) {
  const [currentRound, setCurrentRound] = useState(1);
  const [currentPuzzle, setCurrentPuzzle] = useState(1);
  const [puzzleData, setPuzzleData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isPaused, setIsPaused] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [showCountdown, setShowCountdown] = useState(true);
  const [countdownNumber, setCountdownNumber] = useState(7);
  const [gameStarted, setGameStarted] = useState(false);
  const [borderBlink, setBorderBlink] = useState(false);
  const [roundScore, setRoundScore] = useState(0);
  const [puzzleScores, setPuzzleScores] = useState<number[]>([]);
  
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const gameName = GAME_NAMES[gameId] || 'Unknown Game';
  const gameStartedRef = useRef(false);

  // Start countdown on mount
  useEffect(() => {
    countdownRef.current = window.setInterval(() => {
      setCountdownNumber((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          handleCountdownFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Handle countdown finish
  const handleCountdownFinish = () => {
    setShowCountdown(false);
    setGameStarted(true);
    setBorderBlink(true);

    // Track game started event
    if (!gameStartedRef.current) {
      analytics.gameStarted(gameName, gameId, userId);
      gameStartedRef.current = true;
    }

    setTimeout(() => setBorderBlink(false), 500);
    setTimeout(() => {
      setBorderBlink(true);
      setTimeout(() => setBorderBlink(false), 500);
    }, 1000);
  };

  // Manual start (skip countdown)
  const handleManualStart = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    handleCountdownFinish();
  };

  // Load puzzle data
  useEffect(() => {
    if (gameStarted) {
      loadPuzzle();
    }
  }, [gameId, currentRound, currentPuzzle, gameStarted]);

  // Timer logic
  useEffect(() => {
    if (!gameStarted || isPaused || hasEnded || showCountdown) {
      return;
    }

    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, hasEnded, gameStarted, showCountdown]);

  const loadPuzzle = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('puzzle_data')
      .select('*')
      .eq('game_id', gameId)
      .eq('sequence_round', currentRound)
      .eq('sequence_order', currentPuzzle)
      .single();

    if (error) {
      console.error('Error loading puzzle:', error);
      analytics.gameError(gameName, `Load puzzle failed: ${error.message}`);
    } else {
      setPuzzleData(data);
      setTimeRemaining(30); // Reset timer for new puzzle
    }
    setIsLoading(false);
  };

  const handleTimeUp = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setHasEnded(true);
    
    // Track as abandoned if time ran out
    analytics.gameAbandoned(gameName, currentPuzzle, currentRound);
  };

  const handlePuzzleComplete = (score: number) => {
    const newPuzzleScores = [...puzzleScores, score];
    setPuzzleScores(newPuzzleScores);
    setRoundScore(roundScore + score);

    // Track puzzle completion
    analytics.puzzleCompleted(gameName, currentPuzzle, score, timeRemaining);

    if (currentPuzzle < 5) {
      // More puzzles in this round
      setCurrentPuzzle(currentPuzzle + 1);
    } else {
      // Round complete
      const totalScore = roundScore + score;
      const perfectRound = newPuzzleScores.every(s => s >= 1000); // Adjust threshold as needed
      
      analytics.roundCompleted(gameName, currentRound, totalScore, perfectRound);

      if (currentRound < 5) {
        setCurrentRound(currentRound + 1);
        setCurrentPuzzle(1);
        setRoundScore(0);
        setPuzzleScores([]);
      } else {
        // All rounds complete
        setHasEnded(true);
      }
    }
  };

  const handleNextPuzzle = () => {
    if (currentPuzzle < 5) {
      setCurrentPuzzle(currentPuzzle + 1);
    }
  };

  const handleNextRound = () => {
    if (currentRound < 5) {
      setCurrentRound(currentRound + 1);
      setCurrentPuzzle(1);
      setRoundScore(0);
      setPuzzleScores([]);
    }
  };

  const handleQuitClick = () => {
    if (!hasEnded) {
      // Track abandonment if quitting mid-game
      analytics.gameAbandoned(gameName, currentPuzzle, currentRound);
    }
    analytics.menuReturned(gameName);
    onQuit();
  };

  const GameComponent = GAME_COMPONENTS[gameId];

  if (!GameComponent) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Game not found</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-900 text-white flex flex-col relative ${borderBlink ? 'border-4 border-white' : ''}`}>
      {/* Countdown Overlay */}
      {showCountdown && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/95">
          <div className="text-center">
            <div className="text-9xl font-bold mb-8">{countdownNumber}</div>
            <button
              onClick={handleManualStart}
              className="relative w-64 h-16 bg-green-600 rounded-lg overflow-hidden group"
            >
              <div
                className="absolute inset-0 bg-white transition-all duration-[7000ms] ease-linear"
                style={{
                  width: `${((7 - countdownNumber) / 7) * 100}%`,
                }}
              />
              <span className="relative z-10 text-black font-bold text-xl">Start Game</span>
            </button>
          </div>
        </div>
      )}

      {/* Header with Controls */}
      <div className="flex-shrink-0 px-6 py-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={handleNextPuzzle}
            disabled={currentPuzzle >= 5}
            className="px-4 py-2 bg-white text-black rounded-lg font-semibold text-sm hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Question
          </button>
          <button
            onClick={handleNextRound}
            disabled={currentRound >= 5}
            className="px-4 py-2 bg-white text-black rounded-lg font-semibold text-sm hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Round
          </button>
        </div>
        <button
          onClick={handleQuitClick}
          disabled={hasEnded}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors"
        >
          {hasEnded ? 'Finished' : 'Back to Menu'}
        </button>
      </div>

      {/* Visual Timer Bar */}
      {gameStarted && !showCountdown && (
        <VisualTimerBar
          totalTime={30}
          timeRemaining={timeRemaining}
          isPaused={isPaused}
        />
      )}

      {/* Game Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-xl">Loading puzzle...</div>
          </div>
        ) : puzzleData && gameStarted ? (
          <GameComponent
            puzzleData={puzzleData}
            onComplete={handlePuzzleComplete}
            timeRemaining={timeRemaining}
            isPaused={isPaused}
          />
        ) : null}
      </div>
    </div>
  );
}