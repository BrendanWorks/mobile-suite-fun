import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ArrowUp, ArrowDown, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';

const RankAndRoll = forwardRef((props, ref) => {

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
        { id: '4', name: 'Abraj Al-Bait', subtitle: 'Mecca, Saudi Arabia', value: 601, unit: 'meters', image: '🕌' },
        { id: '5', name: 'Ping An Finance Center', subtitle: 'Shenzhen, China', value: 599, unit: 'meters', image: '🏙️' }
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
        { id: '13', name: 'Indonesia', subtitle: 'Southeast Asian Archipelago', value: 275, unit: 'millions', image: '🇮🇩' },
        { id: '14', name: 'Pakistan', subtitle: 'South Asian Nation', value: 225, unit: 'millions', image: '🇵🇰' }
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
  const [moves, setMoves] = useState(0);
  const [puzzlesCompleted, setPuzzlesCompleted] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [showValues, setShowValues] = useState(false);
  const [hintMessage, setHintMessage] = useState('');
  const [hintsUsed, setHintsUsed] = useState(0);
  const [touchStartY, setTouchStartY] = useState(null);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: score,
      maxScore: puzzlesCompleted > 0 ? puzzlesCompleted * 600 : 600
    }),
    onGameEnd: () => {
      console.log(`RankAndRoll ended with score: ${score}/${puzzlesCompleted > 0 ? puzzlesCompleted * 600 : 600}`);
      if (resultTimeout) {
        clearTimeout(resultTimeout);
      }
    }
  }));
  const [touchStartIndex, setTouchStartIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [resultTimeout, setResultTimeout] = useState<NodeJS.Timeout | null>(null);

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

  // Initialize puzzle
  useEffect(() => {
    if (currentPuzzle) {
      shufflePuzzle();
    }
  }, [currentPuzzle]);

  const shufflePuzzle = () => {
    if (!currentPuzzle) return;

    // Clear any pending result timeout
    if (resultTimeout) {
      clearTimeout(resultTimeout);
      setResultTimeout(null);
    }

    // Shuffle the items for the player to sort
    const shuffled = [...currentPuzzle.items].sort(() => Math.random() - 0.5);
    setPlayerOrder(shuffled);
    setGameState('playing');
    setMoves(0);
    setShowValues(false);
    setHintMessage('');
    setHintsUsed(0);
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
      setHintMessage('🎉 Everything is in the correct position!');
      return;
    }
    
    // Pick a random wrong item
    const randomWrongItem = wrongItems[Math.floor(Math.random() * wrongItems.length)];
    const currentIndex = playerOrder.findIndex(item => item.id === randomWrongItem.id);
    const correctIndex = correctOrder.findIndex(item => item.id === randomWrongItem.id);
    
    let direction = '';
    if (currentIndex < correctIndex) {
      direction = 'should be moved DOWN (lower in ranking)';
    } else {
      direction = 'should be moved UP (higher in ranking)';
    }
    
    setHintMessage(`💡 ${randomWrongItem.name} ${direction}`);
    setHintsUsed(prev => prev + 1);
    
    // Clear hint message after 5 seconds
    setTimeout(() => setHintMessage(''), 5000);
  };

  const submitFinalAnswer = () => {
    if (!currentPuzzle) return;

    // Check if puzzle is complete
    const correctOrder = currentPuzzle.sortOrder === 'desc'
      ? [...currentPuzzle.items].sort((a, b) => b.value - a.value)
      : [...currentPuzzle.items].sort((a, b) => a.value - b.value);

    const isCorrect = playerOrder.every((item, index) =>
      item.id === correctOrder[index].id
    );

    setGameState('completed');

    if (isCorrect) {
      const moveBonus = Math.max(0, 200 - moves * 10);
      const hintPenalty = hintsUsed * 25;
      const difficultyBonus = currentPuzzle.difficulty === 'hard' ? 100 :
                              currentPuzzle.difficulty === 'medium' ? 50 : 0;
      const finalScore = Math.max(50, 300 + moveBonus + difficultyBonus - hintPenalty);
      setScore(prev => prev + finalScore);
      setPuzzlesCompleted(prev => prev + 1);
    }

    // Auto-advance to next puzzle after 3 seconds
    const timeout = setTimeout(() => {
      nextPuzzle();
    }, 3000);
    setResultTimeout(timeout);
  };

  // Check if puzzle is complete
  // Remove the old auto-checking logic - replaced with manual submission

  const nextPuzzle = () => {
    if (puzzles.length === 0) return;
    
    const nextIndex = (currentPuzzleIndex + 1) % puzzles.length;
    setCurrentPuzzleIndex(nextIndex);
    setCurrentPuzzle(puzzles[nextIndex]);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      <div className="max-w-md mx-auto p-4 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">📊 Loading Ranky puzzles...</div>
          <div className="text-sm text-purple-300 mt-2">Connecting to database</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !currentPuzzle) {
    return (
      <div className="max-w-md mx-auto p-4 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-red-400">❌ {error || 'No puzzles available'}</div>
          <div className="text-sm text-purple-300 mt-2">Check your Supabase connection</div>
          <button
            onClick={fetchPuzzles}
            className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all border-2 border-blue-400"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white min-h-screen">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">📊 Ranky</h2>
      </div>

      {/* Puzzle Info */}
      <div className="text-center mb-6 bg-white/10 p-4 rounded-xl">
        <h3 className="text-lg font-semibold text-white mb-1">
          {currentPuzzle.title}
        </h3>
        <p className="text-sm text-purple-300 mb-3">
          {currentPuzzle.instruction}
        </p>
        
        {/* Controls */}
        <div className="flex justify-center gap-2">
          <button
            onClick={getHint}
            disabled={gameState !== 'playing'}
            className="text-xs px-3 py-1 bg-blue-500/30 border border-blue-400 rounded-lg hover:bg-blue-500/50 transition-all disabled:opacity-50"
          >
            💡 Hint ({hintsUsed})
          </button>
        </div>
      </div>

      {/* Hint Message */}
      {hintMessage && (
        <div className="mb-4 p-3 bg-blue-500/20 border border-blue-400 rounded-xl text-center text-blue-200">
          {hintMessage}
        </div>
      )}

      {/* Ranking List */}
      <div className="space-y-2 mb-6">
        {playerOrder.map((item, index) => (
          <div
            key={item.id}
            className={`relative bg-white/10 border-2 border-purple-500/30 rounded-xl p-3 transition-all ${
              draggedIndex === index ? 'opacity-50 scale-95' : 'hover:border-purple-400 hover:bg-white/20'
            }`}
          >
            {/* Rank Number */}
            <div className="absolute -left-2 -top-2 w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-sm font-bold border-2 border-white">
              {index + 1}
            </div>
            
            {/* Draggable Area (left side) */}
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
                touchAction: 'none', // Prevent default touch behaviors
                WebkitUserSelect: 'none',
                userSelect: 'none'
              }}
            />
            
            {/* Item Content */}
            <div className="flex items-center gap-3 ml-4 pointer-events-none">
              <div className="text-2xl">{item.image}</div>
              <div className="flex-1">
                <div className="font-semibold text-white">{item.name}</div>
                <div className="text-xs text-purple-300">{item.subtitle}</div>
              </div>
            </div>
            
            {/* Mobile Controls - ALWAYS CLICKABLE */}
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex flex-col gap-1 pointer-events-auto z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  moveItem(index, 'up');
                }}
                disabled={index === 0}
                className="disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-all"
              >
                <ArrowUp size={20} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  moveItem(index, 'down');
                }}
                disabled={index === playerOrder.length - 1}
                className="disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-all"
              >
                <ArrowDown size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Final Answer Button */}
      {gameState === 'playing' && (
        <div className="text-center mb-6">
          <button
            onClick={submitFinalAnswer}
            className="px-8 py-4 rounded-xl font-bold text-lg transition-all border-2 bg-gradient-to-r from-blue-500 to-purple-600 border-blue-400 hover:shadow-lg hover:shadow-blue-500/25"
          >
            🎯 Final Answer
          </button>
        </div>
      )}

      {/* Success/Failure Message */}
      {gameState === 'completed' && (
        <div className="text-center p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-400 rounded-xl shadow-lg shadow-green-500/25 mb-6">
          {(() => {
            const correctOrder = currentPuzzle.sortOrder === 'desc' 
              ? [...currentPuzzle.items].sort((a, b) => b.value - a.value)
              : [...currentPuzzle.items].sort((a, b) => a.value - b.value);
            const isCorrect = playerOrder.every((item, index) => item.id === correctOrder[index].id);
            
            if (isCorrect) {
              const moveBonus = Math.max(0, 200 - moves * 10);
              const hintPenalty = hintsUsed * 25;
              const difficultyBonus = currentPuzzle.difficulty === 'hard' ? 100 :
                                      currentPuzzle.difficulty === 'medium' ? 50 : 0;
              const finalScore = Math.max(50, 300 + moveBonus + difficultyBonus - hintPenalty);

              return (
                <>
                  <div className="text-4xl mb-2">🎉</div>
                  <div className="text-2xl font-bold text-green-300 mb-2">Perfect Ranking!</div>
                  <div className="text-green-200 text-sm mb-2">
                    Completed with {moves} moves
                    {hintsUsed > 0 && ` and ${hintsUsed} hint${hintsUsed > 1 ? 's' : ''}`}
                  </div>
                  <div className="text-lg font-bold text-white">
                    +{finalScore} points!
                  </div>
                  {hintsUsed > 0 && (
                    <div className="text-xs text-yellow-300 mt-1">
                      (-{hintPenalty} for hints)
                    </div>
                  )}
                </>
              );
            } else {
              return (
                <>
                  <div className="text-4xl mb-2">😅</div>
                  <div className="text-2xl font-bold text-red-300 mb-2">Not Quite Right!</div>
                  <div className="text-red-200 text-sm mb-3">
                    The correct order was:
                  </div>
                  <div className="text-left bg-white/10 p-3 rounded-lg text-sm">
                    {correctOrder.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2 mb-1">
                        <span className="text-yellow-300 font-bold">{index + 1}.</span>
                        <span className="text-xl">{item.image}</span>
                        <span className="text-white">{item.name}</span>
                        <span className="text-purple-300 text-xs">({formatValue(item.value, item.unit)})</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            }
          })()}
        </div>
      )}

      {/* Next Puzzle Button */}
      {gameState === 'completed' && (
        <div className="text-center space-y-3">
          <div className="p-3 bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 rounded-xl">
            <div className="text-sm text-blue-300">
              {puzzles.length > 1 ? 'Next puzzle loading automatically...' : 'You can continue playing!'}
            </div>
          </div>
          {puzzles.length > 1 && (
            <button
              onClick={() => {
                if (resultTimeout) {
                  clearTimeout(resultTimeout);
                  setResultTimeout(null);
                }
                nextPuzzle();
              }}
              className="px-6 py-2 bg-gradient-to-r from-green-500/50 to-teal-600/50 rounded-xl font-medium hover:bg-green-500/70 transition-all border border-green-400/50 flex items-center gap-2 mx-auto text-sm"
            >
              <Star size={16} />
              Skip to Next Puzzle →
            </button>
          )}
        </div>
      )}

      {gameState !== 'completed' && (
        <div className="text-center">
          <button
            onClick={nextPuzzle}
            disabled={puzzles.length <= 1}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 rounded-xl font-semibold hover:shadow-lg hover:shadow-green-500/25 transition-all border-2 border-green-400 flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Star size={20} />
            {puzzles.length > 1 ? 'Next Challenge' : 'Only Puzzle'}
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="text-center text-xs text-purple-300 bg-white/5 p-3 rounded-xl mt-4">
        <strong>How to play:</strong> 
        <span className="hidden sm:inline"> Drag the left side of items to reorder, or use</span>
        <span className="sm:hidden"> Touch & drag the left side of items, or use</span>
        {" "}arrow buttons to move items up/down. 
        Use hints if you get stuck!
      </div>
    </div>
  );
});

RankAndRoll.displayName = 'RankAndRoll';

export default RankAndRoll;