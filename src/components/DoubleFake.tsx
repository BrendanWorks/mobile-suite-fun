import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
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
const LENS_SIZE = 120;
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
      console.log('DoubleFake game ended');
    }
  }));

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
        console.log("Using fallback puzzles for DoubleFake");
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

  useEffect(() => {
    if (puzzles.length > 0) {
      setAiSide(Math.random() < 0.5 ? 'left' : 'right');
    }
  }, [currentIndex, puzzles]);

  useEffect(() => {
    if (currentIndex < puzzles.length - 1 && puzzles[currentIndex + 1]) {
      const nextPuzzle = puzzles[currentIndex + 1];
      const img1 = new Image();
      const img2 = new Image();
      img1.src = nextPuzzle.metadata.ai_image_url;
      img2.src = nextPuzzle.metadata.real_image_url;
    }
  }, [currentIndex, puzzles]);

  const handleChoice = (side: 'left' | 'right') => {
    if (status !== 'playing') return;

    const isCorrect = side === aiSide;
    let pointsGained = isCorrect ? BASE_POINTS : 0;
    const newStreak = isCorrect ? streak + 1 : 0;

    if (isCorrect && newStreak > 1) {
      pointsGained += STREAK_BONUS * newStreak;
    }

    const newScore = score + pointsGained;
    setScore(newScore);
    setStreak(newStreak);
    scoreRef.current = newScore;

    setLastResult({
      isCorrect,
      message: isCorrect ? `+${pointsGained} pts!` : 'Wrong!'
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
        if (onComplete) {
          onComplete(newScore, maxScoreRef.current);
        }
      }
    }, 1500);
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  if (status === 'finished') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black text-white p-4">
        <div className="text-4xl mb-4">Game Complete!</div>
        <div className="text-2xl">Final Score: {score}</div>
      </div>
    );
  }

  const current = puzzles[currentIndex];
  if (!current) return null;

  return (
    <div className="flex flex-col h-full bg-black text-white p-2 sm:p-4 font-mono select-none overflow-hidden">
      <div className="flex justify-between items-end mb-4 border-b-2 border-cyan-900 pb-2">
        <div>
          <div className="text-xs text-cyan-400 uppercase tracking-wider">Score</div>
          <div className="text-2xl font-black text-cyan-300">{score}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-pink-400 uppercase tracking-wider">Image</div>
          <div className="text-2xl font-black text-pink-300">{currentIndex + 1}/{puzzles.length}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-yellow-400 uppercase tracking-wider">Streak</div>
          <div className="text-2xl font-black text-yellow-300">{streak}🔥</div>
        </div>
      </div>

      {lastResult && (
        <div className={`text-center text-xl font-bold mb-2 ${lastResult.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
          {lastResult.message}
        </div>
      )}

      <div className="text-center mb-2 text-sm text-gray-400">
        Which image is AI-generated?
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

    pressTimer.current = setTimeout(() => {
      setShowMagnifier(true);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 250);
  };

  const handlePointerUp = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }

    if (showMagnifier) {
      setShowMagnifier(false);
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
      onPointerLeave={handlePointerUp}
      className={`relative w-full aspect-[3/4] rounded-sm border-2 overflow-hidden transition-all duration-300 touch-none
        ${isFeedback ? (isAI ? 'border-green-500 shadow-[0_0_15px_#22c55e]' : 'border-red-500') : 'border-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.2)]'}`}
    >
      <img src={url} className="w-full h-full object-cover pointer-events-none" alt="Detect" />

      <div
        ref={lensRef}
        style={{
          width: LENS_SIZE,
          height: LENS_SIZE,
          backgroundImage: `url(${url})`,
          backgroundSize: `${100 * ZOOM_LEVEL}%`,
          display: showMagnifier ? 'block' : 'none',
          boxShadow: '0 0 20px rgba(0,0,0,0.5), 0 0 0 2px #00ffff',
        }}
        className="absolute pointer-events-none rounded-full border-2 border-cyan-400 z-50 bg-no-repeat"
      />

      {isFeedback && (
        <div className={`absolute bottom-0 left-0 right-0 py-1 text-[10px] font-black uppercase text-center z-10
          ${isAI ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
          {isAI ? '🤖 AI GENERATED' : '📷 AUTHENTIC'}
        </div>
      )}

      {!isFeedback && (
        <div className="absolute top-2 left-2 bg-black/50 px-1 text-[8px] text-cyan-400 uppercase tracking-tighter">
          Hold to Zoom
        </div>
      )}
    </div>
  );
}

DoubleFake.displayName = 'DoubleFake';

export default DoubleFake;
