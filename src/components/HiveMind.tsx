import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { GameHandle } from '../lib/gameTypes';

interface Choice {
  text: string;
  percentage: number;
}

interface Question {
  question: string;
  choices: Choice[];
}

interface HiveMindProps {
  puzzleId?: string;
  onScoreUpdate: (score: number) => void;
  onComplete: (finalScore: number) => void;
  timeRemaining: number;
}

// ============================================================
// Constants & Helpers
// ============================================================

const TIMING = {
  BAR_DELAY: 0.4,        // Delay between each bar animation start
  BAR_DURATION: 0.8,     // Duration of bar fill animation
  REVEAL_PAUSE: 2.5,     // Time to show results before advancing
};

const POINTS = {
  FIRST: 200,
  SECOND: 100,
  THIRD: 25,
};

const ICON_STYLES = {
  color: '#00ffff',
  filter: 'drop-shadow(0 0 8px rgba(0, 255, 255, 0.6))',
  strokeWidth: 2,
};

interface ButtonStateStyle {
  className: string;
  glow: React.CSSProperties;
}

// Determine button styling based on game state
const getButtonStateStyle = (
  isWinner: boolean,
  isSelected: boolean,
  revealState: boolean,
  barsComplete: boolean
): ButtonStateStyle => {
  let className = "p-2.5 sm:p-3 rounded-lg text-sm sm:text-base font-medium text-left transition-all duration-500 border-2";

  if (barsComplete) {
    if (isWinner) {
      className += " bg-green-500/20 border-green-500 text-white";
    } else if (isSelected && !isWinner) {
      className += " bg-red-500/20 border-red-500 text-white/70";
    } else {
      className += " bg-black/50 border-cyan-400/20 text-gray-400/60";
    }
  } else if (revealState) {
    className += " bg-black/50 border-cyan-400/30 text-white";
  } else {
    if (isSelected) {
      className += " bg-cyan-500/20 border-cyan-400 text-cyan-300";
    } else {
      className += " bg-black/50 hover:bg-cyan-500/10 text-white border-cyan-400/30 hover:border-cyan-400";
    }
  }

  const glowStyle: React.CSSProperties = barsComplete && isWinner
    ? { boxShadow: '0 0 15px rgba(34, 197, 94, 0.5)' }
    : barsComplete && isSelected && !isWinner
    ? { boxShadow: '0 0 15px rgba(239, 68, 68, 0.5)' }
    : isSelected && !revealState
    ? { boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)' }
    : {};

  return { className, glow: glowStyle };
};

// Get background color for animation bar
const getBarBgColor = (
  isWinner: boolean,
  isSelected: boolean,
  barsComplete: boolean
): string => {
  if (barsComplete && isWinner) return 'bg-green-500/30';
  if (barsComplete && isSelected) return 'bg-red-500/20';
  return 'bg-cyan-500/20';
};

// Get percentage text color
const getPercentageTextColor = (
  isWinner: boolean,
  barsComplete: boolean
): string => {
  return barsComplete && isWinner ? 'text-green-400' : 'text-white/60';
};

// ============================================================
// Component
// ============================================================

