import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../lib/supabase';

interface PuzzleMetadata {
  ai_image_url: string;
  real_image_url: string;
  ai_source?: string;
  description?: string;
  difficulty?: "easy" | "medium" | "hard";
}

interface Puzzle {
  id: string;
  metadata: PuzzleMetadata;
}

interface DoubleFakeProps {
  onScoreUpdate?: (currentScore: number, maxPossibleScore: number) => void;
  onComplete?: (finalScore: number, maxScore: number) => void;
  duration?: number;
  timeRemaining?: number;
  puzzleId?: string;
}

const ZOOM_LEVEL = 3;
const LENS_SIZE = 140; // Slightly larger for better mobile visibility
const MAX_IMAGES = 10;
const BASE_POINTS = 100;
const STREAK_BONUS = 50;

const FALLBACK_PUZZLES: Puzzle[] = [
  {
    id: 'demo-1',
    metadata: {
      ai_image_url: 'https://images.pexels.com/photos/1181677/pexels-photo-1181677.jpeg',
      real_image_url: 'https://images.pexels.com/photos/1366919/pexels-photo-1366919.jpeg',
      description: 'Landscape vs City',
      difficulty: 'easy'
    }
  },
  {
    id: 'demo-2',
    metadata: {
      ai_image_url: 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg',
      real_image_url: 'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg',
      description: 'Forest vs Beach',
      difficulty: 'medium'
    }
  }
];

const DoubleFake = forwardRef((props: DoubleFakeProps, ref) => {
  const { onScoreUpdate, onComplete, duration, timeRemaining, puzzleId } = props;

  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [status, setStatus] = useState<'loading' | 'playing' | 'feedback' | 'finished'>('loading');
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const [aiSide, setAiSide] = useState<'left' | 'right'>('left');
  
  const scoreRef = useRef(0);
  const maxScoreRef = useRef(0);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: scoreRef.current,
      maxScore: maxScoreRef.current
    }),
    onGameEnd: () => {
      console.log('DoubleFake session terminated');
    }
  }));

  // Load Data
  useEffect(() => {
    async function fetchPuzzles() {
      let query = supabase
        .from('puzzles')
        .select('*')
        .eq('game_type', 'double_fake')
        .limit(MAX_IMAGES);

      if (puzzleId) {
        query = query.eq('id', puzzleId);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        setPuzzles(FALLBACK_PUZZLES);
        maxScoreRef.current = FALLBACK_PUZZLES.length * (BASE_POINTS + STREAK_BONUS);
        setStatus('playing');
        return;
      }

      setPuzzles(data as Puzzle[]);
      maxScoreRef.current = data.length * (BASE_POINTS + STREAK_BONUS);
      setStatus('playing');
    }

    fetchPuzzles();
  }, [puzzleId]);

  // Randomize AI position per round
  useEffect(() => {
    if (puzzles.length > 0) {
      setAiSide(Math.random() < 0.5 ? 'left' : 'right');
    }
  }, [currentIndex, puzzles]);

  const handleChoice = (side: 'left' | 'right') => {
    if (status !== 'playing') return;

    const isCorrect = side === aiSide;
    let pointsGained = isCorrect ? BASE_POINTS : 0;
    const newStreak = isCorrect ? streak + 1 : 0;

    // Correct streak logic: bonus applied for 2nd correct answer onwards
    if (isCorrect && newStreak > 1) {
      pointsGained += STREAK_BONUS;
    }

    const newScore = score + pointsGained;
    setScore(newScore);
    setStreak(newStreak);
    scoreRef.current = newScore;

    setLastResult({
      isCorrect,
      message: isCorrect ? `+${pointsGained} PTS` : 'DETECTION FAILED'
    });

    setStatus('feedback');

    if (onScoreUpdate) {
      onScoreUpdate(newScore, maxScoreRef.current);
    }

    setTimeout(() => {
      if (currentIndex < puzzles.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setStatus('playing');
        setLastResult(null);
      } else {
        setStatus('finished');
        if (onComplete) onComplete(newScore, maxScoreRef.current);
      }
    }, 1500);
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-cyan-400 animate-pulse tracking-widest font-mono">INITIALIZING SCANNER...</div>
      </div>
    );
  }

  if (status === 'finished') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black text-white p-4 font-mono">
        <div className="text-4xl font-black text-yellow-400 mb-2 shadow-yellow-500/50" style={{ textShadow: '0 0 10px #fbbf24' }}>MISSION COMPLETE</div>
        <div className="text-xl text-cyan-400">FINAL SCORE: {score}</div>
      </div>
    );
  }

  const current = puzzles[currentIndex];
  if (!current) return null;

  return (
    <div className="flex flex-col h-full bg-black text-white p-2 sm:p-4 font-mono select-none overflow-hidden">
      {/* Arcade HUD */}
      <div className="flex justify-between items-end mb-4 border-b-2 border-cyan-900 pb-2">
        <div>
          <div className="text-[10px] text-cyan-500 uppercase font-bold">Data Stream</div>
          <div className="text-2xl font-black text-cyan-300" style={{ textShadow: '0 0 8px #06b6d4' }}>{score}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-pink-500 uppercase font-bold">Node</div>
          <div className="text-2xl font-black text-pink-300" style={{ textShadow: '0 0 8px #d946ef' }}>{currentIndex + 1}/{puzzles.length}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-yellow-500 uppercase font-bold">Sync</div>
          <div className="text-2xl font-black text-yellow-300" style={{ textShadow: '0 0 8px #eab308' }}>{streak}🔥</div>
        </div>
      </div>

      <div className="h-8 flex items-center justify-center">
        {lastResult ? (
           <div className={`text-xl font-black tracking-tighter ${lastResult.isCorrect ? 'text-green-400' : 'text-red-500 animate-shake'}`}>
             {lastResult.message}
           </div>
        ) : (
          <div className="text-xs text-gray-500 uppercase tracking-[0.2em]">Identify the Synthetic Image</div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-2 gap-2 sm:gap-4 items-center">
        <ImageSlot
          url={aiSide === 'left' ? current.metadata.ai_image_url : current.metadata.real_image_url}
          isAI={aiSide === 'left'}
          status={status}
          onSelect={() => handleChoice('left')}
        />
        <ImageSlot
          url={aiSide === 'right' ? current.metadata.ai_image_url : current.metadata.real_image_url}
          isAI={aiSide === 'right'}
          status={status}
          onSelect={() => handleChoice('right')}
        />
      </div>
    </div>
  );
});

