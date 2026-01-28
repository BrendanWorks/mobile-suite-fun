import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { analytics } from '../lib/analytics';
import VisualTimerBar from './VisualTimerBar';
// Import your game components...
// (keeping this placeholder since you have your own)

interface GameWrapperProps {
  gameId: number;
  userId: string;
  onQuit: () => void;
}

// Game name mapping (adjust to match your actual game IDs)
const GAME_NAMES: Record<number, string> = {
  2: 'Odd Man Out',
  3: 'Zooma',
  4: 'Ranky',
  5: 'Dalmatian Puzzle',
  6: 'Split Decision',
  7: 'Pop',
  8: 'Shape Sequence',
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
  
  // Score tracking
  const [roundScore, setRoundScore] = useState(0);
  const [puzzleScores, setPuzzleScores] = useState<number[]>([]);
  const [totalGameScore, setTotalGameScore] = useState(0);
  const [allRoundScores, setAllRoundScores] = useState<number[]>([]);
  
  // Time tracking
  const [puzzleStartTime, setPuzzleStartTime] = useState<number>(0);
  const [roundStartTime, setRoundStartTime] = useState<number>(0);
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  const [puzzleTimes, setPuzzleTimes] = useState<number[]>([]);
  
  // Streak tracking
  const [perfectPuzzleStreak, setPerfectPuzzleStreak] = useState(0);
  const [perfectRoundStreak, setPerfectRoundStreak] = useState(0);
  
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
    
    const now = Date.now();
    setGameStartTime(now);
    setRoundStartTime(now);
    setPuzzleStartTime(now);

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
    
    // Track puzzle start
    analytics.puzzleStarted(gameName, currentRound, currentPuzzle);
    setPuzzleStartTime(Date.now());
    
    const { data, error } = await supabase
      .from('puzzle_data')
      .select('*')
      .eq('game_id', gameId)
      .eq('sequence_round', currentRound)
      .eq('sequence_order', currentPuzzle)
      .single();

    if (error) {
      console.error('Error loading puzzle:', error);
      analytics.gameError(gameName, `Load puzzle failed: ${error.message}`, `R${currentRound}P${currentPuzzle}`);
    } else {
      setPuzzleData(data);
      setTimeRemaining(30); // Reset timer for new puzzle
    }
    setIsLoading(false);
  };

  const handleTimeUp = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setHasEnded(true);
    
    const timePlayedSeconds = Math.round((Date.now() - gameStartTime) / 1000);
    analytics.gameAbandoned(gameName, currentRound, currentPuzzle, totalGameScore + roundScore, timePlayedSeconds);
  };

  const handlePuzzleComplete = (score: number) => {
    const puzzleTime = Math.round((Date.now() - puzzleStartTime) / 1000);
    const isPerfect = score >= 1000; // Adjust threshold as needed
    
    // Update scores
    const newPuzzleScores = [...puzzleScores, score];
    setPuzzleScores(newPuzzleScores);
    setRoundScore(roundScore + score);
    
    // Update times
    const newPuzzleTimes = [...puzzleTimes, puzzleTime];
    setPuzzleTimes(newPuzzleTimes);
    
    // Track perfect streak
    if (isPerfect) {
      const newStreak = perfectPuzzleStreak + 1;
      setPerfectPuzzleStreak(newStreak);
      
      // Track streak milestones
      if (newStreak === 3 || newStreak === 5 || newStreak === 10) {
        analytics.streakAchieved(gameName, newStreak, 'puzzle');
      }
    } else {
      setPerfectPuzzleStreak(0);
    }
    
    // Track low scores
    analytics.lowScore(gameName, currentRound, currentPuzzle, score);
    
    // Track score thresholds
    if (score >= 800) analytics.scoreThreshold(gameName, 800, score);
    if (score >= 900) analytics.scoreThreshold(gameName, 900, score);
    if (score >= 1000) analytics.scoreThreshold(gameName, 1000, score);
    
    // Track puzzle completion with enhanced data
    analytics.puzzleCompleted(
      gameName,
      currentRound,
      currentPuzzle,
      score,
      timeRemaining,
      isPerfect
    );

    if (currentPuzzle < 5) {
      // More puzzles in this round
      setCurrentPuzzle(currentPuzzle + 1);
    } else {
      // Round complete
      handleRoundComplete(roundScore + score, newPuzzleScores, newPuzzleTimes);
    }
  };

  const handleRoundComplete = (totalScore: number, scores: number[], times: number[]) => {
    const perfectRound = scores.every(s => s >= 1000);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    
    // Update round tracking
    const newAllRoundScores = [...allRoundScores, totalScore];
    setAllRoundScores(newAllRoundScores);
    setTotalGameScore(totalGameScore + totalScore);
    
    // Track perfect round streak
    if (perfectRound) {
      const newStreak = perfectRoundStreak + 1;
      setPerfectRoundStreak(newStreak);
      
      if (newStreak === 2 || newStreak === 5) {
        analytics.streakAchieved(gameName, newStreak, 'round');
      }
    } else {
      setPerfectRoundStreak(0);
    }
    
    // Track round completion
    analytics.roundCompleted(
      gameName,
      currentRound,
      totalScore,
      perfectRound,
      avgTime
    );

    if (currentRound < 5) {
      // Next round
      setCurrentRound(currentRound + 1);
      setCurrentPuzzle(1);
      setRoundScore(0);
      setPuzzleScores([]);
      setPuzzleTimes([]);
      setRoundStartTime(Date.now());
    } else {
      // All rounds complete - game finished!
      handleGameComplete(newAllRoundScores);
    }
  };

  const handleGameComplete = (allScores: number[]) => {
    const finalScore = allScores.reduce((a, b) => a + b, 0);
    const perfectGame = allScores.every(roundScore => {
      // Assuming each round has 5 puzzles at 1000 points each = 5000 max per round
      return roundScore >= 5000;
    });
    const totalTimePlayed = Math.round((Date.now() - gameStartTime) / 1000);
    
    analytics.gameCompleted(gameName, finalScore, perfectGame, totalTimePlayed);
    
    setHasEnded(true);
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
      setPuzzleTimes([]);
      setRoundStartTime(Date.now());
    }
  };

  const handleQuitClick = () => {
    const completedGame = hasEnded && currentRound === 5 && currentPuzzle === 5;
    
    if (!hasEnded && !completedGame) {
      // Track abandonment if quitting mid-game
      const timePlayedSeconds = Math.round((Date.now() - gameStartTime) / 1000);
      analytics.gameAbandoned(
        gameName,
        currentRound,
        currentPuzzle,
        totalGameScore + roundScore,
        timePlayedSeconds
      );
    }
    
    analytics.menuReturned(gameName, completedGame);
    onQuit();
  };

  // Rest of your GameWrapper JSX...
  // (Keep your existing rendering logic)
  
  return (
    <div className={`min-h-screen bg-gray-900 text-white flex flex-col relative ${borderBlink ? 'border-4 border-white' : ''}`}>
      {/* Your existing countdown, header, timer, and game content */}
      {/* ... */}
    </div>
  );
}