const HiveMind = forwardRef<GameHandle, HiveMindProps>(({
  puzzleId,
  onScoreUpdate,
  onComplete,
  timeRemaining
}, ref) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [revealState, setRevealState] = useState(false);
  const [barsComplete, setBarsComplete] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score: totalScore, maxScore: questions.length * 200 }),
    onGameEnd: () => {
      onComplete(totalScore);
    },
    canSkipQuestion: false,
    pauseTimer: revealState
  }));

  // Load Data
  useEffect(() => {
    const fetchPuzzle = async () => {
      let query = supabase
        .from('puzzles')
        .select('*')
        .eq('game_type', 'hive_mind')
        .eq('is_playable', true);

      if (puzzleId) {
        query = query.eq('id', puzzleId);
      }

      const { data, error } = await query.limit(1).maybeSingle();

      if (data && !error && data.metadata?.questions) {
        setQuestions(data.metadata.questions);
      } else if (error) {
        console.error('Error loading Hive Mind puzzle:', error);
      }
      setLoading(false);
    };

    fetchPuzzle();
  }, [puzzleId]);

  const currentQuestion = questions[currentIndex];

  // Logic for the Reveal Phase
  const handleGuess = (choiceText: string) => {
    if (revealState) return;

    setSelectedChoice(choiceText);
    setRevealState(true);
    setBarsComplete(false);

    // Calculate Points
    const sorted = [...currentQuestion.choices].sort((a, b) => b.percentage - a.percentage);
    const rank = sorted.findIndex(c => c.text === choiceText);

    const pointsMap = [POINTS.FIRST, POINTS.SECOND, POINTS.THIRD];
    const points = rank < 3 ? pointsMap[rank] : 0;

    const newScore = totalScore + points;
    setTotalScore(newScore);
    onScoreUpdate(newScore);

    // Calculate when the last bar finishes animating
    const numChoices = currentQuestion.choices.length;
    const lastBarFinish = (numChoices - 1) * TIMING.BAR_DELAY + TIMING.BAR_DURATION;

    setTimeout(() => {
      setBarsComplete(true);
    }, lastBarFinish * 1000);

    // Move to next or complete after bars finish + showcase time
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setRevealState(false);
        setBarsComplete(false);
        setSelectedChoice(null);
        setCurrentIndex(prev => prev + 1);
      } else {
        onComplete(newScore);
      }
    }, (lastBarFinish + TIMING.REVEAL_PAUSE) * 1000);
  };

  if (loading || !currentQuestion) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-cyan-400">
          <div style={{ textShadow: '0 0 10px #00ffff' }}>
            LOADING SWARM...
          </div>
        </div>
      </div>
    );
  }

  // Sort for sequential animation (lowest % to highest %)
  const animationOrder = [...currentQuestion.choices].sort((a, b) => a.percentage - b.percentage);
  const winnerText = [...currentQuestion.choices].sort((a, b) => b.percentage - a.percentage)[0].text;

  return (
    <div className="min-h-screen bg-black flex items-start justify-center pt-4 p-3 sm:p-4">
      <div className="text-center max-w-2xl w-full text-white select-none space-y-3">
        
        {/* HEADER - Compact single line */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users
              className="w-4 h-4 sm:w-5 sm:h-5"
              style={ICON_STYLES}
            />
            <h2 className="text-xs sm:text-sm font-bold text-cyan-400"
                style={{ textShadow: '0 0 10px #00ffff' }}>
              Hive Mind
            </h2>
          </div>
          
          <div className="text-cyan-300 text-xs sm:text-sm">
            Score: <strong className="text-yellow-400 tabular-nums">{totalScore}</strong>
          </div>
        </div>

        {/* QUESTION - Direct, no subtitle */}
        <h3 className="text-2xl sm:text-3xl font-bold text-white" style={{ textShadow: '0 0 10px rgba(0, 255, 255, 0.5)' }}>
          {currentQuestion.question}
        </h3>

        {/* SUBTITLE - Minimal */}
        <p className="text-cyan-300/70 text-xs sm:text-sm italic">
          What did most people say?
        </p>

        {/* ANSWER BUTTONS */}
        <div className="grid grid-cols-1 gap-2">
          {currentQuestion.choices.map((choice) => {
            const isWinner = choice.text === winnerText;
            const isSelected = selectedChoice === choice.text;
            const animIndex = animationOrder.findIndex(c => c.text === choice.text);
            const { className, glow } = getButtonStateStyle(isWinner, isSelected, revealState, barsComplete);

            return (
              <button
                key={choice.text}
                disabled={revealState}
                onClick={() => handleGuess(choice.text)}
                className={`${className} relative overflow-hidden`}
                style={glow}
              >
                <AnimatePresence>
                  {revealState && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${choice.percentage}%` }}
                      transition={{
                        duration: TIMING.BAR_DURATION,
                        delay: animIndex * TIMING.BAR_DELAY,
                        ease: "easeOut"
                      }}
                      className={`absolute inset-0 z-0 h-full transition-colors duration-500 ${getBarBgColor(isWinner, isSelected, barsComplete)}`}
                    />
                  )}
                </AnimatePresence>

                <div className="relative z-10 flex justify-between items-center">
                  <span>{choice.text}</span>
                  {revealState && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: (animIndex * TIMING.BAR_DELAY) + 0.5 }}
                      className={`text-xs font-bold ${getPercentageTextColor(isWinner, barsComplete)}`}
                    >
                      {choice.percentage}%
                    </motion.span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
});

HiveMind.displayName = 'HiveMind';
export default HiveMind;