import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { TrendingUp } from 'lucide-react';
import { GameHandle } from '../lib/gameTypes';
import { audioManager } from '../lib/audioManager';

interface Position {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'gold' | 'ice';
  spawnTime: number;
}

interface Obstacle {
  x: number;
  y: number;
}

interface SnakeProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number) => void;
}

const GRID_SIZE = 20;
const INITIAL_SPEED = 200;
const SPEED_INCREMENT = 5;
const MAX_SPEED = 50;
const POWERUP_CHANCE = 0.15;
const SLOW_DURATION = 10000;

const Snake = forwardRef<GameHandle, SnakeProps>(({ onScoreUpdate, onComplete }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [direction, setDirection] = useState<Position>({ x: 0, y: 0 });
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [gameStarted, setGameStarted] = useState(false);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [powerUp, setPowerUp] = useState<PowerUp | null>(null);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [screenShake, setScreenShake] = useState(0);
  const [shimmer, setShimmer] = useState(0);
  const [slowedUntil, setSlowedUntil] = useState(0);
  const [backgroundHue, setBackgroundHue] = useState(0);
  const [showInstructions, setShowInstructions] = useState(true);

  const directionRef = useRef(direction);
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const gameOverRef = useRef(false);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const particlesRef = useRef<Particle[]>([]);
  const powerUpRef = useRef<PowerUp | null>(null);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const slowedUntilRef = useRef(0);

  useEffect(() => {
    directionRef.current = direction;
    snakeRef.current = snake;
    foodRef.current = food;
    gameOverRef.current = gameOver;
    scoreRef.current = score;
    livesRef.current = lives;
    particlesRef.current = particles;
    powerUpRef.current = powerUp;
    obstaclesRef.current = obstacles;
    slowedUntilRef.current = slowedUntil;
  }, [direction, snake, food, gameOver, score, lives, particles, powerUp, obstacles, slowedUntil]);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: scoreRef.current,
      maxScore: 200
    }),
    onGameEnd: () => {
      if (!gameOverRef.current && onComplete) {
        onComplete(scoreRef.current, 200);
      }
    },
    canSkipQuestion: false,
    hideTimer: true
  }));

  // --- AUDIO: background load on mount, cleanup ticktock on unmount ---
  useEffect(() => {
    const loadAudio = async () => {
      await audioManager.loadSound('snake_eat', '/sounds/snake/short_success.mp3', 3);
      await audioManager.loadSound('snake_gobble', '/sounds/snake/gobble_optimized.mp3', 2);
      await audioManager.loadSound('snake_die', '/sounds/fail.mp3', 2);
      await audioManager.loadSound('snake_gameover', '/sounds/snake/level_complete.mp3', 1);
      await audioManager.loadSound('snake_ticktock', '/sounds/snake/ticktock.mp3', 1);
    };
    loadAudio();

    return () => {
      audioManager.stopMusic('snake_ticktock');
    };
  }, []);

  const createFood = (currentSnake: Position[], currentObstacles: Obstacle[], currentPowerUp: PowerUp | null): Position => {
    let newFood: Position;
    do {
      newFood = {
        x: Math.floor(Math.random() * 20),
        y: Math.floor(Math.random() * 20)
      };
    } while (
      currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y) ||
      currentObstacles.some(obs => obs.x === newFood.x && obs.y === newFood.y) ||
      (currentPowerUp && currentPowerUp.x === newFood.x && currentPowerUp.y === newFood.y)
    );
    return newFood;
  };

  const createPowerUp = (currentSnake: Position[], currentFood: Position, currentObstacles: Obstacle[]): PowerUp | null => {
    if (Math.random() > POWERUP_CHANCE) return null;

    let position: Position;
    do {
      position = {
        x: Math.floor(Math.random() * 20),
        y: Math.floor(Math.random() * 20)
      };
    } while (
      currentSnake.some(segment => segment.x === position.x && segment.y === position.y) ||
      (position.x === currentFood.x && position.y === currentFood.y) ||
      currentObstacles.some(obs => obs.x === position.x && obs.y === position.y)
    );

    return {
      x: position.x,
      y: position.y,
      type: Math.random() > 0.5 ? 'gold' : 'ice',
      spawnTime: Date.now()
    };
  };

  const createObstacle = (currentSnake: Position[], currentFood: Position, currentObstacles: Obstacle[], currentPowerUp: PowerUp | null): Obstacle => {
    let position: Position;
    do {
      position = {
        x: Math.floor(Math.random() * 20),
        y: Math.floor(Math.random() * 20)
      };
    } while (
      currentSnake.some(segment => segment.x === position.x && segment.y === position.y) ||
      (position.x === currentFood.x && position.y === currentFood.y) ||
      currentObstacles.some(obs => obs.x === position.x && obs.y === position.y) ||
      (currentPowerUp && position.x === currentPowerUp.x && position.y === currentPowerUp.y)
    );

    return position;
  };

  const createParticleBurst = (x: number, y: number, color: string) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10;
      const speed = 2 + Math.random() * 2;
      newParticles.push({
        x: x * GRID_SIZE + GRID_SIZE / 2,
        y: y * GRID_SIZE + GRID_SIZE / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  const triggerScreenShake = () => {
    setScreenShake(10);
  };

  const triggerShimmer = () => {
    setShimmer(1);
  };

  const checkCollision = (head: Position, body: Position[], currentObstacles: Obstacle[]): boolean => {
    if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20) return true;

    for (let i = 1; i < body.length; i++) {
      if (head.x === body[i].x && head.y === body[i].y) return true;
    }

    if (currentObstacles.some(obs => obs.x === head.x && obs.y === head.y)) return true;

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

    // --- AUDIO: collision → stop ticktock, then play die or gameover ---
    if (checkCollision(head, currentSnake, obstaclesRef.current)) {
      audioManager.stopMusic('snake_ticktock');
      triggerScreenShake();
      const newLives = livesRef.current - 1;
      setLives(newLives);
      livesRef.current = newLives;

      if (newLives <= 0) {
        audioManager.play('snake_gameover', 0.7);
        setGameOver(true);
        gameOverRef.current = true;
        setTimeout(() => {
          if (onComplete) {
            onComplete(scoreRef.current, 200);
          }
        }, 2000);
      } else {
        audioManager.play('snake_die', 0.5);
        resetSnake();
      }
      return;
    }

    const newSnake = [head, ...currentSnake];
    let ateFood = false;
    let pointsGained = 0;

    // --- AUDIO: ate food → short success ---
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      ateFood = true;
      pointsGained = 10;
      audioManager.play('snake_eat', 0.5);
      createParticleBurst(head.x, head.y, '#ef4444');
      triggerShimmer();

      const newScore = scoreRef.current + pointsGained;
      setScore(newScore);
      scoreRef.current = newScore;

      if (onScoreUpdate) {
        onScoreUpdate(newScore, 200);
      }

      const newFood = createFood(newSnake, obstaclesRef.current, powerUpRef.current);
      setFood(newFood);
      foodRef.current = newFood;

      const maybePowerUp = createPowerUp(newSnake, newFood, obstaclesRef.current);
      if (maybePowerUp) {
        setPowerUp(maybePowerUp);
        powerUpRef.current = maybePowerUp;
      }

      if (newScore % 100 === 0 && newScore > 0) {
        const newObstacle = createObstacle(newSnake, newFood, obstaclesRef.current, maybePowerUp);
        setObstacles(prev => [...prev, newObstacle]);
        obstaclesRef.current = [...obstaclesRef.current, newObstacle];

        setBackgroundHue(prev => (prev + 30) % 360);
      }

      const isSlowed = Date.now() < slowedUntilRef.current;
      const newSpeed = isSlowed
        ? Math.max(MAX_SPEED, INITIAL_SPEED - Math.floor(newScore / 50) * SPEED_INCREMENT) * 1.5
        : Math.max(MAX_SPEED, INITIAL_SPEED - Math.floor(newScore / 50) * SPEED_INCREMENT);
      setSpeed(newSpeed);
    }

    // --- AUDIO: power-up → gobble for both gold and ice ---
    if (powerUpRef.current && head.x === powerUpRef.current.x && head.y === powerUpRef.current.y) {
      const currentPowerUp = powerUpRef.current;

      if (currentPowerUp.type === 'gold') {
        audioManager.play('snake_gobble', 0.5);
        pointsGained = 50;
        createParticleBurst(head.x, head.y, '#fbbf24');
        triggerShimmer();

        const newScore = scoreRef.current + pointsGained;
        setScore(newScore);
        scoreRef.current = newScore;

        if (onScoreUpdate) {
          onScoreUpdate(newScore, 200);
        }
      } else if (currentPowerUp.type === 'ice') {
        audioManager.play('snake_gobble', 0.5);
        setSlowedUntil(Date.now() + SLOW_DURATION);
        slowedUntilRef.current = Date.now() + SLOW_DURATION;
        createParticleBurst(head.x, head.y, '#60a5fa');
        triggerShimmer();

        const newSpeed = Math.max(MAX_SPEED, INITIAL_SPEED - Math.floor(scoreRef.current / 50) * SPEED_INCREMENT) * 1.5;
        setSpeed(newSpeed);
      }

      setPowerUp(null);
      powerUpRef.current = null;
    }

    if (ateFood || pointsGained > 0) {
      setSnake(newSnake);
      snakeRef.current = newSnake;
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
    const particleInterval = setInterval(() => {
      setParticles(prev => {
        return prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            life: p.life - 0.02
          }))
          .filter(p => p.life > 0);
      });
    }, 16);

    return () => clearInterval(particleInterval);
  }, []);

  useEffect(() => {
    if (screenShake > 0) {
      const timer = setTimeout(() => {
        setScreenShake(prev => Math.max(0, prev - 1));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [screenShake]);

  useEffect(() => {
    if (shimmer > 0) {
      const timer = setTimeout(() => {
        setShimmer(prev => Math.max(0, prev - 0.05));
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [shimmer]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInstructions(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const bgColor = `hsl(${backgroundHue}, 20%, 4%)`;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const time = Date.now() / 1000;
      const pulse = Math.sin(time * 3) * 0.3 + 0.7;
      const foodSize = (GRID_SIZE - 2) * pulse;
      const foodOffset = ((GRID_SIZE - 2) - foodSize) / 2;

      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 15 * pulse;
      ctx.fillRect(
        food.x * GRID_SIZE + foodOffset,
        food.y * GRID_SIZE + foodOffset,
        foodSize,
        foodSize
      );
      ctx.shadowBlur = 0;

      obstaclesRef.current.forEach(obs => {
        ctx.fillStyle = '#78716c';
        ctx.shadowColor = '#78716c';
        ctx.shadowBlur = 8;
        ctx.fillRect(obs.x * GRID_SIZE, obs.y * GRID_SIZE, GRID_SIZE - 2, GRID_SIZE - 2);
        ctx.shadowBlur = 0;
      });

      if (powerUpRef.current) {
        const powerUpAge = Date.now() - powerUpRef.current.spawnTime;
        const flash = Math.sin(powerUpAge / 200) * 0.5 + 0.5;

        if (powerUpRef.current.type === 'gold') {
          ctx.fillStyle = `rgba(251, 191, 36, ${0.5 + flash * 0.5})`;
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 20;
        } else {
          ctx.fillStyle = `rgba(96, 165, 250, ${0.5 + flash * 0.5})`;
          ctx.shadowColor = '#60a5fa';
          ctx.shadowBlur = 20;
        }
        ctx.fillRect(powerUpRef.current.x * GRID_SIZE, powerUpRef.current.y * GRID_SIZE, GRID_SIZE - 2, GRID_SIZE - 2);
        ctx.shadowBlur = 0;
      }

      snake.forEach((segment, index) => {
        const gradient = ctx.createLinearGradient(
          segment.x * GRID_SIZE, segment.y * GRID_SIZE,
          (segment.x + 1) * GRID_SIZE, (segment.y + 1) * GRID_SIZE
        );

        if (index === 0) {
          gradient.addColorStop(0, '#22d3ee');
          gradient.addColorStop(1, '#06b6d4');
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 20;

          const headSize = GRID_SIZE - 1;
          const headOffset = -0.5;
          ctx.fillStyle = gradient;
          ctx.fillRect(
            segment.x * GRID_SIZE + headOffset,
            segment.y * GRID_SIZE + headOffset,
            headSize,
            headSize
          );
        } else {
          gradient.addColorStop(0, '#10b981');
          gradient.addColorStop(1, '#059669');
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 10;

          ctx.fillStyle = gradient;
          ctx.fillRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE - 2, GRID_SIZE - 2);
        }
        ctx.shadowBlur = 0;
      });

      particlesRef.current.forEach(particle => {
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.life;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 10;
        ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      });

      if (shimmer > 0) {
        const shimmerIntensity = Math.sin(shimmer * Math.PI * 3) * shimmer;
        const gradient1 = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient1.addColorStop(0, `rgba(34, 197, 94, ${shimmerIntensity * 0.5})`);
        gradient1.addColorStop(0.5, `rgba(34, 197, 94, 0)`);
        gradient1.addColorStop(1, `rgba(34, 197, 94, ${shimmerIntensity * 0.5})`);
        
        ctx.fillStyle = gradient1;
        ctx.fillRect(0, 0, canvas.width, 10);
        ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

        const gradient2 = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient2.addColorStop(0, `rgba(34, 197, 94, ${shimmerIntensity * 0.5})`);
        gradient2.addColorStop(0.5, `rgba(34, 197, 94, 0)`);
        gradient2.addColorStop(1, `rgba(34, 197, 94, ${shimmerIntensity * 0.5})`);
        
        ctx.fillStyle = gradient2;
        ctx.fillRect(0, 0, 10, canvas.height);
        ctx.fillRect(canvas.width - 10, 0, 10, canvas.height);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [snake, food, backgroundHue, shimmer]);

  // --- AUDIO: start ticktock when snake goes from stationary to moving ---
  const handleKeyDown = (e: KeyboardEvent) => {
    if (gameOver) return;

    const { x, y } = directionRef.current;
    const wasStationary = x === 0 && y === 0;
    let moved = false;

    if (!gameStarted) {
      setGameStarted(true);
      setShowInstructions(false);
    }

    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        if (x !== 1) { setDirection({ x: -1, y: 0 }); moved = true; }
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        if (x !== -1) { setDirection({ x: 1, y: 0 }); moved = true; }
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        if (y !== 1) { setDirection({ x: 0, y: -1 }); moved = true; }
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        if (y !== -1) { setDirection({ x: 0, y: 1 }); moved = true; }
        break;
    }

    if (wasStationary && moved) {
      audioManager.playMusic('snake_ticktock');
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, gameStarted]);

  // --- AUDIO: same ticktock logic for touch buttons ---
  const handleDirectionButton = (newDirection: Position) => {
    if (gameOver) return;

    const { x, y } = directionRef.current;
    const wasStationary = x === 0 && y === 0;
    let moved = false;

    if (!gameStarted) {
      setGameStarted(true);
      setShowInstructions(false);
    }

    if (newDirection.x === -1 && x !== 1) { setDirection(newDirection); moved = true; }
    else if (newDirection.x === 1 && x !== -1) { setDirection(newDirection); moved = true; }
    else if (newDirection.y === -1 && y !== 1) { setDirection(newDirection); moved = true; }
    else if (newDirection.y === 1 && y !== -1) { setDirection(newDirection); moved = true; }

    if (wasStationary && moved) {
      audioManager.playMusic('snake_ticktock');
    }
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header - Branded */}
      <div className="px-3 sm:px-6 py-2 sm:py-3">
        <div className="mb-2">
          <h2 className="text-xl sm:text-2xl font-bold text-green-400 mb-1 border-b border-green-400 pb-1 flex items-center justify-center gap-2">
            <TrendingUp 
              className="w-6 h-6 sm:w-7 sm:h-7" 
              style={{ 
                color: '#22c55e',
                filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.6))',
                strokeWidth: 2
              }} 
            />
            <span style={{ textShadow: '0 0 10px #22c55e' }}>Snake</span>
          </h2>
          
          {/* Tagline */}
          <p className="text-green-300 text-xs sm:text-sm text-center mb-2">
            Thrive and Survive
          </p>
        </div>

        {/* Score and Lives */}
        <div className="flex justify-between items-center text-xs sm:text-sm">
          <div className="text-green-300">
            Score: <strong className="text-yellow-400 tabular-nums">{score}</strong>
          </div>
          <div className="flex items-center gap-1">
            {[...Array(3)].map((_, i) => (
              <span key={i} className={`text-sm sm:text-base ${i < lives ? 'opacity-100' : 'opacity-20'}`}>
                {i < lives ? '❤️' : '🖤'}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-3 py-2">
        {/* Fixed-size canvas container */}
        <div className="relative mb-3" style={{
          transform: `translate(${(Math.random() - 0.5) * screenShake}px, ${(Math.random() - 0.5) * screenShake}px)`,
          width: '340px',
          height: '340px'
        }}>
          {/* Power-up indicators - overlaid at top */}
          <div className="absolute -top-10 left-0 right-0 flex gap-2 flex-wrap justify-center z-20">
            {Date.now() < slowedUntil && (
              <div className="bg-blue-500/20 border-2 border-blue-500 rounded-lg px-3 py-1 text-blue-300 text-xs font-semibold" style={{ boxShadow: '0 0 10px rgba(59, 130, 246, 0.4)' }}>
                ❄️ Slowed! {Math.ceil((slowedUntil - Date.now()) / 1000)}s
              </div>
            )}
            {obstacles.length > 0 && (
              <div className="bg-gray-500/20 border-2 border-gray-500 rounded-lg px-3 py-1 text-gray-300 text-xs font-semibold" style={{ boxShadow: '0 0 10px rgba(107, 114, 128, 0.4)' }}>
                ⚠️ Obstacles: {obstacles.length}
              </div>
            )}
          </div>

          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            className="border-4 border-green-500 rounded-lg bg-black"
            style={{ width: '340px', height: '340px', boxShadow: '0 0 25px rgba(34, 197, 94, 0.4)' }}
          />

          {/* Instructions overlay */}
          {showInstructions && (
            <div 
              className="absolute inset-0 bg-black/80 rounded-lg flex items-center justify-center transition-opacity duration-500 z-20"
            >
              <div className="text-center px-4">
                <p className="text-green-300 text-sm sm:text-base mb-2">
                  Eat the red food. Avoid walls and yourself!
                </p>
                <p className="text-green-400 text-xs sm:text-sm mb-3">
                  🟡 Gold: +50pts | ❄️ Blue Ice: Slow down | ⚫ Gray: Death
                </p>
                <p className="text-green-400 text-xs sm:text-sm font-bold" style={{ textShadow: '0 0 10px #22c55e' }}>
                  Press any arrow to start!
                </p>
              </div>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/95 rounded-lg">
              <div className="text-center">
                <p className="text-red-500 text-2xl sm:text-4xl font-bold mb-2" style={{ textShadow: '0 0 15px #ff0066' }}>💀 Game Over!</p>
                <p className="text-yellow-400 text-lg sm:text-2xl" style={{ textShadow: '0 0 10px #fbbf24' }}>Final Score: {score}</p>
              </div>
            </div>
          )}
        </div>

        {/* Fixed control buttons */}
        <div className="grid grid-cols-3 gap-2 w-40 sm:w-48 mt-3">
          <div></div>
          <button
            onClick={() => handleDirectionButton({ x: 0, y: -1 })}
            className="bg-transparent border-2 border-green-400 hover:bg-green-400 hover:text-black active:bg-green-500 text-green-400 font-bold py-2 px-3 rounded-lg transition-all text-xl disabled:opacity-30"
            style={{ boxShadow: '0 0 10px rgba(34, 197, 94, 0.3)' }}
            disabled={gameOver}
          >
            ↑
          </button>
          <div></div>
          <button
            onClick={() => handleDirectionButton({ x: -1, y: 0 })}
            className="bg-transparent border-2 border-green-400 hover:bg-green-400 hover:text-black active:bg-green-500 text-green-400 font-bold py-2 px-3 rounded-lg transition-all text-xl disabled:opacity-30"
            style={{ boxShadow: '0 0 10px rgba(34, 197, 94, 0.3)' }}
            disabled={gameOver}
          >
            ←
          </button>
          <button
            onClick={() => handleDirectionButton({ x: 0, y: 1 })}
            className="bg-transparent border-2 border-green-400 hover:bg-green-400 hover:text-black active:bg-green-500 text-green-400 font-bold py-2 px-3 rounded-lg transition-all text-xl disabled:opacity-30"
            style={{ boxShadow: '0 0 10px rgba(34, 197, 94, 0.3)' }}
            disabled={gameOver}
          >
            ↓
          </button>
          <button
            onClick={() => handleDirectionButton({ x: 1, y: 0 })}
            className="bg-transparent border-2 border-green-400 hover:bg-green-400 hover:text-black active:bg-green-500 text-green-400 font-bold py-2 px-3 rounded-lg transition-all text-xl disabled:opacity-30"
            style={{ boxShadow: '0 0 10px rgba(34, 197, 94, 0.3)' }}
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