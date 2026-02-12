import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase'; // Adjust import based on your config
import { motion, AnimatePresence } from 'framer-motion';

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

const HiveMind: React.FC<HiveMindProps> = ({ 
  puzzleId, 
  onScoreUpdate, 
  onComplete, 
  timeRemaining 
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [revealState, setRevealState] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load Data
  useEffect(() => {
    const fetchPuzzle = async () => {
      let query = supabase.from('puzzles').select('*').eq('game_type', 'hive_mind');
      
      if (puzzleId) {
        query = query.eq('id', puzzleId);
      }
      
      const { data, error } = await query.limit(1).single();
      
      if (data && !error) {
        // Assuming metadata contains the questions array
        setQuestions(data.metadata.questions);
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

    // Move to next or complete after 3 seconds (reveal sequence + pause)
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setRevealState(false);
        setSelectedChoice(null);
        setCurrentIndex(prev => prev + 1);
      } else {
        onComplete(newScore);
      }
    }, 4500); // Wait for the staggered bars to finish + 2.5s showcase
  };

  if (loading || !currentQuestion) {
    return <div className="flex items-center justify-center h-full text-cyan-400">LOADING SWARM...</div>;
  }

  // Sort for sequential animation (lowest % to highest %)
  const animationOrder = [...currentQuestion.choices].sort((a, b) => a.percentage - b.percentage);
  const winnerText = [...currentQuestion.choices].sort((a, b) => b.percentage - a.percentage)[0].text;

  return (
    <div className="flex flex-col h-full bg-black p-4 font-mono select-none">
      {/* Header Info */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-xs uppercase tracking-widest text-cyan-400/70">
          Question {currentIndex + 1}/{questions.length}
        </div>
        <div className="text-xl font-bold text-yellow-400" style={{ textShadow: '0 0 10px #fbbf24' }}>
          {totalScore.toLocaleString()}
        </div>
      </div>

      {/* Question Section */}
      <div className="text-center mb-8">
        <h2 className="text-xl sm:text-2xl text-cyan-400 font-bold mb-2 uppercase italic tracking-tighter"
            style={{ textShadow: '0 0 10px #00ffff' }}>
          {currentQuestion.question}
        </h2>
        <p className="text-cyan-300/60 text-xs sm:text-sm italic">
          What did most people say?
        </p>
      </div>

      {/* Answer Buttons */}
      <div className="flex flex-col gap-3 w-full max-w-md mx-auto">
        {currentQuestion.choices.map((choice) => {
          const isWinner = choice.text === winnerText;
          const isSelected = selectedChoice === choice.text;
          const animIndex = animationOrder.findIndex(c => c.text === choice.text);
          
          return (
            <button
              key={choice.text}
              disabled={revealState}
              onClick={() => handleGuess(choice.text)}
              className={`
                relative w-full text-left p-4 border-2 transition-all duration-200 overflow-hidden
                ${revealState ? 'cursor-default' : 'hover:bg-cyan-500/10 active:scale-95'}
                ${isSelected && !revealState ? 'border-yellow-400' : 'border-cyan-400/30'}
                ${revealState && isWinner ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : ''}
                ${revealState && isSelected && !isWinner ? 'border-red-500' : ''}
              `}
            >
              {/* Fill Bar (Animated) */}
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
                    className={`absolute inset-0 z-0 h-full ${
                      isWinner ? 'bg-green-500/30' : 
                      animIndex === 2 ? 'bg-cyan-500/20' : 
                      'bg-white/5'
                    }`}
                  />
                )}
              </AnimatePresence>

              {/* Content */}
              <div className="relative z-10 flex justify-between items-center">
                <span className={`text-sm sm:text-base font-medium ${revealState && !isWinner && !isSelected ? 'text-white/40' : 'text-white'}`}>
                  {choice.text}
                  {revealState && isSelected && isWinner && " 🎯"}
                  {revealState && isSelected && !isWinner && animationOrder.findIndex(c => c.text === choice.text) === 2 && " (Close!)"}
                </span>
                
                {revealState && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: (animIndex * 0.4) + 0.5 }}
                    className={`text-xs font-bold ${isWinner ? 'text-green-400' : 'text-white/60'}`}
                  >
                    {choice.percentage}%
                  </motion.span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-4 text-center">
        <div className="text-[10px] text-cyan-400/40 uppercase tracking-[0.2em]">
          🐝 Hive Mind System Active
        </div>
      </div>
    </div>
  );
};

export default HiveMind;