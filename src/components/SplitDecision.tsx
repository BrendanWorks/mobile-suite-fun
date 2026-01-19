import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../lib/supabase';
import SplitDecisionLoadScreen from './SplitDecisionLoadScreen';

const SplitDecision = forwardRef((props, ref) => {
  // Game data state
  const [gameData, setGameData] = useState(null);
  const [allPuzzles, setAllPuzzles] = useState([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Game state
  const [gameState, setGameState] = useState({
    phase: 'menu', // 'menu', 'intro', 'item', 'feedback', 'complete'
    currentItem: 0,
    score: 0,
    selectedAnswer: null,
    feedback: null,
    results: []
  });

  useImperativeHandle(ref, () => ({
    getGameScore: () => {
      const correctCount = gameState.results.filter(r => r.correct).length;
      const totalItems = Math.max(1, gameData?.items?.length || gameState.results.length || 1);
      return {
        score: gameState.score,
        maxScore: totalItems * 143
      };
    },
    onGameEnd: () => {
      const correctCount = gameState.results.filter(r => r.correct).length;
      const totalItems = Math.max(1, gameData?.items?.length || gameState.results.length || 1);
      console.log(`SplitDecision ended: ${correctCount}/${totalItems} correct, score: ${gameState.score}`);
    },
    skipQuestion: () => {
      if (gameState.phase === 'item') {
        const nextItem = gameState.currentItem + 1;
        if (nextItem >= gameData.items.length) {
          setGameState(prev => ({ ...prev, phase: 'complete' }));
        } else {
          setGameState(prev => ({
            ...prev,
            phase: 'item',
            currentItem: nextItem,
            selectedAnswer: null,
            feedback: null,
            results: [...prev.results, {
              item: gameData.items[gameState.currentItem].item_text,
              correct: false,
              timeout: true,
              points: 0
            }]
          }));
        }
      }
    },
    canSkipQuestion: true
  }));

  // Fetch game data from Supabase
  const fetchGameData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all Split Decision puzzles from puzzles table
      const { data: puzzlesData, error: puzzleError } = await supabase
        .from('puzzles')
        .select('*')
        .eq('game_id', 7); // Split Decision game ID
      
      if (puzzleError) {
        console.error('Supabase error:', puzzleError);
        setError('Failed to load game data');
        setLoading(false);
        return;
      }
      
      if (!puzzlesData || puzzlesData.length === 0) {
        console.log('No Split Decision data found');
        setError('No game data available');
        setLoading(false);
        return;
      }
      
      setAllPuzzles(puzzlesData);
      console.log(`Loaded ${puzzlesData.length} Split Decision puzzles from Supabase`);
      
      // Load the current puzzle
      await loadPuzzle(puzzlesData[currentPuzzleIndex]);
      
    } catch (error) {
      console.error('Error fetching Split Decision data:', error);
      setError('Failed to load game data');
      setLoading(false);
    }
  };

  // Load a specific puzzle with its items
  const loadPuzzle = async (puzzleData) => {
    try {
      // Get the puzzle items for this puzzle
      const { data: itemsData, error: itemsError } = await supabase
        .from('puzzle_items')
        .select('*')
        .eq('puzzle_id', puzzleData.id)
        .order('item_order', { ascending: true });
      
      if (itemsError) {
        console.error('Items error:', itemsError);
        setError(`Failed to load puzzle items: ${itemsError.message}`);
        setLoading(false);
        return;
      }
      
      if (!itemsData || itemsData.length === 0) {
        console.log('No items found for puzzle');
        setError(`No puzzle items available for puzzle ${puzzleData.id}`);
        setLoading(false);
        return;
      }
      
      // Transform database data to game format
      const transformedGame = {
        type: "splitdecision",
        id: `splitdecision_${puzzleData.id}`,
        title: puzzleData.prompt || "Category Classification",
        categoryA: puzzleData.category_1 || "Category A",
        categoryB: puzzleData.category_2 || "Category B",
        allowBoth: true, // Allow "both" category
        items: itemsData,
        timing: { itemDurationMs: 3000, introMs: 1000, recapMs: 1200 },
        scoring: { correct: 143, wrong: -143, timeout: 0 }
      };
      
      console.log(`Loaded Split Decision game with ${itemsData.length} items from Supabase`);
      setGameData(transformedGame);
      setLoading(false);
    } catch (error) {
      console.error('Error loading puzzle:', error);
      setError('Failed to load puzzle');
      setLoading(false);
    }
  };

  // Initialize game data
  useEffect(() => {
    fetchGameData();
  }, []);

  // Auto-advance from intro to game
  useEffect(() => {
    if (!gameData) return;

    let timeoutId;

    if (gameState.phase === 'intro') {
      timeoutId = setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          phase: 'item'
        }));
      }, gameData.timing.introMs);
    }

    else if (gameState.phase === 'feedback') {
      timeoutId = setTimeout(() => {
        const nextItem = gameState.currentItem + 1;
        if (nextItem >= gameData.items.length) {
          setGameState(prev => ({ ...prev, phase: 'complete' }));
        } else {
          setGameState(prev => ({
            ...prev,
            phase: 'item',
            currentItem: nextItem,
            selectedAnswer: null,
            feedback: null
          }));
        }
      }, 1000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [gameState.phase, gameState.currentItem, gameData]);

  const handleAnswer = useCallback((answer) => {
    if (!gameData || gameState.selectedAnswer !== null || gameState.phase !== 'item') return;
    
    const currentItemData = gameData.items[gameState.currentItem];
    if (!currentItemData) return;
    
    const isCorrect = answer === (currentItemData.correct_category === 'category_1' ? 'A' : 
                                  currentItemData.correct_category === 'category_2' ? 'B' : 'BOTH');
    const points = isCorrect ? gameData.scoring.correct : gameData.scoring.wrong;
    
    setGameState(prev => ({
      ...prev,
      selectedAnswer: answer,
      score: Math.max(0, prev.score + points),
      feedback: {
        type: isCorrect ? 'correct' : 'wrong',
        text: isCorrect ? `+${points}` : `${points}`
      },
      phase: 'feedback',
      results: [...prev.results, {
        item: currentItemData.item_text,
        correct: isCorrect,
        timeout: false,
        points: points
      }]
    }));
  }, [gameState.selectedAnswer, gameState.phase, gameState.currentItem, gameData]);

  const startGame = () => {
    setGameState({
      phase: 'intro',
      currentItem: 0,
      score: 0,
      timeLeft: 0,
      selectedAnswer: null,
      feedback: null,
      results: []
    });
  };

  const backToMenu = () => {
    setGameState(prev => ({ ...prev, phase: 'menu' }));
  };

  const nextPuzzle = async () => {
    if (allPuzzles.length <= 1) return;
    
    const nextIndex = (currentPuzzleIndex + 1) % allPuzzles.length;
    setCurrentPuzzleIndex(nextIndex);
    setLoading(true);
    await loadPuzzle(allPuzzles[nextIndex]);
    setGameState(prev => ({ ...prev, phase: 'menu' }));
  };

  const previousPuzzle = async () => {
    if (allPuzzles.length <= 1) return;
    
    const prevIndex = currentPuzzleIndex === 0 ? allPuzzles.length - 1 : currentPuzzleIndex - 1;
    setCurrentPuzzleIndex(prevIndex);
    setLoading(true);
    await loadPuzzle(allPuzzles[prevIndex]);
    setGameState(prev => ({ ...prev, phase: 'menu' }));
  };
  // Loading state
  if (loading) {
    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
        <div className="text-lg">⚡ Loading Split Decision...</div>
        <div className="text-sm text-purple-300 mt-2">Preparing rapid-fire questions</div>
      </div>
    );
  }

  // Error state
  if (error && !gameData) {
    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
        <div className="text-lg text-red-400">❌ Error loading game</div>
        <div className="text-sm text-purple-300 mt-2">{error}</div>
        <button
          onClick={fetchGameData}
          className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all border-2 border-blue-400"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!gameData) return null;

  // Menu
  if (gameState.phase === 'menu') {
    return <SplitDecisionLoadScreen onStart={startGame} />;
  }

  // Intro
  if (gameState.phase === 'intro') {
    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
        <h2 className="text-2xl font-bold text-white mb-4 drop-shadow-lg">{gameData.title}</h2>
        
        <div className="flex justify-between items-center mb-6 gap-4">
          <div className="bg-blue-500/20 border border-blue-400 px-4 py-3 rounded-xl flex-1">
            <div className="text-sm text-blue-300">Category A</div>
            <div className="font-bold text-blue-200">{gameData.categoryA}</div>
          </div>
          <div className="text-2xl font-bold text-purple-300">VS</div>
          <div className="bg-red-500/20 border border-red-400 px-4 py-3 rounded-xl flex-1">
            <div className="text-sm text-red-300">Category B</div>
            <div className="font-bold text-red-200">{gameData.categoryB}</div>
          </div>
        </div>
        
        {gameData.allowBoth && (
          <div className="mb-4 bg-yellow-500/20 border border-yellow-400 px-4 py-3 rounded-xl">
            <div className="text-sm text-yellow-300">Special Category</div>
            <div className="font-bold text-yellow-200">BOTH Categories</div>
          </div>
        )}
        
        <div className="text-purple-300 text-lg animate-pulse">
          {gameData.items.length} rapid items
        </div>
      </div>
    );
  }

  // Playing
  if (gameState.phase === 'item' || gameState.phase === 'feedback') {
    const item = gameData.items[gameState.currentItem];
    if (!item) return null;

    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white min-h-96">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-purple-300">
              Item {gameState.currentItem + 1} of {gameData.items.length}
            </div>
            <div className="text-lg font-bold text-cyan-400">
              Score: {gameState.score}
            </div>
          </div>
        </div>

        {/* Item */}
        <div className="mb-8">
          <div className="bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-8 shadow-lg">
            <div className="text-3xl font-bold text-white mb-4 drop-shadow-lg">
              {item?.item_text || 'No item text available'}
            </div>
            
            {gameState.feedback && (
              <div className={`text-2xl font-bold animate-pulse ${
                gameState.feedback.type === 'correct' ? 'text-green-400' : 
                gameState.feedback.type === 'wrong' ? 'text-red-400' : 'text-gray-400'
              }`}>
                {gameState.feedback.text}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <button
            onClick={() => handleAnswer('A')}
            disabled={gameState.selectedAnswer !== null}
            className={`py-6 px-4 rounded-xl font-semibold transition-all border-2 ${
              gameState.selectedAnswer !== null 
                ? 'bg-gray-600 border-gray-500 cursor-not-allowed opacity-50' 
                : 'bg-blue-500/20 border-blue-400 text-blue-200 hover:bg-blue-500/30 hover:shadow-lg hover:shadow-blue-500/25 active:scale-98'
            }`}
          >
            <div className="text-sm opacity-90">Category A</div>
            <div className="text-lg font-semibold">{gameData.categoryA}</div>
          </button>
          
          <button
            onClick={() => handleAnswer('B')}
            disabled={gameState.selectedAnswer !== null}
            className={`py-6 px-4 rounded-xl font-semibold transition-all border-2 ${
              gameState.selectedAnswer !== null 
                ? 'bg-gray-600 border-gray-500 cursor-not-allowed opacity-50' 
                : 'bg-red-500/20 border-red-400 text-red-200 hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/25 active:scale-98'
            }`}
          >
            <div className="text-sm opacity-90">Category B</div>
            <div className="text-lg font-semibold">{gameData.categoryB}</div>
          </button>
        </div>
        
        {/* Both button if allowed */}
        {gameData.allowBoth && (
          <button
            onClick={() => handleAnswer('BOTH')}
            disabled={gameState.selectedAnswer !== null}
            className={`w-full py-4 px-4 rounded-xl font-semibold transition-all border-2 ${
              gameState.selectedAnswer !== null 
                ? 'bg-gray-600 border-gray-500 cursor-not-allowed opacity-50' 
                : 'bg-yellow-500/20 border-yellow-400 text-yellow-200 hover:bg-yellow-500/30 hover:shadow-lg hover:shadow-yellow-500/25 active:scale-98'
            }`}
          >
            <div className="text-sm opacity-90">Special Category</div>
            <div className="text-lg font-semibold">BOTH</div>
          </button>
        )}
      </div>
    );
  }

  // Complete
  if (gameState.phase === 'complete') {
    return (
      <div className="text-center max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
        <h2 className="text-3xl font-bold text-white mb-6 drop-shadow-lg">⚡ Game Complete!</h2>

        <div className="mb-6 p-6 bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-xl">
          <div className="text-4xl font-bold text-green-400">{gameState.score}</div>
        </div>
      </div>
    );
  }

  return null;
});

SplitDecision.displayName = 'SplitDecision';

export default SplitDecision;