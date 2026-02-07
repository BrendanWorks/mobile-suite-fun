import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GameHandle } from '../lib/gameTypes';
import { audioManager } from '../lib/audioManager';

interface RankAndRollProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onTimerPause?: (paused: boolean) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
  duration?: number;
}

interface RankItem {
  id: number;
  name: string;
  subtitle?: string;
  value: number;
  display_value?: string;
  emoji?: string;
  correct_position: number;
  item_order: number;
}

interface Puzzle {
  id: number;
  title: string;
  instruction: string;
  items: RankItem[];
}

const MAX_PUZZLES = 2;
const ITEMS_PER_PUZZLE = 4;
const TOTAL_ITEMS = MAX_PUZZLES * ITEMS_PER_PUZZLE; // 8 items total

const RankAndRoll = forwardRef<GameHandle, RankAndRollProps>((props, ref) => {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [items, setItems] = useState<RankItem[]>([]);
  const [gameState, setGameState] = useState<'loading' | 'playing' | 'feedback'>('loading');
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCorrectCount, setTotalCorrectCount] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState<{ itemId: number; direction: 'up' | 'down' } | null>(null);
  const [completedPuzzles, setCompletedPuzzles] = useState(0);
  const autoAdvanceTimeoutRef = useRef<number | null>(null);
  const onCompleteRef = useRef(props.onComplete);
  const totalCorrectRef = useRef(0);
  const gameStateRef = useRef(gameState);

  const MAX_HINTS = 3;
  const HINT_PENALTY = 25;

  // Keep refs in sync
  useEffect(() => {
    onCompleteRef.current = props.onComplete;
  }, [props.onComplete]);

  useEffect(() => {
    totalCorrectRef.current = totalCorrectCount;
  }, [totalCorrectCount]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Load audio
  useEffect(() => {
    const loadAudio = async () => {
      await audioManager.loadSound('ranky-select', '/sounds/ranky/select_optimized.mp3', 3);
      await audioManager.loadSound('ranky-win', '/sounds/global/win_optimized.mp3', 2);
      await audioManager.loadSound('global-wrong', '/sounds/global/wrong_optimized.mp3', 2);
    };
    loadAudio();
  }, []);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: totalCorrectRef.current,
      maxScore: TOTAL_ITEMS
    }),
    onGameEnd: () => {
      console.log('RankAndRoll: onGameEnd called (time ran out)');
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
      const callback = onCompleteRef.current;
      const finalCorrect = totalCorrectRef.current;
      console.log('RankAndRoll: Time up! Calling onComplete with correct:', finalCorrect);
      if (callback) {
        callback(finalCorrect, TOTAL_ITEMS, props.timeRemaining);
      }
    },
    skipQuestion: () => {
      handleNextPuzzle();
    },
    canSkipQuestion: true,
    get pauseTimer() {
      return gameStateRef.current === 'feedback';
    },
    loadNextPuzzle: () => {
      handleNextPuzzle();
    }
  }), [props.timeRemaining]);

  const fetchPuzzles = async () => {
    try {
      setGameState('loading');

      const { data, error } = await supabase
        .from('ranking_puzzles')
        .select('*')
        .eq('game_id', 5)
        .limit(MAX_PUZZLES);

      if (error) {
        console.error('Supabase error:', error);
        setGameState('playing');
        return;
      }

      if (!data || data.length === 0) {
        console.error('No ranking puzzles found');
        setGameState('playing');
        return;
      }

      const puzzlesWithItems = await Promise.all(
        data.map(async (puzzle) => {
          const { data: itemsData, error: itemsError } = await supabase
            .from('ranking_items')
            .select('*')
            .eq('puzzle_id', puzzle.id)
            .order('item_order', { ascending: true });

          if (itemsError) {
            console.error('Error fetching items:', itemsError);
            return { ...puzzle, items: [] };
          }

          return { ...puzzle, items: itemsData || [] };
        })
      );

      console.log(`Loaded ${puzzlesWithItems.length} puzzles from Supabase`);
      setPuzzles(puzzlesWithItems);

      if (puzzlesWithItems.length > 0 && puzzlesWithItems[0].items.length > 0) {
        const shuffled = shuffleArray([...puzzlesWithItems[0].items]);
        setItems(shuffled);
      }

      setGameState('playing');
    } catch (error) {
      console.error('Error fetching puzzles:', error);
      setGameState('playing');
    }
  };

  useEffect(() => {
    fetchPuzzles();

    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, []);

  const shuffleArray = (array: any[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (gameState !== 'playing') return;

    audioManager.play('ranky-select');

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    const newItems = [...items];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    setItems(newItems);

    if (showHint?.itemId === items[index].id) {
      setShowHint(null);
    }
  };

  const getHint = () => {
    if (hintsUsed >= MAX_HINTS || gameState !== 'playing') return;

    const wrongItems = items.filter((item, index) => item.correct_position !== index + 1);
    if (wrongItems.length === 0) return;

    const randomWrongItem = wrongItems[Math.floor(Math.random() * wrongItems.length)];
    const currentIndex = items.findIndex(i => i.id === randomWrongItem.id);
    const correctIndex = randomWrongItem.correct_position - 1;
    const direction = currentIndex > correctIndex ? 'up' : 'down';

    setShowHint({ itemId: randomWrongItem.id, direction });
    setHintsUsed(prev => prev + 1);

    setTimeout(() => {
      setShowHint(null);
    }, 3000);
  };

  const checkAnswer = () => {
    if (gameState !== 'playing') return;

    let correct = 0;
    items.forEach((item, index) => {
      if (item.correct_position === index + 1) {
        correct++;
      }
    });

    setCorrectCount(correct);
    
    const newTotalCorrect = totalCorrectCount + correct;
    setTotalCorrectCount(newTotalCorrect);
    totalCorrectRef.current = newTotalCorrect;

    if (props.onScoreUpdate) {
      props.onScoreUpdate(newTotalCorrect, TOTAL_ITEMS);
    }

    if (props.onTimerPause) {
      props.onTimerPause(true);
    }

    if (correct === items.length) {
      audioManager.play('ranky-win');
    } else {
      audioManager.play('global-wrong', 0.3);
    }

    setGameState('feedback');

    const newCompletedPuzzles = completedPuzzles + 1;
    setCompletedPuzzles(newCompletedPuzzles);

    console.log('RankAndRoll: Puzzle completed', {
      puzzleNum: newCompletedPuzzles,
      correct,
      total: items.length,
      isLastPuzzle: newCompletedPuzzles >= MAX_PUZZLES
    });

    if (newCompletedPuzzles >= MAX_PUZZLES) {
      console.log('RankAndRoll: ✅ LAST PUZZLE - Calling onComplete with timeRemaining:', props.timeRemaining);
      const callback = onCompleteRef.current;
      const finalCorrect = totalCorrectRef.current;
      if (callback) {
        callback(finalCorrect, TOTAL_ITEMS, props.timeRemaining);
      }
    } else {
      console.log('RankAndRoll: Moving to next puzzle after 3.5s');
      autoAdvanceTimeoutRef.current = window.setTimeout(() => {
        handleNextPuzzle();
      }, 3500);
    }
  };

  const handleNextPuzzle = () => {
    const nextIndex = currentPuzzleIndex + 1;
    if (nextIndex < puzzles.length && puzzles[nextIndex].items.length > 0) {
      const shuffled = shuffleArray([...puzzles[nextIndex].items]);
      setItems(shuffled);
      setCurrentPuzzleIndex(nextIndex);
      setCorrectCount(0);
      setHintsUsed(0);
      setShowHint(null);
      setGameState('playing');

      if (props.onTimerPause) {
        props.onTimerPause(false);
      }
    }
  };

  if (gameState === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-green-400">
          <div className="text-lg" style={{ textShadow: '0 0 10px #22c55e' }}>
            <BarChart3 className="inline-block w-5 h-5 mr-2" style={{ filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.6))' }} />
            Loading puzzles...
          </div>
          <div className="text-sm text-green-300 mt-2">Connecting to database</div>
        </div>
      </div>
    );
  }

  const currentPuzzle = puzzles[currentPuzzleIndex];
  if (!currentPuzzle) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-white">
          <div className="text-lg text-red-500" style={{ textShadow: '0 0 10px #ff0066' }}>
            ❌ No puzzles available
          </div>
          <div className="text-sm text-green-300 mt-2">Check your database</div>
        </div>
      </div>
    );
  }

  const remainingHints = MAX_HINTS - hintsUsed;

  return (
    <div className="min-h-screen bg-black flex items-start justify-center p-2 pt-2">
      <div className="text-center max-w-2xl w-full text-white">
        <style>{`
          @keyframes pulse-twice {
            0%, 100% { opacity: 1; }
            25% { opacity: 0.5; }
            50% { opacity: 1; }
            75% { opacity: 0.5; }
          }
          .animate-pulse-twice {
            animation: pulse-twice 1s ease-in-out;
          }
          @keyframes hint-pulse {
            0%, 100% {
              transform: scale(1);
              filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.8));
            }
            50% {
              transform: scale(1.2);
              filter: drop-shadow(0 0 15px rgba(251, 191, 36, 1));
            }
          }
          .hint-pulse {
            animation: hint-pulse 0.8s ease-in-out infinite;
          }
        `}</style>

        {/* Header */}
        <div className="mb-1.5">
          <h2 className="text-xl sm:text-2xl font-bold text-green-400 mb-0.5 border-b border-green-400 pb-0.5 flex items-center justify-center gap-2">
            <BarChart3
              className="w-6 h-6 sm:w-7 sm:h-7"
              style={{
                color: '#22c55e',
                filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.6))',
                strokeWidth: 2
              }}
            />
            <span style={{ textShadow: '0 0 10px #22c55e' }}>Ranky</span>
          </h2>

          <p className="text-green-300 text-xs sm:text-sm mb-0.5 text-center">
            Rank 'em!
          </p>

          {/* Hint Button - Centered */}
          <div className="flex justify-center mb-1">
            <button
              onClick={getHint}
              disabled={hintsUsed >= MAX_HINTS || gameState !== 'playing'}
              className={`
                px-2.5 py-0.5 rounded text-xs font-semibold transition-all border-2
                ${hintsUsed >= MAX_HINTS || gameState !== 'playing'
                  ? 'bg-black/50 border-yellow-400/30 text-yellow-400/40 cursor-not-allowed'
                  : 'bg-transparent border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black active:scale-95'
                }
              `}
              style={hintsUsed >= MAX_HINTS || gameState !== 'playing' ? {} : {
                textShadow: '0 0 8px #fbbf24',
                boxShadow: '0 0 10px rgba(251, 191, 36, 0.3)'
              }}
            >
              💡 Hint ({remainingHints})
            </button>
          </div>

          {/* Score */}
          <div className="text-green-300 text-xs sm:text-sm mb-1 text-center">
            Score: <strong className="text-yellow-400 tabular-nums">{totalCorrectCount}</strong>
          </div>
        </div>

        {/* Puzzle Info */}
        <div className="text-center mb-1.5 bg-black/50 border-2 border-green-500 rounded-lg p-1.5" style={{ boxShadow: '0 0 15px rgba(34, 197, 94, 0.3)' }}>
          <h3 className="text-sm sm:text-base font-bold text-green-400 mb-0 break-words" style={{ textShadow: '0 0 10px #22c55e' }}>
            {currentPuzzle.title}
          </h3>
          <p className="text-gray-300 text-xs">
            {currentPuzzle.instruction}
          </p>
        </div>

        {/* Ranking Items */}
        <div className="mb-1.5 space-y-1">
          {items.map((item, index) => {
            const isCorrect = gameState === 'feedback' && item.correct_position === index + 1;
            const isWrong = gameState === 'feedback' && item.correct_position !== index + 1;
            const hasHint = showHint?.itemId === item.id;

            let cardClass = "relative bg-black/50 border-2 rounded-lg p-1.5 transition-all";

            if (gameState === 'feedback') {
              if (isCorrect) {
                cardClass += " border-green-500 bg-green-500/20 animate-pulse";
              } else if (isWrong) {
                cardClass += " border-red-500 bg-red-500/20 animate-pulse-twice";
              }
            } else {
              cardClass += " border-green-500/60 hover:border-green-500";
            }

            const glowStyle = isCorrect ? { boxShadow: '0 0 15px rgba(34, 197, 94, 0.5)' } :
                             isWrong ? { boxShadow: '0 0 15px rgba(239, 68, 68, 0.5)' } :
                             { boxShadow: '0 0 10px rgba(34, 197, 94, 0.2)' };

            const badgeColor = gameState === 'feedback'
              ? (isCorrect ? 'bg-green-500' : 'bg-red-500')
              : 'bg-green-500';

            const badgeShadow = gameState === 'feedback'
              ? (isCorrect ? '0 0 8px rgba(34, 197, 94, 0.6)' : '0 0 8px rgba(239, 68, 68, 0.6)')
              : '0 0 8px rgba(34, 197, 94, 0.6)';

            return (
              <div key={item.id} className={cardClass} style={glowStyle}>
                {/* Number Badge - Positioned on top-left corner */}
                <div className={`absolute -top-2 -left-2 w-6 h-6 rounded-full ${badgeColor} flex items-center justify-center flex-shrink-0 z-10`} style={{ boxShadow: badgeShadow }}>
                  <span className="text-black font-bold text-xs">
                    {index + 1}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pl-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {item.emoji && (
                      <span className="text-lg flex-shrink-0">{item.emoji}</span>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-green-400 text-sm font-semibold truncate">
                        {item.name}
                      </div>
                      {item.subtitle && (
                        <div className="text-gray-300 text-xs truncate">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5 flex-shrink-0" style={{ width: '32px', minHeight: '52px' }}>
                    {gameState === 'playing' ? (
                      <>
                        {hasHint && showHint?.direction === 'up' ? (
                          <div className="w-7 h-7 flex items-center justify-center">
                            <span className="text-xl hint-pulse text-yellow-400">▲</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => moveItem(index, 'up')}
                            disabled={index === 0}
                            className={`w-7 h-7 flex items-center justify-center transition-all
                              ${index === 0
                                ? 'text-green-400/20 cursor-not-allowed'
                                : 'text-green-400 hover:scale-110 active:scale-95'
                              }`}
                            style={index === 0 ? {} : { filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.3))' }}
                          >
                            <span className="text-xl">▲</span>
                          </button>
                        )}

                        {hasHint && showHint?.direction === 'down' ? (
                          <div className="w-7 h-7 flex items-center justify-center">
                            <span className="text-xl hint-pulse text-yellow-400">▼</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => moveItem(index, 'down')}
                            disabled={index === items.length - 1}
                            className={`w-7 h-7 flex items-center justify-center transition-all
                              ${index === items.length - 1
                                ? 'text-green-400/20 cursor-not-allowed'
                                : 'text-green-400 hover:scale-110 active:scale-95'
                              }`}
                            style={index === items.length - 1 ? {} : { filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.3))' }}
                          >
                            <span className="text-xl">▼</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="w-7 h-7 flex items-center justify-center">
                          <span className={`text-xl ${isCorrect ? 'text-green-500/40' : 'text-red-500/40'}`}>▲</span>
                        </div>
                        <div className="w-7 h-7 flex items-center justify-center">
                          <span className={`text-xl ${isCorrect ? 'text-green-500/40' : 'text-red-500/40'}`}>▼</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-center pb-2">
          {gameState === 'playing' ? (
            <button
              onClick={checkAnswer}
              className="w-2/3 py-2 px-4 rounded-lg text-sm font-bold transition-all bg-green-500 text-black hover:bg-green-400 active:scale-95"
              style={{ boxShadow: '0 0 15px rgba(34, 197, 94, 0.4)' }}
            >
              �� Final Answer
            </button>
          ) : (
            <div className={`
              w-2/3 py-2 px-4 rounded-lg text-sm font-bold border-2
              ${correctCount === items.length
                ? 'bg-green-500/20 text-green-400 border-green-500'
                : 'bg-red-500/20 text-red-400 border-red-500'
              }
            `}
            style={{
              boxShadow: correctCount === items.length
                ? '0 0 20px rgba(34, 197, 94, 0.4)'
                : '0 0 20px rgba(239, 68, 68, 0.4)'
            }}>
              {correctCount === items.length
                ? '🎉 Perfect!'
                : `${correctCount} of ${items.length} Correct`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

RankAndRoll.displayName = 'RankAndRoll';

export default RankAndRoll;