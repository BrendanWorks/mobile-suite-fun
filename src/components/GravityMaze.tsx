import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';

// --- Constants ---
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const BALL_RADIUS = 10;
const CELL_SIZE = 40;
const GRAVITY_STRENGTH = 0.15;
const MAZE_WIDTH = Math.floor(CANVAS_WIDTH / CELL_SIZE);
const MAZE_HEIGHT = Math.floor(CANVAS_HEIGHT / CELL_SIZE);

const TILE_COLORS = {
  empty: '#0f172a',
  wall: '#334155',
  start: '#10b981',
  goal: '#f59e0b',
  hazard: '#ef4444',
  teleport: '#06b6d4',
  key: '#8b5cf6',
  checkpoint: '#ec4899',
};

interface MazeTile { 
  x: number; 
  y: number; 
  type: keyof typeof TILE_COLORS;
  id?: number;
  active?: boolean;
}

interface Particle { 
  x: number; 
  y: number; 
  vx: number; 
  vy: number; 
  life: number; 
  color: string;
  size: number;
}

interface Key { 
  x: number; 
  y: number; 
  id: number;
  collected: boolean;
}

const GravityMaze = forwardRef((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameOver' | 'complete'>('idle');
  const [stats, setStats] = useState({ 
    score: 0, 
    level: 1, 
    time: 60, 
    keys: 0, 
    moves: 0,
    bestTime: Infinity,
  });

  // Physics & Logic Refs
  const ballRef = useRef({ 
    x: 0, 
    y: 0, 
    vx: 0, 
    vy: 0, 
    trail: [] as Array<{x: number, y: number, life: number}>,
    isTeleporting: false,
    hasShield: false,
    lastTeleport: 0,
  });
  
  const mazeRef = useRef<MazeTile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<Key[]>([]);
  const tiltRef = useRef({ x: 0, y: 0 });
  const shakeRef = useRef(0);
  const keysNeededRef = useRef(0);
  const startTimeRef = useRef(0);
  const teleportPairsRef = useRef(new Map<number, {x: number, y: number}>());
  const bgStarsRef = useRef<Array<{x: number, y: number, size: number, speed: number}>>([]);
  const completedRef = useRef(false); // Track if level is already completed

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ 
      score: stats.score, 
      level: stats.level,
      maxScore: 1000 + stats.level * 500 
    }),
    onGameEnd: () => setGameState('gameOver'),
  }));

  // --- MAZE GENERATION ---
  const generateSolvableMaze = useCallback((level: number) => {
    const grid: MazeTile[] = [];

    // Initialize all as walls
    for (let y = 0; y < MAZE_HEIGHT; y++) {
      for (let x = 0; x < MAZE_WIDTH; x++) {
        grid.push({ x, y, type: 'wall' });
      }
    }

    // Recursive backtracker algorithm
    const stack: [number, number][] = [[1, 1]];
    const visited = new Set(['1,1']);
    grid[1 * MAZE_WIDTH + 1].type = 'empty';

    while (stack.length > 0) {
      const [cx, cy] = stack[stack.length - 1];
      const neighbors = [[0,2],[0,-2],[2,0],[-2,0]]
        .map(([dx,dy]) => [cx+dx, cy+dy])
        .filter(([nx, ny]) =>
          nx > 0 && nx < MAZE_WIDTH-1 &&
          ny > 0 && ny < MAZE_HEIGHT-1 &&
          !visited.has(`${nx},${ny}`)
        );

      if (neighbors.length > 0) {
        const [nx, ny] = neighbors[Math.floor(Math.random() * neighbors.length)];
        grid[ny * MAZE_WIDTH + nx].type = 'empty';
        grid[(cy + (ny - cy) / 2) * MAZE_WIDTH + (cx + (nx - cx) / 2)].type = 'empty';
        visited.add(`${nx},${ny}`);
        stack.push([nx, ny]);
      } else {
        stack.pop();
      }
    }

    // Level-based features
    keysNeededRef.current = level >= 2 ? Math.min(3, Math.floor(level/2)) : 0;

    // Start position
    grid[1 * MAZE_WIDTH + 1].type = 'start';

    // Goal position (bottom right area)
    const goalX = MAZE_WIDTH - 2;
    const goalY = MAZE_HEIGHT - 2;
    grid[goalY * MAZE_WIDTH + goalX].type = 'goal';

    // Helper: Check if path exists from start to goal
    const pathExists = () => {
      const visited = new Set<string>();
      const queue: [number, number][] = [[1, 1]];
      visited.add('1,1');

      while (queue.length > 0) {
        const [x, y] = queue.shift()!;

        if (x === goalX && y === goalY) return true;

        [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          const key = `${nx},${ny}`;

          if (nx >= 0 && nx < MAZE_WIDTH && ny >= 0 && ny < MAZE_HEIGHT && !visited.has(key)) {
            const tile = grid[ny * MAZE_WIDTH + nx];
            if (tile.type !== 'wall' && tile.type !== 'hazard') {
              visited.add(key);
              queue.push([nx, ny]);
            }
          }
        });
      }
      return false;
    };

    // Add hazards based on level - only if they don't block the path
    const hazardCount = Math.min(6, Math.floor(level * 1.2));
    let hazardsPlaced = 0;
    let attempts = 0;

    while (hazardsPlaced < hazardCount && attempts < 50) {
      attempts++;
      const emptyTiles = grid.filter(t => t.type === 'empty');
      if (emptyTiles.length === 0) break;

      const tile = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
      const originalType = tile.type;
      tile.type = 'hazard';

      // Check if path still exists
      if (pathExists()) {
        hazardsPlaced++;
      } else {
        // Revert if it blocks the path
        tile.type = originalType;
      }
    }

    // Add teleporters from level 3
    if (level >= 3) {
      teleportPairsRef.current.clear();
      const emptyTiles = grid.filter(t => t.type === 'empty');
      if (emptyTiles.length >= 2) {
        const [tile1, tile2] = [
          emptyTiles[Math.floor(Math.random() * emptyTiles.length)],
          emptyTiles[Math.floor(Math.random() * emptyTiles.length)]
        ];
        if (tile1 && tile2 && tile1 !== tile2) {
          const teleportId = Date.now();
          tile1.type = 'teleport';
          tile2.type = 'teleport';
          tile1.id = teleportId;
          tile2.id = teleportId;
          teleportPairsRef.current.set(teleportId, {x: tile2.x, y: tile2.y});
        }
      }
    }

    // Add checkpoints from level 4
    if (level >= 4) {
      const checkpointCount = Math.min(2, Math.floor(level / 4));
      for (let i = 0; i < checkpointCount; i++) {
        const emptyTiles = grid.filter(t => t.type === 'empty');
        if (emptyTiles.length > 0) {
          const tile = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
          tile.type = 'checkpoint';
          tile.id = i;
          tile.active = false;
        }
      }
    }

    return grid;
  }, []);

  // --- CORE LOGIC ---
  const startSensor = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
          initLevel(1);
        }
      } catch (err) {
        alert("Motion sensors required for iPhone play.");
      }
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
      initLevel(1);
    }
  };

  const handleOrientation = (e: DeviceOrientationEvent) => {
    const gamma = e.gamma || 0;
    const beta = e.beta || 0;
    
    tiltRef.current.x += (gamma / 30 - tiltRef.current.x) * 0.3;
    tiltRef.current.y += (beta / 30 - tiltRef.current.y) * 0.3;
  };

  const createBurst = (x: number, y: number, color: string, count: number = 12, size: number = 3) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x, 
        y, 
        vx: (Math.random() - 0.5) * 8, 
        vy: (Math.random() - 0.5) * 8 - 2, 
        life: 1, 
        color,
        size: size + Math.random() * 2
      });
    }
  };

  const initLevel = (lvl: number) => {
    // Reset completion flag
    completedRef.current = false;

    // Generate background stars
    bgStarsRef.current = Array.from({ length: 50 }).map(() => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 0.3 + 0.1
    }));

    mazeRef.current = generateSolvableMaze(lvl);

    // Generate keys
    keysRef.current = [];
    if (keysNeededRef.current > 0) {
      const emptyTiles = mazeRef.current.filter(t => t.type === 'empty');
      for (let i = 0; i < keysNeededRef.current; i++) {
        if (emptyTiles.length > 0) {
          const tile = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
          keysRef.current.push({
            x: tile.x * CELL_SIZE + CELL_SIZE / 2,
            y: tile.y * CELL_SIZE + CELL_SIZE / 2,
            id: Date.now() + i,
            collected: false
          });
        }
      }
    }

    // Reset ball to start
    const startTile = mazeRef.current.find(t => t.type === 'start');
    ballRef.current = {
      x: startTile ? startTile.x * CELL_SIZE + CELL_SIZE / 2 : CELL_SIZE * 1.5,
      y: startTile ? startTile.y * CELL_SIZE + CELL_SIZE / 2 : CELL_SIZE * 1.5,
      vx: 0,
      vy: 0,
      trail: [],
      isTeleporting: false,
      hasShield: false,
      lastTeleport: 0,
    };

    // Initialize trail
    ballRef.current.trail = Array.from({ length: 15 }).map(() => ({
      x: ballRef.current.x,
      y: ballRef.current.y,
      life: 1
    }));

    particlesRef.current = [];
    startTimeRef.current = Date.now();

    setStats(s => ({
      ...s,
      level: lvl,
      time: 60 + lvl * 5,
      keys: 0,
      moves: 0
    }));
    setGameState('playing');
  };

  const checkTileCollision = (x: number, y: number): MazeTile | null => {
    const tileX = Math.floor(x / CELL_SIZE);
    const tileY = Math.floor(y / CELL_SIZE);
    
    if (tileX < 0 || tileX >= MAZE_WIDTH || tileY < 0 || tileY >= MAZE_HEIGHT) {
      return null;
    }
    
    return mazeRef.current[tileY * MAZE_WIDTH + tileX] || null;
  };

  // --- GAME LOOP ---
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let lastTime = 0;
    let timeInterval: NodeJS.Timeout;

    // Timer
    timeInterval = setInterval(() => {
      setStats(s => {
        if (s.time <= 1) {
          setGameState('gameOver');
          clearInterval(timeInterval);
          return s;
        }
        return { ...s, time: s.time - 1 };
      });
    }, 1000);

    const loop = (timestamp: number) => {
      const delta = timestamp - lastTime || 0;
      lastTime = timestamp;

      const b = ballRef.current;
      
      // Update trail
      b.trail.unshift({x: b.x, y: b.y, life: 1});
      if (b.trail.length > 15) b.trail.pop();
      b.trail.forEach((p, i) => p.life = i / b.trail.length);

      // Physics with tilt
      b.vx += tiltRef.current.x * GRAVITY_STRENGTH;
      b.vy += tiltRef.current.y * GRAVITY_STRENGTH;
      
      // Apply friction
      b.vx *= 0.93;
      b.vy *= 0.93;
      
      // Clamp velocity
      const maxSpeed = 6;
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (speed > maxSpeed) {
        b.vx = (b.vx / speed) * maxSpeed;
        b.vy = (b.vy / speed) * maxSpeed;
      }

      // Predict next position with multiple collision points
      const nextX = b.x + b.vx;
      const nextY = b.y + b.vy;
      
      const collisionPoints = [
        {x: nextX - BALL_RADIUS, y: nextY - BALL_RADIUS},
        {x: nextX + BALL_RADIUS, y: nextY - BALL_RADIUS},
        {x: nextX - BALL_RADIUS, y: nextY + BALL_RADIUS},
        {x: nextX + BALL_RADIUS, y: nextY + BALL_RADIUS},
        {x: nextX, y: nextY}
      ];

      let collision = false;
      let tileHit: MazeTile | null = null;

      for (const point of collisionPoints) {
        const tile = checkTileCollision(point.x, point.y);
        if (tile && tile.type === 'wall') {
          collision = true;
          tileHit = tile;
          
          // Calculate bounce direction
          const tileCenterX = tile.x * CELL_SIZE + CELL_SIZE / 2;
          const tileCenterY = tile.y * CELL_SIZE + CELL_SIZE / 2;
          const dx = point.x - tileCenterX;
          const dy = point.y - tileCenterY;
          
          if (Math.abs(dx) > Math.abs(dy)) {
            b.vx *= -0.5;
          } else {
            b.vy *= -0.5;
          }
          
          // Add shake based on impact
          shakeRef.current = Math.min(20, Math.abs(b.vx) + Math.abs(b.vy)) * 3;
          break;
        }
      }

      if (!collision) {
        b.x = nextX;
        b.y = nextY;
      } else if (tileHit) {
        // Visual feedback for hitting wall
        createBurst(
          tileHit.x * CELL_SIZE + CELL_SIZE / 2,
          tileHit.y * CELL_SIZE + CELL_SIZE / 2,
          TILE_COLORS.wall,
          6,
          2
        );
      }

      // Keep ball in bounds
      b.x = Math.max(BALL_RADIUS, Math.min(CANVAS_WIDTH - BALL_RADIUS, b.x));
      b.y = Math.max(BALL_RADIUS, Math.min(CANVAS_HEIGHT - BALL_RADIUS, b.y));

      // Special tile interactions
      const currentTile = checkTileCollision(b.x, b.y);
      if (currentTile) {
        switch(currentTile.type) {
          case 'goal':
            if (stats.keys >= keysNeededRef.current && !completedRef.current) {
              completedRef.current = true;
              const levelTime = Date.now() - startTimeRef.current;
              const timeBonus = Math.max(0, 30000 - levelTime) / 100;

              setStats(s => ({
                ...s,
                score: s.score + 1000 + Math.floor(timeBonus),
                bestTime: Math.min(s.bestTime || Infinity, levelTime)
              }));

              createBurst(b.x, b.y, TILE_COLORS.goal, 30, 4);
              setGameState('complete');
              return;
            }
            break;

          case 'hazard':
            if (!ballRef.current.hasShield) {
              setStats(s => ({...s, time: Math.max(0, s.time - 3)}));
              createBurst(b.x, b.y, TILE_COLORS.hazard, 20, 3);
              shakeRef.current = 15;
            }
            break;

          case 'teleport':
            if (!b.isTeleporting && currentTile.id) {
              const target = teleportPairsRef.current.get(currentTile.id);
              if (target && Date.now() - b.lastTeleport > 1000) {
                b.isTeleporting = true;
                b.lastTeleport = Date.now();
                b.x = target.x * CELL_SIZE + CELL_SIZE / 2;
                b.y = target.y * CELL_SIZE + CELL_SIZE / 2;
                createBurst(b.x, b.y, TILE_COLORS.teleport, 25, 3);
                setTimeout(() => { ballRef.current.isTeleporting = false; }, 300);
              }
            }
            break;

          case 'checkpoint':
            if (currentTile.id !== undefined && !currentTile.active) {
              currentTile.active = true;
              createBurst(b.x, b.y, TILE_COLORS.checkpoint, 15, 3);
              setStats(s => ({...s, score: s.score + 250}));
            }
            break;
        }
      }

      // Check key collection
      keysRef.current.forEach(key => {
        if (!key.collected) {
          const dx = key.x - b.x;
          const dy = key.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < BALL_RADIUS + 10) {
            key.collected = true;
            setStats(s => ({...s, keys: s.keys + 1, score: s.score + 500}));
            createBurst(key.x, key.y, TILE_COLORS.key, 20, 4);
          }
        }
      });

      // Update particles
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= 0.02;
      });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      // Update background stars
      bgStarsRef.current.forEach(star => {
        star.y += star.speed;
        if (star.y > CANVAS_HEIGHT) {
          star.y = 0;
          star.x = Math.random() * CANVAS_WIDTH;
        }
      });

      // Increment moves counter
      if (delta > 16) {
        setStats(s => ({...s, moves: s.moves + 1}));
      }

      // --- DRAWING ---
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      gradient.addColorStop(0, '#020617');
      gradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw background stars
      ctx.fillStyle = '#ffffff';
      bgStarsRef.current.forEach(star => {
        ctx.globalAlpha = star.speed * 0.8;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Apply camera shake
      const shakeX = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
      const shakeY = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
      shakeRef.current *= 0.9;
      
      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Draw maze tiles
      mazeRef.current.forEach(tile => {
        const x = tile.x * CELL_SIZE;
        const y = tile.y * CELL_SIZE;
        
        if (tile.type !== 'empty') {
          ctx.fillStyle = TILE_COLORS[tile.type];
          ctx.shadowBlur = tile.type === 'goal' ? 20 : 
                           tile.type === 'teleport' ? 15 : 
                           tile.type === 'hazard' ? 10 : 0;
          ctx.shadowColor = TILE_COLORS[tile.type];
          
          if (tile.type === 'wall') {
            ctx.beginPath();
            ctx.roundRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2, 4);
            ctx.fill();
          } else {
            // Special tiles with glow
            ctx.beginPath();
            ctx.roundRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 6);
            ctx.fill();
            
            // Draw tile icons
            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            if (tile.type === 'start') {
              ctx.fillText('▶', x + CELL_SIZE/2, y + CELL_SIZE/2);
            } else if (tile.type === 'goal') {
              ctx.fillText('★', x + CELL_SIZE/2, y + CELL_SIZE/2);
            } else if (tile.type === 'hazard') {
              ctx.fillText('☠', x + CELL_SIZE/2, y + CELL_SIZE/2);
            } else if (tile.type === 'teleport') {
              ctx.fillText('↯', x + CELL_SIZE/2, y + CELL_SIZE/2);
            } else if (tile.type === 'checkpoint') {
              ctx.globalAlpha = tile.active ? 1 : 0.5;
              ctx.fillText('✓', x + CELL_SIZE/2, y + CELL_SIZE/2);
              ctx.globalAlpha = 1;
            }
          }
          
          ctx.shadowBlur = 0;
        }
      });

      // Draw keys
      keysRef.current.forEach(key => {
        if (!key.collected) {
          ctx.save();
          const pulse = 0.9 + Math.sin(Date.now() / 300) * 0.1;
          ctx.translate(key.x, key.y);
          ctx.scale(pulse, pulse);
          
          ctx.fillStyle = TILE_COLORS.key;
          ctx.shadowBlur = 15;
          ctx.shadowColor = TILE_COLORS.key;
          
          // Draw key shape
          ctx.beginPath();
          ctx.roundRect(-8, -3, 16, 6, 3); // Bow
          ctx.fillRect(8, -2, 6, 4); // Stem
          ctx.fillRect(14, -4, 2, 8); // Teeth
          
          ctx.restore();
        }
      });

      // Draw ball trail
      b.trail.forEach((pos, i) => {
        ctx.globalAlpha = pos.life * 0.3;
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, BALL_RADIUS * pos.life, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Draw ball
      ctx.save();
      ctx.translate(b.x, b.y);
      
      // Ball rotation based on velocity
      const rotation = Math.atan2(b.vy, b.vx);
      ctx.rotate(rotation);
      
      // Ball gradient
      const ballGradient = ctx.createRadialGradient(-3, -3, 0, 0, 0, BALL_RADIUS);
      ballGradient.addColorStop(0, '#67e8f9');
      ballGradient.addColorStop(1, '#22d3ee');
      ctx.fillStyle = ballGradient;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#22d3ee';
      
      // Main ball
      ctx.beginPath();
      ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      
      // Ball highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(-BALL_RADIUS/3, -BALL_RADIUS/3, BALL_RADIUS/3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();

      // Draw particles
      particlesRef.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.restore(); // Restore from shake transform

      frameId = requestAnimationFrame(loop);
    };

    loop(0);

    return () => {
      clearInterval(timeInterval);
      cancelAnimationFrame(frameId);
    };
  }, [gameState, stats.keys]);

  const resetBall = () => {
    const startTile = mazeRef.current.find(t => t.type === 'start');
    if (startTile) {
      ballRef.current.x = startTile.x * CELL_SIZE + CELL_SIZE / 2;
      ballRef.current.y = startTile.y * CELL_SIZE + CELL_SIZE / 2;
      ballRef.current.vx = 0;
      ballRef.current.vy = 0;
      ballRef.current.trail = ballRef.current.trail.map(() => ({
        x: ballRef.current.x,
        y: ballRef.current.y,
        life: 1
      }));
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-950 to-slate-900 items-center justify-center touch-none overflow-hidden font-sans">
      <div className="w-full max-w-[400px] flex justify-between items-center p-4 text-white border-b border-slate-800/50 backdrop-blur-sm bg-slate-900/50">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold text-xl">L{stats.level}</span>
          <div className="h-4 w-px bg-slate-700"></div>
          <span className="text-lg font-mono">⏱️ {stats.time}s</span>
        </div>
        
        <div className="flex items-center gap-3">
          {keysNeededRef.current > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-purple-400">🔑</span>
              <span className="font-bold">{stats.keys}/{keysNeededRef.current}</span>
            </div>
          )}
          <div className="h-4 w-px bg-slate-700"></div>
          <span className="text-yellow-400 font-bold text-lg">{stats.score}</span>
        </div>
      </div>

      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT} 
        className="max-h-[70vh] w-auto shadow-2xl"
      />

      {gameState === 'playing' && (
        <div className="absolute bottom-6 flex gap-4">
          <button
            onClick={resetBall}
            className="bg-slate-800/70 hover:bg-slate-700/70 text-white font-medium py-2 px-6 rounded-full backdrop-blur-sm transition-all active:scale-95"
          >
            Reset Ball
          </button>
          <button
            onClick={() => setGameState('idle')}
            className="bg-slate-800/70 hover:bg-slate-700/70 text-white font-medium py-2 px-6 rounded-full backdrop-blur-sm transition-all active:scale-95"
          >
            Menu
          </button>
        </div>
      )}

      {gameState === 'idle' && (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/95 to-slate-950/95 flex flex-col items-center justify-center text-center p-6 backdrop-blur-sm">
          <h2 className="text-5xl font-black text-white mb-2 tracking-tighter">GRAVITY</h2>
          <h2 className="text-5xl font-black bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent mb-6 tracking-tighter">MAZE</h2>
          
          <div className="mb-8 max-w-sm">
            <p className="text-slate-300 mb-4">
              Navigate through <span className="text-cyan-400 font-bold">procedurally generated mazes</span> using tilt controls!
            </p>
            
            <div className="grid grid-cols-2 gap-3 text-left text-slate-400 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>Start position</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span>Goal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                <span>Collect keys</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>Avoid hazards</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-cyan-500 rounded"></div>
                <span>Teleporters</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-pink-500 rounded"></div>
                <span>Checkpoints</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={startSensor}
            className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-black py-4 px-12 rounded-full text-xl transition-all active:scale-95 shadow-[0_0_30px_rgba(34,211,238,0.4)]"
          >
            START GAME
          </button>
          
          <p className="mt-6 text-slate-500 text-sm">
            Tilt your device to control the ball • High Score: {stats.score}
          </p>
        </div>
      )}

      {gameState === 'complete' && (
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/95 to-slate-900/95 flex flex-col items-center justify-center text-center p-6 backdrop-blur-sm">
          <span className="text-8xl mb-2 animate-bounce">🏆</span>
          <h2 className="text-5xl font-black text-white mb-2">LEVEL CLEAR!</h2>
          <p className="text-emerald-200 text-xl mb-6">
            Time Bonus: +{Math.floor(Math.max(0, 30000 - (Date.now() - startTimeRef.current)) / 100)} points
          </p>
          
          <div className="flex gap-4 mb-8">
            <button 
              onClick={() => initLevel(stats.level + 1)}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-black py-4 px-10 rounded-full text-xl shadow-xl active:scale-95 transition-all"
            >
              NEXT LEVEL
            </button>
            <button 
              onClick={() => initLevel(1)}
              className="bg-slate-800/70 hover:bg-slate-700/70 text-white font-medium py-4 px-8 rounded-full backdrop-blur-sm transition-all"
            >
              RESTART
            </button>
          </div>
          
          <p className="text-slate-300">
            Keys Collected: {stats.keys}/{keysNeededRef.current} • 
            Moves: {stats.moves} • 
            Total Score: {stats.score}
          </p>
        </div>
      )}

      {gameState === 'gameOver' && (
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/95 to-slate-900/95 flex flex-col items-center justify-center text-center p-6 backdrop-blur-sm">
          <span className="text-8xl mb-2">💥</span>
          <h2 className="text-5xl font-black text-white mb-2">MAZE FAILED</h2>
          <p className="text-red-200 text-xl mb-6">
            Reached Level {stats.level} • Score: {stats.score}
          </p>
          
          <div className="flex gap-4">
            <button 
              onClick={() => initLevel(stats.level)}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-black py-4 px-10 rounded-full text-xl shadow-xl active:scale-95 transition-all"
            >
              RETRY LEVEL
            </button>
            <button 
              onClick={() => initLevel(1)}
              className="bg-slate-800/70 hover:bg-slate-700/70 text-white font-medium py-4 px-8 rounded-full backdrop-blur-sm transition-all"
            >
              NEW GAME
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default GravityMaze;