import React, { useState, useRef, useEffect } from 'react';

// Game Configuration
const GAME_CONFIG = {
  // Canvas & World
  CANVAS_WIDTH: 1200,
  CANVAS_HEIGHT: 800,
  
  // Character Positions
  KAI_X: 600,
  KAI_Y: 400,
  KAI_SIZE: 60,
  
  // Ground Configuration
  GROUND_X: 600,
  GROUND_Y: 500,
  GROUND_WIDTH: 1200,
  GROUND_HEIGHT: 100,
  GROUND_SURFACE_Y: 450,
  
  // Obstacle Spawning
  OBSTACLE_SPAWN_X: 800, // Reduced from 1250 - too far caused physics issues
  
  // Obstacle Sizes
  GROUND_OBSTACLE_WIDTH: 30,
  GROUND_OBSTACLE_HEIGHT: 60,
  SPHERE_RADIUS: 20,
  FLYING_RADIUS: 20,
  
  // Physics Values
  GRAVITY: .5,
  FRICTION: 0.5,
  RESTITUTION: 0,
  OBSTACLE_VELOCITY: -1,
  ROLLING_VELOCITY: -5, // Increased for better rolling momentum
  FLYING_VELOCITY: -3,
  JUMP_FORCE: -0.12,
  DASH_FORCE: 0.12,
  CROUCH_FORCE: 0.05,
  
  // Flying Obstacle Heights
  FLYING_MIN_Y: 350,
  FLYING_MAX_Y: 450,
  
  // Touch Gesture Thresholds
  MIN_SWIPE_DISTANCE: 30,
  MAX_TAP_TIME: 300,
  MAX_TAP_DISTANCE: 10,
  
  // Cleanup Boundaries
  CLEANUP_LEFT: -100,
  CLEANUP_RIGHT: 1300,
  CLEANUP_BOTTOM: 900,
  CLEANUP_TOP: -100,

  // Colors
  COLORS: {
    KAI: '#FF6B6B',
    GROUND: '#8B4513',
    OBSTACLE_GROUND: '#E74C3C',
    OBSTACLE_FLYING: '#9B59B6',
    OBSTACLE_ROLLING: '#FFA500',
    BACKGROUND: '#87CEEB'
  },

  // Object Pool Sizes
  POOL_SIZES: {
    GROUND: 8,
    FLYING: 6,
    ROLLING: 6
  },

  // Autospawn Settings
  ROLLING_AUTOSPAWN_INTERVAL: 3000 // 3 seconds between rolling obstacles
};

// Object Pool Implementation
class ObjectPool {
  constructor() {
    this.groundPool = [];
    this.flyingPool = [];
    this.rollingPool = [];
    this.isInitialized = false;
  }

  initialize() {
    if (this.isInitialized || !window.Matter) return;
    
    const { Bodies } = window.Matter;
    
    // Pre-create ground obstacles
    for (let i = 0; i < GAME_CONFIG.POOL_SIZES.GROUND; i++) {
      const obstacle = Bodies.rectangle(
        -200, -200, // Off-screen position
        GAME_CONFIG.GROUND_OBSTACLE_WIDTH,
        GAME_CONFIG.GROUND_OBSTACLE_HEIGHT,
        {
          render: { fillStyle: GAME_CONFIG.COLORS.OBSTACLE_GROUND },
          label: 'obstacle',
          restitution: GAME_CONFIG.RESTITUTION,
          friction: GAME_CONFIG.FRICTION,
          density: 0.001,
          isStatic: true // Start as static to prevent physics until needed
        }
      );
      obstacle.width = GAME_CONFIG.GROUND_OBSTACLE_WIDTH;
      obstacle.height = GAME_CONFIG.GROUND_OBSTACLE_HEIGHT;
      obstacle.poolType = 'ground';
      this.groundPool.push(obstacle);
    }

    // Pre-create flying obstacles
    for (let i = 0; i < GAME_CONFIG.POOL_SIZES.FLYING; i++) {
      const obstacle = Bodies.circle(-200, -200, GAME_CONFIG.FLYING_RADIUS, {
        render: { fillStyle: GAME_CONFIG.COLORS.OBSTACLE_FLYING },
        label: 'obstacle',
        frictionAir: 0.01,
        restitution: 0.3,
        density: 0.001,
        isStatic: true
      });
      obstacle.circleRadius = GAME_CONFIG.FLYING_RADIUS;
      obstacle.poolType = 'flying';
      this.flyingPool.push(obstacle);
    }

    // Pre-create rolling obstacles
    for (let i = 0; i < GAME_CONFIG.POOL_SIZES.ROLLING; i++) {
      const obstacle = Bodies.circle(-200, -200, GAME_CONFIG.SPHERE_RADIUS, {
        render: { fillStyle: GAME_CONFIG.COLORS.OBSTACLE_ROLLING },
        label: 'obstacle',
        restitution: 0.3, // Moderate bounce
        friction: 0.8, // Keep original friction for ground contact
        frictionAir: 0.01, // Low air resistance
        density: 0.002,
        isStatic: true
      });
      obstacle.circleRadius = GAME_CONFIG.SPHERE_RADIUS;
      obstacle.poolType = 'rolling';
      this.rollingPool.push(obstacle);
    }

    this.isInitialized = true;
    console.log('Object pools initialized');
  }

