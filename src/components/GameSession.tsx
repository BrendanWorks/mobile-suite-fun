import React, { useState, useEffect } from 'react';
import { Trophy, Star } from 'lucide-react';
import GameWrapper from './GameWrapper';
import EmojiMaster from './EmojiMaster';
import OddManOut from './OddManOut';
import PhotoMystery from './PhotoMystery';
import RankAndRoll from './RankAndRoll';
import DalmatianPuzzle from './DalmatianPuzzle';
import SplitDecision from './SplitDecision';
import WordRescue from './WordRescue';
import ShapeSequence from './ShapeSequence';
import PolysphereGame from './PolysphereGame';
import RoundResults from './RoundResults';

interface GameConfig {
  id: string;
  name: string;
  component: React.ComponentType<any>;
  maxScore: number;
}

const AVAILABLE_GAMES: GameConfig[] = [
  { id: 'emoji-master', name: 'Emoji Master', component: EmojiMaster, maxScore: 100 },
  { id: 'odd-man-out', name: 'Odd Man Out', component: OddManOut, maxScore: 100 },
  { id: 'photo-mystery', name: 'Photo Mystery', component: PhotoMystery, maxScore: 100 },
  { id: 'rank-and-roll', name: 'Rank & Roll', component: RankAndRoll, maxScore: 100 },
  { id: 'dalmatian-puzzle', name: 'Dalmatian Puzzle', component: DalmatianPuzzle, maxScore: 100 },
  { id: 'split-decision', name: 'Split Decision', component: SplitDecision, maxScore: 100 },
  { id: 'word-rescue', name: 'Word Rescue', component: WordRescue, maxScore: 100 },
  { id: 'shape-sequence', name: 'Shape Sequence', component: ShapeSequence, maxScore: 100 },
  { id: 'polysphere', name: 'Polysphere', component: PolysphereGame, maxScore: 100 },
];

interface GameSessionProps {
  onExit: () => void;
  totalRounds?: number;
}

export default function GameSession({ onExit, totalRounds = 5 }: GameSessionProps) {
  const [currentRound, setCurrentRound] = useState(1);
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'results' | 'complete'>('intro');
  const [currentGame, setCurrentGame] = useState<GameConfig | null>(null);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [playedGames, setPlayedGames] = useState<string[]>([]);

  const totalScore = roundScores.reduce((sum, score) => sum + score, 0);
  const maxPossibleScore = currentRound * 100;

  const selectRandomGame = () => {
    const availableGames = AVAILABLE_GAMES.filter(
      game => !playedGames.includes(game.id)
    );

    const gamesToChooseFrom = availableGames.length > 0 ? availableGames : AVAILABLE_GAMES;
    const randomGame = gamesToChooseFrom[Math.floor(Math.random() * gamesToChooseFrom.length)];

    setCurrentGame(randomGame);
    setPlayedGames(prev => [...prev, randomGame.id]);
  };

  const startRound = () => {
    selectRandomGame();
    setGameState('playing');
  };

  const handleGameComplete = (score: number) => {
    setRoundScores(prev => [...prev, score]);
    setGameState('results');
  };

  const handleNextRound = () => {
    if (currentRound >= totalRounds) {
      setGameState('complete');
    } else {
      setCurrentRound(prev => prev + 1);
      setGameState('intro');
    }
  };

  useEffect(() => {
    if (gameState === 'intro' && currentRound === 1) {
      const timer = setTimeout(() => startRound(), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (gameState === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-gray-900 flex items-center justify-center p-6">
        <div className="text-center max-w-2xl">
          <div className="mb-8">
            <Star className="w-24 h-24 mx-auto text-yellow-400 animate-pulse" />
          </div>
          <h1 className="text-6xl font-bold text-white mb-4">Round {currentRound}</h1>
          <p className="text-2xl text-gray-300 mb-8">Get ready for the next challenge!</p>
          <div className="bg-white/10 rounded-lg p-6 backdrop-blur">
            <p className="text-lg text-gray-200">Current Score: <span className="font-bold text-yellow-400">{totalScore}</span></p>
            <p className="text-sm text-gray-400 mt-2">Round {currentRound} of {totalRounds}</p>
          </div>
          <button
            onClick={startRound}
            className="mt-8 px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xl transition-all transform hover:scale-105"
          >
            Start Round
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'results') {
    const lastScore = roundScores[roundScores.length - 1] || 0;
    return (
      <RoundResults
        roundNumber={currentRound}
        roundScore={lastScore}
        maxRoundScore={100}
        totalScore={totalScore}
        maxTotalScore={maxPossibleScore}
        gameName={currentGame?.name || ''}
        onContinue={handleNextRound}
        isLastRound={currentRound >= totalRounds}
      />
    );
  }

  if (gameState === 'complete') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center p-6">
        <div className="text-center max-w-2xl">
          <div className="mb-8">
            <Trophy className="w-32 h-32 mx-auto text-yellow-400 animate-bounce" />
          </div>
          <h1 className="text-6xl font-bold text-white mb-4">Game Complete!</h1>
          <div className="bg-white/10 rounded-lg p-8 backdrop-blur mb-8">
            <p className="text-4xl font-bold text-yellow-400 mb-4">{totalScore}</p>
            <p className="text-xl text-gray-200">out of {maxPossibleScore} possible points</p>
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="text-lg text-gray-300 mb-2">Performance</p>
              <div className="text-3xl font-bold text-white">
                {Math.round((totalScore / maxPossibleScore) * 100)}%
              </div>
            </div>
          </div>
          <button
            onClick={onExit}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xl transition-all transform hover:scale-105"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'playing' && currentGame) {
    const GameComponent = currentGame.component;
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
          <div className="flex justify-between items-center max-w-6xl mx-auto">
            <div className="text-white">
              <p className="text-sm text-gray-400">Round {currentRound} of {totalRounds}</p>
              <p className="text-lg font-bold">{currentGame.name}</p>
            </div>
            <div className="text-right text-white">
              <p className="text-sm text-gray-400">Total Score</p>
              <p className="text-2xl font-bold text-yellow-400">{totalScore}</p>
            </div>
          </div>
        </div>
        <div className="p-6 max-w-4xl mx-auto">
          <GameWrapper
            duration={60}
            onComplete={handleGameComplete}
            gameName={currentGame.name}
          >
            <GameComponent />
          </GameWrapper>
        </div>
      </div>
    );
  }

  return null;
}
