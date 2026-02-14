import React, { useRef, useEffect, useState, useCallback } from 'react';

const GRID_SIZE = 30;
const WALL = 1;
const FLOOR = 0;
const EXIT = 2;

interface NeuralPulseProps {
  onComplete: (rawScore: number, maxScore: number, timeRemaining: number) => void;
  onScoreUpdate: (score: number, maxScore: number) => void;
  duration: number;
}

export default function NeuralPulse({ onComplete, onScoreUpdate, duration }: NeuralPulseProps) {
  const [map, setMap] = useState<number[][]>([]);
  const [visited, setVisited] = useState<boolean[][]>([]);
  const [player, setPlayer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [startTime] = useState(Date.now());
  const [tileSize, setTileSize] = useState(16);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate responsive tile size
  useEffect(() => {
    const updateTileSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight - 100;
        const maxSize = Math.min(containerWidth, containerHeight);
        const calculatedTileSize = Math.floor(maxSize / GRID_SIZE);
        setTileSize(Math.max(8, Math.min(20, calculatedTileSize)));
      }
    };

    updateTileSize();
    window.addEventListener('resize', updateTileSize);
    return () => window.removeEventListener('resize', updateTileSize);
  }, []);

  // Generate procedural cave map using cellular automata
  const generateCaves = useCallback(() => {
    setIsGenerating(true);

    // 1. Initial random noise (~45% walls)
    let newMap = Array(GRID_SIZE)
      .fill(null)
      .map(() =>
        Array(GRID_SIZE)
          .fill(0)
          .map(() => (Math.random() < 0.45 ? WALL : FLOOR))
      );

    // 2. Smooth 5 iterations
    const smooth = (current: number[][]) => {
      const temp = current.map(row => [...row]);
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          let walls = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const ny = y + dy;
              const nx = x + dx;
              if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE || current[ny][nx] === WALL) {
                walls++;
              }
            }
          }
          temp[y][x] = walls > 4 ? WALL : FLOOR;
        }
      }
      return temp;
    };

    for (let i = 0; i < 5; i++) {
      newMap = smooth(newMap);
    }

    // 3. Find valid starting position (top-left-ish floor tile)
    let start = { x: 1, y: 1 };
    for (let y = 1; y < GRID_SIZE; y++) {
      for (let x = 1; x < GRID_SIZE; x++) {
        if (newMap[y][x] === FLOOR) {
          start = { x, y };
          break;
        }
      }
      if (start.x !== 1 || start.y !== 1) break;
    }

    // 4. Place exit (bottom-right-ish floor tile)
    let exitFound = false;
    for (let y = GRID_SIZE - 2; y > 0 && !exitFound; y--) {
      for (let x = GRID_SIZE - 2; x > 0 && !exitFound; x--) {
        if (newMap[y][x] === FLOOR) {
          newMap[y][x] = EXIT;
          exitFound = true;
        }
      }
    }

    setMap(newMap);
    setVisited(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false)));
    setPlayer(start);
    setScore((prev) => prev + level * 50); // Bonus for reaching exit
    setTimeout(() => setIsGenerating(false), 400);
  }, [level]);

  // Initial generation
  useEffect(() => {
    generateCaves();
  }, [generateCaves]);

  // Visibility (torch radius ~3 tiles)
  useEffect(() => {
    if (!map.length) return;
    setVisited((prev) => {
      const next = prev.map((row) => [...row]);
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const ny = player.y + dy;
          const nx = player.x + dx;
          if (ny >= 0 && ny < GRID_SIZE && nx >= 0 && nx < GRID_SIZE) {
            next[ny][nx] = true;
          }
        }
      }
      return next;
    });
  }, [player, map]);

  // Movement (keyboard + touch swipe)
  const move = useCallback(
    (dx: number, dy: number) => {
      const nx = player.x + dx;
      const ny = player.y + dy;
      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) return;

      if (map[ny][nx] === FLOOR || map[ny][nx] === EXIT) {
        setPlayer({ x: nx, y: ny });
        setScore((prev) => prev + 1); // +1 per step
        onScoreUpdate(score + 1, 1000); // arbitrary max for normalization
      }

      if (map[ny][nx] === EXIT) {
        setLevel((prev) => prev + 1);
        generateCaves();
      }
    },
    [player, map, score, generateCaves, onScoreUpdate]
  );

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.includes('Arrow')) e.preventDefault();
      if (e.key === 'ArrowUp') move(0, -1);
      if (e.key === 'ArrowDown') move(0, 1);
      if (e.key === 'ArrowLeft') move(-1, 0);
      if (e.key === 'ArrowRight') move(1, 0);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [move]);

  // Touch swipe controls (mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // Simple swipe detection (threshold ~40px)
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 40) move(1, 0);
      else if (dx < -40) move(-1, 0);
    } else {
      if (dy > 40) move(0, 1);
      else if (dy < -40) move(0, -1);
    }

    touchStartRef.current = null;
  };

  // Timer-based game end
  useEffect(() => {
    const timer = setTimeout(() => {
      const timeElapsed = (Date.now() - startTime) / 1000;
      const timeRemaining = Math.max(0, duration - timeElapsed);
      onComplete(score, 1000, timeRemaining); // maxScore arbitrary – normalize in scoringSystem
    }, duration * 1000);

    return () => clearTimeout(timer);
  }, [duration, score, startTime, onComplete]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
      {/* HUD */}
      <div className="w-full flex justify-between items-center mb-2 px-2">
        <div className="text-cyan-400 text-sm font-bold" style={{ textShadow: '0 0 10px #00ffff' }}>
          LEVEL {level}
        </div>
        <div className="text-yellow-400 text-lg font-bold" style={{ textShadow: '0 0 15px #fbbf24' }}>
          {score}
        </div>
        <div className="text-cyan-300 text-sm">
          TIME {Math.ceil(duration - (Date.now() - startTime) / 1000)}s
        </div>
      </div>

      {/* Game Grid */}
      <div
        className={`relative grid border-2 border-cyan-400/40 rounded overflow-hidden shadow-[0_0_20px_rgba(0,255,255,0.3)] transition-opacity duration-500 ${
          isGenerating ? 'opacity-40' : 'opacity-100'
        }`}
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, ${tileSize}px)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, ${tileSize}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {map.map((row, y) =>
          row.map((tile, x) => {
            const isVisible = visited[y]?.[x];
            const isPlayer = player.x === x && player.y === y;
            const isExit = tile === EXIT;

            let bgClass = 'bg-black';
            if (isVisible) {
              if (tile === WALL) bgClass = 'bg-gray-900/60 border border-pink-900/30';
              else if (isExit) bgClass = 'bg-yellow-500/40 animate-pulse';
              else bgClass = 'bg-transparent';
            }

            return (
              <div
                key={`${x}-${y}`}
                className={`transition-all duration-300 ${bgClass}`}
                style={{ width: tileSize, height: tileSize }}
              >
                {isPlayer && (
                  <div
                    className="bg-pink-500 rounded-full shadow-[0_0_12px_#ec4899,0_0_20px_#ec4899]"
                    style={{
                      width: Math.max(tileSize * 0.7, 6),
                      height: Math.max(tileSize * 0.7, 6),
                      margin: 'auto',
                      marginTop: Math.max(tileSize * 0.15, 1)
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Instructions */}
      <div className="mt-3 text-cyan-400/70 text-xs sm:text-sm text-center px-2">
        Swipe or use arrow keys to explore the cave<br />
        Find the pulsing exit to advance
      </div>

      {/* Generating overlay */}
      {isGenerating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
          <div className="text-cyan-400 text-xl font-bold animate-pulse" style={{ textShadow: '0 0 15px #00ffff' }}>
            GENERATING SECTOR {level}...
          </div>
        </div>
      )}
    </div>
  );
}