import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Shapes } from 'lucide-react';
import { supabase } from '../lib/supabase';

const DalmatianPuzzle = forwardRef((props: any, ref) => {
  const { onComplete } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggableContainerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [puzzles, setPuzzles] = useState([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(60);
  const [resultTimeout, setResultTimeout] = useState<NodeJS.Timeout | null>(null);

  const maxTimePerPuzzle = 60;

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: gameState === 'won' ? 100 : Math.round((gameStateRef.current.completedSlots / gameStateRef.current.NUM_DRAGGABLE_PIECES) * 100),
      maxScore: 100
    }),
    onGameEnd: () => {
      console.log(`SnapShot ended: ${gameState}, ${gameStateRef.current.completedSlots}/${gameStateRef.current.NUM_DRAGGABLE_PIECES} pieces`);
      if (resultTimeout) {
        clearTimeout(resultTimeout);
      }
    },
    skipQuestion: () => {
      nextPuzzle();
    },
    canSkipQuestion: true,
    loadNextPuzzle: () => {
      nextPuzzle();
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
    if (!canvas) {
      console.log('Canvas not found in handleResize');
      return;
    }

    const container = canvas.parentElement;
    if (!container) {
      console.log('Canvas container not found in handleResize');
      return;
    }

    const size = Math.min(container.offsetWidth, window.innerHeight * 0.7);
    canvas.width = size;
    canvas.height = size;
    gameStateRef.current.canvasWidth = canvas.width;
    gameStateRef.current.canvasHeight = canvas.height;
    gameStateRef.current.pieceSize = gameStateRef.current.canvasWidth / gameStateRef.current.PUZZLE_COLS;

    console.log('Canvas resized to:', size, 'pieceSize:', gameStateRef.current.pieceSize);

    if (isImageLoaded) {
      drawGame();
      drawDraggablePieces();
    }
  };

  const drawDraggablePieces = () => {
    const container = draggableContainerRef.current;
    if (!container) {
      console.log('Container not found');
      return;
    }

    // Wait for container to have dimensions
    if (container.offsetWidth === 0) {
      console.log('Container width is 0, waiting...');
      requestAnimationFrame(drawDraggablePieces);
      return;
    }

    console.log('Drawing draggable pieces, container width:', container.offsetWidth, 'canvas width:', gameStateRef.current.canvasWidth);

    container.innerHTML = '';

    // If no pieces to draw, exit
    if (gameStateRef.current.draggablePieces.length === 0) {
      console.log('No draggable pieces to draw');
      return;
    }

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

    console.log('Draggable piece size:', draggablePieceSize, 'num pieces:', gameStateRef.current.draggablePieces.length);

    gameStateRef.current.draggablePieces.forEach((piece, index) => {
      const pieceCanvas = document.createElement('canvas');
      pieceCanvas.width = draggablePieceSize;
      pieceCanvas.height = draggablePieceSize;
      pieceCanvas.dataset.id = piece.id.toString();
      pieceCanvas.className = 'rounded-lg shadow-md transition-transform duration-100 hover:scale-110 cursor-pointer border-2 border-pink-400';
      pieceCanvas.style.minWidth = '60px';
      pieceCanvas.style.minHeight = '60px';
      pieceCanvas.style.display = 'block';

      console.log(`Creating piece ${index} (id: ${piece.id}):`, pieceCanvas.width, 'x', pieceCanvas.height, 'source:', piece.sourceX, piece.sourceY);

      const pieceCtx = pieceCanvas.getContext('2d');
      if (pieceCtx) {
        try {
          pieceCtx.drawImage(
            gameStateRef.current.img,
            piece.sourceX, piece.sourceY,
            gameStateRef.current.img.width / gameStateRef.current.PUZZLE_COLS,
            gameStateRef.current.img.height / gameStateRef.current.PUZZLE_ROWS,
            0, 0,
            draggablePieceSize, draggablePieceSize
          );
        } catch (err) {
          console.error('Error drawing piece:', err);
        }
      }

      container.appendChild(pieceCanvas);
    });

    console.log('Finished drawing pieces, container children:', container.children.length);
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
          // Call onComplete when puzzle is solved
          if (onComplete) {
            onComplete(100, 100);
          }
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
    if (!currentPuzzle) {
      console.log('No current puzzle found');
      return;
    }

    console.log('Resetting game with puzzle:', currentPuzzle.id);

    // Clear any pending result timeout
    if (resultTimeout) {
      clearTimeout(resultTimeout);
      setResultTimeout(null);
    }

    // Update the image URL for the current puzzle
    gameStateRef.current.IMAGE_URL = currentPuzzle.image_url;

    gameStateRef.current.completedSlots = 0;
    gameStateRef.current.draggingPiece = null;
    gameStateRef.current.isDragging = false;
    setGameState('playing');
    setTimeLeft(maxTimePerPuzzle);

    console.log('Image dimensions:', gameStateRef.current.img.width, 'x', gameStateRef.current.img.height);
    console.log('Canvas dimensions:', gameStateRef.current.canvasWidth, 'x', gameStateRef.current.canvasHeight);
    console.log('Piece size:', gameStateRef.current.pieceSize);

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

    console.log('Created', allPieces.length, 'pieces');

    const shuffledPieces = [...allPieces].sort(() => Math.random() - 0.5);

    gameStateRef.current.draggablePieces = shuffledPieces.slice(0, gameStateRef.current.NUM_DRAGGABLE_PIECES);

    console.log('Draggable pieces:', gameStateRef.current.draggablePieces.length);

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

    console.log('About to draw draggable pieces...');
    drawDraggablePieces();
    console.log('About to draw game...');
    drawGame();
    console.log('Reset complete');
  };

  // Timer effect
  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
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
  }, [gameState, timeLeft]);

  // Handle puzzle completion
  useEffect(() => {
    if (gameState === 'won' && puzzles.length > 1) {
      // Auto-advance to next puzzle after 3 seconds
      const timeout = setTimeout(() => {
        nextPuzzle();
      }, 3000);
      setResultTimeout(timeout);
    }
  }, [gameState, puzzles.length]);

  // Initialize puzzles
  useEffect(() => {
    fetchPuzzles();
  }, []);

  // Load image when puzzles change or current puzzle changes
  useEffect(() => {
    const currentPuzzle = getCurrentPuzzle();
    if (!currentPuzzle || loading) {
      console.log('No puzzle or still loading, skipping image load');
      return;
    }

    console.log('Loading image for puzzle:', currentPuzzle.id, 'URL:', currentPuzzle.image_url);

    const img = gameStateRef.current.img;
    gameStateRef.current.IMAGE_URL = currentPuzzle.image_url;

    img.onload = () => {
      console.log('Image loaded successfully!', img.width, 'x', img.height);
      setIsImageLoaded(true);
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        handleResize();
        resetGame();
      });
    };

    img.onerror = (err) => {
      console.error("Failed to load image:", err, "URL:", currentPuzzle.image_url);
      // Try fallback image
      const fallbackUrl = 'https://plus.unsplash.com/premium_photo-1754781493808-e575e4474ee9?q=80&w=2005&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
      if (img.src !== fallbackUrl) {
        console.log('Trying fallback image');
        img.src = fallbackUrl;
      } else {
        setIsImageLoaded(false);
      }
    };

    // If image is already loaded (cached), trigger onload manually
    if (img.complete && img.naturalWidth > 0) {
      console.log('Image already cached, triggering onload');
      img.onload(null);
    } else {
      img.src = currentPuzzle.image_url;
    }
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

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-2 pt-4">
      <div className="text-center max-w-4xl w-full text-white">
      
      {/* Header - Updated to match pattern */}
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

        {/* Stats - Score, Timer, Pieces (removed puzzle number and difficulty) */}
        <div className="flex justify-center items-center gap-3 sm:gap-6 text-xs sm:text-sm">
          <div className="flex items-center gap-1 sm:gap-2">
            <div className={`text-base sm:text-lg font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-pink-400'}`} style={{ textShadow: timeLeft > 10 ? '0 0 10px #ec4899' : '0 0 10px #ff0066' }}>
              ⏰ {timeLeft}s
            </div>
          </div>
          <div className="text-pink-300">
            {gameStateRef.current.completedSlots} / {gameStateRef.current.NUM_DRAGGABLE_PIECES} pieces
          </div>
        </div>
      </div>

      <div className="w-full flex flex-col items-center">
        {/* Puzzle Canvas - Updated to pink theme */}
        <div className="w-full md:w-2/3 mb-3 sm:mb-8 bg-black rounded-xl p-2 transition-all duration-300 transform scale-100 md:hover:scale-105 aspect-square border-2 border-pink-400/40" style={{ boxShadow: '0 0 20px rgba(236, 72, 153, 0.2)' }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full border-2 border-pink-500 rounded-lg"
            style={{ touchAction: 'none', boxShadow: '0 0 15px rgba(236, 72, 153, 0.3)' }}
          />
        </div>

        {/* Draggable pieces container - Updated to pink theme */}
        <div
          ref={draggableContainerRef}
          id="draggable-pieces-container"
          className="w-full flex flex-wrap justify-center gap-2 sm:gap-4 bg-black border-2 border-pink-400/40 rounded-xl p-2 sm:p-4 mb-3 sm:mb-8"
          style={{ boxShadow: 'inset 0 0 20px rgba(236, 72, 153, 0.1)', minHeight: '100px' }}
        />

        {/* Controls - Updated to pink theme */}
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

      {/* Game Over Message - Updated to pink theme */}
      {gameState !== 'playing' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-black border-2 border-pink-400 p-8 rounded-lg" style={{ boxShadow: '0 0 30px rgba(236, 72, 153, 0.5)' }}>
            <div className="flex flex-col items-center justify-center space-y-4">
              <h3 className="text-3xl font-bold text-pink-400" style={{ textShadow: '0 0 15px #ec4899' }}>
                {gameState === 'won' ? '🎉 Puzzle Solved!' : "⏰ Time's Up!"}
              </h3>
              {gameState === 'won' && (
                <div className="text-lg text-green-400 text-center" style={{ textShadow: '0 0 10px #22c55e' }}>
                  Completed in {maxTimePerPuzzle - timeLeft} seconds!
                </div>
              )}
              {currentPuzzle.correct_answer && (
                <div className="text-lg text-pink-300 text-center">
                  Answer: <strong className="text-yellow-400">{currentPuzzle.correct_answer}</strong>
                </div>
              )}
              {puzzles.length > 1 && gameState === 'won' && (
                <div className="text-sm text-pink-400 text-center" style={{ textShadow: '0 0 8px #ec4899' }}>
                  Next puzzle loading automatically...
                </div>
              )}
              <button
                onClick={resetGame}
                className="px-6 py-3 bg-transparent border-2 border-pink-400 text-pink-400 font-bold rounded-lg hover:bg-pink-400 hover:text-black transition-all"
                style={{ textShadow: '0 0 8px #ec4899', boxShadow: '0 0 15px rgba(236, 72, 153, 0.3)' }}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
});

DalmatianPuzzle.displayName = 'DalmatianPuzzle';

export default DalmatianPuzzle;