function ImageSlot({ url, isAI, status, onSelect }: any) {
  const [showMagnifier, setShowMagnifier] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  
  // THE FIX: didZoom tracks if the magnifier was actually activated during the current press
  const didZoom = useRef(false);

  const isFeedback = status === 'feedback';

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!showMagnifier || !containerRef.current || !lensRef.current) return;

    const bounds = containerRef.current.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;

    const posX = Math.max(0, Math.min(x, bounds.width));
    const posY = Math.max(0, Math.min(y, bounds.height));

    lensRef.current.style.left = `${posX - LENS_SIZE / 2}px`;
    lensRef.current.style.top = `${posY - LENS_SIZE / 2}px`;

    const bgX = (posX / bounds.width) * 100;
    const bgY = (posY / bounds.height) * 100;
    lensRef.current.style.backgroundPosition = `${bgX}% ${bgY}%`;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isFeedback) return;
    didZoom.current = false; // Reset for new interaction

    pressTimer.current = setTimeout(() => {
      setShowMagnifier(true);
      didZoom.current = true; // Mark that we have entered zoom mode
      if (window.navigator.vibrate) window.navigator.vibrate(40);
    }, 300); // Increased threshold slightly for better tap detection
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }

    if (didZoom.current) {
      // If we zoomed, we ONLY hide the magnifier. No selection allowed.
      setShowMagnifier(false);
      didZoom.current = false;
    } else if (!isFeedback) {
      // If we never hit the zoom threshold, it's a valid selection tap.
      onSelect();
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerUp}
      className={`relative w-full aspect-[3/4] rounded-sm border-2 overflow-hidden transition-all duration-300 touch-none
        ${isFeedback ? (isAI ? 'border-green-500 shadow-[0_0_20px_#22c55e]' : 'border-red-600') : 'border-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.2)] hover:border-white'}`}
    >
      <img src={url} className="w-full h-full object-cover pointer-events-none" alt="Evidence" />

      {/* Magnifier Lens */}
      <div
        ref={lensRef}
        style={{
          width: LENS_SIZE,
          height: LENS_SIZE,
          backgroundImage: `url(${url})`,
          backgroundSize: `${100 * ZOOM_LEVEL}%`,
          display: showMagnifier ? 'block' : 'none',
          boxShadow: '0 0 25px rgba(0,0,0,0.8), 0 0 0 3px #00ffff',
        }}
        className="absolute pointer-events-none rounded-full border-2 border-cyan-400 z-50 bg-no-repeat transition-transform scale-110"
      />

      {/* Feedback Overlay */}
      {isFeedback && (
        <div className={`absolute bottom-0 left-0 right-0 py-2 text-xs font-black uppercase text-center z-10
          ${isAI ? 'bg-green-500 text-black' : 'bg-red-600 text-white'}`}>
          {isAI ? 'SYNTHETIC' : 'AUTHENTIC'}
        </div>
      )}

      {!isFeedback && (
        <div className="absolute top-2 left-2 bg-black/70 px-1.5 py-0.5 text-[7px] text-cyan-300 uppercase tracking-widest border border-cyan-800 rounded-sm">
          Long Press: Zoom
        </div>
      )}
    </div>
  );
}

DoubleFake.displayName = 'DoubleFake';

export default DoubleFake;