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
const LENS_SIZE = 140;
const MAX_IMAGES = 10;
const BASE_POINTS = 100;
const STREAK_BONUS = 50;
const ZOOM_THRESHOLD = 250; // ms to trigger zoom

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
  const { onScoreUpdate, onComplete, puzzleId } = props;

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
    onGameEnd: () => console.log('Session Ended')
  }));

  useEffect(() => {
    async function fetchPuzzles() {
      let query = supabase.from('puzzles').select('*').eq('game_type', 'double_fake').limit(MAX_IMAGES);
      if (puzzleId) query = query.eq('id', puzzleId);
      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        setPuzzles(FALLBACK_PUZZLES);
        maxScoreRef.current = FALLBACK_PUZZLES.length * (BASE_POINTS + STREAK_BONUS);
      } else {
        setPuzzles(data as Puzzle[]);
        maxScoreRef.current = data.length * (BASE_POINTS + STREAK_BONUS);
      }
      setStatus('playing');
    }
    fetchPuzzles();
  }, [puzzleId]);

  useEffect(() => {
    if (puzzles.length > 0) setAiSide(Math.random() < 0.5 ? 'left' : 'right');
  }, [currentIndex, puzzles]);

  const handleChoice = (side: 'left' | 'right') => {
    if (status !== 'playing') return;

    const isCorrect = side === aiSide;
    let pointsGained = isCorrect ? BASE_POINTS : 0;
    const newStreak = isCorrect ? streak + 1 : 0;
    if (isCorrect && newStreak > 1) pointsGained += STREAK_BONUS;

    const newScore = score + pointsGained;
    setScore(newScore);
    setStreak(newStreak);
    scoreRef.current = newScore;
    setLastResult({ isCorrect, message: isCorrect ? `+${pointsGained} PTS` : 'DETECTION FAILED' });
    setStatus('feedback');

    if (onScoreUpdate) onScoreUpdate(newScore, maxScoreRef.current);

    setTimeout(() => {
      if (currentIndex < puzzles.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setStatus('playing');
        setLastResult(null);
      } else {
        setStatus('finished');
        if (onComplete) onComplete(newScore, maxScoreRef.current);
      }
    }, 1500);
  };

  if (status === 'loading') return <div className="h-full bg-black flex items-center justify-center font-mono text-cyan-400 animate-pulse">BOOTING...</div>;
  
  if (status === 'finished') return (
    <div className="h-full bg-black flex flex-col items-center justify-center font-mono text-white">
      <h1 className="text-4xl font-black text-yellow-400 mb-4" style={{ textShadow: '0 0 10px #fbbf24' }}>COMPLETE</h1>
      <p className="text-xl">SCORE: {score}</p>
    </div>
  );

  const current = puzzles[currentIndex];

  return (
    <div className="flex flex-col h-full bg-black text-white p-2 sm:p-4 font-mono select-none overflow-hidden">
      <div className="flex justify-between items-end mb-4 border-b-2 border-cyan-900 pb-2">
        <div><p className="text-[10px] text-cyan-500 font-bold uppercase">Score</p><p className="text-2xl font-black text-cyan-300">{score}</p></div>
        <div><p className="text-[10px] text-pink-500 font-bold uppercase">Node</p><p className="text-2xl font-black text-pink-300">{currentIndex + 1}/{puzzles.length}</p></div>
        <div><p className="text-[10px] text-yellow-500 font-bold uppercase">Sync</p><p className="text-2xl font-black text-yellow-300">{streak}🔥</p></div>
      </div>

      <div className="h-8 flex items-center justify-center mb-2">
        <p className={`text-lg font-black tracking-tighter ${lastResult?.isCorrect ? 'text-green-400' : lastResult ? 'text-red-500' : 'text-gray-500'}`}>
          {lastResult?.message || "WHICH IS THE SYNTHETIC IMAGE?"}
        </p>
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
  const pressStartTime = useRef<number>(0);
  const isFeedback = status === 'feedback';

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!showMagnifier || !containerRef.current || !lensRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - bounds.left, bounds.width));
    const y = Math.max(0, Math.min(e.clientY - bounds.top, bounds.height));

    lensRef.current.style.left = `${x - LENS_SIZE / 2}px`;
    lensRef.current.style.top = `${y - LENS_SIZE / 2}px`;
    lensRef.current.style.backgroundPosition = `${(x / bounds.width) * 100}% ${(y / bounds.height) * 100}%`;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isFeedback) return;
    pressStartTime.current = Date.now();
    
    // Safety: prevent context menu/long-press defaults
    if (e.pointerType === 'touch') {
        const target = e.target as HTMLElement;
        target.style.webkitUserSelect = 'none';
    }

    pressTimer.current = setTimeout(() => {
      setShowMagnifier(true);
      if (window.navigator.vibrate) window.navigator.vibrate(40);
    }, ZOOM_THRESHOLD);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    
    const pressDuration = Date.now() - pressStartTime.current;

    // IF we are showing the magnifier OR the press lasted longer than the threshold
    // we cancel the selection entirely.
    if (showMagnifier || pressDuration >= ZOOM_THRESHOLD) {
      setShowMagnifier(false);
      e.preventDefault();
      e.stopPropagation();
    } else if (!isFeedback) {
      onSelect();
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
        setShowMagnifier(false);
      }}
      className={`relative w-full aspect-[3/4] rounded-sm border-2 overflow-hidden transition-all duration-300 touch-none select-none
        ${isFeedback ? (isAI ? 'border-green-500 shadow-[0_0_20px_#22c55e]' : 'border-red-600') : 'border-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.2)]'}`}
    >
      <img src={url} className="w-full h-full object-cover pointer-events-none" alt="Evidence" />

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

      {isFeedback && (
        <div className={`absolute bottom-0 left-0 right-0 py-2 text-[10px] font-black uppercase text-center z-10
          ${isAI ? 'bg-green-500 text-black' : 'bg-red-600 text-white'}`}>
          {isAI ? '🤖 SYNTHETIC' : '📷 AUTHENTIC'}
        </div>
      )}

      {!isFeedback && (
        <div className="absolute top-1 left-1 bg-black/70 px-1 text-[7px] text-cyan-300 uppercase tracking-widest border border-cyan-900">
          Hold to Zoom
        </div>
      )}
    </div>
  );
}

DoubleFake.displayName = 'DoubleFake';
export default DoubleFake;