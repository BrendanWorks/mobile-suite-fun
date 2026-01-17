import React, { useState, useEffect } from 'react';
import { Trophy, Star } from 'lucide-react';
import GameWrapper from './GameWrapper';
import OddManOut from './OddManOut';
import PhotoMystery from './PhotoMystery';
import RankAndRoll from './RankAndRoll';
import DalmatianPuzzle from './DalmatianPuzzle';
import SplitDecision from './SplitDecision';
import WordRescue from './WordRescue';
import ShapeSequence from './ShapeSequence';
import RoundResults from './RoundResults';
import { scoringSystem, calculateSessionScore, getSessionGrade, GameScore } from '../lib/scoringSystem';

interface GameConfig {
  id: string;
  name: string;
  component: React.ComponentType<any>;
}

const AVAILABLE_GAMES: GameConfig[] = [
  { id: 'odd-man-out', name: 'Odd Man Out', component: OddManOut },
  { id: 'photo-mystery', name: 'Zooma', component: PhotoMystery },
  { id: 'rank-and-roll', name: 'Ranky', component: RankAndRoll },
  { id: 'dalmatian-puzzle', name: 'Dalmatian Puzzle', component: DalmatianPuzzle },
  { id: 'split-decision', name: 'Split Decision', component: SplitDecision },
  { id: 'word-rescue', name: 'Pop', component: WordRescue },
  { id: 'shape-sequence', name: 'Shape Sequence', component: ShapeSequence },
];

interface GameSessionProps {
  onExit: () => void;
  totalRounds?: number;
}

interface RoundData {
  gameId: string;
  gameName: string;
  score: GameScore;
}

export default function GameSession({ onExit, totalRounds = 5 }: GameSessionProps) {
  const [currentRound, setCurrentRound] = useState(1);
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'results' | 'complete'>('intro');
  const [currentGame, setCurrentGame] = useState<GameConfig | null>(null);
  const [roundScores, setRoundScores] = useState<RoundData[]>([]);
  const [playedGames, setPlayedGames] = useState<string[]>([]);

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

  const handleGameComplete = (rawScore: number) => {
    if (!currentGame) return;

    // Convert raw score to normalized GameScore based on game type
    let gameScore: GameScore;

    switch (currentGame.id) {
      case 'odd-man-out':
        // Rough estimate: rawScore is 0-100 already from accuracy
        gameScore = scoringSystem.oddManOut(Math.round(rawScore), 100);
        break;
      case 'rank-and-roll':
        gameScore = scoringSystem.rankAndRoll(rawScore);
        break;
      case 'shape-sequence':
        gameScore = scoringSystem.shapeSequence(rawScore);
        break;
      case 'split-decision':
        // rawScore is already percentage, convert back
        const accuracy = rawScore / 100;
        gameScore = scoringSystem.splitDecision(
          Math.round(accuracy * 10),
          Math.round((1 - accuracy) * 10)
        );
        break;
      case 'word-rescue':
        gameScore = scoringSystem.pop(rawScore);
        break;
      case 'photo-mystery':
        gameScore = scoringSystem.zooma(rawScore);
        break;
      case 'dalmatian-puzzle':
        // For now, treat as incomplete if score < 50
        gameScore = scoringSystem.dalmatian(rawScore >= 50, 30, 60);
        break;
      default:
        gameScore = { gameId: '', gameName: '', rawScore: 0, normalizedScore: 0, grade: 'D', breakdown: '' };
    }

    setRoundScores(prev => [...prev, { gameId: currentGame.id, gameName: currentGame.name, score: gameScore }]);
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
  }, [gameState, currentRound]);

  if (gameState === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-gray-900 flex items-center justify-center p-6">
        <div className="text-center max-w-2xl">
          <div className="mb-8">
            <Star className="w-24 h-24 mx-auto text-yellow-400 animate-pulse" />
          </div>
          <h1 className="text-6xl font-bold text-white mb-4">Round {currentRound}</h1>
          <p className="text-2xl text-gray-300 mb-8">Get ready for the next challenge!</p>
          <div className="bg-white/10 rounded-lg p-6 backdrop-blur mb-8">
            <p className="text-lg text-gray-200 mb-2">Current Score: <span className="font-bold text-yellow-400">{Math.round(roundScores.reduce((sum, r) => sum + r.score.normalizedScore, 0))}</span></p>
            <p className="text-sm text-gray-400">Round {currentRound} of {totalRounds}</p>
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

  if (gameState === 'results' && roundScores.length > 0) {
    const lastRound = roundScores[roundScores.length - 1];
    const totalSessionScore = roundScores.reduce((sum, r) => sum + r.score.normalizedScore, 0);
    const maxPossibleRounds = currentRound * 100;
    
    return (
      <RoundResults
        roundNumber={currentRound}
        gameName={lastRound.gameName}
        gameScore={lastRound.score}
        allRoundScores={roundScores}
        totalSessionScore={Math.round(totalSessionScore)}
        maxSessionScore={maxPossibleRounds}
        onContinue={handleNextRound}
        isLastRound={currentRound >= totalRounds}
      />
    );
  }

  if (gameState === 'complete') {
    const sessionTotal = calculateSessionScore(roundScores.map(r => r.score));
    const sessionGrade = getSessionGrade(sessionTotal.percentage);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center p-6">
        <div className="text-center max-w-2xl">
          <div className="mb-8">
            <Trophy className="w-32 h-32 mx-auto text-yellow-400 animate-bounce" />
          </div>
          <h1 className="text-6xl font-bold text-white mb-4">Game Complete!</h1>
          <div className="bg-white/10 rounded-lg p-8 backdrop-blur mb-8">
            <div className="mb-4">
              <p className="text-4xl font-bold text-yellow-400 mb-2">{sessionTotal.totalScore}</p>
              <p className="text-xl text-gray-200">out of {sessionTotal.maxPossible} possible points</p>
            </div>
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="text-lg text-gray-300 mb-2">Performance</p>
              <div className="text-3xl font-bold text-white mb-4">
                {sessionTotal.percentage}% - Grade: <span className="text-yellow-400">{sessionGrade}</span>
              </div>
            </div>

            {/* Game Breakdown */}
            <div className="mt-6 pt-6 border-t border-white/20 text-left">
              <p className="text-lg text-gray-300 mb-3 font-bold">Game Scores:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {roundScores.map((round, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white/10 p-2 rounded">
                    <span className="text-white">{idx + 1}. {round.gameName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-cyan-400">{Math.round(round.score.normalizedScore)}/100</span>
                      <span className={`font-bold w-8 text-center ${
                        round.score.grade === 'S' ? 'text-yellow-400' :
                        round.score.grade === 'A' ? 'text-green-400' :
                        round.score.grade === 'B' ? 'text-blue-400' :
                        round.score.grade === 'C' ? 'text-orange-400' :
                        'text-red-400'
                      }`}>
                        {round.score.grade}
                      </span>
                    </div>
                  </div>
                ))}
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
              <p className="text-sm text-gray-400">Session Score</p>
              <p className="text-2xl font-bold text-yellow-400">
                {Math.round(roundScores.reduce((sum, r) => sum + r.score.normalizedScore, 0))}/
                <span className="text-gray-400">{currentRound * 100}</span>
              </p>
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