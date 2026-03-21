import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SlotProps {
  puzzle: {
    id: number;
    prompt: string;
    correct_answer: string;
    metadata: {
      blanks: number[];
      tiles: string[];
    };
  };
  timeRemaining: number;
  onComplete: (score: number, isCorrect: boolean) => void;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const Slot: React.FC<SlotProps> = ({ puzzle, timeRemaining, onComplete, difficulty }) => {
  const [filledBlanks, setFilledBlanks] = useState<string[]>([]);
  const [usedTiles, setUsedTiles] = useState<Set<number>>(new Set());
  const [tiles, setTiles] = useState<string[]>([]);
  const [gameState, setGameState] = useState<'playing' | 'correct' | 'wrong'>('playing');
  const [bounceIndex, setBounceIndex] = useState<number | null>(null);
  const completeRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  // Initialize tiles on mount (shuffle them)
  useEffect(() => {
    const shuffled = [...puzzle.metadata.tiles].sort(() => Math.random() - 0.5);
    setTiles(shuffled);
  }, [puzzle.metadata.tiles]);

  // Check for completion
  useEffect(() => {
    if (filledBlanks.length === puzzle.metadata.blanks.length && filledBlanks.length > 0) {
      // Build the answer from filled blanks
      const answerArray = puzzle.correct_answer.split('');
      let isCorrect = true;

      for (let i = 0; i < puzzle.metadata.blanks.length; i++) {
        const blankPos = puzzle.metadata.blanks[i];
        if (answerArray[blankPos] !== filledBlanks[i]) {
          isCorrect = false;
          break;
        }
      }

      if (isCorrect && !completeRef.current) {
        completeRef.current = true;
        setGameState('correct');

        // Calculate score
        const elapsedTime = (Date.now() - startTimeRef.current) / 1000;
        const timeBonus = Math.max(0, timeRemaining - Math.ceil(elapsedTime));
        const difficultyMultiplier = { easy: 1, medium: 1.25, hard: 1.5 }[difficulty];
        const score = Math.round((1000 + timeBonus * 50) * difficultyMultiplier);

        setTimeout(() => {
          onComplete(score, true);
        }, 1500);
      } else if (!isCorrect) {
        setGameState('wrong');
        // Clear filled blanks and reset
        setTimeout(() => {
          setFilledBlanks([]);
          setGameState('playing');
        }, 1000);
      }
    }
  }, [filledBlanks, puzzle, timeRemaining, difficulty, onComplete]);

  // Handle tile tap
  const handleTileTap = useCallback((index: number) => {
    if (usedTiles.has(index) || gameState !== 'playing') return;

    const nextBlankIndex = filledBlanks.length;
    const blankPosition = puzzle.metadata.blanks[nextBlankIndex];
    const correctLetter = puzzle.correct_answer[blankPosition];

    if (tiles[index] === correctLetter) {
      // Correct tile
      setFilledBlanks([...filledBlanks, tiles[index]]);
      setUsedTiles(new Set([...usedTiles, index]));
    } else {
      // Wrong tile - bounce animation
      setBounceIndex(index);
      setTimeout(() => setBounceIndex(null), 400);
    }
  }, [filledBlanks, usedTiles, tiles, puzzle, gameState]);

  // Build word display with blanks and filled letters
  const wordDisplay = puzzle.correct_answer.split('').map((letter, idx) => {
    const isBlank = puzzle.metadata.blanks.includes(idx);
    if (!isBlank) {
      return letter; // Known letter
    }
    const blankIndex = puzzle.metadata.blanks.indexOf(idx);
    const isFilled = blankIndex < filledBlanks.length;
    return isFilled ? filledBlanks[blankIndex] : '_';
  });

  const difficultyMultiplier = { easy: 1, medium: 1.25, hard: 1.5 }[difficulty];
  const baseTileSize = 44;

  return (
    <div style={{
      background: '#000000',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
      padding: '16px',
      minHeight: '100vh'
    }}>
      {/* Hint */}
      <div style={{
        marginBottom: '24px',
        padding: '12px',
        border: '2px solid #fbbf24',
        borderRadius: '8px',
        background: 'transparent',
        boxShadow: '0 0 15px rgba(251, 191, 36, 0.3)'
      }}>
        <div style={{ fontSize: '11px', color: '#00ffff', opacity: 0.6, marginBottom: '4px', textTransform: 'uppercase' }}>
          Category Hint
        </div>
        <div style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#fbbf24',
          textShadow: '0 0 8px #fbbf24'
        }}>
          {puzzle.prompt}
        </div>
      </div>

      {/* Word Display */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '12px', color: '#00ffff', marginBottom: '12px', opacity: 0.7 }}>
          Complete the word:
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          {wordDisplay.map((letter, idx) => (
            <div
              key={idx}
              style={{
                width: `${baseTileSize}px`,
                height: `${baseTileSize + 6}px`,
                border: '2px solid #00ffff',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 'bold',
                color: puzzle.metadata.blanks.includes(idx) ? '#00ffff' : '#00ffff',
                background: puzzle.metadata.blanks.includes(idx) ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 255, 255, 0.1)',
                boxShadow: '0 0 10px rgba(0, 255, 255, 0.2)',
                opacity: gameState === 'wrong' ? 0.5 : 1,
                transition: 'opacity 300ms'
              }}
            >
              {letter === '_' ? '' : letter}
            </div>
          ))}
        </div>
      </div>

      {/* Tiles */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', color: '#00ffff', marginBottom: '12px', opacity: 0.7 }}>
          Tap letters to fill blanks:
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          {tiles.map((letter, idx) => {
            const isUsed = usedTiles.has(idx);
            const isBouncing = bounceIndex === idx;
            
            return (
              <button
                key={idx}
                onClick={() => handleTileTap(idx)}
                disabled={isUsed || gameState !== 'playing'}
                style={{
                  width: `${baseTileSize}px`,
                  height: `${baseTileSize}px`,
                  border: isUsed ? '2px solid rgba(0, 255, 255, 0.1)' : '2px solid rgba(0, 255, 255, 0.3)',
                  background: isUsed ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.5)',
                  color: isUsed ? 'rgba(255, 255, 255, 0.3)' : '#ffffff',
                  borderRadius: '6px',
                  fontSize: '18px',
                  fontWeight: '700',
                  cursor: isUsed ? 'default' : 'pointer',
                  transition: 'all 200ms',
                  boxShadow: isUsed ? '0 0 5px rgba(0, 255, 255, 0.05)' : '0 0 10px rgba(0, 255, 255, 0.2)',
                  opacity: isUsed ? 0.5 : 1,
                  transform: isBouncing ? 'translateY(-8px)' : 'translateY(0)',
                  animation: isBouncing ? 'bounce 0.4s ease-in-out' : 'none'
                }}
              >
                {letter}
              </button>
            );
          })}
        </div>
        <style>{`
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          button:hover:not(:disabled) {
            border-color: #00ffff !important;
            background-color: rgba(0, 255, 255, 0.1) !important;
            box-shadow: 0 0 10px rgba(0, 255, 255, 0.3) !important;
            transform: scale(1.05) !important;
          }
        `}</style>
      </div>

      {/* Feedback message */}
      {gameState === 'correct' && (
        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: 'rgba(34, 197, 94, 0.2)',
          border: '2px solid #22c55e',
          borderRadius: '6px',
          color: '#22c55e',
          fontWeight: 'bold',
          textAlign: 'center',
          animation: 'pulse 1s ease-in-out'
        }}>
          Correct! {puzzle.correct_answer}
        </div>
      )}

      {gameState === 'wrong' && (
        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: 'rgba(239, 68, 68, 0.2)',
          border: '2px solid #ef4444',
          borderRadius: '6px',
          color: '#ef4444',
          fontWeight: 'bold',
          textAlign: 'center'
        }}>
          Try again
        </div>
      )}

      <div style={{
        marginTop: '20px',
        fontSize: '13px',
        color: 'rgba(0, 255, 255, 0.6)',
        textAlign: 'center'
      }}>
        {filledBlanks.length}/{puzzle.metadata.blanks.length} filled
      </div>
    </div>
  );
};

export default Slot;