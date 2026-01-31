/**
 * GameSession.tsx - WITH NEXT GAME & QUIT/SAVE BUTTONS
 * 
 * Paste this into bolt.new to replace your current GameSession.tsx
 */

import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  createGameSession,
  completeGameSession,
  saveAllRoundResults,
  getGameId
} from '../lib/supabaseHelpers';
import GameWrapper from './GameWrapper';
import OddManOut from './OddManOut';
import PhotoMystery from './PhotoMystery.jsx';
import RankAndRoll from './RankAndRoll';
import DalmatianPuzzle from './DalmatianPuzzle';
import SplitDecision from './SplitDecision';
import WordRescue from './WordRescue';
import ShapeSequence from './ShapeSequence';
import Snake from './Snake';
import RoundResults from './RoundResults';
import AuthModal from './AuthModal';
import { scoringSystem, calculateSessionScore, getSessionGrade, GameScore } from '../lib/scoringSystem';

interface GameConfig {
  id: string;
  name: string;
  component: React.ComponentType<any>;
  duration: number;
}

const AVAILABLE_GAMES: GameConfig[] = [
  { id: 'odd-man-out', name: 'Odd Man Out', component: OddManOut, duration: 60 },
  { id: 'photo-mystery', name: 'Zooma', component: PhotoMystery, duration: 45 },
  { id: 'rank-and-roll', name: 'Ranky', component: RankAndRoll, duration: 90 },
  { id: 'dalmatian-puzzle', name: 'Dalmatian Puzzle', component: DalmatianPuzzle, duration: 60 },
  { id: 'split-decision', name: 'Split Decision', component: SplitDecision, duration: 60 },
  { id: 'word-rescue', name: 'Pop', component: WordRescue, duration: 90 },
  { id: 'shape-sequence', name: 'Shape Sequence', component: ShapeSequence, duration: 60 },
  { id: 'snake', name: 'Snake', component: Snake, duration: 75 },
];

interface RoundData {
  gameId: string;
  gameName: string;
  rawScore: number;
  maxScore: number;
  normalizedScore: GameScore;
}

interface GameSessionProps {
  onExit: () => void;
  totalRounds?: number;
}

