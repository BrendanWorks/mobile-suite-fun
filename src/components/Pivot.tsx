import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../lib/supabase';
import { GameHandle } from '../lib/gameTypes';
import { audioManager } from '../lib/audioManager';

interface PivotPuzzle {
  id: number;
  correct_answer: string;
  metadata: {
    word1: string;
    word2: string;
    options: string[];
  };
}

interface GameProps {
  puzzleIds?: number[] | null;
  puzzleId?: number | null;
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
  duration?: number;
}

const DEMO_PUZZLES: PivotPuzzle[] = [
  {
    id: -1,
    correct_answer: 'POTATO',
    metadata: {
      word1: 'Couch',
      word2: 'Chip',
      options: ['FRENCH', 'POTATO', 'TOMATO', 'CARROT'].sort(() => Math.random() - 0.5),
    },
  },
  {
    id: -2,
    correct_answer: 'APPLE',
    metadata: {
      word1: 'Big',
      word2: 'Pie',
      options: ['ORANGE', 'APPLE', 'CHERRY', 'GRAPE'].sort(() => Math.random() - 0.5),
    },
  },
];

async function loadPuzzlesFromDB(ids: number[]): Promise<PivotPuzzle[]> {
  const { data, error } = await supabase
    .from('puzzles')
    .select('id, correct_answer, metadata')
    .in('id', ids);
  if (error || !data || data.length === 0) return DEMO_PUZZLES;
  return data.map(puzzle => ({
    ...puzzle,
    metadata: {
      ...puzzle.metadata,
      options: [...puzzle.metadata.options].sort(() => Math.random() - 0.5)
    }
  })) as PivotPuzzle[];
}

async function loadRandomPuzzles(count: number): Promise<PivotPuzzle[]> {
  const { data, error } = await supabase
    .from('puzzles')
    .select('id, correct_answer, metadata')
    .eq('game_id', 26);
  if (error || !data || data.length === 0) return DEMO_PUZZLES;
  const shuffled = [...data].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(puzzle => ({
    ...puzzle,
    metadata: {
      ...puzzle.metadata,
      options: [...puzzle.metadata.options].sort(() => Math.random() - 0.5)
    }
  })) as PivotPuzzle[];
}

const MAX_SCORE_PER_PUZZLE = 1000;

