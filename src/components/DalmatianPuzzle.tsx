import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../lib/supabase';

const DalmatianPuzzle = forwardRef((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggableContainerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [puzzles, setPuzzles] = useState([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: gameState === 'won' ? 100 : Math.round((gameStateRef.current.completedSlots / gameStateRef.current.NUM_DRAGGABLE_PIECES) * 100),
      maxScore: 100
    }),
    onGameEnd: () => {
      console.log(`DalmatianPuzzle ended: ${gameState}, ${gameStateRef.current.completedSlots}/${gameStateRef.current.NUM_DRAGGABLE_PIECES} pieces`);
    }
  }));

  // Game state variables (using refs to maintain state across renders)
  const gameStateRef = useRef({
    PUZZLE_ROWS: 3,
    PUZZLE_COLS: 3,
    NUM_DRAGGABLE_PIECES: 6,
    IMAGE_URL: '',
    img: new Image(),
    puzzlePieces: [],
    draggablePieces: [],
    emptySlots: [],
    draggingPiece: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    isDragging: false,
    completedSlots: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    pieceSize: 0
  });

  // Fetch puzzles from Supabase
  const fetchPuzzles = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('puzzles')
        .select('*')
        .eq('game_id', 6); // Dalmatian Puzzle game ID
      
      if (error) {
        console.error('Supabase error:', error);
        // Fallback to default image if database fails
        setPuzzles([{
          id: 1,
          image_url: 'https://plus.unsplash.com/premium_photo-1754781493808-e575e4474ee9?q=80&w=2005&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
          correct_answer: 'Dalmatian Dog',
          difficulty: 'medium'
        }]);
        setLoading(false);
        return;
      }
      
      if (!data || data.length === 0) {
        console.error('No puzzles found for Dalmatian Puzzle');
        // Fallback to default image
        setPuzzles([{
          id: 1,
          image_url: 'https://plus.unsplash.com/premium_photo-1754781493808-e575e4474ee9?q=80&w=2005&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
          correct_answer: 'Dalmatian Dog',
          difficulty: 'medium'
        }]);
        setLoading(false);
        return;
      }
      
      console.log(`Loaded ${data.length} Dalmatian puzzles from Supabase`);
      setPuzzles(data);
      setLoading(false);
      
    } catch (error) {
      console.error('Error fetching puzzles:', error);
      // Fallback to default image
      setPuzzles([{
        id: 1,
        image_url: 'https://plus.unsplash.com/premium_photo-1754781493808-e575e4474ee9?q=80&w=2005&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        correct_answer: 'Dalmatian Dog',
        difficulty: 'medium'
      }]);
      setLoading(false);
    }
  };

  // Get current puzzle
  const getCurrentPuzzle = () => {
    if (puzzles.length === 0) return null;
    return puzzles[currentPuzzleIndex % puzzles.length];
  };

  // Next puzzle
  const nextPuzzle = () => {
    setCurrentPuzzleIndex(prev => (prev + 1) % puzzles.length);
    resetGame();
  };

  const playSound = (frequency = 440) => {
    // Simple beep sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.log('Audio not supported');
    }
  };

  const handleResize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const size = Math.min(container.offsetWidth, window.innerHeight * 0.7);
    canvas.width = size;
    canvas.height = size;
    gameStateRef.current.canvasWidth = canvas.width;
    gameStateRef.current.canvasHeight = canvas.height;
    gameStateRef.current.pieceSize = gameStateRef.current.canvasWidth / gameStateRef.current.PUZZLE_COLS;
    
    if (isImageLoaded) {
      drawGame();
      drawDraggablePieces();
    }
  };

  const drawDraggablePieces = () => {
    const container = draggableContainerRef.current;
    if (!container) return;

    container.innerHTML = '';
    
    const draggablePieceSize = Math.min(
      (container.offsetWidth - (gameStateRef.current.draggablePieces.length - 1) * 16) / gameStateRef.current.draggablePieces.length,
      gameStateRef.current.canvasWidth / gameStateRef.current.PUZZLE_COLS
    );

    gameStateRef.current.draggablePieces.forEach(piece => {
      const pieceCanvas = document.createElement('canvas');
      pieceCanvas.width = draggablePieceSize;
      pieceCanvas.height = draggablePieceSize;
      pieceCanvas.dataset.id = piece.id.toString();
      pieceCanvas.className = 'rounded-lg shadow-md transition-transform duration-100 hover:scale-110 cursor-pointer';
      
      const pieceCtx = pieceCanvas.getContext('2d');
      if (pieceCtx) {
        pieceCtx.drawImage(
          gameStateRef.current.img,
          piece.sourceX, piece.sourceY,
          gameStateRef.current.img.width / gameStateRef.current.PUZZLE_COLS, 
          gameStateRef.current.img.height / gameStateRef.current.PUZZLE_ROWS,
          0, 0,
          draggablePieceSize, draggablePieceSize
        );
      }
      
      container.appendChild(pieceCanvas);
    });
  };

  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas || !isImageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    console.log('Drawing game, dragging piece:', gameStateRef.current.draggingPiece);
    
    ctx.clearRect(0, 0, gameStateRef.current.canvasWidth, gameStateRef.current.canvasHeight);
    
    gameStateRef.current.puzzlePieces.forEach(piece => {
      if (piece.isMissing) {
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(piece.destX, piece.destY, gameStateRef.current.pieceSize, gameStateRef.current.pieceSize);
        ctx.setLineDash([]);
      } else {
        ctx.drawImage(
          gameStateRef.current.img, 
          piece.sourceX, piece.sourceY, 
          gameStateRef.current.img.width / gameStateRef.current.PUZZLE_COLS, 
          gameStateRef.current.img.height / gameStateRef.current.PUZZLE_ROWS, 
          piece.destX, piece.destY, 
          gameStateRef.current.pieceSize, gameStateRef.current.pieceSize
        );
      }
    });
    
    if (gameStateRef.current.draggingPiece) {
      const dragPiece = gameStateRef.current.draggingPiece;
      console.log('Drawing dragging piece at:', dragPiece.dragX, dragPiece.dragY, 'piece size:', gameStateRef.current.pieceSize);
      
      // Draw with slight transparency and shadow effect
      ctx.globalAlpha = 0.8;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;
      
      // Draw a red rectangle first to see if we're drawing in the right place
      ctx.fillStyle = 'red';
      ctx.fillRect(dragPiece.dragX || 0, dragPiece.dragY || 0, gameStateRef.current.pieceSize, gameStateRef.current.pieceSize);
      
      ctx.drawImage(
        gameStateRef.current.img, 
        dragPiece.sourceX, 
        dragPiece.sourceY, 
        gameStateRef.current.img.width / gameStateRef.current.PUZZLE_COLS, 
        gameStateRef.current.img.height / gameStateRef.current.PUZZLE_ROWS, 
        dragPiece.dragX || 0, 
        dragPiece.dragY || 0, 
        gameStateRef.current.pieceSize, gameStateRef.current.pieceSize
      );
      
      // Reset shadow and alpha
      ctx.globalAlpha = 1;
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
  };

  const getMousePos = (e: any, targetCanvas: HTMLCanvasElement) => {
    const rect = targetCanvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };
  
  const getCanvasPos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleStart = (e: any) => {
    if (!isImageLoaded || gameState !== 'playing') return;
    e.preventDefault();
    e.stopPropagation();

    // Check if we clicked on a draggable piece
    const target = e.target;
    if (target.tagName === 'CANVAS' && target.dataset.id) {
      const pieceId = parseInt(target.dataset.id, 10);
      const piece = gameStateRef.current.draggablePieces.find(p => p.id === pieceId);
      if (!piece) {
        console.log('Piece not found for ID:', pieceId);
        return;
      }
      
      console.log('Starting drag for piece:', pieceId);
      
      // Create dragging piece
      gameStateRef.current.draggingPiece = {
        ...piece,
        dragX: 0,
        dragY: 0
      };
      gameStateRef.current.isDragging = true;
      
      // Get mouse/touch position relative to the piece canvas
      const rect = target.getBoundingClientRect();
      const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
      
      gameStateRef.current.dragOffsetX = clientX - rect.left;
      gameStateRef.current.dragOffsetY = clientY - rect.top;
      
      // Dim the original piece
      target.style.opacity = '0.3';
      
      // Set initial position on main canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        const canvasX = (clientX - canvasRect.left) * (canvas.width / canvasRect.width);
        const canvasY = (clientY - canvasRect.top) * (canvas.height / canvasRect.height);
        
        gameStateRef.current.draggingPiece.dragX = canvasX - gameStateRef.current.dragOffsetX;
        gameStateRef.current.draggingPiece.dragY = canvasY - gameStateRef.current.dragOffsetY;
        
        console.log('Initial drag position:', gameStateRef.current.draggingPiece.dragX, gameStateRef.current.draggingPiece.dragY, 'canvas:', canvas.width, canvas.height);
        console.log('Canvas rect:', canvasRect);
        console.log('Client pos:', clientX, clientY);
        console.log('Event type:', e.type);
        
        // Force immediate redraw
        drawGame();
      }
    }
  };
  
  const handleMove = (e: any) => {
    if (!gameStateRef.current.isDragging || !gameStateRef.current.draggingPiece) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get current mouse/touch position
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    
    // Convert to canvas coordinates
    const canvasRect = canvas.getBoundingClientRect();
    const canvasX = (clientX - canvasRect.left) * (canvas.width / canvasRect.width);
    const canvasY = (clientY - canvasRect.top) * (canvas.height / canvasRect.height);
    
    // Update drag position
    gameStateRef.current.draggingPiece.dragX = canvasX - gameStateRef.current.dragOffsetX;
    gameStateRef.current.draggingPiece.dragY = canvasY - gameStateRef.current.dragOffsetY;
    
    console.log('Moving to:', gameStateRef.current.draggingPiece.dragX, gameStateRef.current.draggingPiece.dragY, 'event type:', e.type);
    
    // Force a redraw
    drawGame();
  };
  
  const handleEnd = (e?: any) => {
    if (!gameStateRef.current.isDragging || !gameStateRef.current.draggingPiece) {
      return;
    }
    
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('Ending drag at:', gameStateRef.current.draggingPiece.dragX, gameStateRef.current.draggingPiece.dragY);
    
    const dragX = gameStateRef.current.draggingPiece.dragX || 0;
    const dragY = gameStateRef.current.draggingPiece.dragY || 0;
    const pieceSize = gameStateRef.current.pieceSize;

    // Find the closest empty slot
    const closestEmptySlot = gameStateRef.current.emptySlots.find(slot => {
      const dx = (dragX + pieceSize / 2) - (slot.destX + pieceSize / 2);
      const dy = (dragY + pieceSize / 2) - (slot.destY + pieceSize / 2);
      const distance = Math.sqrt(dx * dx + dy * dy);
      console.log('Distance to slot:', distance, 'threshold:', pieceSize * 0.6);
      return distance < pieceSize * 0.6;
    });
    
    if (closestEmptySlot) {
      console.log('Found close slot:', closestEmptySlot);
      
      // Check if it's the correct piece for this slot
      if (gameStateRef.current.draggingPiece.id === closestEmptySlot.id) {
        console.log('Correct placement!');
        playSound(880); // Success sound
        
        // Mark slot as filled
        closestEmptySlot.isMissing = false;
        
        // Remove piece from draggable pieces
        const pieceIndex = gameStateRef.current.draggablePieces.findIndex(p => p.id === gameStateRef.current.draggingPiece!.id);
        if (pieceIndex > -1) {
          gameStateRef.current.draggablePieces.splice(pieceIndex, 1);
        }
        
        // Remove from empty slots
        const slotIndex = gameStateRef.current.emptySlots.findIndex(s => s.id === closestEmptySlot.id);
        if (slotIndex > -1) {
          gameStateRef.current.emptySlots.splice(slotIndex, 1);
        }
        
        // Remove the draggable piece element
        const container = draggableContainerRef.current;
        if (container) {
          const pieceElement = container.querySelector(`[data-id="${gameStateRef.current.draggingPiece.id}"]`);
          if (pieceElement) {
            pieceElement.remove();
          }
        }
        
        gameStateRef.current.completedSlots++;
        
        // Check if puzzle is complete
        if (gameStateRef.current.completedSlots === gameStateRef.current.NUM_DRAGGABLE_PIECES) {
          setGameState('won');
        }
      } else {
        console.log('Wrong placement');
        playSound(100); // Error sound
        
        // Restore piece opacity
        const container = draggableContainerRef.current;
        if (container) {
          const pieceElement = container.querySelector(`[data-id="${gameStateRef.current.draggingPiece.id}"]`);
          if (pieceElement) {
            (pieceElement as HTMLElement).style.opacity = '1';
          }
        }
      }
    } else {
      console.log('No close slot found');
      
      // Restore piece opacity
      const container = draggableContainerRef.current;
      if (container) {
        const pieceElement = container.querySelector(`[data-id="${gameStateRef.current.draggingPiece.id}"]`);
        if (pieceElement) {
          (pieceElement as HTMLElement).style.opacity = '1';
        }
      }
    }
    
    // Reset drag state
    gameStateRef.current.isDragging = false;
    gameStateRef.current.draggingPiece = null;
    drawGame();
  };

  const resetGame = () => {
    const currentPuzzle = getCurrentPuzzle();
    if (!currentPuzzle) return;
    
    // Update the image URL for the current puzzle
    gameStateRef.current.IMAGE_URL = currentPuzzle.image_url;
    
    gameStateRef.current.completedSlots = 0;
    gameStateRef.current.draggingPiece = null;
    gameStateRef.current.isDragging = false;
    setGameState('playing');

    const allPieces = [];
    for (let row = 0; row < gameStateRef.current.PUZZLE_ROWS; row++) {
      for (let col = 0; col < gameStateRef.current.PUZZLE_COLS; col++) {
        allPieces.push({
          id: row * gameStateRef.current.PUZZLE_COLS + col,
          sourceX: col * (gameStateRef.current.img.width / gameStateRef.current.PUZZLE_COLS),
          sourceY: row * (gameStateRef.current.img.height / gameStateRef.current.PUZZLE_ROWS),
          destX: col * gameStateRef.current.pieceSize,
          destY: row * gameStateRef.current.pieceSize,
          correctRow: row,
          correctCol: col,
          isMissing: false
        });
      }
    }
    
    const shuffledPieces = [...allPieces].sort(() => Math.random() - 0.5);
    
    gameStateRef.current.draggablePieces = shuffledPieces.slice(0, gameStateRef.current.NUM_DRAGGABLE_PIECES);
    
    gameStateRef.current.puzzlePieces = [];
    gameStateRef.current.emptySlots = [];
    
    allPieces.forEach(originalPiece => {
      const isDraggable = gameStateRef.current.draggablePieces.some(d => d.id === originalPiece.id);
      if (isDraggable) {
        const missingPiece = { ...originalPiece, isMissing: true };
        gameStateRef.current.puzzlePieces.push(missingPiece);
        gameStateRef.current.emptySlots.push(missingPiece);
      } else {
        gameStateRef.current.puzzlePieces.push({ ...originalPiece, isMissing: false });
      }
    });

    drawDraggablePieces();
    drawGame();
  };

  // Initialize puzzles
  useEffect(() => {
    fetchPuzzles();
  }, []);

  // Load image when puzzles change or current puzzle changes
  useEffect(() => {
    const currentPuzzle = getCurrentPuzzle();
    if (!currentPuzzle || loading) return;
    
    const img = gameStateRef.current.img;
    gameStateRef.current.IMAGE_URL = currentPuzzle.image_url;
    
    img.onload = () => {
      setIsImageLoaded(true);
      handleResize();
      resetGame();
    };
    
    img.onerror = () => {
      setIsImageLoaded(false);
      console.error("Failed to load image. Please check the URL.");
    };
    
    img.src = currentPuzzle.image_url;
  }, [puzzles, currentPuzzleIndex, loading]);

  // Handle resize
  useEffect(() => {
    const img = gameStateRef.current.img;

    const handleResizeEvent = () => handleResize();
    window.addEventListener('resize', handleResizeEvent);

    return () => {
      window.removeEventListener('resize', handleResizeEvent);
    };
  }, [isImageLoaded]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = draggableContainerRef.current;
    
    if (!canvas || !container) return;

    // Global event handlers for mouse
    const handleMouseMove = (e: MouseEvent) => {
      if (gameStateRef.current.isDragging) {
        handleMove(e);
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (gameStateRef.current.isDragging) {
        handleEnd(e);
      }
    };
    
    // Global event handlers for touch
    const handleTouchMove = (e: TouchEvent) => {
      if (gameStateRef.current.isDragging) {
        handleMove(e);
      }
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (gameStateRef.current.isDragging) {
        handleEnd(e);
      }
    };
    
    // Local event handlers for starting drag
    const handleMouseDown = (e: MouseEvent) => handleStart(e);
    const handleTouchStart = (e: TouchEvent) => handleStart(e);

    // Add global listeners for move and end events
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    // Add local listeners for start events
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      // Remove global listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      // Remove local listeners
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('touchstart', handleTouchStart);
    };
  }, [isImageLoaded]);

  const currentPuzzle = getCurrentPuzzle();

  // Loading state
  if (loading) {
    return (
      <div className="text-center max-w-4xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
        <div className="text-lg">🧩 Loading puzzle images...</div>
        <div className="text-sm text-purple-300 mt-2">Connecting to database</div>
      </div>
    );
  }

  // No puzzles available
  if (!currentPuzzle) {
    return (
      <div className="text-center max-w-4xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
        <div className="text-lg text-red-400">❌ No puzzles available</div>
        <div className="text-sm text-purple-300 mt-2">Check your Supabase connection</div>
        <button
          onClick={fetchPuzzles}
          className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all border-2 border-blue-400"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="text-center max-w-4xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
      {/* Header */}
      <h1 className="text-4xl md:text-5xl font-bold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
        Dalmatian Puzzle
      </h1>

      {/* Info bar */}
      <div className="flex justify-center items-center gap-6 mb-6">
        <div className="text-sm text-purple-300">
          Puzzle {currentPuzzleIndex + 1} of {puzzles.length}
          {currentPuzzle.difficulty && (
            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium border ${
              currentPuzzle.difficulty === 'easy' ? 'bg-green-500/20 text-green-300 border-green-400' :
              currentPuzzle.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400' :
              'bg-red-500/20 text-red-300 border-red-400'
            }`}>
              {currentPuzzle.difficulty.charAt(0).toUpperCase() + currentPuzzle.difficulty.slice(1)}
            </span>
          )}
        </div>
        <div className="text-sm text-purple-300">
          Drag pieces to complete the puzzle!
        </div>
      </div>

      <div className="w-full flex flex-col items-center">
        {/* Puzzle Canvas */}
        <div className="w-full md:w-2/3 mb-8 bg-gray-800 rounded-xl shadow-lg p-2 transition-all duration-300 transform scale-100 md:hover:scale-105 aspect-square">
          <canvas 
            ref={canvasRef}
            className="w-full h-full border-2 border-purple-600 rounded-lg"
            style={{ touchAction: 'none' }}
          />
        </div>

        {/* Draggable pieces container */}
        <div 
          ref={draggableContainerRef}
          id="draggable-pieces-container"
          className="w-full flex flex-wrap justify-center gap-4 bg-gray-800 rounded-xl shadow-lg p-4 mb-8"
        />

        {/* Controls */}
        <div className="w-full flex justify-center">
          <div className="flex gap-4">
            <button 
              onClick={resetGame}
              className="px-6 py-3 bg-gradient-to-r from-cyan-400 to-purple-500 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-transform duration-200 transform hover:scale-105"
            >
              Reset Puzzle
            </button>
            {puzzles.length > 1 && (
              <button 
                onClick={nextPuzzle}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-transform duration-200 transform hover:scale-105"
              >
                Next Puzzle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Game Over Message */}
      {gameState !== 'playing' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-700 p-8 rounded-lg shadow-2xl">
            <div className="flex flex-col items-center justify-center space-y-4">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                {gameState === 'won' ? 'Puzzle Solved!' : "Time's Up! Try Again."}
              </h3>
              {currentPuzzle.correct_answer && (
                <div className="text-lg text-gray-700 dark:text-gray-300 text-center">
                  Answer: <strong>{currentPuzzle.correct_answer}</strong>
                </div>
              )}
              <div className="flex gap-4">
                <button 
                  onClick={resetGame}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-400 to-purple-500 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-transform duration-200 transform hover:scale-105"
                >
                  Try Again
                </button>
                {puzzles.length > 1 && (
                  <button 
                    onClick={nextPuzzle}
                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-transform duration-200 transform hover:scale-105"
                  >
                    Next Puzzle
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

DalmatianPuzzle.displayName = 'DalmatianPuzzle';

export default DalmatianPuzzle;