import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { GameHandle } from '../lib/gameTypes';

interface Position {
  x: number;
  y: number;
}

interface SnakeProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number) => void;
  onTimerPause?: (paused: boolean) => void;
}

const GRID_SIZE = 20;
const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 5;
const MAX_SPEED = 50;

const Snake = forwardRef<GameHandle, SnakeProps>(({ onScoreUpdate, onComplete, onTimerPause }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [direction, setDirection] = useState<Position>({ x: 0, y: 0 });
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [gameStarted, setGameStarted] = useState(false);
  const [speed, setSpeed] = useState(INITIAL_SPEED);

  const directionRef = useRef(direction);
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const gameOverRef = useRef(false);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);

  useEffect(() => {
    directionRef.current = direction;
    snakeRef.current = snake;
    foodRef.current = food;
    gameOverRef.current = gameOver;
    scoreRef.current = score;
    livesRef.current = lives;
  }, [direction, snake, food, gameOver, score, lives]);

  useEffect(() => {
    if (onTimerPause) {
      onTimerPause(true);
    }
  }, [onTimerPause]);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: scoreRef.current,
      maxScore: 100
    }),
    onGameEnd: () => {
      if (!gameOverRef.current && onComplete) {
        onComplete(scoreRef.current, 100);
      }
    }
  }));

  const createFood = (currentSnake: Position[]): Position => {
    let newFood: Position;
    do {
      newFood = {
        x: Math.floor(Math.random() * 20),
        y: Math.floor(Math.random() * 20)
      };
    } while (currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    return newFood;
  };

  const checkCollision = (head: Position, body: Position[]): boolean => {
    if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20) return true;

    for (let i = 1; i < body.length; i++) {
      if (head.x === body[i].x && head.y === body[i].y) return true;
    }
    return false;
  };

  const resetSnake = () => {
    const newSnake = [{ x: 10, y: 10 }];
    setSnake(newSnake);
    snakeRef.current = newSnake;
    setDirection({ x: 0, y: 0 });
    directionRef.current = { x: 0, y: 0 };
    setSpeed(INITIAL_SPEED);
  };

  const gameLoop = () => {
    if (gameOverRef.current || directionRef.current.x === 0 && directionRef.current.y === 0) return;

    const currentSnake = [...snakeRef.current];
    const head = {
      x: currentSnake[0].x + directionRef.current.x,
      y: currentSnake[0].y + directionRef.current.y
    };

    if (checkCollision(head, currentSnake)) {
      const newLives = livesRef.current - 1;
      setLives(newLives);
      livesRef.current = newLives;

      if (newLives <= 0) {
        setGameOver(true);
        gameOverRef.current = true;
        if (onComplete) {
          onComplete(scoreRef.current, 100);
        }
      } else {
        resetSnake();
      }
      return;
    }

    const newSnake = [head, ...currentSnake];

    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      const newScore = scoreRef.current + 10;
      setScore(newScore);
      scoreRef.current = newScore;

      if (onScoreUpdate) {
        onScoreUpdate(newScore, 100);
      }

      const newFood = createFood(newSnake);
      setFood(newFood);
      foodRef.current = newFood;
      setSnake(newSnake);
      snakeRef.current = newSnake;

      const newSpeed = Math.max(MAX_SPEED, INITIAL_SPEED - Math.floor(newScore / 50) * SPEED_INCREMENT);
      setSpeed(newSpeed);
    } else {
      newSnake.pop();
      setSnake(newSnake);
      snakeRef.current = newSnake;
    }
  };

  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const interval = setInterval(gameLoop, speed);
    return () => clearInterval(interval);
  }, [gameStarted, speed, gameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.fillRect(food.x * GRID_SIZE, food.y * GRID_SIZE, GRID_SIZE - 2, GRID_SIZE - 2);
    ctx.shadowBlur = 0;

    snake.forEach((segment, index) => {
      const gradient = ctx.createLinearGradient(
        segment.x * GRID_SIZE, segment.y * GRID_SIZE,
        (segment.x + 1) * GRID_SIZE, (segment.y + 1) * GRID_SIZE
      );

      if (index === 0) {
        gradient.addColorStop(0, '#22d3ee');
        gradient.addColorStop(1, '#06b6d4');
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 15;
      } else {
        gradient.addColorStop(0, '#10b981');
        gradient.addColorStop(1, '#059669');
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 5;
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE - 2, GRID_SIZE - 2);
      ctx.shadowBlur = 0;
    });
  }, [snake, food]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (gameOver) return;

    const { x, y } = directionRef.current;

    if (!gameStarted) {
      setGameStarted(true);
    }

    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        if (x !== 1) setDirection({ x: -1, y: 0 });
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        if (x !== -1) setDirection({ x: 1, y: 0 });
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        if (y !== 1) setDirection({ x: 0, y: -1 });
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        if (y !== -1) setDirection({ x: 0, y: 1 });
        break;
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, gameStarted]);

  const handleDirectionButton = (newDirection: Position) => {
    if (gameOver) return;

    const { x, y } = directionRef.current;

    if (!gameStarted) {
      setGameStarted(true);
    }

    if (newDirection.x === -1 && x !== 1) setDirection(newDirection);
    else if (newDirection.x === 1 && x !== -1) setDirection(newDirection);
    else if (newDirection.y === -1 && y !== 1) setDirection(newDirection);
    else if (newDirection.y === 1 && y !== -1) setDirection(newDirection);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800">
      <div className="px-3 sm:px-6 py-2 bg-gray-900/50">
        <p className="text-gray-300 text-xs sm:text-sm text-center">
          Eat the red food. Avoid walls and yourself!
        </p>
      </div>

      <div className="px-3 sm:px-6 py-2 flex justify-between items-center">
        <h2 className="text-lg sm:text-2xl font-bold text-white">Snake</h2>
        <div className="flex items-center gap-1 sm:gap-2">
          {[...Array(3)].map((_, i) => (
            <span key={i} className={`text-base sm:text-xl ${i < lives ? 'opacity-100' : 'opacity-20'}`}>
              {i < lives ? '❤️' : '🖤'}
            </span>
          ))}
        </div>
        <div className="text-right">
          <p className="text-lg sm:text-xl font-bold text-cyan-400">Score: {score}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-3 sm:space-y-4 px-3">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            className="border-4 border-cyan-500/30 rounded-lg shadow-2xl shadow-cyan-500/20 bg-black"
            style={{ maxWidth: '90vw', maxHeight: '45vh', width: '400px', height: '400px' }}
          />

          {!gameStarted && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
              <div className="text-center px-4">
                <p className="text-white text-base sm:text-xl font-bold mb-2">Press any arrow or button to start!</p>
                <p className="text-gray-400 text-xs sm:text-sm">Use WASD or Arrow Keys</p>
              </div>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 rounded-lg">
              <div className="text-center">
                <p className="text-red-500 text-2xl sm:text-4xl font-bold mb-2">Game Over!</p>
                <p className="text-white text-lg sm:text-2xl">Final Score: {score}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 w-40 sm:w-56">
          <div></div>
          <button
            onClick={() => handleDirectionButton({ x: 0, y: -1 })}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-2 sm:py-3 px-3 rounded-lg transition-colors text-lg sm:text-xl"
            disabled={gameOver}
          >
            ↑
          </button>
          <div></div>
          <button
            onClick={() => handleDirectionButton({ x: -1, y: 0 })}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-2 sm:py-3 px-3 rounded-lg transition-colors text-lg sm:text-xl"
            disabled={gameOver}
          >
            ←
          </button>
          <button
            onClick={() => handleDirectionButton({ x: 0, y: 1 })}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-2 sm:py-3 px-3 rounded-lg transition-colors text-lg sm:text-xl"
            disabled={gameOver}
          >
            ↓
          </button>
          <button
            onClick={() => handleDirectionButton({ x: 1, y: 0 })}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-2 sm:py-3 px-3 rounded-lg transition-colors text-lg sm:text-xl"
            disabled={gameOver}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
});

Snake.displayName = 'Snake';

export default Snake;
