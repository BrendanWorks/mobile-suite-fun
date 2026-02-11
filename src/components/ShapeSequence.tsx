import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Repeat } from 'lucide-react';

interface ShapeSequenceProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
  duration?: number;
}

interface GameShape {
  id: number;
  type: string;
  color: string;
  x: number;
  y: number;
  size: number;
  actualX?: number;
  actualY?: number;
  actualSize?: number;
}

interface GameState {
  canvasWidth: number;
  canvasHeight: number;
  shapes: GameShape[];
  sequence: number[];
  playerSequence: number[];
  showingSequence: boolean;
  sequenceIndex: number;
  lastClickTime: number;
  animatingShape: number | null;
  animationStartTime: number;
  feedbackStartTime: number;
  feedbackType: 'correct' | 'wrong' | null;
}

const MAX_SCORE = 1000;
const MAX_LIVES = 3;
const INITIAL_SEQUENCE_LENGTH = 3;
const MAX_SEQUENCE_LENGTH = 10;
const SHAPE_ANIMATION_DURATION = 600;
const FEEDBACK_DURATION = 800;

const SHAPES: GameShape[] = [
  { id: 0, type: 'circle', color: '#ef4444', x: 0.25, y: 0.25, size: 75 },    // Red
  { id: 1, type: 'square', color: '#3b82f6', x: 0.75, y: 0.25, size: 75 },    // Blue
  { id: 2, type: 'triangle', color: '#10b981', x: 0.25, y: 0.75, size: 75 },  // Green
  { id: 3, type: 'diamond', color: '#f59e0b', x: 0.75, y: 0.75, size: 75 },   // Yellow
  { id: 4, type: 'star', color: '#8b5cf6', x: 0.5, y: 0.5, size: 75 },        // Purple
];

const SHAPE_FREQUENCIES = [440, 523.25, 659.25, 783.99, 880]; // Musical notes

