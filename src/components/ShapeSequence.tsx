import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

interface ShapeSequenceProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
}

const ShapeSequenceGame = forwardRef<any, ShapeSequenceProps>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'waiting' | 'showing' | 'playing' | 'correct' | 'wrong' | 'gameover'>('waiting');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [showingIndex, setShowingIndex] = useState(0);

  useImperativeHandle(ref, () => ({
  getGameScore: () => ({
    score: Math.round((score / 500) * 100), // Normalize score to 0-100
    maxScore: 100
  }),
  onGameEnd: () => {
    console.log(`ShapeSequence ended at level: ${level}, score: ${score}`);
  },
  canSkipQuestion: false
}));

  // Game state variables (using refs to maintain state across renders)
  const gameStateRef = useRef({
    canvasWidth: 0,
    canvasHeight: 0,
    shapes: [],
    sequence: [],
    playerSequence: [],
    showingSequence: false,
    sequenceIndex: 0,
    lastClickTime: 0,
    animatingShape: null,
    animationStartTime: 0,
    feedbackStartTime: 0,
    feedbackType: null
  });

  const SHAPES = [
    { id: 0, type: 'circle', color: '#ff6b6b', x: 0.2, y: 0.3, size: 80 },
    { id: 1, type: 'square', color: '#4ecdc4', x: 0.8, y: 0.3, size: 80 },
    { id: 2, type: 'triangle', color: '#45b7d1', x: 0.2, y: 0.7, size: 80 },
    { id: 3, type: 'diamond', color: '#f9ca24', x: 0.8, y: 0.7, size: 80 },
    { id: 4, type: 'star', color: '#6c5ce7', x: 0.5, y: 0.5, size: 80 }
  ];

  const playSound = (frequency = 440, duration = 150) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (error) {
      console.log('Audio not supported');
    }
  };

  const handleResize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const size = Math.min(container.offsetWidth, window.innerHeight * 0.6);
    canvas.width = size;
    canvas.height = size;
    gameStateRef.current.canvasWidth = canvas.width;
    gameStateRef.current.canvasHeight = canvas.height;

    // Update shape positions based on canvas size
    gameStateRef.current.shapes = SHAPES.map(shape => ({
      ...shape,
      actualX: shape.x * canvas.width,
      actualY: shape.y * canvas.height,
      actualSize: shape.size * (canvas.width / 400) // Scale size based on canvas
    }));

    drawGame();
  };

  const drawShape = (ctx, shape, isHighlighted = false, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    
    const x = shape.actualX;
    const y = shape.actualY;
    const size = shape.actualSize;
    
    // Add glow effect when highlighted
    if (isHighlighted) {
      ctx.shadowColor = shape.color;
      ctx.shadowBlur = 20;
      ctx.fillStyle = shape.color;
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = shape.color;
    }

    ctx.beginPath();
    
    switch (shape.type) {
      case 'circle':
        ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
        break;
      case 'square':
        ctx.rect(x - size / 2, y - size / 2, size, size);
        break;
      case 'triangle':
        ctx.moveTo(x, y - size / 2);
        ctx.lineTo(x - size / 2, y + size / 2);
        ctx.lineTo(x + size / 2, y + size / 2);
        ctx.closePath();
        break;
      case 'diamond':
        ctx.moveTo(x, y - size / 2);
        ctx.lineTo(x + size / 2, y);
        ctx.lineTo(x, y + size / 2);
        ctx.lineTo(x - size / 2, y);
        ctx.closePath();
        break;
      case 'star':
        const spikes = 5;
        const outerRadius = size / 2;
        const innerRadius = outerRadius * 0.4;
        let rot = Math.PI / 2 * 3;
        let cx = x;
        let cy = y;
        const step = Math.PI / spikes;

        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
          cx = x + Math.cos(rot) * outerRadius;
          cy = y + Math.sin(rot) * outerRadius;
          ctx.lineTo(cx, cy);
          rot += step;

          cx = x + Math.cos(rot) * innerRadius;
          cy = y + Math.sin(rot) * innerRadius;
          ctx.lineTo(cx, cy);
          rot += step;
        }
        ctx.lineTo(x, y - outerRadius);
        ctx.closePath();
        break;
    }
    
    ctx.fill();
    
    // Add border
    ctx.strokeStyle = isHighlighted ? '#ffffff' : '#ffffff40';
    ctx.lineWidth = isHighlighted ? 4 : 2;
    ctx.stroke();
    
    ctx.restore();
  };

  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with gradient background
    const gradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#0f0f23');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const currentTime = Date.now();
    
    // Draw all shapes
    gameStateRef.current.shapes.forEach(shape => {
      let isHighlighted = false;
      let alpha = 1;

      // Check if this shape is currently being animated
      if (gameStateRef.current.animatingShape === shape.id) {
        const animationProgress = (currentTime - gameStateRef.current.animationStartTime) / 600;
        if (animationProgress < 1) {
          // Pulsing animation
          const pulseIntensity = Math.sin(animationProgress * Math.PI * 4) * 0.5 + 0.5;
          isHighlighted = pulseIntensity > 0.3;
          alpha = 0.7 + (pulseIntensity * 0.3);
        } else {
          gameStateRef.current.animatingShape = null;
        }
      }

      // Dim shapes when not playing
      if (gameState === 'showing' || gameState === 'waiting') {
        alpha *= 0.6;
      }

      drawShape(ctx, shape, isHighlighted, alpha);
    });

    // Draw feedback overlay
    if (gameStateRef.current.feedbackType && gameStateRef.current.feedbackStartTime) {
      const feedbackProgress = (currentTime - gameStateRef.current.feedbackStartTime) / 800;
      if (feedbackProgress < 1) {
        ctx.save();
        ctx.globalAlpha = (1 - feedbackProgress) * 0.3;
        ctx.fillStyle = gameStateRef.current.feedbackType === 'correct' ? '#4ade80' : '#ef4444';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        gameStateRef.current.feedbackType = null;
      }
    }

    // Continue animation loop if needed
    if (gameStateRef.current.animatingShape !== null || gameStateRef.current.feedbackType) {
      requestAnimationFrame(drawGame);
    }
  };

  const getClickedShape = (x, y) => {
    return gameStateRef.current.shapes.find(shape => {
      const dx = x - shape.actualX;
      const dy = y - shape.actualY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= shape.actualSize / 2;
    });
  };

  const generateSequence = (length) => {
    const sequence = [];
    for (let i = 0; i < length; i++) {
      const availableShapes = level <= 3 ? SHAPES.slice(0, 4) : SHAPES; // Start with 4 shapes, add 5th at level 4
      sequence.push(availableShapes[Math.floor(Math.random() * availableShapes.length)].id);
    }
    return sequence;
  };

  const showSequence = async () => {
    setGameState('showing');
    gameStateRef.current.playerSequence = [];
    setShowingIndex(0);
    
    const sequence = gameStateRef.current.sequence;
    
    for (let i = 0; i < sequence.length; i++) {
      setShowingIndex(i);
      
      // Animate the shape
      gameStateRef.current.animatingShape = sequence[i];
      gameStateRef.current.animationStartTime = Date.now();
      
      // Play sound based on shape
      const frequencies = [440, 523, 659, 784, 880]; // C, C#, E, G, A
      playSound(frequencies[sequence[i]], 400);
      
      // Start animation
      drawGame();
      
      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Brief pause between shapes
      if (i < sequence.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    setShowingIndex(-1);
    setGameState('playing');
  };

  const handleShapeClick = (shapeId) => {
    if (gameState !== 'playing') return;
    
    const currentTime = Date.now();
    if (currentTime - gameStateRef.current.lastClickTime < 200) return; // Debounce
    gameStateRef.current.lastClickTime = currentTime;

    // Animate clicked shape
    gameStateRef.current.animatingShape = shapeId;
    gameStateRef.current.animationStartTime = Date.now();
    drawGame();

    // Play sound
    const frequencies = [440, 523, 659, 784, 880];
    playSound(frequencies[shapeId], 200);

    gameStateRef.current.playerSequence.push(shapeId);
    const currentIndex = gameStateRef.current.playerSequence.length - 1;
    const expectedId = gameStateRef.current.sequence[currentIndex];

    if (shapeId === expectedId) {
      // Correct so far
      if (gameStateRef.current.playerSequence.length === gameStateRef.current.sequence.length) {
        // Sequence complete!
        setGameState('correct');
        gameStateRef.current.feedbackType = 'correct';
        gameStateRef.current.feedbackStartTime = Date.now();
        drawGame();
        
        playSound(880, 300); // Success sound
        setScore(prev => {
          const newScore = prev + level * 10;
          if (props.onScoreUpdate) {
            props.onScoreUpdate(newScore, newScore);
          }
          return newScore;
        });

        setTimeout(() => {
          setLevel(prev => prev + 1);
          startNextRound();
        }, 1000);
      }
    } else {
      // Wrong!
      setGameState('wrong');
      gameStateRef.current.feedbackType = 'wrong';
      gameStateRef.current.feedbackStartTime = Date.now();
      drawGame();
      
      playSound(200, 500); // Error sound
      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setTimeout(() => setGameState('gameover'), 1000);
        } else {
          setTimeout(() => showSequence(), 1000);
        }
        return newLives;
      });
    }
  };

  const handleCanvasClick = (e) => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const clickedShape = getClickedShape(x, y);
    if (clickedShape) {
      handleShapeClick(clickedShape.id);
    }
  };

  const startNextRound = () => {
    const sequenceLength = Math.min(3 + level - 1, 8); // Start with 3, max 8
    gameStateRef.current.sequence = generateSequence(sequenceLength);
    setTimeout(() => showSequence(), 500);
  };

  const startGame = () => {
    setLevel(1);
    setScore(0);
    setLives(3);
    setGameState('waiting');
    startNextRound();
  };

  const resetGame = () => {
    setGameState('waiting');
    setLevel(1);
    setScore(0);
    setLives(3);
    gameStateRef.current.playerSequence = [];
    gameStateRef.current.sequence = [];
    gameStateRef.current.animatingShape = null;
    gameStateRef.current.feedbackType = null;
    drawGame();
  };

  // Initialize canvas and handle resize
  useEffect(() => {
    handleResize();
    
    const handleResizeEvent = () => handleResize();
    window.addEventListener('resize', handleResizeEvent);
    
    return () => {
      window.removeEventListener('resize', handleResizeEvent);
    };
  }, []);

  // Handle canvas events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e) => handleCanvasClick(e);
    const handleTouchStart = (e) => {
      e.preventDefault();
      handleCanvasClick(e);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('touchstart', handleTouchStart);
    };
  }, [gameState]);

  return (
    <div className="text-center max-w-4xl mx-auto p-3 sm:p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white">
      {/* Header */}
      <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-center mb-3 sm:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
        Shape Sequence
      </h1>

      {/* Game Stats */}
      <div className="flex justify-center items-center gap-3 sm:gap-8 mb-3 sm:mb-6 flex-wrap text-sm sm:text-base">
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="text-lg sm:text-2xl font-bold text-cyan-400">Level {level}</div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="text-base sm:text-xl font-bold text-yellow-400">Score: {score}</div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="text-base sm:text-xl font-bold text-red-400">
            Lives: {'❤️'.repeat(lives)}
          </div>
        </div>
      </div>

      {/* Game Status */}
      <div className="mb-2 sm:mb-4 min-h-[24px] sm:min-h-[28px]">
        {gameState === 'waiting' && (
          <div className="text-sm sm:text-lg text-purple-300">Ready to start?</div>
        )}
        {gameState === 'showing' && (
          <div className="text-sm sm:text-lg text-cyan-400">
            Watch the sequence... ({showingIndex + 1}/{gameStateRef.current.sequence?.length || 0})
          </div>
        )}
        {gameState === 'playing' && (
          <div className="text-sm sm:text-lg text-green-400">
            Repeat the sequence! ({gameStateRef.current.playerSequence?.length || 0}/{gameStateRef.current.sequence?.length || 0})
          </div>
        )}
        {gameState === 'correct' && (
          <div className="text-sm sm:text-lg text-green-400 animate-pulse">Correct! ✨</div>
        )}
        {gameState === 'wrong' && (
          <div className="text-sm sm:text-lg text-red-400 animate-pulse">Wrong! Try again...</div>
        )}
      </div>

      {/* Game Canvas */}
      <div className="w-full flex justify-center mb-4 sm:mb-8">
        <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-lg p-2 sm:p-4">
          <canvas
            ref={canvasRef}
            className="w-full h-full border-2 border-purple-600 rounded-lg cursor-pointer"
            style={{ touchAction: 'none', aspectRatio: '1' }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-2 sm:gap-4">
        {gameState === 'waiting' && (
          <button
            onClick={startGame}
            className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-transform duration-200 transform hover:scale-105 text-base sm:text-lg"
          >
            🎮 Start Game
          </button>
        )}

        {(gameState === 'playing' || gameState === 'showing' || gameState === 'correct' || gameState === 'wrong') && gameState !== 'gameover' && (
          <button
            onClick={resetGame}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white text-sm sm:text-base font-bold rounded-full shadow-lg hover:shadow-xl transition-transform duration-200 transform hover:scale-105"
          >
            Reset Game
          </button>
        )}
      </div>

      {/* Game Over Screen */}
      {gameState === 'gameover' && (
        <div className="mt-3 sm:mt-6 p-3 sm:p-6 bg-red-500/20 border-2 border-red-400 rounded-xl">
          <div className="text-center">
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-4">
              Game Over! 💀
            </h3>
            <div className="text-base sm:text-lg text-gray-200 mb-2 sm:mb-4">
              <div>Final Score: <strong className="text-yellow-400">{score}</strong></div>
              <div>Level Reached: <strong className="text-cyan-400">{level}</strong></div>
            </div>
            <p className="text-xs sm:text-sm text-purple-300">
              Click "Quit Round" above to continue to the next game
            </p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 sm:mt-8 text-xs sm:text-sm text-purple-300 text-center max-w-2xl mx-auto">
        <p className="mb-1 sm:mb-2">🎯 <strong>How to Play:</strong></p>
        <p>Watch the sequence of flashing shapes, then tap them in the same order. Each level adds more shapes to remember!</p>
      </div>
    </div>
  );
});

ShapeSequenceGame.displayName = 'ShapeSequenceGame';

export default ShapeSequenceGame;