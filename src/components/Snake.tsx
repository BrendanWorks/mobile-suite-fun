import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { GameHandle } from '../lib/gameTypes';

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
const INITIAL_SPEED = 200; // Slower starting speed (was 150)
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
  const [shimmer, setShimmer] = useState(0); // New shimmer effect for good events
  const [slowedUntil, setSlowedUntil] = useState(0);
  const [backgroundHue, setBackgroundHue] = useState(0);

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
    canSkipQuestion: false
  }));

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

    if (checkCollision(head, currentSnake, obstaclesRef.current)) {
      triggerScreenShake(); // Only shake on collision (bad event)
      const newLives = livesRef.current - 1;
      setLives(newLives);
      livesRef.current = newLives;

      if (newLives <= 0) {
        setGameOver(true);
        gameOverRef.current = true;
        setTimeout(() => {
          if (onComplete) {
            onComplete(scoreRef.current, 200);
          }
        }, 2000);
      } else {
        resetSnake();
      }
      return;
    }

    const newSnake = [head, ...currentSnake];
    let ateFood = false;
    let pointsGained = 0;

    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      ateFood = true;
      pointsGained = 10;
      createParticleBurst(head.x, head.y, '#ef4444');
      triggerShimmer(); // Shimmer instead of shake for eating food

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

    if (powerUpRef.current && head.x === powerUpRef.current.x && head.y === powerUpRef.current.y) {
      const currentPowerUp = powerUpRef.current;

      if (currentPowerUp.type === 'gold') {
        pointsGained = 50;
        createParticleBurst(head.x, head.y, '#fbbf24');
        triggerShimmer(); // Shimmer instead of shake for powerup

        const newScore = scoreRef.current + pointsGained;
        setScore(newScore);
        scoreRef.current = newScore;

        if (onScoreUpdate) {
          onScoreUpdate(newScore, 200);
        }
      } else if (currentPowerUp.type === 'ice') {
        setSlowedUntil(Date.now() + SLOW_DURATION);
        slowedUntilRef.current = Date.now() + SLOW_DURATION;
        createParticleBurst(head.x, head.y, '#60a5fa');
        triggerShimmer(); // Shimmer for ice powerup too

        const isSlowed = true;
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
          (segment.x + 1) * GRID_SIZE