const ShapeSequenceGame = forwardRef<any, ShapeSequenceProps>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const gameOverTimeoutRef = useRef<number | null>(null);
  const sequenceTimeoutsRef = useRef<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const [gameState, setGameState] = useState<'idle' | 'showing' | 'playing' | 'correct' | 'wrong' | 'gameover'>('idle');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [showingIndex, setShowingIndex] = useState(-1);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('simonHighScore') || '0');
    } catch {
      return 0;
    }
  });

  const gameStateRef = useRef<GameState>({
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
    feedbackType: null,
  });

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score, maxScore: MAX_SCORE }),
    onGameEnd: () => {
      cleanupTimeouts();
    },
    canSkipQuestion: false,
    hideTimer: true,
  }));

  // Initialize audio context on user interaction
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.warn('Audio not supported');
      }
    }
  }, []);

  const playSound = useCallback((frequency: number, duration: number = 150) => {
    if (!audioContextRef.current) return;
    
    try {
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.2, audioContextRef.current.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + duration / 1000);
      
      oscillator.start(audioContextRef.current.currentTime);
      oscillator.stop(audioContextRef.current.currentTime + duration / 1000);
    } catch (error) {
      console.warn('Failed to play sound');
    }
  }, []);

  const cleanupTimeouts = useCallback(() => {
    sequenceTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    sequenceTimeoutsRef.current = [];
    
    if (gameOverTimeoutRef.current) {
      clearTimeout(gameOverTimeoutRef.current);
      gameOverTimeoutRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const drawShape = useCallback((ctx: CanvasRenderingContext2D, shape: GameShape, isHighlighted = false, alpha = 1) => {
    const x = shape.actualX!;
    const y = shape.actualY!;
    const size = shape.actualSize!;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    
    // Glow effect for highlighted shapes
    if (isHighlighted) {
      ctx.shadowColor = shape.color;
      ctx.shadowBlur = 25;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    
    ctx.fillStyle = shape.color;
    ctx.lineWidth = isHighlighted ? 3 : 1.5;
    ctx.strokeStyle = isHighlighted ? '#ffffff' : '#ffffff30';
    
    ctx.beginPath();
    
    switch (shape.type) {
      case 'circle':
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        break;
      case 'square':
        ctx.rect(x - size / 2, y - size / 2, size, size);
        break;
      case 'triangle':
        const triangleHeight = (Math.sqrt(3) / 2) * size;
        ctx.moveTo(x, y - triangleHeight / 2);
        ctx.lineTo(x - size / 2, y + triangleHeight / 2);
        ctx.lineTo(x + size / 2, y + triangleHeight / 2);
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
        let rotation = (Math.PI / 2) * 3;
        
        ctx.moveTo(x, y - outerRadius);
        for (let i = 0; i < spikes; i++) {
          ctx.lineTo(
            x + Math.cos(rotation) * outerRadius,
            y + Math.sin(rotation) * outerRadius
          );
          rotation += Math.PI / spikes;
          
          ctx.lineTo(
            x + Math.cos(rotation) * innerRadius,
            y + Math.sin(rotation) * innerRadius
          );
          rotation += Math.PI / spikes;
        }
        ctx.closePath();
        break;
    }
    
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, []);

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear with gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const currentTime = Date.now();
    const state = gameStateRef.current;
    
    // Draw all shapes
    state.shapes.forEach(shape => {
      let isHighlighted = false;
      let alpha = 1;
      
      // Animation for currently highlighted shape
      if (state.animatingShape === shape.id) {
        const animationProgress = (currentTime - state.animationStartTime) / SHAPE_ANIMATION_DURATION;
        if (animationProgress < 1) {
          const pulse = Math.sin(animationProgress * Math.PI * 6) * 0.5 + 0.5;
          isHighlighted = pulse > 0.3;
          alpha = 0.8 + pulse * 0.2;
        } else {
          state.animatingShape = null;
        }
      }
      
      // Dim shapes during sequence display
      if (gameState === 'showing' && shape.id !== state.sequence[showingIndex]) {
        alpha *= 0.4;
      }
      
      drawShape(ctx, shape, isHighlighted, alpha);
    });
    
    // Draw feedback overlay
    if (state.feedbackType && state.feedbackStartTime) {
      const feedbackProgress = (currentTime - state.feedbackStartTime) / FEEDBACK_DURATION;
      if (feedbackProgress < 1) {
        ctx.save();
        ctx.globalAlpha = (1 - feedbackProgress) * 0.4;
        ctx.fillStyle = state.feedbackType === 'correct' ? '#10b981' : '#ef4444';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        state.feedbackType = null;
      }
    }
    
    // Continue animation if needed
    if (state.animatingShape !== null || state.feedbackType) {
      animationFrameRef.current = requestAnimationFrame(drawGame);
    }
  }, [gameState, showingIndex, drawShape]);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const container = canvas.parentElement;
    if (!container) return;
    
    const size = Math.min(container.offsetWidth - 32, 500);
    canvas.width = size;
    canvas.height = size;
    
    const state = gameStateRef.current;
    state.canvasWidth = size;
    state.canvasHeight = size;
    
    // Calculate actual positions
    state.shapes = SHAPES.map(shape => ({
      ...shape,
      actualX: shape.x * size,
      actualY: shape.y * size,
      actualSize: shape.size * (size / 400),
    }));
    
    drawGame();
  }, [drawGame]);

  const generateSequence = useCallback((length: number): number[] => {
    const availableShapes = level <= 3 ? SHAPES.slice(0, 4) : SHAPES;
    return Array.from({ length }, () => 
      availableShapes[Math.floor(Math.random() * availableShapes.length)].id
    );
  }, [level]);

  const showSequence = useCallback(async () => {
    setGameState('showing');
    gameStateRef.current.playerSequence = [];
    setShowingIndex(-1);
    
    const sequence = gameStateRef.current.sequence;
    
    // Brief pause before starting
    await new Promise(resolve => {
      const timeout = window.setTimeout(resolve, 500);
      sequenceTimeoutsRef.current.push(timeout);
    });
    
    for (let i = 0; i < sequence.length; i++) {
      setShowingIndex(i);
      
      // Animate shape
      gameStateRef.current.animatingShape = sequence[i];
      gameStateRef.current.animationStartTime = Date.now();
      drawGame();
      
      // Play corresponding sound
      playSound(SHAPE_FREQUENCIES[sequence[i]], 400);
      
      // Wait for animation
      await new Promise(resolve => {
        const timeout = window.setTimeout(resolve, 800);
        sequenceTimeoutsRef.current.push(timeout);
      });
      
      // Pause between shapes
      if (i < sequence.length - 1) {
        await new Promise(resolve => {
          const timeout = window.setTimeout(resolve, 150);
          sequenceTimeoutsRef.current.push(timeout);
        });
      }
    }
    
    setShowingIndex(-1);
    setGameState('playing');
  }, [drawGame, playSound]);

  const handleShapeClick = useCallback((shapeId: number) => {
    if (gameState !== 'playing') return;
    
    const currentTime = Date.now();
    if (currentTime - gameStateRef.current.lastClickTime < 150) return;
    gameStateRef.current.lastClickTime = currentTime;
    
    // Animate clicked shape
    gameStateRef.current.animatingShape = shapeId;
    gameStateRef.current.animationStartTime = Date.now();
    drawGame();
    
    // Play sound
    playSound(SHAPE_FREQUENCIES[shapeId], 200);
    
    const state = gameStateRef.current;
    state.playerSequence.push(shapeId);
    const currentIndex = state.playerSequence.length - 1;
    const expectedId = state.sequence[currentIndex];
    
    if (shapeId === expectedId) {
      // Correct
      if (state.playerSequence.length === state.sequence.length) {
        // Sequence complete
        setGameState('correct');
        state.feedbackType = 'correct';
        state.feedbackStartTime = Date.now();
        drawGame();
        
        // Success sound
        setTimeout(() => playSound(987.77, 300), 100);
        
        // Calculate and update score
        const points = level * 15 + state.sequence.length * 5;
        setScore(prev => {
          const newScore = prev + points;
          props.onScoreUpdate?.(newScore, MAX_SCORE);
          
          // Update high score
          if (newScore > highScore) {
            setHighScore(newScore);
            try {
              localStorage.setItem('simonHighScore', newScore.toString());
            } catch {}
          }
          
          return newScore;
        });
        
        // Move to next level
        setTimeout(() => {
          setLevel(prev => prev + 1);
          startNextRound();
        }, 1000);
      }
    } else {
      // Wrong
      setGameState('wrong');
      state.feedbackType = 'wrong';
      state.feedbackStartTime = Date.now();
      drawGame();
      
      playSound(200, 500);
      
      setLives(prev => {
        const newLives = prev - 1;
        
        if (newLives <= 0) {
          // Game over
          setTimeout(() => {
            setGameState('gameover');
            gameOverTimeoutRef.current = window.setTimeout(() => {
              props.onComplete?.(score, MAX_SCORE);
            }, 2500);
          }, 1000);
        } else {
          // Try again
          setTimeout(() => {
            showSequence();
          }, 1000);
        }
        
        return newLives;
      });
    }
  }, [gameState, level, score, highScore, drawGame, playSound, showSequence, props]);

  const handleCanvasClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    // Find clicked shape
    const clickedShape = gameStateRef.current.shapes.find(shape => {
      const dx = x - shape.actualX!;
      const dy = y - shape.actualY!;
      return Math.sqrt(dx * dx + dy * dy) <= shape.actualSize! / 2;
    });
    
    if (clickedShape) {
      handleShapeClick(clickedShape.id);
    }
  }, [handleShapeClick]);

  const startNextRound = useCallback(() => {
    const sequenceLength = Math.min(INITIAL_SEQUENCE_LENGTH + level - 1, MAX_SEQUENCE_LENGTH);
    gameStateRef.current.sequence = generateSequence(sequenceLength);
    
    setTimeout(() => {
      showSequence();
    }, 500);
  }, [level, generateSequence, showSequence]);

  const startGame = useCallback(() => {
    initAudio();
    cleanupTimeouts();
    
    setLevel(1);
    setScore(0);
    setLives(MAX_LIVES);
    setGameState('showing');
    
    setTimeout(() => {
      startNextRound();
    }, 300);
  }, [initAudio, cleanupTimeouts, startNextRound]);

  const resetGame = useCallback(() => {
    cleanupTimeouts();
    setGameState('idle');
    setLevel(1);
    setScore(0);
    setLives(MAX_LIVES);
    setShowingIndex(-1);
    
    gameStateRef.current = {
      ...gameStateRef.current,
      sequence: [],
      playerSequence: [],
      animatingShape: null,
      feedbackType: null,
    };
    
    drawGame();
  }, [cleanupTimeouts, drawGame]);

  // Initialize and cleanup
  useEffect(() => {
    handleResize();
    
    const handleResizeEvent = () => handleResize();
    window.addEventListener('resize', handleResizeEvent);
    
    // Initialize on first click
    const initOnClick = () => {
      initAudio();
      document.removeEventListener('click', initOnClick);
    };
    document.addEventListener('click', initOnClick);
    
    return () => {
      cleanupTimeouts();
      window.removeEventListener('resize', handleResizeEvent);
      document.removeEventListener('click', initOnClick);
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [handleResize, initAudio, cleanupTimeouts]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Repeat className="w-10 h-10 text-orange-400 animate-pulse" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
              Memory Shapes
            </h1>
          </div>
          <p className="text-gray-300 mb-4">Watch and repeat the pattern!</p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Score</div>
            <div className="text-2xl font-bold text-yellow-400">{score}</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Level</div>
            <div className="text-2xl font-bold text-green-400">{level}</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Lives</div>
            <div className="text-2xl font-bold text-red-400">
              {'♥'.repeat(lives)}{'♡'.repeat(MAX_LIVES - lives)}
            </div>
          </div>
        </div>

        {/* High Score */}
        <div className="text-center mb-4">
          <div className="inline-block bg-gray-800/30 px-4 py-2 rounded-full">
            <span className="text-gray-400">High Score: </span>
            <span className="font-bold text-orange-300">{highScore}</span>
          </div>
        </div>

        {/* Game Status */}
        <div className="text-center mb-4 min-h-[40px]">
          {gameState === 'showing' && (
            <div className="text-lg text-orange-300 animate-pulse">
              Watch carefully... {showingIndex + 1}/{gameStateRef.current.sequence.length}
            </div>
          )}
          {gameState === 'playing' && (
            <div className="text-lg text-green-400 font-bold">
              Your turn! ({gameStateRef.current.playerSequence.length}/{gameStateRef.current.sequence.length})
            </div>
          )}
          {gameState === 'correct' && (
            <div className="text-lg text-green-400 animate-bounce">Perfect! 🎉</div>
          )}
          {gameState === 'wrong' && (
            <div className="text-lg text-red-400 animate-pulse">Wrong pattern! 😔</div>
          )}
        </div>

        {/* Game Canvas */}
        <div className="flex justify-center mb-8">
          <div className="relative w-full max-w-md">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onTouchStart={handleCanvasClick}
              className="w-full aspect-square rounded-2xl border-4 border-gray-700 shadow-2xl cursor-pointer touch-none"
              style={{
                background: 'radial-gradient(circle at center, #1a1a1a 0%, #0a0a0a 100%)',
              }}
            />
            
            {/* Center indicator */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-16 h-16 rounded-full border-2 border-gray-600/50 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400/20 to-transparent animate-spin-slow" />
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mb-8">
          {gameState === 'idle' || gameState === 'gameover' ? (
            <button
              onClick={startGame}
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-bold rounded-xl text-lg hover:from-orange-600 hover:to-yellow-600 transition-all transform hover:scale-105 active:scale-95 shadow-lg"
            >
              {gameState === 'gameover' ? 'Play Again' : 'Start Game'}
            </button>
          ) : (
            <button
              onClick={resetGame}
              className="px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all border border-gray-600"
            >
              Reset Game
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 mb-8">
          <h3 className="text-xl font-bold mb-3 text-center text-gray-300">How to Play</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl">👁️</span>
              </div>
              <div className="font-semibold mb-1">Watch</div>
              <p className="text-sm text-gray-400">Memorize the sequence of shapes</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl">👆</span>
              </div>
              <div className="font-semibold mb-1">Repeat</div>
              <p className="text-sm text-gray-400">Click shapes in the same order</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl">🏆</span>
              </div>
              <div className="font-semibold mb-1">Progress</div>
              <p className="text-sm text-gray-400">Longer sequences = more points</p>
            </div>
          </div>
        </div>

        {/* Game Over Screen */}
        {gameState === 'gameover' && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gradient-to-b from-gray-900 to-black rounded-2xl p-8 max-w-md w-full border border-red-500/30 shadow-2xl">
              <div className="text-center">
                <div className="text-6xl mb-4">🎮</div>
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                  Game Over!
                </h2>
                
                <div className="space-y-4 my-6">
                  <div>
                    <div className="text-gray-400">Final Score</div>
                    <div className="text-4xl font-bold text-yellow-400">{score}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-400">Level Reached</div>
                      <div className="text-2xl font-bold text-green-400">{level}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">High Score</div>
                      <div className="text-2xl font-bold text-orange-400">{Math.max(score, highScore)}</div>
                    </div>
                  </div>
                </div>
                
                <div className="text-gray-400 text-sm mt-4">
                  Auto-advancing in 2 seconds...
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Add custom animation */}
      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
});

ShapeSequenceGame.displayName = 'ShapeSequenceGame';

export default ShapeSequenceGame;