  acquireGroundObstacle() {
    if (this.groundPool.length > 0) {
      return this.groundPool.pop();
    }
    console.log('Ground pool empty, creating new obstacle');
    return null;
  }

  acquireFlyingObstacle() {
    if (this.flyingPool.length > 0) {
      return this.flyingPool.pop();
    }
    console.log('Flying pool empty, creating new obstacle');
    return null;
  }

  acquireRollingObstacle() {
    if (this.rollingPool.length > 0) {
      return this.rollingPool.pop();
    }
    console.log('Rolling pool empty, creating new obstacle');
    return null;
  }

  releaseObstacle(obstacle) {
    if (!obstacle || !obstacle.poolType) return;

    // Reset obstacle to off-screen position and make static
    const { Body } = window.Matter;
    Body.setPosition(obstacle, { x: -200, y: -200 });
    Body.setVelocity(obstacle, { x: 0, y: 0 });
    Body.setAngularVelocity(obstacle, 0);
    Body.setStatic(obstacle, true);
    
    // Reset physics properties to original state
    Body.set(obstacle, {
      restitution: obstacle.poolType === 'rolling' ? 0.3 : GAME_CONFIG.RESTITUTION,
      friction: GAME_CONFIG.FRICTION,
      frictionAir: 0.01,
      density: obstacle.poolType === 'rolling' ? 0.002 : 0.001
    });

    // Return to appropriate pool
    switch (obstacle.poolType) {
      case 'ground':
        this.groundPool.push(obstacle);
        break;
      case 'flying':
        this.flyingPool.push(obstacle);
        break;
      case 'rolling':
        this.rollingPool.push(obstacle);
        break;
    }
  }

  getStats() {
    return {
      ground: this.groundPool.length,
      flying: this.flyingPool.length,
      rolling: this.rollingPool.length
    };
  }
}

