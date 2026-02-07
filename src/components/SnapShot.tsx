import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Shapes } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { audioManager } from '../lib/audioManager';

const MAX_SCORE = 1000;

const SnapShot = forwardRef((props: any, ref) => {
  const { onComplete, timeRemaining } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggableContainerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [puzzles, setPuzzles] = useState([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(60);
  const hasCalledOnComplete = useRef(false);

  const maxTimePerPuzzle = 60;

  useImperativeHandle(ref, () => ({
    getGameScore: () => {
      const percentComplete = gameStateRef.current.completedSlots / gameStateRef.current.NUM_DRAGGABLE_PIECES;
      const score = Math.round(percentComplete * MAX_SCORE);
      return {
        score: score,
        maxScore: MAX_SCORE
      };
    },
    onGameEnd: () => {
      console.log('SnapShot: onGameEnd called (time ran out)');
      // Time ran out - complete with partial score based on pieces placed
      const percentComplete = gameStateRef.current.completedSlots / gameStateRef.current.NUM_DRAGGABLE_PIECES;
      const partialScore = Math.round(percentComplete * MAX_SCORE);
      console.log('SnapShot: Time up! Pieces placed:', gameStateRef.current.completedSlots, 'Score:', partialScore, 'timeRemaining:', timeRemaining);
      if (onComplete) {
        onComplete(partialScore, MAX_SCORE, timeRemaining);
      }
    },
    skipQuestion: () => nextPuzzle(),
    canSkipQuestion: true,
    loadNextPuzzle: () => nextPuzzle(),
    get pauseTimer() {
      // Pause if image not loaded or still loading puzzles, but NOT if won/lost (let countdown continue)
      return !isImageLoaded || loading;
    }
  }), [isImageLoaded, loading, gameState, onComplete]);

  // Game state variables (using refs to maintain state across renders)
  const gameStateRef = useRef({
    PUZZLE_ROWS: 3,
    PUZZLE_COLS: 3,
    NUM_DRAGGABLE_PIECES: 4, // Only 4 pieces to place (5 pre-placed)
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
    pieceSize: 0,
    // Crop coordinates for center-cropping to square
    cropX: 0,
    cropY: 0,
    cropSize: 0
  });

  // Load audio on mount
  useEffect(() => {
    const loadAudio = async () => {
      await audioManager.loadSound('snapshot-correct', '/sounds/global/win_optimized.mp3', 2);
      await audioManager.loadSound('global-wrong', '/sounds/global/wrong_optimized.mp3', 2);
    };
    loadAudio();
  }, []);

  // Calculate center crop coordinates for square aspect ratio
  const calculateCenterCrop = () => {
    const img = gameStateRef.current.img;
    const size = Math.min(img.width, img.height);
    const cropX = (img.width - size) / 2;
    const cropY = (img.height - size) / 2;
    
    gameStateRef.current.cropX = cropX;
    gameStateRef.current.cropY = cropY;
    gameStateRef.current.cropSize = size;
  };

  // Fetch puzzles from Supabase
  const fetchPuzzles = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('puzzles')
        .select('*')
        .eq('game_id', 6); // SnapShot game ID
      
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
        console.error('No puzzles found for SnapShot');
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
      
      console.log(`Loaded ${data.length} SnapShot puzzles from Supabase`);
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

    // Wait for container to have dimensions
    if (container.offsetWidth === 0) {
      requestAnimationFrame(drawDraggablePieces);
      return;
    }

    container.innerHTML = '';

    // If no pieces to draw, exit
    if (gameStateRef.current.draggablePieces.length === 0) return;

    // Calculate piece size with a minimum of 60px
    let draggablePieceSize = Math.min(
      (container.offsetWidth - (gameStateRef.current.draggablePieces.length - 1) * 16) / gameStateRef.current.draggablePieces.length,
      gameStateRef.current.canvasWidth / gameStateRef.current.PUZZLE_COLS
    );

    // Ensure minimum size and valid number
    draggablePieceSize = Math.max(60, draggablePieceSize);

    if (isNaN(draggablePieceSize) || draggablePieceSize <= 0) {
      console.error('Invalid piece size:', draggablePieceSize);
      return;
    }

    gameStateRef.current.draggablePieces.forEach((piece, index) => {
      const pieceCanvas = document.createElement('canvas');
      pieceCanvas.width = draggablePieceSize;
      pieceCanvas.height = draggablePieceSize;
      pieceCanvas.dataset.id = piece.id.toString();
      pieceCanvas.className = 'rounded-lg shadow-md transition-transform duration-100 hover:scale-110 cursor-pointer border-2 border-pink-400';
      pieceCanvas.style.minWidth = '60px';
      pieceCanvas.style.minHeight = '60px';
      pieceCanvas.style.display = 'block';

      const pieceCtx = pieceCanvas.getContext('2d');
      if (pieceCtx) {
        try {
          // Use center-cropped coordinates
          const pieceWidth = gameStateRef.current.cropSize / gameStateRef.current.PUZZLE_COLS;
          const pieceHeight = gameStateRef.current.cropSize / gameStateRef.current.PUZZLE_ROWS;
          
          pieceCtx.drawImage(
            gameStateRef.current.img,
            gameStateRef.current.cropX + piece.sourceX, 
            gameStateRef.current.cropY + piece.sourceY,
            pieceWidth,
            pieceHeight,
            0, 0,
            draggablePieceSize, draggablePieceSize
          );
        } catch (err) {
          console.error('Error drawing piece:', err);
        }
      }

      container.appendChild(pieceCanvas);
    });
  };

  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas || !isImageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, gameStateRef.current.canvasWidth, gameStateRef.current.canvasHeight);
    
    gameStateRef.current.puzzlePieces.forEach(piece => {
      if (piece.isMissing) {
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(piece.destX, piece.destY, gameStateRef.current.pieceSize, gameStateRef.current.pieceSize);
        ctx.setLineDash([]);
      } else {
        // Use center-cropped coordinates
        const pieceWidth = gameStateRef.current.cropSize / gameStateRef.current.PUZZLE_COLS;
        const pieceHeight = gameStateRef.current.cropSize / gameStateRef.current.PUZZLE_ROWS;
        
        ctx.drawImage(
          gameStateRef.current.img, 
          gameStateRef.current.cropX + piece.sourceX,
          gameStateRef.current.cropY + piece.sourceY,
          pieceWidth,
          pieceHeight,
          piece.destX, piece.destY, 
          gameStateRef.current.pieceSize, gameStateRef.current.pieceSize
        );
      }
    });
    
    if (gameStateRef.current.draggingPiece) {
      const dragPiece = gameStateRef.current.draggingPiece;
      
      // Draw with slight transparency and shadow effect
      ctx.globalAlpha = 0.8;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;
      
      // Use center-cropped coordinates
      const pieceWidth = gameStateRef.current.cropSize / gameStateRef.current.PUZZLE_COLS;
      const pieceHeight = gameStateRef.current.cropSize / gameStateRef.current.PUZZLE_ROWS;
      
      ctx.drawImage(
        gameStateRef.current.img, 
        gameStateRef.current.cropX + dragPiece.sourceX,
        gameStateRef.current.cropY + dragPiece.sourceY,
        pieceWidth,
        pieceHeight,
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
      if (!piece) return;
      
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
    
    const dragX = gameStateRef.current.draggingPiece.dragX || 0;
    const dragY = gameStateRef.current.draggingPiece.dragY || 0;
    const pieceSize = gameStateRef.current.pieceSize;

    // Find the closest empty slot
    const closestEmptySlot = gameStateRef.current.emptySlots.find(slot => {
      const dx = (dragX + pieceSize / 2) - (slot.destX + pieceSize / 2);
      const dy = (dragY + pieceSize / 2) - (slot.destY + pieceSize / 2);
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < pieceSize * 0.6;
    });
    
    if (closestEmptySlot) {
      // Check if it's the correct piece for this slot
      if (gameStateRef.current.draggingPiece.id === closestEmptySlot.id) {
        audioManager.initialize();
        audioManager.play('snapshot-correct', 0.4);
        
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
        audioManager.initialize();
        audioManager.play('global-wrong', 0.3);
        
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
    hasCalledOnComplete.current = false;
    setGameState('playing');
    setTimeLeft(maxTimePerPuzzle);

    // Calculate center crop coordinates
    calculateCenterCrop();

    const allPieces = [];
    const pieceWidth = gameStateRef.current.cropSize / gameStateRef.current.PUZZLE_COLS;
    const pieceHeight = gameStateRef.current.cropSize / gameStateRef.current.PUZZLE_ROWS;
    
    for (let row = 0; row < gameStateRef.current.PUZZLE_ROWS; row++) {
      for (let col = 0; col < gameStateRef.current.PUZZLE_COLS; col++) {
        allPieces.push({
          id: row * gameStateRef.current.PUZZLE_COLS + col,
          sourceX: col * pieceWidth,  // Position within cropped square
          sourceY: row * pieceHeight,  // Position within cropped square
          destX: col * gameStateRef.current.pieceSize,
          destY: row * gameStateRef.current.pieceSize,
          correctRow: row,
          correctCol: col,
          isMissing: false
        });
      }
    }

    const shuffledPieces = [...allPieces].sort(() => Math.random() - 0.5);

    // Take only 4 pieces as draggable (leaving 5 already in place)
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

  // Timer effect - only starts when image is loaded and puzzle is ready
  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0 && isImageLoaded) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameState('lost');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState, timeLeft, isImageLoaded]);

  // Handle puzzle completion/timeout - call onComplete immediately
  useEffect(() => {
    if (gameState === 'won' && !hasCalledOnComplete.current) {
      // Puzzle complete - call onComplete immediately to trigger fast countdown
      console.log('SnapShot: Puzzle complete! Calling onComplete with timeRemaining:', timeRemaining);
      hasCalledOnComplete.current = true;
      if (onComplete) {
        onComplete(MAX_SCORE, MAX_SCORE, timeRemaining);
      }
    }

    if (gameState === 'lost' && !hasCalledOnComplete.current) {
      // Time ran out - call onComplete immediately with partial score
      console.log('SnapShot: Time up! Calling onComplete with timeRemaining:', timeRemaining);
      hasCalledOnComplete.current = true;
      if (onComplete) {
        const percentComplete = gameStateRef.current.completedSlots / gameStateRef.current.NUM_DRAGGABLE_PIECES;
        const score = Math.round(percentComplete * MAX_SCORE);
        onComplete(score, MAX_SCORE, timeRemaining);
      }
    }
  }, [gameState, onComplete, timeRemaining]);

  // Initialize puzzles
  useEffect(() => {
    fetchPuzzles();
  }, []);

  // Load image when puzzles change or current puzzle changes
  useEffect(() => {
    const currentPuzzle = getCurrentPuzzle();
    if (!currentPuzzle || loading) return;

    // Reset image loaded state when starting to load new image
    setIsImageLoaded(false);

    const img = gameStateRef.current.img;
    gameStateRef.current.IMAGE_URL = currentPuzzle.image_url;

    // Set crossOrigin to allow canvas operations on images from Supabase storage
    img.crossOrigin = "anonymous";

    img.onload = () => {
      setIsImageLoaded(true);
    };

    img.onerror = (err) => {
      console.error("Image load failed:", currentPuzzle.image_url, err);
      // Try fallback image
      const fallbackUrl = 'https://plus.unsplash.com/premium_photo-1754781493808-e575e4474ee9?q=80&w=2005&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
      if (img.src !== fallbackUrl) {
        img.crossOrigin = "anonymous";
        img.src = fallbackUrl;
      } else {
        setIsImageLoaded(false);
      }
    };

    // Set src last (after crossOrigin is set)
    if (img.complete && img.naturalWidth !== 0 && img.src === currentPuzzle.image_url) {
      img.onload?.(new Event('load'));
    } else {
      img.src = currentPuzzle.image_url;
    }

    // Cleanup
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [puzzles, currentPuzzleIndex, loading]);

  // Initialize puzzle AFTER image is loaded and canvas is rendered
  useEffect(() => {
    if (!isImageLoaded || !canvasRef.current) return;
    
    const timer = requestAnimationFrame(() => {
      handleResize();
      resetGame();
    });
    
    return () => cancelAnimationFrame(timer);
  }, [isImageLoaded]);

  // Handle resize
  useEffect(() => {
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

    // Global event handlers
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
    
    // Local event handlers
    const handleMouseDown = (e: MouseEvent) => handleStart(e);
    const handleTouchStart = (e: TouchEvent) => handleStart(e);

    // Add global listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    // Add local listeners
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('touchstart', handleTouchStart);
    };
  }, [isImageLoaded]);

  const currentPuzzle = getCurrentPuzzle();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-pink-400">
          <div className="text-lg" style={{ textShadow: '0 0 10px #ec4899' }}>
            <Shapes className="inline-block w-5 h-5 mr-2" style={{ filter: 'drop-shadow(0 0 8px rgba(236, 72, 153, 0.6))' }} />
            Loading puzzles...
          </div>
          <div className="text-sm text-pink-300 mt-2">Connecting to database</div>
        </div>
      </div>
    );
  }

  // Image not loaded yet
  if (!isImageLoaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-pink-400">
          <div className="text-lg" style={{ textShadow: '0 0 10px #ec4899' }}>
            <Shapes className="inline-block w-5 h-5 mr-2" style={{ filter: 'drop-shadow(0 0 8px rgba(236, 72, 153, 0.6))' }} />
            Loading image...
          </div>
          <div className="text-sm text-pink-300 mt-2">
            {currentPuzzle ? `Loading: ${currentPuzzle.prompt}` : 'Preparing puzzle'}
          </div>
        </div>
      </div>
    );
  }

  // No puzzles available
  if (!currentPuzzle) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-white">
          <div className="text-lg text-red-500" style={{ textShadow: '0 0 10px #ff0066' }}>❌ No puzzles available</div>
          <div className="text-sm text-pink-300 mt-2">Check your Supabase connection</div>
          <button
            onClick={fetchPuzzles}
            className="mt-4 px-6 py-3 bg-transparent border-2 border-pink-400 text-pink-400 rounded-lg font-semibold hover:bg-pink-400 hover:text-black transition-all"
            style={{ textShadow: '0 0 8px #ec4899', boxShadow: '0 0 15px rgba(236, 72, 153, 0.3)' }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const percentComplete = (gameStateRef.current.completedSlots / gameStateRef.current.NUM_DRAGGABLE_PIECES) * 100;
  const currentScore = Math.round((gameStateRef.current.completedSlots / gameStateRef.current.NUM_DRAGGABLE_PIECES) * MAX_SCORE);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-2 pt-4">
      <div className="text-center max-w-4xl w-full text-white">
      
      {/* Header */}
      <div className="mb-3 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-pink-400 mb-1 border-b border-pink-400 pb-1 flex items-center justify-center gap-2">
          <Shapes 
            className="w-6 h-6 sm:w-7 sm:h-7" 
            style={{ 
              color: '#ec4899',
              filter: 'drop-shadow(0 0 8px rgba(236, 72, 153, 0.6))',
              strokeWidth: 2
            }} 
          />
          <span style={{ textShadow: '0 0 10px #ec4899' }}>SnapShot</span>
        </h2>
        
        {/* Tagline */}
        <p className="text-pink-300 text-xs sm:text-sm mb-2 sm:mb-4">
          Piece it Together
        </p>

        {/* Score */}
        <div className="flex justify-start items-center mb-2 sm:mb-4 text-sm sm:text-base">
          <div className="text-pink-300">
            Score: <strong className="text-yellow-400 tabular-nums text-base sm:text-lg">{currentScore}</strong>
          </div>
        </div>
      </div>

      <div className="w-full flex flex-col items-center">
        {/* Puzzle Canvas */}
        <div className="w-full md:w-2/3 mb-3 sm:mb-8 bg-black rounded-xl p-2 transition-all duration-300 transform scale-100 md:hover:scale-105 aspect-square border-2 border-pink-400/40 relative" style={{ boxShadow: '0 0 20px rgba(236, 72, 153, 0.2)' }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full border-2 border-pink-500 rounded-lg"
            style={{ touchAction: 'none', boxShadow: '0 0 15px rgba(236, 72, 153, 0.3)' }}
          />
          
          {/* Completion Overlay */}
          {gameState === 'won' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-xl">
              <div className="text-center">
                <div className="text-4xl sm:text-5xl mb-2">🎉</div>
                <div className="text-2xl sm:text-3xl font-bold text-green-400 mb-2" style={{ textShadow: '0 0 20px #22c55e' }}>
                  Puzzle Complete!
                </div>
                <div className="text-lg text-green-300">
                  +{MAX_SCORE} points
                </div>
              </div>
            </div>
          )}
          
          {/* Time Out Overlay */}
          {gameState === 'lost' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-xl">
              <div className="text-center">
                <div className="text-4xl sm:text-5xl mb-2">⏱️</div>
                <div className="text-2xl sm:text-3xl font-bold text-yellow-400 mb-2" style={{ textShadow: '0 0 20px #fbbf24' }}>
                  Time's Up!
                </div>
                <div className="text-lg text-yellow-300">
                  +{Math.round((gameStateRef.current.completedSlots / gameStateRef.current.NUM_DRAGGABLE_PIECES) * MAX_SCORE)} points
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Draggable pieces container */}
        <div
          ref={draggableContainerRef}
          id="draggable-pieces-container"
          className="w-full flex flex-wrap justify-center gap-2 sm:gap-4 bg-black border-2 border-pink-400/40 rounded-xl p-2 sm:p-4 mb-3 sm:mb-8"
          style={{ boxShadow: 'inset 0 0 20px rgba(236, 72, 153, 0.1)', minHeight: '100px' }}
        />

        {/* Controls */}
        <div className="w-full flex justify-center">
          <button
            onClick={resetGame}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-transparent border-2 border-pink-400 text-pink-400 text-sm sm:text-base font-bold rounded-lg hover:bg-pink-400 hover:text-black transition-all"
            style={{ textShadow: '0 0 8px #ec4899', boxShadow: '0 0 15px rgba(236, 72, 153, 0.3)' }}
          >
            🔄 Reset Puzzle
          </button>
        </div>
      </div>
      </div>
    </div>
  );
});

SnapShot.displayName = 'SnapShot';

export default SnapShot;