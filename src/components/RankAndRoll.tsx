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
  puzzleId?: number | null;
  rankingPuzzleId?: number | null;
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

const RankAndRoll = forwardRef<GameHandle, RankAndRollProps>((props, ref) => {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [items, setItems] = useState<RankItem[]>([]);
  const [gameState, setGameState] = useState<'loading' | 'playing' | 'feedback'>('loading');
  const [correctCount, setCorrectCount] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState<{ itemId: number; direction: 'up' | 'down' } | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const onCompleteRef = useRef(props.onComplete);
  const correctCountRef = useRef(0);
  const gameStateRef = useRef(gameState);
  const itemCountRef = useRef(0);

  const MAX_HINTS = 3;
  const HINT_PENALTY = 25;
  const FEEDBACK_DISPLAY_TIME = 3500; // Time to show feedback before completing

  // Keep refs in sync
  useEffect(() => {
    onCompleteRef.current = props.onComplete;
  }, [props.onComplete]);

  useEffect(() => {
    correctCountRef.current = correctCount;
  }, [correctCount]);

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
      score: correctCountRef.current,
      maxScore: itemCountRef.current
    }),
    onGameEnd: () => {
      console.log('RankAndRoll: onGameEnd called (time ran out)');
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = null;
      }
      const callback = onCompleteRef.current;
      const finalCorrect = correctCountRef.current;
      const totalItems = itemCountRef.current;
      console.log('RankAndRoll: Time up! Calling onComplete with correct:', finalCorrect, 'out of', totalItems);
      if (callback) {
        callback(finalCorrect, totalItems, props.timeRemaining);
      }
    },
    skipQuestion: () => {
      // Complete immediately with current score
      const callback = onCompleteRef.current;
      if (callback) {
        callback(correctCountRef.current, itemCountRef.current, props.timeRemaining);
      }
    },
    canSkipQuestion: true,
    get pauseTimer() {
      return gameStateRef.current === 'feedback';
    }
  }), [props.timeRemaining]);

  const fetchPuzzle = async () => {
    try {
      setGameState('loading');

      // Check if rankingPuzzleId is provided (playlist mode)
      if (props.rankingPuzzleId) {
        console.log('🎯 Ranky: Loading specific puzzle ID:', props.rankingPuzzleId);
        
        const { data: puzzleData, error: puzzleError } = await supabase
          .from('ranking_puzzles')
          .select('*')
          .eq('id', props.rankingPuzzleId)
          .single();

        if (puzzleError) {
          console.error('Supabase error loading ranking puzzle:', puzzleError);
          setGameState('playing');
          return;
        }

        const { data: itemsData, error: itemsError } = await supabase
          .from('ranking_items')
          .select('*')
          .eq('puzzle_id', puzzleData.id)
          .order('item_order', { ascending: true });

        if (itemsError) {
          console.error('Error fetching ranking items:', itemsError);
          setGameState('playing');
          return;
        }

        const loadedPuzzle = { ...puzzleData, items: itemsData || [] };
        console.log('✅ Ranky: Loaded puzzle with', loadedPuzzle.items.length, 'items');
        
        setPuzzle(loadedPuzzle);
        itemCountRef.current = loadedPuzzle.items.length;
        
        if (loadedPuzzle.items.length > 0) {
          const shuffled = shuffleArray([...loadedPuzzle.items]);
          setItems(shuffled);
        }

        setGameState('playing');
      } else {
        // Fallback: random puzzle (backwards compatibility)
        console.log('🎲 Ranky: No rankingPuzzleId provided, loading random puzzle');
        
        const { data, error } = await supabase
          .from('ranking_puzzles')
          .select('*')
          .eq('game_id', 5)
          .limit(1);

        if (error || !data || data.length === 0) {
          console.error('Supabase error:', error);
          setGameState('playing');
          return;
        }

        const { data: itemsData, error: itemsError } = await supabase
          .from('ranking_items')
          .select('*')
          .eq('puzzle_id', data[0].id)
          .order('item_order', { ascending: true });

        if (itemsError) {
          console.error('Error fetching items:', itemsError);
          return;
        }

        const loadedPuzzle = { ...data[0], items: itemsData || [] };
        setPuzzle(loadedPuzzle);
        itemCountRef.current = loadedPuzzle.items.length;

        if (loadedPuzzle.items.length > 0) {
          const shuffled = shuffleArray([...loadedPuzzle.items]);
          setItems(shuffled);
        }

        setGameState('playing');
      }
    } catch (error) {
      console.error('Error fetching puzzle:', error);
      setGameState('playing');
    }
  };

  useEffect(() => {
    fetchPuzzle();

    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [props.rankingPuzzleId]);

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
    correctCountRef.current = correct;

    if (props.onScoreUpdate) {
      props.onScoreUpdate(correct, items.length);
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

    console.log('RankAndRoll: Puzzle completed', {
      correct,
      total: items.length,
      timeRemaining: props.timeRemaining
    });

    // Show feedback for FEEDBACK_DISPLAY_TIME, then complete
    console.log(`RankAndRoll: Showing feedback for ${FEEDBACK_DISPLAY_TIME}ms, then completing round`);
    feedbackTimeoutRef.current = window.setTimeout(() => {
      console.log('RankAndRoll: ✅ Feedback complete - Calling onComplete');
      const callback = onCompleteRef.current;
      if (callback) {
        callback(correct, items.length, props.timeRemaining);
      }
    }, FEEDBACK_DISPLAY_TIME);
  };

  if (gameState === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-green-400">
          <div className="text-lg" style={{ textShadow: '0 0 10px #22c55e' }}>
            <BarChart3 className="inline-block w-5 h-5 mr-2" style={{ filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.6))' }} />
            Loading puzzle...
          </div>
          <div className="text-sm text-green-300 mt-2">Connecting to database</div>
        </div>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-white">
          <div className="text-lg text-red-500" style={{ textShadow: '0 0 10px #ff0066' }}>
            ❌ No puzzle available
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
            Score: <strong className="text-yellow-400 tabular-nums">{correctCount}/{items.length}</strong>
          </div>
        </div>

        {/* Puzzle Info */}
        <div className="text-center mb-1.5 bg-black/50 border-2 border-green-500 rounded-lg p-1.5" style={{ boxShadow: '0 0 15px rgba(34, 197, 94, 0.3)' }}>
          <h3 className="text-sm sm:text-base font-bold text-green-400 mb-0 break-words" style={{ textShadow: '0 0 10px #22c55e' }}>
            {puzzle.title}
          </h3>
          <p className="text-gray-300 text-xs">
            {puzzle.instruction}
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
                {/* Number Badge */}
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
              ✅ Final Answer
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