const AdvancedRunner = () => {
  const [gameState, setGameState] = useState('menu');
  const [isLoading, setIsLoading] = useState(false);
  const [gameStatus, setGameStatus] = useState('playing');
  const [score, setScore] = useState(0);
  const [lastGesture, setLastGesture] = useState('');
  
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const kaiBodyRef = useRef(null);
  const obstaclesRef = useRef([]);
  const gameLoopRef = useRef(null);
  const autoSpawnRef = useRef(null);
  const gameStatusRef = useRef(gameStatus);
  const scoreRef = useRef(score);
  const objectPoolRef = useRef(new ObjectPool());
  
  // Touch control state
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const touchEndRef = useRef({ x: 0, y: 0, time: 0 });
  
  // Utility function to check if game requirements are met
  const validateGameState = () => {
    return gameStatusRef.current === 'playing' && 
           kaiBodyRef.current && 
           window.Matter && 
           engineRef.current;
  };

  // Collision detection utility
  const checkCircleCollision = (kai, obstacle, obstacleRadius) => {
    const distance = Math.sqrt(
      Math.pow(kai.position.x - obstacle.position.x, 2) + 
      Math.pow(kai.position.y - obstacle.position.y, 2)
    );
    const kaiRadius = GAME_CONFIG.KAI_SIZE / 2;
    return distance < (kaiRadius + obstacleRadius - 10);
  };

  const checkRectangleCollision = (kai, obstacle) => {
    const kaiHalf = GAME_CONFIG.KAI_SIZE / 2;
    const obstacleHalfW = obstacle.width / 2;
    const obstacleHalfH = obstacle.height / 2;
    
    return Math.abs(kai.position.x - obstacle.position.x) < (kaiHalf + obstacleHalfW - 5) &&
           Math.abs(kai.position.y - obstacle.position.y) < (kaiHalf + obstacleHalfH - 5);
  };
  
  // Cleanup function
  const cleanupGame = () => {
    console.log('Cleaning up game...');
    
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    
    if (autoSpawnRef.current) {
      clearInterval(autoSpawnRef.current);
      autoSpawnRef.current = null;
    }
    
    if (runnerRef.current && window.Matter) {
      const { Runner } = window.Matter;
      Runner.stop(runnerRef.current);
      runnerRef.current = null;
    }
    
    if (renderRef.current && window.Matter) {
      const { Render } = window.Matter;
      Render.stop(renderRef.current);
      renderRef.current = null;
    }
    
    if (engineRef.current && window.Matter) {
      const { Engine, Events } = window.Matter;
      Events.off(engineRef.current, 'collisionStart');
      Events.off(engineRef.current, 'beforeUpdate');
      Engine.clear(engineRef.current);
      engineRef.current = null;
    }
    
    // Return all active obstacles to pools before clearing
    if (objectPoolRef.current) {
      obstaclesRef.current.forEach(obstacle => {
        objectPoolRef.current.releaseObstacle(obstacle);
      });
    }
    
    kaiBodyRef.current = null;
    obstaclesRef.current = [];
    
    console.log('Game cleanup complete');
  };

  // Keep refs in sync with state
  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);
  
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // Cleanup on component unmount
  useEffect(() => {
    return cleanupGame;
  }, []);

  // Add touch controls when game is playing
  useEffect(() => {
    if (gameState === 'playing' && canvasRef.current) {
      const canvas = canvasRef.current;
      
      console.log('Adding touch controls to canvas');
      
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      
      return () => {
        console.log('Removing touch controls from canvas');
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchend', handleTouchEnd);
        canvas.removeEventListener('touchmove', handleTouchMove);
      };
    }
  }, [gameState]);

  // Initialize game when state changes to playing
  useEffect(() => {
    if (gameState === 'playing' && canvasRef.current && !engineRef.current && !isLoading) {
      console.log('Game state changed to playing, initializing...');
      initializeGame();
    }
  }, [gameState, isLoading]);

  const loadMatterJS = () => {
    return new Promise((resolve, reject) => {
      if (window.Matter) {
        resolve();
        return;
      }
      
      console.log('Loading Matter.js...');
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/matter-js@0.19.0/build/matter.min.js';
      script.onload = () => {
        console.log('Matter.js loaded successfully');
        resolve();
      };
      script.onerror = () => {
        console.error('Matter.js failed to load');
        reject(new Error('Failed to load Matter.js'));
      };
      document.head.appendChild(script);
    });
  };

  const initializeGame = async () => {
    if (!canvasRef.current) {
      console.log('Canvas not ready yet, waiting...');
      setTimeout(() => {
        if (canvasRef.current && gameState === 'playing') {
          initializeGame();
        }
      }, 100);
      return;
    }

    try {
      setIsLoading(true);
      
      await loadMatterJS();
      
      if (!window.Matter) {
        throw new Error('Matter.js not available after loading');
      }

      // Initialize object pools
      objectPoolRef.current.initialize();

      createPhysicsWorld();
      setupCollisionDetection();
      startPhysics();
      startObstacleCleanup();
      startAutoSpawn();

      console.log('Game initialized successfully');
    } catch (error) {
      console.error('Game initialization failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startAutoSpawn = () => {
    console.log('Starting auto spawn for rolling obstacles');
    
    autoSpawnRef.current = setInterval(() => {
      if (gameStatusRef.current === 'playing') {
        createRollingObstacle();
      }
    }, GAME_CONFIG.ROLLING_AUTOSPAWN_INTERVAL);
  };

  const createPhysicsWorld = () => {
    console.log('Creating physics world...');
    
    const { Engine, Render, World, Bodies, Runner } = window.Matter;
    
    // Clean up any existing physics objects
    cleanupGame();
    
    // Create engine with optimized settings
    const engine = Engine.create();
    engine.world.gravity.y = GAME_CONFIG.GRAVITY;
    
    // Enhanced collision detection
    engine.detector.canCollide = function(bodyA, bodyB) {
      return true;
    };
    
    engine.timing.timeScale = 1;
    engine.constraintIterations = 2;
    engine.positionIterations = 6;
    engine.velocityIterations = 4;
    
    engineRef.current = engine;
    
    // Create renderer
    const render = Render.create({
      canvas: canvasRef.current,
      engine: engine,
      options: {
        width: GAME_CONFIG.CANVAS_WIDTH,
        height: GAME_CONFIG.CANVAS_HEIGHT,
        wireframes: false,
        background: GAME_CONFIG.COLORS.BACKGROUND,
        showAngleIndicator: false,
        showVelocity: false
      }
    });
    renderRef.current = render;
    
    // Create runner
    const runner = Runner.create({
      delta: 16.666,
      isFixed: true
    });
    runnerRef.current = runner;
    
    // Create ground
    const ground = Bodies.rectangle(
      GAME_CONFIG.GROUND_X, 
      GAME_CONFIG.GROUND_Y, 
      GAME_CONFIG.GROUND_WIDTH, 
      GAME_CONFIG.GROUND_HEIGHT, 
      { 
        isStatic: true,
        render: { fillStyle: GAME_CONFIG.COLORS.GROUND },
        label: 'ground'
      }
    );
    
    // Create Kai
    const kai = Bodies.rectangle(
      GAME_CONFIG.KAI_X, 
      GAME_CONFIG.KAI_Y, 
      GAME_CONFIG.KAI_SIZE, 
      GAME_CONFIG.KAI_SIZE, 
      {
        render: { fillStyle: GAME_CONFIG.COLORS.KAI },
        frictionAir: 0.01,
        friction: GAME_CONFIG.FRICTION,
        label: 'kai'
      }
    );
    
    kaiBodyRef.current = kai;
    obstaclesRef.current = [];
    
    World.add(engine.world, [ground, kai]);
    
    console.log('Physics world created');
  };

  const setupCollisionDetection = () => {
    if (!engineRef.current) return;

    const { Events } = window.Matter;

    // Primary collision detection
    Events.on(engineRef.current, 'collisionStart', (event) => {
      if (gameStatusRef.current !== 'playing') {
        console.log('Collision detected but game not playing, ignoring');
        return;
      }

      const pairs = event.pairs;
      
      for (let pair of pairs) {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        
        if ((bodyA.label === 'kai' && bodyB.label === 'obstacle') ||
            (bodyA.label === 'obstacle' && bodyB.label === 'kai')) {
          
          console.log('Primary collision system detected hit!');
          handleGameOver();
          return;
        }
      }
    });

    // Backup collision detection
    Events.on(engineRef.current, 'beforeUpdate', () => {
      if (gameStatusRef.current !== 'playing' || !kaiBodyRef.current || obstaclesRef.current.length === 0) {
        return;
      }
      
      const kai = kaiBodyRef.current;
      
      obstaclesRef.current.forEach(obstacle => {
        if (!obstacle || obstacle.label !== 'obstacle') return;
        
        let collisionDetected = false;
        
        if (obstacle.circleRadius) {
          collisionDetected = checkCircleCollision(kai, obstacle, obstacle.circleRadius);
        } else if (obstacle.width && obstacle.height) {
          collisionDetected = checkRectangleCollision(kai, obstacle);
        }
        
        if (collisionDetected) {
          console.log('Backup collision system triggered game over');
          handleGameOver();
          return;
        }
      });
    });
  };

  const startPhysics = () => {
    if (!engineRef.current || !renderRef.current || !runnerRef.current) return;

    const { Runner, Render } = window.Matter;
    
    Runner.run(runnerRef.current, engineRef.current);
    Render.run(renderRef.current);
    
    console.log('Physics engine started');
  };

  const startObstacleCleanup = () => {
    gameLoopRef.current = setInterval(() => {
      if (!engineRef.current || !window.Matter || gameStatusRef.current !== 'playing') return;
      
      const { World } = window.Matter;
      
      const initialCount = obstaclesRef.current.length;
      obstaclesRef.current = obstaclesRef.current.filter(obstacle => {
        const pos = obstacle.position;
        
        const isOffScreen = pos.x < GAME_CONFIG.CLEANUP_LEFT || 
                           pos.x > GAME_CONFIG.CLEANUP_RIGHT || 
                           pos.y > GAME_CONFIG.CLEANUP_BOTTOM || 
                           pos.y < GAME_CONFIG.CLEANUP_TOP;
        
        if (isOffScreen) {
          console.log(`Removing obstacle at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
          World.remove(engineRef.current.world, obstacle);
          // Return to pool only if it came from pool (not fresh rolling obstacles)
          if (obstacle.poolType !== 'rolling') {
            objectPoolRef.current.releaseObstacle(obstacle);
          }
          return false;
        }
        return true;
      });
      
      if (obstaclesRef.current.length !== initialCount) {
        console.log(`Obstacle count: ${initialCount} → ${obstaclesRef.current.length}`);
        const poolStats = objectPoolRef.current.getStats();
        console.log(`Pool status - Ground: ${poolStats.ground}, Flying: ${poolStats.flying}, Rolling: ${poolStats.rolling}`);
      }
    }, 1000);
  };

  const createObstacle = () => {
    if (!validateGameState()) {
      console.log('Cannot create obstacle - requirements not met');
      return;
    }
    
    console.log('Creating ground obstacle...');
    
    const { World, Body } = window.Matter;
    
    // Get obstacle from pool
    const obstacle = objectPoolRef.current.acquireGroundObstacle();
    if (!obstacle) {
      console.log('No ground obstacles available in pool');
      return;
    }
    
    setScore(prev => {
      const newScore = prev + 1;
      scoreRef.current = newScore;
      return newScore;
    });
    
    const obstacleY = GAME_CONFIG.GROUND_SURFACE_Y - (GAME_CONFIG.GROUND_OBSTACLE_HEIGHT / 2);
    
    // Reset obstacle position and make it dynamic
    Body.setPosition(obstacle, { x: GAME_CONFIG.OBSTACLE_SPAWN_X, y: obstacleY });
    Body.setStatic(obstacle, false);
    
    // Add to world if not already there
    if (!engineRef.current.world.bodies.includes(obstacle)) {
      World.add(engineRef.current.world, obstacle);
    }
    
    obstaclesRef.current.push(obstacle);
    
    Body.setVelocity(obstacle, { x: GAME_CONFIG.OBSTACLE_VELOCITY, y: 0 });
    
    console.log('Ground obstacle created from pool');
  };

  const createFlyingObstacle = () => {
    if (!validateGameState()) {
      console.log('Cannot create flying obstacle - requirements not met');
      return;
    }
    
    console.log('Creating flying obstacle...');
    
    const { World, Body } = window.Matter;
    
    const obstacle = objectPoolRef.current.acquireFlyingObstacle();
    if (!obstacle) {
      console.log('No flying obstacles available in pool');
      return;
    }
    
    setScore(prev => {
      const newScore = prev + 1;
      scoreRef.current = newScore;
      return newScore;
    });
    
    const spawnSide = Math.random() > 0.5 ? 'top' : 'right';
    let startX, startY, velocityX, velocityY;
    
    if (spawnSide === 'top') {
      startX = Math.random() * 100 + 550;
      startY = GAME_CONFIG.FLYING_MIN_Y;
      velocityX = (Math.random() - 0.5) * 1;
      velocityY = 2;
    } else {
      startX = 680;
      startY = Math.random() * (GAME_CONFIG.FLYING_MAX_Y - GAME_CONFIG.FLYING_MIN_Y) + GAME_CONFIG.FLYING_MIN_Y;
      velocityX = GAME_CONFIG.FLYING_VELOCITY;
      velocityY = 1;
    }
    
    Body.setPosition(obstacle, { x: startX, y: startY });
    Body.setStatic(obstacle, false);
    
    if (!engineRef.current.world.bodies.includes(obstacle)) {
      World.add(engineRef.current.world, obstacle);
    }
    
    obstaclesRef.current.push(obstacle);
    
    Body.setVelocity(obstacle, { x: velocityX, y: velocityY });
    
    console.log(`Flying obstacle created from pool from ${spawnSide}`);
  };

  const createRollingObstacle = () => {
    if (!validateGameState()) {
      console.log('Cannot create rolling obstacle - requirements not met');
      return;
    }
    
    console.log('Creating fresh rolling sphere...');
    
    const { World, Body, Bodies } = window.Matter;
    
    setScore(prev => {
      const newScore = prev + 1;
      scoreRef.current = newScore;
      return newScore;
    });
    
    const sphereY = GAME_CONFIG.GROUND_SURFACE_Y - GAME_CONFIG.SPHERE_RADIUS;
    
    // Create fresh rolling obstacle (bypassing pool for now)
    const obstacle = Bodies.circle(
      GAME_CONFIG.OBSTACLE_SPAWN_X, 
      sphereY, 
      GAME_CONFIG.SPHERE_RADIUS, 
      {
        render: { fillStyle: GAME_CONFIG.COLORS.OBSTACLE_ROLLING },
        label: 'obstacle',
        restitution: 0.3,
        friction: 0.8,
        frictionAir: 0.01,
        density: 0.002
      }
    );
    
    obstacle.circleRadius = GAME_CONFIG.SPHERE_RADIUS;
    obstacle.poolType = 'rolling';
    
    World.add(engineRef.current.world, obstacle);
    obstaclesRef.current.push(obstacle);
    
    // Set rolling motion
    Body.setVelocity(obstacle, { x: GAME_CONFIG.ROLLING_VELOCITY, y: 0 });
    Body.setAngularVelocity(obstacle, -0.15);
    
    console.log(`Fresh rolling sphere created at (${obstacle.position.x}, ${obstacle.position.y})`);
  };

  const handleGameOver = () => {
    if (gameStatusRef.current !== 'playing') {
      console.log('Game over already triggered, ignoring');
      return;
    }
    
    const currentScore = scoreRef.current;
    console.log('Game Over! Final Score:', currentScore);
    
    setGameStatus('gameOver');
    gameStatusRef.current = 'gameOver';
    
    // Clean up obstacles - return pooled ones to pool, dispose fresh ones
    obstaclesRef.current.forEach(obstacle => {
      if (obstacle.poolType === 'rolling') {
        // Fresh rolling obstacles - just remove from world (will be garbage collected)
        if (engineRef.current && engineRef.current.world) {
          const { World } = window.Matter;
          World.remove(engineRef.current.world, obstacle);
        }
      } else {
        // Pooled obstacles - return to pool
        objectPoolRef.current.releaseObstacle(obstacle);
      }
    });
    obstaclesRef.current = [];
    
    // Stop auto spawn
    if (autoSpawnRef.current) {
      clearInterval(autoSpawnRef.current);
      autoSpawnRef.current = null;
    }
    
    if (runnerRef.current && window.Matter) {
      const { Runner } = window.Matter;
      Runner.stop(runnerRef.current);
    }
    
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    
    if (engineRef.current && window.Matter) {
      const { Events } = window.Matter;
      Events.off(engineRef.current, 'collisionStart');
      Events.off(engineRef.current, 'beforeUpdate');
    }
    
    console.log('Physics stopped, final score preserved:', currentScore);
  };

  const restartGame = () => {
    console.log('Restarting game...');
    
    cleanupGame();
    
    setTimeout(() => {
      setGameStatus('playing');
      setScore(0);
      scoreRef.current = 0;
      
      setTimeout(() => {
        if (canvasRef.current) {
          initializeGame();
        }
      }, 100);
    }, 50);
  };

  // Touch event handlers
  const handleTouchStart = (e) => {
    e.preventDefault();
    
    if (gameStatusRef.current !== 'playing') return;
    
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    
    if (gameStatusRef.current !== 'playing') return;
    
    const touch = e.changedTouches[0];
    touchEndRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    
    const deltaX = touchEndRef.current.x - touchStartRef.current.x;
    const deltaY = touchEndRef.current.y - touchStartRef.current.y;
    const deltaTime = touchEndRef.current.time - touchStartRef.current.time;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance < GAME_CONFIG.MAX_TAP_DISTANCE && deltaTime < GAME_CONFIG.MAX_TAP_TIME) {
      handleTap();
    } else if (distance > GAME_CONFIG.MIN_SWIPE_DISTANCE) {
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        if (deltaY < 0) {
          console.log('Swipe UP detected');
          setLastGesture('SUPER JUMP');
          setTimeout(() => setLastGesture(''), 1000);
          makeKaiJump();
        } else {
          console.log('Swipe DOWN detected');
          setLastGesture('CROUCH');
          setTimeout(() => setLastGesture(''), 1000);
          makeKaiCrouch();
        }
      } else {
        if (deltaX < 0) {
          console.log('Swipe LEFT detected');
          setLastGesture('DASH LEFT');
          setTimeout(() => setLastGesture(''), 1000);
          makeKaiDash('left');
        } else {
          console.log('Swipe RIGHT detected');
          setLastGesture('DASH RIGHT');
          setTimeout(() => setLastGesture(''), 1000);
          makeKaiDash('right');
        }
      }
    }
    
    touchStartRef.current = { x: 0, y: 0, time: 0 };
    touchEndRef.current = { x: 0, y: 0, time: 0 };
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
  };

  // Game actions
  const makeKaiJump = () => {
    if (!validateGameState()) return;
    
    const { Body } = window.Matter;
    Body.applyForce(kaiBodyRef.current, kaiBodyRef.current.position, { x: 0, y: GAME_CONFIG.JUMP_FORCE });
  };

  const makeKaiCrouch = () => {
    if (!validateGameState()) return;
    
    const { Body } = window.Matter;
    Body.applyForce(kaiBodyRef.current, kaiBodyRef.current.position, { x: 0, y: GAME_CONFIG.CROUCH_FORCE });
  };

  const makeKaiDash = (direction) => {
    if (!validateGameState()) return;
    
    const { Body } = window.Matter;
    const dashForce = direction === 'left' ? -GAME_CONFIG.DASH_FORCE : GAME_CONFIG.DASH_FORCE;
    Body.applyForce(kaiBodyRef.current, kaiBodyRef.current.position, { x: dashForce, y: 0 });
  };

  const handleTap = () => {
    if (gameStatusRef.current !== 'playing') return;
    
    console.log('Tap detected');
    setLastGesture('TAP');
    setTimeout(() => setLastGesture(''), 1000);
  };
  
  const startGame = () => {
    console.log('Starting game...');
    setGameState('playing');
    setGameStatus('playing');
    setScore(0);
    scoreRef.current = 0;
    setLastGesture('');
  };
  
  const backToMenu = () => {
    cleanupGame();
    setGameState('menu');
  };
  
  if (gameState === 'menu') {
    return (
      <div className="text-center max-w-4xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white min-h-screen flex flex-col justify-center">
        <h1 className="text-6xl font-bold mb-4">Kai's Journey</h1>
        <p className="text-xl mb-4 opacity-90">Help Kai run, jump, and dodge obstacles!</p>
        <p className="text-lg mb-4 opacity-75">Enhanced swipe controls with dramatic movements</p>
        <p className="text-md mb-8 opacity-60">Rolling obstacles auto-spawn every 3 seconds</p>
        <button 
          onClick={startGame}
          disabled={isLoading}
          className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xl transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Start Game'}
        </button>
        
        <div className="mt-8 pt-4 border-t border-white border-opacity-20">
          <p className="text-sm opacity-50">Advanced Runner v0.8.0</p>
          <p className="text-xs opacity-40">Object Pooling • Auto Spawn • Performance Optimized</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full h-screen bg-gray-900 relative overflow-auto flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="block touch-none select-none border border-gray-600"
        width={GAME_CONFIG.CANVAS_WIDTH}
        height={GAME_CONFIG.CANVAS_HEIGHT}
        style={{ 
          touchAction: 'none',
          minWidth: GAME_CONFIG.CANVAS_WIDTH + 'px',
          minHeight: GAME_CONFIG.CANVAS_HEIGHT + 'px'
        }}
      />
      
      <div className="absolute top-4 left-4 text-white bg-black bg-opacity-50 p-3 rounded-lg">
        <div className="font-bold">Kai's Journey v0.8.0</div>
        <div className="text-sm opacity-80">Score: {score}</div>
        <div className="text-xs opacity-60">
          {gameStatus === 'playing' ? 'Auto Spawn Active' : 'Game Over!'}
        </div>
        <div className="text-xs opacity-60">
          {gameStatus === 'playing' ? `Obstacles: ${obstaclesRef.current.length}` : `Final Score: ${score}`}
        </div>
        <div className="text-xs opacity-40">
          Engine: {!!engineRef.current ? 'Active' : 'Inactive'}
        </div>
        {gameStatus === 'playing' && (
          <div className="text-xs opacity-40">
            Pool: G{objectPoolRef.current.getStats().ground}/F{objectPoolRef.current.getStats().flying}/R{objectPoolRef.current.getStats().rolling}
          </div>
        )}
      </div>

      {gameState === 'playing' && (
        <div className="absolute bottom-4 left-4 text-white bg-black bg-opacity-50 p-3 rounded-lg">
          <div className="text-xs font-bold mb-2">Touch Controls:</div>
          <div className="text-xs opacity-80">Swipe Up: Super Jump</div>
          <div className="text-xs opacity-80">Swipe Down: Fast Crouch</div>
          <div className="text-xs opacity-80">Swipe Left/Right: Long Dash</div>
          <div className="text-xs opacity-80">Tap: Special Action</div>
          <div className="text-xs opacity-60 mt-2">Rolling obstacles spawn every 3s</div>
          {lastGesture && (
            <div className="text-sm font-bold text-green-400 mt-2 animate-pulse">
              {lastGesture}
            </div>
          )}
        </div>
      )}
      
      <div className="absolute top-4 right-4 space-y-2">
        <button 
          onClick={createObstacle}
          disabled={gameStatus !== 'playing'}
          className="block w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
        >
          Ground Block
        </button>
        
        <button 
          onClick={createFlyingObstacle}
          disabled={gameStatus !== 'playing'}
          className="block w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
        >
          Flying Thing
        </button>
        
        <button 
          onClick={createRollingObstacle}
          disabled={gameStatus !== 'playing'}
          className="block w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
        >
          Rolling Sphere
        </button>
        
        <div className="text-xs text-white opacity-60 text-center my-2">Backup Controls:</div>
        
        <button 
          onClick={makeKaiJump}
          disabled={gameStatus !== 'playing'}
          className="block w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
        >
          Super Jump
        </button>
        
        <button 
          onClick={() => makeKaiDash('left')}
          disabled={gameStatus !== 'playing'}
          className="block w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
        >
          Long Dash Left
        </button>
        
        <button 
          onClick={() => makeKaiDash('right')}
          disabled={gameStatus !== 'playing'}
          className="block w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
        >
          Long Dash Right
        </button>
        
        <button 
          onClick={makeKaiCrouch}
          disabled={gameStatus !== 'playing'}
          className="block w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
        >
          Fast Crouch
        </button>
        
        {gameStatus === 'gameOver' && (
          <button 
            onClick={restartGame}
            className="block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Restart
          </button>
        )}
        
        <button 
          onClick={backToMenu}
          className="block w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Menu
        </button>
      </div>

      {gameStatus === 'gameOver' && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-white text-black p-8 rounded-2xl text-center max-w-md">
            <h2 className="text-3xl font-bold mb-4">Game Over!</h2>
            <p className="text-xl mb-2">Kai hit an obstacle!</p>
            <p className="text-lg mb-6">Final Score: <span className="font-bold text-blue-600">{score}</span></p>
            <button 
              onClick={restartGame}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold mr-4"
            >
              Play Again
            </button>
            <button 
              onClick={backToMenu}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold"
            >
              Menu
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="text-white text-xl">Loading Matter.js...</div>
        </div>
      )}
    </div>
  );
};

export default AdvancedRunner;