export default function GameSession({ onExit, totalRounds = 5 }: GameSessionProps) {
  const [user, setUser] = useState<any>(null);
  const [currentRound, setCurrentRound] = useState(1);
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'results' | 'complete'>('intro');
  const [currentGame, setCurrentGame] = useState<GameConfig | null>(null);
  const [roundScores, setRoundScores] = useState<RoundData[]>([]);
  const [playedGames, setPlayedGames] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionSaved, setSessionSaved] = useState(false);
  const sessionStartTimeRef = useRef<number | null>(null);
  const [currentGameScore, setCurrentGameScore] = useState<{ score: number; maxScore: number }>({ score: 0, maxScore: 0 });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingSessionData, setPendingSessionData] = useState<any>(null);
  const [sevenSecondsElapsed, setSevenSecondsElapsed] = useState(false);

  // Get current user on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const newUser = session?.user;
      setUser(newUser);

      if (newUser && pendingSessionData && !sessionSaved) {
        try {
          const { success, data } = await createGameSession(newUser.id);
          if (success && data) {
            const newSessionId = data.id;
            console.log('✅ Game session created for new user:', newSessionId);

            const completeResult = await completeGameSession(
              newSessionId,
              pendingSessionData.session.totalScore,
              pendingSessionData.session.maxPossible,
              pendingSessionData.session.percentage,
              pendingSessionData.grade,
              pendingSessionData.results.length,
              pendingSessionData.playtimeSeconds
            );

            if (completeResult.success) {
              console.log('✅ Session saved after login');
            }

            const resultsSuccess = await saveAllRoundResults(newSessionId, newUser.id, pendingSessionData.results);
            if (resultsSuccess.success) {
              console.log('✅ Round results saved after login');
            }

            setSessionId(newSessionId);
            setSessionSaved(true);
            setPendingSessionData(null);
            setShowAuthModal(false);
          }
        } catch (error) {
          console.error('Error saving pending session:', error);
        }
      }
    });

    return () => subscription?.unsubscribe();
  }, [pendingSessionData, sessionSaved]);

  // Create game session when starting
  useEffect(() => {
    if (user?.id && gameState === 'intro' && currentRound === 1 && !sessionId) {
      const initSession = async () => {
        try {
          const { success, data } = await createGameSession(user.id);
          if (success && data) {
            setSessionId(data.id);
            sessionStartTimeRef.current = Date.now();
            console.log('✅ Game session created:', data.id);
          }
        } catch (error) {
          console.error('Error creating game session:', error);
        }
      };

      initSession();
    }
  }, [user?.id, gameState, currentRound, sessionId]);

  // Start 7-second timer when game completes
  useEffect(() => {
    if (gameState === 'complete') {
      setSevenSecondsElapsed(false);
      const timer = setTimeout(() => {
        setSevenSecondsElapsed(true);
        if (!user?.id && !sessionSaved && pendingSessionData) {
          setShowAuthModal(true);
        }
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  // Save complete session when finished
  useEffect(() => {
    if (gameState === 'complete' && !sessionSaved) {
      const gameScores = roundScores.map(r => r.normalizedScore);
      const session = calculateSessionScore(gameScores);
      const grade = getSessionGrade(session.percentage);
      const playtimeSeconds = sessionStartTimeRef.current
        ? Math.round((Date.now() - sessionStartTimeRef.current) / 1000)
        : 0;

      const sessionData = {
        gameScores,
        session,
        grade,
        playtimeSeconds,
        results: roundScores.map((r, idx) => ({
          gameId: getGameId(r.gameId),
          puzzleId: 0,
          roundNumber: idx + 1,
          rawScore: r.rawScore,
          maxScore: r.maxScore,
          normalizedScore: Math.round(r.normalizedScore.normalizedScore),
          grade: r.normalizedScore.grade
        }))
      };

      if (!user?.id) {
        setPendingSessionData(sessionData);
      } else if (sessionId) {
        const saveToSupabase = async () => {
          try {
            const completeResult = await completeGameSession(
              sessionId,
              sessionData.session.totalScore,
              sessionData.session.maxPossible,
              sessionData.session.percentage,
              sessionData.grade,
              roundScores.length,
              sessionData.playtimeSeconds
            );

            if (completeResult.success) {
              console.log('✅ Session completed:', {
                sessionId,
                totalScore: sessionData.session.totalScore,
                percentage: sessionData.session.percentage,
                grade: sessionData.grade,
                playtimeSeconds: sessionData.playtimeSeconds
              });
            }

            const resultsSuccess = await saveAllRoundResults(sessionId, user.id, sessionData.results);
            if (resultsSuccess.success) {
              console.log('✅ Round results saved:', sessionData.results.length, 'rounds');
            }

            setSessionSaved(true);
          } catch (error) {
            console.error('Error saving session:', error);
          }
        };

        saveToSupabase();
      }
    }
  }, [gameState, user?.id, sessionId, roundScores, sessionSaved]);

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
    setCurrentGameScore({ score: 0, maxScore: 0 });
    setGameState('playing');
  };

  const handleScoreUpdate = (score: number, maxScore: number) => {
    setCurrentGameScore({ score, maxScore });
  };

  const handleGameComplete = (rawScore: number, maxScore: number) => {
    if (!currentGame) {
      console.error('Invalid game completion: no currentGame, skipping to next round');
      handleNextRound();
      return;
    }

    if (maxScore === 0 || !isFinite(maxScore)) {
      console.warn('Game completed with invalid maxScore, using default values', { maxScore, rawScore });
      maxScore = 100;
      rawScore = 0;
    }

    let normalizedScore: GameScore;
    const percentage = (rawScore / maxScore) * 100;

    switch (currentGame.id) {
      case 'odd-man-out':
        normalizedScore = scoringSystem.oddManOut(rawScore, maxScore);
        break;

      case 'rank-and-roll':
        normalizedScore = scoringSystem.rankAndRoll(rawScore);
        break;

      case 'shape-sequence':
        normalizedScore = scoringSystem.shapeSequence(rawScore);
        break;

      case 'split-decision':
        normalizedScore = scoringSystem.splitDecision(rawScore, maxScore - rawScore);
        break;

      case 'word-rescue':
        normalizedScore = scoringSystem.pop(rawScore);
        break;

      case 'photo-mystery':
        normalizedScore = scoringSystem.zooma(rawScore);
        break;

      case 'dalmatian-puzzle':
        normalizedScore = scoringSystem.dalmatian(rawScore >= 50, maxScore - rawScore, maxScore);
        break;

      case 'snake':
        normalizedScore = scoringSystem.snake(rawScore);
        break;

      default:
        normalizedScore = {
          gameId: '',
          gameName: '',
          rawScore: 0,
          normalizedScore: 0,
          grade: 'D',
          breakdown: ''
        };
    }

    console.log(`Round ${currentRound} - ${currentGame.name}: ${Math.round(normalizedScore.normalizedScore)}/100 (${normalizedScore.grade})`);

    setRoundScores(prev => [...prev, {
      gameId: currentGame.id,
      gameName: currentGame.name,
      rawScore,
      maxScore,
      normalizedScore
    }]);

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

  const handleSkipGame = () => {
    // Skip current game with 0 score
    if (currentGame) {
      console.log(`Game skipped: ${currentGame.name}`);
      handleGameComplete(0, 100);
    }
  };

  const handleQuitAndSave = async () => {
    // Save current progress before quitting
    const currentSessionScore = roundScores.reduce((sum, r) => sum + r.normalizedScore.normalizedScore, 0);
    const completedRounds = roundScores.length;
    
    if (user?.id && sessionId) {
      try {
        // Calculate grade based on completed rounds
        const avgScore = completedRounds > 0 ? currentSessionScore / completedRounds : 0;
        const percentage = avgScore;
        const grade = getSessionGrade(percentage);
        const playtimeSeconds = sessionStartTimeRef.current
          ? Math.round((Date.now() - sessionStartTimeRef.current) / 1000)
          : 0;

        await completeGameSession(
          sessionId,
          Math.round(currentSessionScore),
          completedRounds * 100,
          percentage,
          grade,
          completedRounds,
          playtimeSeconds
        );

        const results = roundScores.map((r, idx) => ({
          gameId: getGameId(r.gameId),
          puzzleId: 0,
          roundNumber: idx + 1,
          rawScore: r.rawScore,
          maxScore: r.maxScore,
          normalizedScore: Math.round(r.normalizedScore.normalizedScore),
          grade: r.normalizedScore.grade
        }));

        await saveAllRoundResults(sessionId, user.id, results);
        console.log('✅ Progress saved on quit:', { completedRounds, score: currentSessionScore });
      } catch (error) {
        console.error('Error saving progress on quit:', error);
      }
    }
    
    onExit();
  };

  useEffect(() => {
    if (gameState === 'intro' && currentRound === 1) {
      const timer = setTimeout(() => startRound(), 2000);
      return () => clearTimeout(timer);
    }
  }, [gameState, currentRound]);

  // Intro screen
  if (gameState === 'intro') {
    const currentSessionScore = roundScores.reduce((sum, r) => sum + r.normalizedScore.normalizedScore, 0);

    return (
      <div className="h-screen w-screen bg-gradient-to-br from-blue-900 via-slate-900 to-gray-900 flex items-center justify-center p-4 sm:p-6">
        <div className="text-center max-w-2xl w-full">
          <div className="mb-6 sm:mb-8">
            <Star className="w-16 h-16 sm:w-24 sm:h-24 mx-auto text-yellow-400 animate-pulse" />
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-3 sm:mb-4">Round {currentRound}</h1>
          <p className="text-lg sm:text-2xl text-gray-300 mb-6 sm:mb-8">Get ready for the next challenge!</p>
          <div className="bg-white/10 rounded-lg p-4 sm:p-6 backdrop-blur mb-6 sm:mb-8">
            <p className="text-base sm:text-lg text-gray-200 mb-2">Session Score: <span className="font-bold text-yellow-400">{Math.round(currentSessionScore)}/{currentRound * 100}</span></p>
            <p className="text-xs sm:text-sm text-gray-400">Round {currentRound} of {totalRounds}</p>
          </div>
          <button
            onClick={startRound}
            className="mt-6 sm:mt-8 px-8 py-4 bg-green-600 active:bg-green-700 text-white font-bold rounded-lg text-lg sm:text-xl transition-all active:scale-[0.98] touch-manipulation"
          >
            Start Round
          </button>
        </div>
      </div>
    );
  }

  // Results screen
  if (gameState === 'results') {
    if (roundScores.length === 0) {
      console.error('Results screen with no scores, advancing to next round');
      handleNextRound();
      return null;
    }

    const lastRound = roundScores[roundScores.length - 1];
    const currentSessionScore = roundScores.reduce((sum, r) => sum + r.normalizedScore.normalizedScore, 0);

    return (
      <RoundResults
        roundNumber={currentRound}
        gameName={lastRound.gameName}
        gameScore={lastRound.normalizedScore}
        allRoundScores={roundScores.map(r => ({ gameId: r.gameId, gameName: r.gameName, score: r.normalizedScore }))}
        totalSessionScore={Math.round(currentSessionScore)}
        maxSessionScore={currentRound * 100}
        onContinue={handleNextRound}
        isLastRound={currentRound >= totalRounds}
      />
    );
  }

  // Complete screen
  if (gameState === 'complete') {
    if (roundScores.length === 0) {
      console.error('Complete screen with no scores, returning to menu');
      onExit();
      return null;
    }

    const gameScores = roundScores.map(r => r.normalizedScore);
    const sessionTotal = calculateSessionScore(gameScores);
    const sessionGrade = getSessionGrade(sessionTotal.percentage);

    return (
      <div className="h-screen w-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex flex-col p-3 sm:p-6">
        <div className="max-w-2xl w-full mx-auto flex flex-col flex-1 min-h-0">
          {/* Compact Header */}
          <div className="text-center mb-3 sm:mb-4 flex-shrink-0">
            <Trophy className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-yellow-400 mb-2" />
            <h1 className="text-2xl sm:text-4xl font-bold text-white mb-1">Game Complete!</h1>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto mb-3">
            <div className="bg-white/10 rounded-xl p-3 sm:p-4 backdrop-blur">
              {/* Hero Score */}
              <div className="text-center mb-3 pb-3 border-b border-white/20">
                <div className="text-5xl sm:text-6xl font-bold text-yellow-400 mb-1">
                  {sessionGrade}
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white mb-1">
                  {sessionTotal.totalScore}
                </p>
                <p className="text-xs sm:text-sm text-gray-300">
                  out of {sessionTotal.maxPossible} possible points
                </p>
              </div>

              {/* Overall Performance */}
              <div className="text-center mb-3 pb-3 border-b border-white/20">
                <p className="text-xs sm:text-sm text-gray-300 mb-1">Overall Performance</p>
                <div className="text-xl sm:text-2xl font-bold text-cyan-400">
                  {sessionTotal.percentage}%
                </div>
              </div>

              {/* Game Breakdown - Compact */}
              <div className="mb-3">
                <p className="text-xs sm:text-sm text-gray-300 mb-2 font-semibold">Game Breakdown:</p>
                <div className="space-y-1">
                  {roundScores.map((round, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white/5 px-2 py-1.5 rounded text-xs sm:text-sm">
                      <span className="text-white truncate flex-1 mr-2">{idx + 1}. {round.gameName}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-cyan-400 font-bold">{Math.round(round.normalizedScore.normalizedScore)}/100</span>
                        <span className={`font-bold w-6 sm:w-7 text-center rounded px-1 py-0.5 text-xs ${
                          round.normalizedScore.grade === 'S' ? 'bg-yellow-400/30 text-yellow-400' :
                          round.normalizedScore.grade === 'A' ? 'bg-green-400/30 text-green-400' :
                          round.normalizedScore.grade === 'B' ? 'bg-blue-400/30 text-blue-400' :
                          round.normalizedScore.grade === 'C' ? 'bg-orange-400/30 text-orange-400' :
                          'bg-red-400/30 text-red-400'
                        }`}>
                          {round.normalizedScore.grade}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Messages */}
              {sessionSaved && (
                <div className="p-2 bg-green-500/20 border border-green-500/30 rounded text-xs text-green-200">
                  ✅ Score saved
                </div>
              )}

              {!user && !sessionSaved && (
                <div className="p-2 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-200">
                  Sign in to save your score!
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons - Always Visible */}
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            {!user && !sessionSaved && (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex-1 px-4 py-3 bg-green-600 active:bg-green-700 text-white font-bold rounded-lg text-sm sm:text-base transition-all active:scale-[0.98] touch-manipulation"
              >
                Sign In to Save
              </button>
            )}
            <button
              onClick={onExit}
              className="flex-1 px-4 py-3 bg-blue-600 active:bg-blue-700 text-white font-bold rounded-lg text-sm sm:text-base transition-all active:scale-[0.98] touch-manipulation"
            >
              {!user && !sessionSaved ? 'Continue Without Saving' : 'Back to Menu'}
            </button>
          </div>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onContinueAsGuest={() => {
            setPendingSessionData(null);
          }}
        />
      </div>
    );
  }

  // Playing state
  if (gameState === 'playing' && currentGame) {
    const GameComponent = currentGame.component;
    const previousRoundsScore = roundScores.reduce((sum, r) => sum + r.normalizedScore.normalizedScore, 0);

    let currentGameNormalizedScore = 0;
    if (currentGameScore.maxScore > 0) {
      const percentage = (currentGameScore.score / currentGameScore.maxScore) * 100;
      currentGameNormalizedScore = percentage;
    }

    const totalSessionScore = previousRoundsScore + currentGameNormalizedScore;
    const maxPossibleScore = currentRound * 100;

    return (
      <div className="h-screen w-screen bg-gray-900 flex flex-col">
        <div className="flex-shrink-0 bg-gray-800 px-2 sm:px-6 py-1.5 sm:py-4 border-b border-gray-700">
          <div className="flex justify-between items-center max-w-6xl mx-auto gap-1.5 sm:gap-3">
            {/* Left: Skip button */}
            <button
              onClick={handleSkipGame}
              className="flex-shrink-0 px-2 sm:px-4 py-1 sm:py-2 bg-yellow-600 hover:bg-yellow-700 active:bg-yellow-800 text-white font-semibold rounded text-xs sm:text-sm transition-colors touch-manipulation"
            >
              Next Game
            </button>

            {/* Center: Game info and score */}
            <div className="flex-1 min-w-0 flex justify-between items-center gap-1 sm:gap-3">
              <div className="text-white min-w-0">
                <p className="text-[10px] sm:text-sm text-gray-400 leading-tight">Round {currentRound} of {totalRounds}</p>
                <p className="text-xs sm:text-base font-bold truncate leading-tight">{currentGame.name}</p>
              </div>
              <div className="text-right text-white flex-shrink-0">
                <p className="text-[9px] sm:text-xs text-gray-400 leading-tight">Session Score</p>
                <p className="text-sm sm:text-xl font-bold text-yellow-400 leading-tight">
                  {Math.round(totalSessionScore)}/
                  <span className="text-gray-400 text-xs sm:text-base">{maxPossibleScore}</span>
                </p>
                {currentGameNormalizedScore > 0 && (
                  <p className="text-[9px] sm:text-xs text-cyan-400 leading-tight">
                    +{Math.round(currentGameNormalizedScore)}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Quit button */}
            <button
              onClick={handleQuitAndSave}
              className="flex-shrink-0 px-2 sm:px-4 py-1 sm:py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-semibold rounded text-xs sm:text-sm transition-colors touch-manipulation"
            >
              Quit & Save
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <GameWrapper
            duration={currentGame.duration}
            onComplete={handleGameComplete}
            gameName={currentGame.name}
            onScoreUpdate={handleScoreUpdate}
          >
            <GameComponent />
          </GameWrapper>
        </div>
      </div>
    );
  }

  return null;
}