const Pivot = forwardRef<GameHandle, GameProps>(function Pivot(
  { puzzleIds, puzzleId, onScoreUpdate, onComplete, timeRemaining = 0 },
  ref
) {
  const [puzzles, setPuzzles] = useState<PivotPuzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [gameState, setGameState] = useState<'loading' | 'playing' | 'correct' | 'wrong' | 'complete'>('loading');
  const [totalScore, setTotalScore] = useState(0);
  const startTimeRef = useRef(Date.now());
  const timeRemainingRef = useRef(timeRemaining);
  const completeCalledRef = useRef(false);
  const scoreRef = useRef(0);

  useEffect(() => {
    audioManager.loadSound('ranky-select', '/sounds/ranky/Select_Optimized.mp3', 3);
    audioManager.loadSound('global-wrong', '/sounds/global/wrong_optimized.mp3', 2);
  }, []);

  useEffect(() => {
    timeRemainingRef.current = timeRemaining;
  }, [timeRemaining]);

  // Load puzzles when puzzleIds or puzzleId changes
  useEffect(() => {
    const load = async () => {
      let loaded: PivotPuzzle[];
      if (puzzleIds && puzzleIds.length > 0) {
        loaded = await loadPuzzlesFromDB(puzzleIds);
      } else if (puzzleId) {
        loaded = await loadPuzzlesFromDB([puzzleId]);
      } else {
        loaded = await loadRandomPuzzles(3);
      }
      setPuzzles(loaded);
      setGameState('playing');
    };
    load();
  }, [puzzleIds, puzzleId]);

  const currentPuzzle = puzzles[currentIndex] ?? null;

  useEffect(() => {
    if (!currentPuzzle) return;
    setSelectedOption(null);
    startTimeRef.current = Date.now();
  }, [currentIndex, currentPuzzle?.id]);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score: scoreRef.current, maxScore: Math.max(1, puzzles.length) * MAX_SCORE_PER_PUZZLE }),
    onGameEnd: () => {},
    hideTimer: false,
  }), [puzzles.length]);

  const advanceOrComplete = useCallback((newTotal: number, puzzleCount: number) => {
    const isLast = currentIndex >= puzzleCount - 1;
    if (isLast) {
      if (!completeCalledRef.current) {
        completeCalledRef.current = true;
        const maxScore = puzzleCount * MAX_SCORE_PER_PUZZLE;
        onScoreUpdate?.(newTotal, maxScore);
        setTimeout(() => {
          onComplete?.(newTotal, maxScore, timeRemainingRef.current);
        }, 1200);
      }
      setGameState('complete');
    } else {
      setTimeout(() => {
        setCurrentIndex(i => i + 1);
        setGameState('playing');
      }, 1200);
    }
  }, [currentIndex, onComplete, onScoreUpdate]);

  const handleOptionSelect = useCallback((option: string) => {
    if (gameState !== 'playing' || selectedOption) return;

    audioManager.play('ranky-select');
    setSelectedOption(option);

    const isCorrect = option === currentPuzzle?.correct_answer;

    if (isCorrect) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const timeBonus = Math.max(0, timeRemainingRef.current - Math.ceil(elapsed));
      const roundScore = Math.round(MAX_SCORE_PER_PUZZLE + timeBonus * 50);
      const newTotal = totalScore + roundScore;
      setTotalScore(newTotal);
      scoreRef.current = newTotal;
      onScoreUpdate?.(newTotal, puzzles.length * MAX_SCORE_PER_PUZZLE);
      setGameState('correct');
      advanceOrComplete(newTotal, puzzles.length);
    } else {
      audioManager.play('global-wrong');
      setGameState('wrong');
      setTimeout(() => {
        setSelectedOption(null);
        setGameState('playing');
      }, 900);
    }
  }, [currentPuzzle, gameState, selectedOption, totalScore, puzzles.length, onScoreUpdate, advanceOrComplete]);

  if (gameState === 'loading' || !currentPuzzle) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <div className="text-cyan-400 text-lg animate-pulse" style={{ textShadow: '0 0 10px #00ffff' }}>
          Loading...
        </div>
      </div>
    );
  }

  const isWrong = gameState === 'wrong';
  const isCorrectState = gameState === 'correct';

  return (
    <div className="h-full bg-black flex justify-center overflow-y-auto">
      <div className="max-w-sm w-full text-white flex flex-col px-2 py-2 gap-4">

        {/* Progress */}
        <div className="flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-cyan-400/60">
            {currentIndex + 1} / {puzzles.length}
          </span>
          <span className="text-xs text-yellow-400 font-bold" style={{ textShadow: '0 0 8px #fbbf24' }}>
            {totalScore} pts
          </span>
        </div>

        {/* Question label */}
        <div className="text-xs text-cyan-400/50 text-center">
          Find the connecting word
        </div>

        {/* Word pair display */}
        <div className="flex items-center justify-center gap-3 flex-shrink-0">
          {/* Word 1 */}
          <div
            className="rounded-lg border-2 px-4 py-3 flex-1 text-center"
            style={{
              borderColor: 'rgba(251,191,36,0.5)',
              background: 'rgba(251,191,36,0.04)',
              boxShadow: '0 0 15px rgba(251,191,36,0.15)',
            }}
          >
            <p className="text-yellow-300 font-bold text-sm leading-tight">
              {currentPuzzle.metadata.word1}
            </p>
          </div>

          {/* Connector */}
          <div className="text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 8px #00ffff' }}>
            ?
          </div>

          {/* Word 2 */}
          <div
            className="rounded-lg border-2 px-4 py-3 flex-1 text-center"
            style={{
              borderColor: 'rgba(251,191,36,0.5)',
              background: 'rgba(251,191,36,0.04)',
              boxShadow: '0 0 15px rgba(251,191,36,0.15)',
            }}
          >
            <p className="text-yellow-300 font-bold text-sm leading-tight">
              {currentPuzzle.metadata.word2}
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <div className="text-xs text-cyan-400/50 text-center">Select the connecting word</div>
          <div className="flex flex-col gap-2">
            {currentPuzzle.metadata.options.map((option, idx) => {
              const isSelected = selectedOption === option;
              const isCorrect = option === currentPuzzle.correct_answer;
              let buttonState = 'default';

              if (isSelected && isCorrect && isCorrectState) {
                buttonState = 'correct';
              } else if (isSelected && !isCorrect && isWrong) {
                buttonState = 'wrong';
              } else if (selectedOption && !isSelected) {
                buttonState = 'dimmed';
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleOptionSelect(option)}
                  disabled={gameState !== 'playing' || !!selectedOption}
                  className="py-3 px-4 rounded-lg border-2 font-semibold text-sm transition-all duration-200"
                  style={{
                    borderColor:
                      buttonState === 'correct'
                        ? '#22c55e'
                        : buttonState === 'wrong'
                        ? '#ef4444'
                        : buttonState === 'dimmed'
                        ? 'rgba(0,255,255,0.1)'
                        : 'rgba(0,255,255,0.35)',
                    background:
                      buttonState === 'correct'
                        ? 'rgba(34,197,94,0.2)'
                        : buttonState === 'wrong'
                        ? 'rgba(239,68,68,0.2)'
                        : buttonState === 'dimmed'
                        ? 'rgba(0,0,0,0.3)'
                        : 'rgba(0,0,0,0.5)',
                    color:
                      buttonState === 'correct'
                        ? '#22c55e'
                        : buttonState === 'wrong'
                        ? '#ef4444'
                        : buttonState === 'dimmed'
                        ? 'rgba(255,255,255,0.3)'
                        : '#ffffff',
                    boxShadow:
                      buttonState === 'correct'
                        ? '0 0 15px rgba(34,197,94,0.3)'
                        : buttonState === 'wrong'
                        ? '0 0 15px rgba(239,68,68,0.3)'
                        : 'none',
                    cursor: gameState !== 'playing' || selectedOption ? 'default' : 'pointer',
                    opacity: buttonState === 'dimmed' ? 0.5 : 1,
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        {/* Feedback */}
        {isCorrectState && (
          <div className="text-center text-green-400 font-bold text-sm flex-shrink-0" style={{ textShadow: '0 0 8px #4ade80' }}>
            {currentPuzzle.metadata.word1} → {currentPuzzle.correct_answer} → {currentPuzzle.metadata.word2}
          </div>
        )}
        {isWrong && (
          <div className="text-center text-red-400 font-bold text-sm animate-pulse flex-shrink-0">
            Try again
          </div>
        )}
      </div>
    </div>
  );
});

export default Pivot;