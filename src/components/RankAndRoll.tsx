import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ArrowUp, ArrowDown, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { audioManager } from '../lib/audioManager';

interface RankAndRollProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onTimerPause?: (paused: boolean) => void;
  onComplete?: (score: number, maxScore: number) => void;
}

const MAX_PUZZLES = 2;
const POINTS_PER_ITEM = 75;
const MAX_SCORE = MAX_PUZZLES * 4 * POINTS_PER_ITEM; // 2 puzzles × 4 items × 75 points = 600

const RankAndRoll = forwardRef<any, RankAndRollProps>((props, ref) => {

  // Fallback data in case Supabase is unavailable
  const fallbackPuzzles = [
    {
      id: 1,
      title: 'World\'s Tallest Buildings',
      instruction: 'Arrange from TALLEST to SHORTEST',
      difficulty: 'medium',
      unit: 'meters',
      sortOrder: 'desc',
      items: [
        { id: '1', name: 'Burj Khalifa', subtitle: 'Dubai, UAE', value: 828, unit: 'meters', image: '🏗️' },
        { id: '2', name: 'Merdeka 118', subtitle: 'Kuala Lumpur, Malaysia', value: 679, unit: 'meters', image: '🏢' },
        { id: '3', name: 'Shanghai Tower', subtitle: 'Shanghai, China', value: 632, unit: 'meters', image: '🌆' },
        { id: '4', name: 'Abraj Al-Bait', subtitle: 'Mecca, Saudi Arabia', value: 601, unit: 'meters', image: '🕌' }
      ]
    },
    {
      id: 2,
      title: 'Fastest Land Animals',
      instruction: 'Arrange from FASTEST to SLOWEST',
      difficulty: 'easy',
      unit: 'mph',
      sortOrder: 'desc',
      items: [
        { id: '6', name: 'Cheetah', subtitle: 'African Speedster', value: 70, unit: 'mph', image: '🐆' },
        { id: '7', name: 'Pronghorn Antelope', subtitle: 'North American Runner', value: 60, unit: 'mph', image: '🦌' },
        { id: '8', name: 'Lion', subtitle: 'King of the Jungle', value: 50, unit: 'mph', image: '🦁' },
        { id: '9', name: 'Horse', subtitle: 'Galloping Mammal', value: 45, unit: 'mph', image: '🐎' }
      ]
    },
    {
      id: 3,
      title: 'Most Populous Countries',
      instruction: 'Arrange from MOST to LEAST populated',
      difficulty: 'hard',
      unit: 'millions',
      sortOrder: 'desc',
      items: [
        { id: '10', name: 'China', subtitle: 'East Asian Giant', value: 1425, unit: 'millions', image: '🇨🇳' },
        { id: '11', name: 'India', subtitle: 'South Asian Subcontinent', value: 1380, unit: 'millions', image: '🇮🇳' },
        { id: '12', name: 'United States', subtitle: 'North American Power', value: 335, unit: 'millions', image: '🇺🇸' },
        { id: '13', name: 'Indonesia', subtitle: 'Southeast Asian Archipelago', value: 275, unit: 'millions', image: '🇮🇩' }
      ]
    }
  ];

  // State for Supabase data
  const [puzzles, setPuzzles] = useState([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [currentPuzzle, setCurrentPuzzle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Game state
  const [playerOrder, setPlayerOrder] = useState([]);
  const [gameState, setGameState] = useState('playing'); // playing, completed, loading
  const [score, setScore] = useState(0);
  const [puzzlesCompleted, setPuzzlesCompleted] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [hintMessage, setHintMessage] = useState('');
  const [hintsUsed, setHintsUsed] = useState(0);
  const [touchStartY, setTouchStartY] = useState(null);
  const [moves, setMoves] = useState(0);
  const [showValues, setShowValues] = useState(false);
  const [touchStartIndex, setTouchStartIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: score,
      maxScore: MAX_SCORE
    }),
    onGameEnd: () => {
      console.log('Ranky: onGameEnd called (time ran out)');
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
      }
      // Time ran out - complete with current score
      console.log('Ranky: Time up! Calling onComplete with score:', score);
      if (props.onComplete) {
        props.onComplete(score, MAX_SCORE);
      }
    },
    skipQuestion: () => {
      nextPuzzle();
    },
    canSkipQuestion: true,
    pauseTimer: gameState === 'completed', // Pause when showing results
    loadNextPuzzle: () => {
      nextPuzzle();
    }
  }), [score, resultTimeout, gameState]);

  // Fetch puzzles from Supabase
  const fetchPuzzles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch ranking puzzles from the ranking_puzzles table
      const { data: puzzleData, error: puzzleError } = await supabase
        .from('ranking_puzzles')
        .select(`
          *,
          ranking_items (*)
        `)
        .order('created_at', { ascending: true });
      
      if (puzzleError) {
        console.error('Supabase error:', puzzleError);
        console.log('Supabase error, using fallback data:', puzzleError);
        setPuzzles(fallbackPuzzles);
        setCurrentPuzzle(fallbackPuzzles[0]);
        setLoading(false);
        return;
      }
      
      if (!puzzleData || puzzleData.length === 0) {
        console.log('No ranking puzzles found in database, using fallback puzzles');
        setPuzzles(fallbackPuzzles);
        setCurrentPuzzle(fallbackPuzzles[0]);
        setLoading(false);
        return;
      }
      
      // Transform database format to component format
      const transformedPuzzles = puzzleData.map(puzzle => ({
        id: puzzle.id,
        title: puzzle.title,
        instruction: puzzle.instruction,
        difficulty: puzzle.difficulty,
        unit: puzzle.unit,
        sortOrder: puzzle.sort_order,
        items: puzzle.ranking_items
          .sort((a, b) => (a.item_order || 0) - (b.item_order || 0))
          .slice(0, 4)  // Limit to 4 items max
          .map(item => ({
            id: item.id.toString(),
            name: item.name,
            subtitle: item.subtitle || '',
            value: item.value,
            unit: puzzle.unit,
            image: item.emoji || '📊',
            displayValue: item.display_value || `${item.value} ${puzzle.unit}`
          }))
      }));
      
      console.log(`Loaded ${transformedPuzzles.length} ranking puzzles from Supabase`);
      setPuzzles(transformedPuzzles);
      setCurrentPuzzle(transformedPuzzles[0]);
      setLoading(false);
      
    } catch (error) {
      console.error('Error fetching ranking puzzles:', error);
      console.log('Using fallback data due to fetch error');
      setPuzzles(fallbackPuzzles);
      setCurrentPuzzle(fallbackPuzzles[0]);
      setLoading(false);
    }
  };

  // Initialize puzzles on component mount
  useEffect(() => {
    fetchPuzzles();
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
      }
    };
  }, []);

  // Load audio files
  useEffect(() => {
    const loadAudio = async () => {
      await audioManager.loadSound('ranky-select', '/sounds/ranky/select_optimized.mp3', 3);
      await audioManager.loadSound('ranky-success', '/sounds/global/win_optimized.mp3', 2);
      await audioManager.loadSound('ranky-fail', '/sounds/ranky/fail.mp3', 2);
      await audioManager.loadSound('ranky-hint', '/sounds/ranky/hint_optimized.mp3', 2);
    };
    loadAudio();
  }, []);

  // Initialize puzzle
  useEffect(() => {
    if (currentPuzzle) {
      shufflePuzzle();
    }
  }, [currentPuzzle]);

  const shufflePuzzle = () => {
    if (!currentPuzzle) return;

    // Clear any pending result timeout
    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }

    // Shuffle the items for the player to sort
    const shuffled = [...currentPuzzle.items].sort(() => Math.random() - 0.5);
    setPlayerOrder(shuffled);
    setGameState('playing');
    setMoves(0);
    setShowValues(false);
    setHintMessage('');
    setHintsUsed(0);

    // Resume the timer for the new puzzle
    if (props.onTimerPause) {
      props.onTimerPause(false);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (dragIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    setMoves(prev => prev + 1);
    
    const newOrder = [...playerOrder];
    const draggedItem = newOrder[dragIndex];
    
    // Remove dragged item
    newOrder.splice(dragIndex, 1);
    
    // Insert at new position
    newOrder.splice(dropIndex, 0, draggedItem);
    
    setPlayerOrder(newOrder);
    setDraggedIndex(null);
    setIsDragging(false);
  };

  // Touch event handlers for mobile drag and drop
  const handleTouchStart = (e, index) => {
    setTouchStartY(e.touches[0].clientY);
    setTouchStartIndex(index);
    setDraggedIndex(index);
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || touchStartIndex === null) return;
    e.preventDefault(); // Prevent scrolling
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY;
    
    // Visual feedback - you could add transform here if desired
  };

  const handleTouchEnd = (e) => {
    if (!isDragging || touchStartIndex === null) {
      setDraggedIndex(null);
      setIsDragging(false);
      setTouchStartY(null);
      setTouchStartIndex(null);
      return;
    }

    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY;
    const threshold = 50; // Minimum distance to trigger move
    
    if (Math.abs(deltaY) > threshold) {
      const direction = deltaY < 0 ? 'up' : 'down';
      moveItem(touchStartIndex, direction);
    }
    
    // Reset touch state
    setDraggedIndex(null);
    setIsDragging(false);
    setTouchStartY(null);
    setTouchStartIndex(null);
  };

  const moveItem = (fromIndex, direction) => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;

    if (toIndex < 0 || toIndex >= playerOrder.length) return;

    audioManager.initialize();
    audioManager.play('ranky-select', 0.3);

    setMoves(prev => prev + 1);

    const newOrder = [...playerOrder];
    [newOrder[fromIndex], newOrder[toIndex]] = [newOrder[toIndex], newOrder[fromIndex]];
    setPlayerOrder(newOrder);

    // Clear hint message when player makes a move
    setHintMessage('');
  };

  const getHint = () => {
    if (!currentPuzzle) return;

    if (playerOrder.length === 0) return;

    audioManager.initialize();
    audioManager.play('ranky-hint', 0.4);

    // Get correct order
    const correctOrder = currentPuzzle.sortOrder === 'desc'
      ? [...currentPuzzle.items].sort((a, b) => b.value - a.value)
      : [...currentPuzzle.items].sort((a, b) => a.value - b.value);

    // Find a randomly selected item that's in the wrong position
    const wrongItems = playerOrder.filter((item, currentIndex) => {
      const correctIndex = correctOrder.findIndex(correct => correct.id === item.id);
      return currentIndex !== correctIndex;
    });

    if (wrongItems.length === 0) {
      setHintMessage('🎉 All correct!');
      return;
    }

    // Pick a random wrong item
    const randomWrongItem = wrongItems[Math.floor(Math.random() * wrongItems.length)];
    const currentIndex = playerOrder.findIndex(item => item.id === randomWrongItem.id);
    const correctIndex = correctOrder.findIndex(item => item.id === randomWrongItem.id);

    let direction = '';
    if (currentIndex < correctIndex) {
      direction = 'should be moved DOWN';
    } else {
      direction = 'should be moved UP';
    }

    setHintMessage(`💡 ${randomWrongItem.name} ${direction}`);
    setHintsUsed(prev => prev + 1);

    // Clear hint message after 5 seconds
    setTimeout(() => setHintMessage(''), 5000);
  };

  const submitFinalAnswer = () => {
    if (!currentPuzzle) return;

    console.log('Ranky: submitFinalAnswer called for puzzle', puzzlesCompleted + 1);

    audioManager.initialize();

    // Check which items are in correct positions
    const correctOrder = currentPuzzle.sortOrder === 'desc'
      ? [...currentPuzzle.items].sort((a, b) => b.value - a.value)
      : [...currentPuzzle.items].sort((a, b) => a.value - b.value);

    // Count correct positions for partial credit
    let correctCount = 0;
    playerOrder.forEach((item, index) => {
      if (item.id === correctOrder[index].id) {
        correctCount++;
      }
    });

    const earnedPoints = correctCount * POINTS_PER_ITEM;
    const isFullyCorrect = correctCount === currentPuzzle.items.length;

    console.log('Ranky: Answer checked', {
      correctCount,
      totalItems: currentPuzzle.items.length,
      earnedPoints,
      isFullyCorrect
    });

    setGameState('completed');

    // Pause the timer while showing feedback
    if (props.onTimerPause) {
      props.onTimerPause(true);
    }

    if (isFullyCorrect) {
      audioManager.play('ranky-success', 0.5);
    } else if (earnedPoints > 0) {
      audioManager.play('ranky-success', 0.3); // Quieter for partial credit
    } else {
      audioManager.play('ranky-fail', 0.3);
    }

    const newScore = score + earnedPoints;
    setScore(newScore);
    
    if (props.onScoreUpdate) {
      props.onScoreUpdate(newScore, MAX_SCORE);
    }

    const newPuzzlesCompleted = puzzlesCompleted + 1;
    setPuzzlesCompleted(newPuzzlesCompleted);

    console.log('Ranky: Updated state', {
      newScore,
      newPuzzlesCompleted,
      isLastPuzzle: newPuzzlesCompleted >= MAX_PUZZLES
    });

    // Check if game is complete (2 puzzles done)
    if (newPuzzlesCompleted >= MAX_PUZZLES) {
      // Last puzzle - auto-advance to results after showing feedback (3s)
      console.log('Ranky: ✅ LAST PUZZLE - Setting 3s timeout to complete game with score:', newScore);
      resultTimeoutRef.current = setTimeout(() => {
        console.log('Ranky: ✅ Timeout fired, calling onComplete with score:', newScore);
        if (props.onComplete) {
          props.onComplete(newScore, MAX_SCORE);
        } else {
          console.error('Ranky: ❌ onComplete callback is undefined!');
        }
      }, 3000);
    } else {
      // More puzzles to go - advance to next puzzle
      console.log('Ranky: Moving to puzzle', newPuzzlesCompleted + 1, 'after 3s');
      resultTimeoutRef.current = setTimeout(() => {
        nextPuzzle();
      }, 3000);
    }
  };

  const nextPuzzle = () => {
    if (puzzles.length === 0) return;
    
    const nextIndex = (currentPuzzleIndex + 1) % puzzles.length;
    setCurrentPuzzleIndex(nextIndex);
    setCurrentPuzzle(puzzles[nextIndex]);
  };

  const formatValue = (value, unit) => {
    if (unit === 'billion') {
      return `${value.toFixed(2)}B`;
    }
    return `${value} ${unit}`;
  };

  // Loading state
  if (loading) {
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

  // Error state
  if (error || !currentPuzzle) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-white">
          <div className="text-lg text-red-500" style={{ textShadow: '0 0 10px #ff0066' }}>❌ {error || 'No puzzles available'}</div>
          <div className="text-sm text-green-300 mt-2">Check your Supabase connection</div>
          <button
            onClick={fetchPuzzles}
            className="mt-4 px-6 py-3 bg-transparent border-2 border-green-400 text-green-400 rounded-lg font-semibold hover:bg-green-400 hover:text-black transition-all"
            style={{ textShadow: '0 0 8px #22c55e', boxShadow: '0 0 15px rgba(34, 197, 94, 0.3)' }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Calculate correct count for display
  const correctOrder = currentPuzzle.sortOrder === 'desc'
    ? [...currentPuzzle.items].sort((a, b) => b.value - a.value)
    : [...currentPuzzle.items].sort((a, b) => a.value - b.value);
  
  let correctCount = 0;
  if (gameState === 'completed') {
    playerOrder.forEach((item, index) => {
      if (item.id === correctOrder[index].id) {
        correctCount++;
      }
    });
  }

  return (
    <div className="min-h-screen bg-black flex items-start justify-center p-2 pt-4">
      <style>{`
        @keyframes pulse-twice {
          0%, 100% {
            opacity: 1;
          }
          25% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
          75% {
            opacity: 0.5;
          }
        }
        .animate-pulse-twice {
          animation: pulse-twice 1s ease-in-out;
        }
      `}</style>
      <div className="max-w-md w-full text-white">
        
        {/* Header - Updated to match pattern */}
        <div className="mb-3 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-green-400 mb-1 border-b border-green-400 pb-1 flex items-center justify-center gap-2">
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
          
          {/* Tagline */}
          <p className="text-green-300 text-xs sm:text-sm mb-2 sm:mb-4 text-center">
            Rank 'em!
          </p>

          {/* Score and Progress */}
          <div className="flex justify-between items-center mb-2 sm:mb-4 text-xs sm:text-sm">
            <div className="text-green-300">
              Score: <strong className="text-yellow-400 tabular-nums">{score}</strong>
            </div>
            <div className="text-green-400">
              Puzzle {puzzlesCompleted + 1} of {MAX_PUZZLES}
            </div>
          </div>

          {/* Hint Button */}
          {gameState === 'playing' && (
            <div className="flex justify-center mb-2">
              <button
                onClick={getHint}
                className="px-3 py-1.5 bg-transparent border-2 border-yellow-400 text-yellow-400 rounded hover:bg-yellow-400 hover:text-black transition-all whitespace-nowrap text-xs"
                style={{ boxShadow: '0 0 10px rgba(251, 191, 36, 0.3)' }}
              >
                💡 Hint ({hintsUsed})
              </button>
            </div>
          )}
        </div>

        {/* Puzzle Info - Updated colors to green */}
        <div className="text-center mb-2 bg-black border-2 border-green-400/40 p-2 rounded-xl" style={{ boxShadow: 'inset 0 0 15px rgba(34, 197, 94, 0.1)' }}>
          <h3 className="text-sm font-semibold text-green-400 mb-0.5">
            {currentPuzzle.title}
          </h3>
          <p className="text-xs text-green-300">
            {currentPuzzle.instruction}
          </p>
        </div>

        {/* Hint Message */}
        {hintMessage && (
          <div className="mb-2 p-2 bg-yellow-500/20 border-2 border-yellow-400 rounded-lg text-center text-yellow-300 text-sm" style={{ boxShadow: '0 0 10px rgba(251, 191, 36, 0.3)' }}>
            {hintMessage}
          </div>
        )}

        {/* Ranking List - Updated colors to green */}
        <div className="space-y-1.5 mb-2">
          {playerOrder.map((item, index) => {
            // Determine if this item is in the correct position (for completed state)
            const isCorrectPosition = gameState === 'completed' && 
              correctOrder.length > 0 && 
              item.id === correctOrder[index]?.id;
            
            // Get border and styling based on game state
            let borderClass = 'border-green-400/30';
            let bgClass = 'bg-black';
            let glowStyle = { boxShadow: '0 0 10px rgba(34, 197, 94, 0.2)' };
            
            if (gameState === 'completed') {
              if (isCorrectPosition) {
                // Correct position - green with pulse
                borderClass = 'border-green-500 animate-pulse';
                bgClass = 'bg-green-500/20';
                glowStyle = { boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)' };
              } else {
                // Wrong position - red with double pulse
                borderClass = 'border-red-500 animate-pulse-twice';
                bgClass = 'bg-red-500/20';
                glowStyle = { boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)' };
              }
            } else if (draggedIndex === index) {
              borderClass = 'border-green-400/30';
              glowStyle = { boxShadow: 'none' };
            } else {
              borderClass = 'border-green-400/30 hover:border-green-400';
              bgClass = 'hover:bg-green-400/10';
            }

            return (
              <div
                key={item.id}
                className={`relative ${bgClass} border-2 ${borderClass} rounded-lg p-2 transition-all ${
                  draggedIndex === index ? 'opacity-50 scale-95' : ''
                }`}
                style={glowStyle}
              >
                {/* Rank Number - Green or Red based on correctness */}
                <div 
                  className={`absolute -left-1.5 -top-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-black text-black ${
                    gameState === 'completed' 
                      ? (isCorrectPosition ? 'bg-green-500' : 'bg-red-500')
                      : 'bg-green-500'
                  }`}
                  style={{ 
                    boxShadow: gameState === 'completed'
                      ? (isCorrectPosition ? '0 0 10px rgba(34, 197, 94, 0.5)' : '0 0 10px rgba(239, 68, 68, 0.5)')
                      : '0 0 10px rgba(34, 197, 94, 0.5)'
                  }}
                >
                  {index + 1}
                </div>

                {/* Draggable Area (left side) - disabled when completed */}
                {gameState !== 'completed' && (
                  <div
                    className={`absolute left-0 top-0 w-3/4 h-full cursor-move select-none ${
                      draggedIndex === index ? 'opacity-50' : ''
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    onTouchStart={(e) => handleTouchStart(e, index)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{
                      touchAction: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none'
                    }}
                  />
                )}

                {/* Item Content */}
                <div className="flex items-center gap-2 ml-3 pointer-events-none">
                  <div className="text-xl">{item.image}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-green-400 text-sm truncate">{item.name}</div>
                    <div className="text-xs text-green-300 truncate">{item.subtitle}</div>
                  </div>
                </div>

                {/* Mobile Controls - Only show when playing */}
                {gameState !== 'completed' && (
                  <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex flex-col gap-0.5 pointer-events-auto z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveItem(index, 'up');
                      }}
                      disabled={index === 0 || gameState !== 'playing'}
                      className="text-green-400 disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-all"
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveItem(index, 'down');
                      }}
                      disabled={index === playerOrder.length - 1 || gameState !== 'playing'}
                      className="text-green-400 disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-all"
                    >
                      <ArrowDown size={18} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Final Answer Button */}
        {gameState === 'playing' && (
          <div className="text-center mb-2">
            <button
              onClick={submitFinalAnswer}
              className="px-6 py-2.5 rounded-xl font-bold text-base transition-all border-2 bg-transparent border-green-500 text-green-400 hover:bg-green-500 hover:text-black"
              style={{ textShadow: '0 0 10px #22c55e', boxShadow: '0 0 15px rgba(34, 197, 94, 0.3)' }}
            >
              📊 Final Answer
            </button>
          </div>
        )}

        {/* Score Display - Shows after submission */}
        {gameState === 'completed' && (() => {
          const isFullyCorrect = correctCount === currentPuzzle.items.length;
          const earnedPoints = correctCount * POINTS_PER_ITEM;

          return (
            <div className="text-center p-3 bg-black border-2 border-green-400/40 rounded-xl mb-2" style={{ boxShadow: '0 0 15px rgba(34, 197, 94, 0.2)' }}>
              <div className="text-2xl mb-1">{isFullyCorrect ? '🎉' : earnedPoints > 0 ? '👍' : '😬'}</div>
              <div className={`text-xl font-bold mb-1 ${isFullyCorrect ? 'text-green-400' : earnedPoints > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                {isFullyCorrect ? 'Perfect!' : earnedPoints > 0 ? 'Good try!' : 'Not quite'}
              </div>
              <div className="text-lg font-bold text-white">
                +{earnedPoints} points
              </div>
              <div className="text-xs text-green-300 mt-1">
                {correctCount} of {currentPuzzle.items.length} correct
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
});

RankAndRoll.displayName = 'RankAndRoll';

export default RankAndRoll;