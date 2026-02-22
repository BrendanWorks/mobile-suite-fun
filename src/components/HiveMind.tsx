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

    let points = 0;
    if (rank === 0) points = 200;
    else if (rank === 1) points = 100;
    else if (rank === 2) points = 25;

    const newScore = totalScore + points;
    setTotalScore(newScore);
    onScoreUpdate(newScore);

    // 4 bars, sorted low→high, so last bar has animIndex=3: delay=3*0.4=1.2s + duration=0.8s = 2.0s
    const numChoices = currentQuestion.choices.length;
    const lastBarFinish = (numChoices - 1) * 0.4 + 0.8;
    setTimeout(() => {
      setBarsComplete(true);
    }, lastBarFinish * 1000);

    // Move to next or complete after bars finish + 2.5s showcase
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setRevealState(false);
        setBarsComplete(false);
        setSelectedChoice(null);
        setCurrentIndex(prev => prev + 1);
      } else {
        onComplete(newScore);
      }
    }, lastBarFinish * 1000 + 2500);
  };

  if (loading || !currentQuestion) {
    return <div className="flex items-center justify-center h-full text-cyan-400">LOADING SWARM...</div>;
  }

  // Sort for sequential animation (lowest % to highest %)
  const animationOrder = [...currentQuestion.choices].sort((a, b) => a.percentage - b.percentage);
  const winnerText = [...currentQuestion.choices].sort((a, b) => b.percentage - a.percentage)[0].text;

  return (
    <div className="min-h-screen bg-black flex items-start justify-center p-2 pt-2">
      <div className="text-center max-w-2xl w-full text-white select-none">
        {/* Header */}
        <div className="mb-2 sm:mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-cyan-400 mb-1 border-b border-cyan-400 pb-1 flex items-center justify-center gap-2">
            <Users
              className="w-6 h-6 sm:w-7 sm:h-7"
              style={{
                color: '#00ffff',
                filter: 'drop-shadow(0 0 8px rgba(0, 255, 255, 0.6))',
                strokeWidth: 2
              }}
            />
            <span style={{ textShadow: '0 0 10px #00ffff' }}>Hive Mind</span>
          </h2>

          <p className="text-cyan-300 text-xs sm:text-sm mb-2 sm:mb-4">
            They said what?
          </p>

          <div className="flex justify-start items-center mb-2 sm:mb-4 text-sm sm:text-base">
            <div className="text-cyan-300">
              Score: <strong className="text-yellow-400 tabular-nums text-base sm:text-lg">{totalScore}</strong>
            </div>
          </div>
        </div>

        {/* Question Section */}
        <div className="text-center mb-2 sm:mb-4">
          <h3 className="text-sm sm:text-base font-bold text-cyan-400 mb-1" style={{ textShadow: '0 0 10px #00ffff' }}>
            {currentQuestion.question}
          </h3>
          <p className="text-cyan-300/60 text-xs sm:text-sm italic">
            What did most people say?
          </p>
        </div>

        {/* Answer Buttons */}
        <div className="mb-2 sm:mb-4">
          <div className="grid grid-cols-1 gap-2">
            {currentQuestion.choices.map((choice) => {
              const isWinner = choice.text === winnerText;
              const isSelected = selectedChoice === choice.text;
              const animIndex = animationOrder.findIndex(c => c.text === choice.text);

              let buttonClass = "p-2.5 sm:p-3 rounded-lg text-sm sm:text-base font-medium text-left transition-all duration-500 border-2";

              if (barsComplete) {
                if (isWinner) {
                  buttonClass += " bg-green-500/20 border-green-500 text-white";
                } else if (isSelected && !isWinner) {
                  buttonClass += " bg-red-500/20 border-red-500 text-white/70";
                } else {
                  buttonClass += " bg-black/50 border-cyan-400/20 text-gray-400/60";
                }
              } else if (revealState) {
                buttonClass += " bg-black/50 border-cyan-400/30 text-white";
              } else {
                if (isSelected) {
                  buttonClass += " bg-cyan-500/20 border-cyan-400 text-cyan-300";
                } else {
                  buttonClass += " bg-black/50 hover:bg-cyan-500/10 text-white border-cyan-400/30 hover:border-cyan-400";
                }
              }

              const glowStyle = barsComplete && isWinner ? { boxShadow: '0 0 15px rgba(34, 197, 94, 0.5)' } :
                               barsComplete && isSelected && !isWinner ? { boxShadow: '0 0 15px rgba(239, 68, 68, 0.5)' } :
                               isSelected && !revealState ? { boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)' } : {};

              return (
                <button
                  key={choice.text}
                  disabled={revealState}
                  onClick={() => handleGuess(choice.text)}
                  className={`${buttonClass} relative overflow-hidden`}
                  style={glowStyle}
                >
                  <AnimatePresence>
                    {revealState && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${choice.percentage}%` }}
                        transition={{
                          duration: 0.8,
                          delay: animIndex * 0.4,
                          ease: "easeOut"
                        }}
                        className={`absolute inset-0 z-0 h-full transition-colors duration-500 ${
                          barsComplete && isWinner ? 'bg-green-500/30' :
                          barsComplete && isSelected && !isWinner ? 'bg-red-500/20' :
                          'bg-cyan-500/20'
                        }`}
                      />
                    )}
                  </AnimatePresence>

                  <div className="relative z-10 flex justify-between items-center">
                    <span>{choice.text}</span>
                    {revealState && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: (animIndex * 0.4) + 0.5 }}
                        className={`text-xs font-bold ${barsComplete && isWinner ? 'text-green-400' : 'text-white/60'}`}
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

        <div className="mt-auto pt-4 text-center">
          <div className="text-[10px] text-cyan-400/40 uppercase tracking-[0.2em]">
            🐝 Hive Mind System Active
          </div>
        </div>
      </div>
    </div>
  );
});

export default HiveMind;