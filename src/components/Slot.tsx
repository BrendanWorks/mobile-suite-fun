import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../lib/supabase';
import { GameHandle } from '../lib/gameTypes';

interface SlotPuzzle {
  id: number;
  prompt: string;
  correct_answer: string;
  metadata: {
    blanks: number[];
    tiles: string[];
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

const DEMO_PUZZLES: SlotPuzzle[] = [
  {
    id: -1,
    prompt: 'Couch and chip snack',
    correct_answer: 'POTATO',
    metadata: { blanks: [1, 3, 5], tiles: ['O', 'A', 'O', 'E', 'I', 'U'] },
  },
  {
    id: -2,
    prompt: 'Morning beverage',
    correct_answer: 'COFFEE',
    metadata: { blanks: [0, 2, 4], tiles: ['C', 'F', 'E', 'T', 'A', 'I'] },
  },
];

async function loadPuzzlesFromDB(ids: number[]): Promise<SlotPuzzle[]> {
  const { data, error } = await supabase
    .from('puzzles')
    .select('id, prompt, correct_answer, metadata')
    .in('id', ids);
  if (error || !data || data.length === 0) return DEMO_PUZZLES;
  return data as SlotPuzzle[];
}

async function loadRandomPuzzles(count: number): Promise<SlotPuzzle[]> {
  const { data, error } = await supabase
    .from('puzzles')
    .select('id, prompt, correct_answer, metadata')
    .eq('game_id', 25);
  if (error || !data || data.length === 0) return DEMO_PUZZLES;
  const shuffled = [...data].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count) as SlotPuzzle[];
}

const MAX_SCORE_PER_PUZZLE = 1000;

const Slot = forwardRef<GameHandle, GameProps>(function Slot(
  { puzzleIds, puzzleId, onScoreUpdate, onComplete, timeRemaining = 0 },
  ref
) {
  const [puzzles, setPuzzles] = useState<SlotPuzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filledBlanks, setFilledBlanks] = useState<string[]>([]);
  const [usedTiles, setUsedTiles] = useState<Set<number>>(new Set());
  const [tiles, setTiles] = useState<string[]>([]);
  const [gameState, setGameState] = useState<'loading' | 'playing' | 'correct' | 'wrong' | 'complete'>('loading');
  const [bounceIndex, setBounceIndex] = useState<number | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const startTimeRef = useRef(Date.now());
  const timeRemainingRef = useRef(timeRemaining);
  const completeCalledRef = useRef(false);
  const scoreRef = useRef(0);

  useEffect(() => {
    timeRemainingRef.current = timeRemaining;
  }, [timeRemaining]);

  useEffect(() => {
    const load = async () => {
      let loaded: SlotPuzzle[];
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
  }, []);

  const currentPuzzle = puzzles[currentIndex] ?? null;

  useEffect(() => {
    if (!currentPuzzle) return;
    const shuffled = [...currentPuzzle.metadata.tiles].sort(() => Math.random() - 0.5);
    setTiles(shuffled);
    setFilledBlanks([]);
    setUsedTiles(new Set());
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

  useEffect(() => {
    if (!currentPuzzle || gameState !== 'playing') return;
    if (filledBlanks.length !== currentPuzzle.metadata.blanks.length || filledBlanks.length === 0) return;

    const answerArray = currentPuzzle.correct_answer.split('');
    let isCorrect = true;
    for (let i = 0; i < currentPuzzle.metadata.blanks.length; i++) {
      if (answerArray[currentPuzzle.metadata.blanks[i]] !== filledBlanks[i]) {
        isCorrect = false;
        break;
      }
    }

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
      setGameState('wrong');
      setTimeout(() => {
        setFilledBlanks([]);
        setUsedTiles(new Set());
        setGameState('playing');
      }, 900);
    }
  }, [filledBlanks]);

  const handleTileTap = useCallback((index: number) => {
    if (!currentPuzzle || usedTiles.has(index) || gameState !== 'playing') return;

    const nextBlankIndex = filledBlanks.length;
    const blankPosition = currentPuzzle.metadata.blanks[nextBlankIndex];
    const correctLetter = currentPuzzle.correct_answer[blankPosition];

    if (tiles[index] === correctLetter) {
      setFilledBlanks(prev => [...prev, tiles[index]]);
      setUsedTiles(prev => new Set([...prev, index]));
    } else {
      setBounceIndex(index);
      setTimeout(() => setBounceIndex(null), 400);
    }
  }, [currentPuzzle, filledBlanks, usedTiles, tiles, gameState]);

  if (gameState === 'loading' || !currentPuzzle) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <div className="text-cyan-400 text-lg animate-pulse" style={{ textShadow: '0 0 10px #00ffff' }}>
          Loading...
        </div>
      </div>
    );
  }

  const wordDisplay = currentPuzzle.correct_answer.split('').map((letter, idx) => {
    const isBlank = currentPuzzle.metadata.blanks.includes(idx);
    if (!isBlank) return { letter, isBlank: false, isFilled: false };
    const blankIndex = currentPuzzle.metadata.blanks.indexOf(idx);
    const isFilled = blankIndex < filledBlanks.length;
    return { letter: isFilled ? filledBlanks[blankIndex] : '', isBlank: true, isFilled };
  });

  const isWrong = gameState === 'wrong';
  const isCorrectState = gameState === 'correct';

  const wordLen = currentPuzzle.correct_answer.length;
  const tileSize = wordLen <= 5 ? 62 : wordLen <= 7 ? 52 : wordLen <= 9 ? 42 : 36;
  const tileFontSize = wordLen <= 5 ? '1.75rem' : wordLen <= 7 ? '1.5rem' : wordLen <= 9 ? '1.25rem' : '1rem';
  const tileHeight = Math.round(tileSize * 1.15);

  return (
    <div className="h-full bg-black flex justify-center overflow-hidden">
      <div className="max-w-sm w-full text-white flex flex-col h-full px-3 py-3">

        {/* Progress */}
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <span className="text-xs text-cyan-400/60">
            {currentIndex + 1} / {puzzles.length}
          </span>
          <span className="text-xs text-yellow-400 font-bold" style={{ textShadow: '0 0 8px #fbbf24' }}>
            {totalScore} pts
          </span>
        </div>

        {/* Hint box */}
        <div
          className="rounded-xl border-2 px-4 py-4 mb-3 flex-shrink-0 text-center"
          style={{
            borderColor: 'rgba(251,191,36,0.5)',
            background: 'rgba(251,191,36,0.04)',
            boxShadow: '0 0 15px rgba(251,191,36,0.15)',
          }}
        >
          <div className="text-xs text-cyan-400/60 uppercase tracking-widest mb-2">Hint</div>
          <p
            className="text-yellow-300 font-bold leading-snug"
            style={{ fontSize: 'clamp(1.1rem, 5vw, 1.4rem)', textShadow: '0 0 8px rgba(251,191,36,0.5)' }}
          >
            {currentPuzzle.prompt}
          </p>
        </div>

        {/* Word display */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 mb-3">
          <div className="text-xs text-cyan-400/50 mb-3">Complete the word</div>
          <div className="flex justify-center gap-1.5 flex-wrap">
            {wordDisplay.map(({ letter, isBlank, isFilled }, idx) => (
              <div
                key={idx}
                className="flex items-center justify-center font-black rounded-lg transition-all duration-300"
                style={{
                  width: `${tileSize}px`,
                  height: `${tileHeight}px`,
                  fontSize: tileFontSize,
                  border: isBlank
                    ? isFilled
                      ? isWrong
                        ? '2px solid rgba(239,68,68,0.7)'
                        : isCorrectState
                        ? '2px solid #22c55e'
                        : '2px solid #22d3ee'
                      : '2px solid rgba(0,255,255,0.3)'
                    : '2px solid rgba(0,255,255,0.15)',
                  background: isBlank
                    ? isFilled
                      ? isWrong
                        ? 'rgba(239,68,68,0.15)'
                        : isCorrectState
                        ? 'rgba(34,197,94,0.15)'
                        : 'rgba(0,255,255,0.1)'
                      : 'rgba(0,0,0,0.5)'
                    : 'rgba(0,255,255,0.06)',
                  color: isBlank
                    ? isFilled
                      ? isWrong
                        ? '#f87171'
                        : isCorrectState
                        ? '#4ade80'
                        : '#22d3ee'
                      : 'transparent'
                    : 'rgba(0,255,255,0.7)',
                  boxShadow: isFilled && isCorrectState
                    ? '0 0 12px rgba(34,197,94,0.4)'
                    : isFilled && !isWrong
                    ? '0 0 10px rgba(0,255,255,0.2)'
                    : 'none',
                  opacity: isWrong ? 0.6 : 1,
                }}
              >
                {letter}
              </div>
            ))}
          </div>
        </div>

        {/* Tile pool */}
        <div className="flex-shrink-0 mb-3">
          <div className="text-xs text-cyan-400/50 text-center mb-2">Tap letters to fill blanks</div>
          <div className="flex justify-center gap-2 flex-wrap">
            {tiles.map((letter, idx) => {
              const isUsed = usedTiles.has(idx);
              const isBouncing = bounceIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => handleTileTap(idx)}
                  disabled={isUsed || gameState !== 'playing'}
                  className="flex items-center justify-center font-black rounded-lg transition-all duration-200 touch-manipulation"
                  style={{
                    width: `${tileSize + 4}px`,
                    height: `${tileSize + 4}px`,
                    fontSize: tileFontSize,
                    border: isUsed ? '2px solid rgba(0,255,255,0.1)' : '2px solid rgba(0,255,255,0.35)',
                    background: isUsed ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.6)',
                    color: isUsed ? 'rgba(255,255,255,0.2)' : '#ffffff',
                    boxShadow: isUsed ? 'none' : '0 0 10px rgba(0,255,255,0.15)',
                    opacity: isUsed ? 0.4 : 1,
                    cursor: isUsed ? 'default' : 'pointer',
                    transform: isBouncing ? 'translateY(-6px) scale(1.1)' : 'none',
                    animation: isBouncing ? 'slot-bounce 0.4s ease-in-out' : 'none',
                  }}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>

        {/* Feedback bar */}
        <div
          className="rounded-xl border-2 py-2.5 flex-shrink-0 flex items-center justify-center transition-all duration-300"
          style={{
            borderColor: isCorrectState
              ? 'rgba(34,197,94,0.5)'
              : isWrong
              ? 'rgba(239,68,68,0.5)'
              : 'rgba(0,255,255,0.1)',
            background: isCorrectState
              ? 'rgba(34,197,94,0.1)'
              : isWrong
              ? 'rgba(239,68,68,0.1)'
              : 'rgba(0,0,0,0.3)',
            boxShadow: isCorrectState
              ? '0 0 15px rgba(34,197,94,0.2)'
              : isWrong
              ? '0 0 15px rgba(239,68,68,0.2)'
              : 'none',
            minHeight: '2.5rem',
          }}
        >
          {isCorrectState ? (
            <span className="text-green-400 font-bold text-sm" style={{ textShadow: '0 0 8px #4ade80' }}>
              {currentPuzzle.correct_answer}
            </span>
          ) : isWrong ? (
            <span className="text-red-400 font-bold text-sm animate-pulse">Try again</span>
          ) : (
            <span className="text-cyan-400/30 font-bold text-sm">
              {filledBlanks.length} / {currentPuzzle.metadata.blanks.length} filled
            </span>
          )}
        </div>

        <style>{`
          @keyframes slot-bounce {
            0%, 100% { transform: translateY(0) scale(1); }
            40% { transform: translateY(-8px) scale(1.12); }
            70% { transform: translateY(2px) scale(0.95); }
          }
        `}</style>
      </div>
    </div>
  );
});

export default Slot;
