/**
 * GameSession.tsx - NEON EDITION
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Trophy, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  createGameSession,
  completeGameSession,
  saveAllRoundResults,
  getGameId
} from '../lib/supabaseHelpers';
import { anonymousSessionManager } from '../lib/anonymousSession';
import GameWrapper from './GameWrapper';
import OddManOut from './OddManOut';
import PhotoMystery from './PhotoMystery.jsx';
import RankAndRoll from './RankAndRoll';
import SnapShot from './SnapShot';
import SplitDecision from './SplitDecision';
import WordRescue from './WordRescue';
import ShapeSequence from './ShapeSequence';
import Snake from './Snake';
import UpYours from './UpYours';
import FakeOut from './FakeOut';
import HiveMind from './HiveMind';
import SlopeRider from './SlopeRider';
import NeuralPulse from './NeuralPulse';
import ZenGravity from './ZenGravity';
import Superlative from './Superlative';
import TrueFalse from './TrueFalse';
import MultipleChoice from './MultipleChoice';
import Tracer from './Tracer';
import Clutch from './Clutch';
import Flashbang from './Flashbang';
import RoundResults from './RoundResults';
import CelebrationScreen from './CelebrationScreen';
import AuthModal from './AuthModal';
import { scoringSystem, calculateSessionScore, getSessionGrade, GameScore, applyTimeBonus } from '../lib/scoringSystem';
import { analytics } from '../lib/analytics';
import ReactGA from 'react-ga4';

interface GameConfig {
  id: string;
  name: string;
  component: React.ComponentType<any>;
  duration: number;
  instructions: string;
  dbId?: number;
}

const GAME_REGISTRY: GameConfig[] = [
  { id: 'odd-man-out',     dbId: 3,  name: 'Odd Man Out',      component: OddManOut,       duration: 60,  instructions: "Select the 2 items that don't belong" },
  { id: 'photo-mystery',   dbId: 4,  name: 'Zooma',            component: PhotoMystery,    duration: 45,  instructions: 'Identify the photo as it zooms out' },
  { id: 'rank-and-roll',   dbId: 5,  name: 'Ranky',            component: RankAndRoll,     duration: 90,  instructions: 'Arrange items in the correct order' },
  { id: 'snapshot',        dbId: 6,  name: 'SnapShot',         component: SnapShot,        duration: 30,  instructions: 'Drag 4 pieces to complete the puzzle' },
  { id: 'split-decision',  dbId: 7,  name: 'Split Decision',   component: SplitDecision,   duration: 60,  instructions: 'Categorize items: A, B, or BOTH' },
  { id: 'word-rescue',               name: 'WordSurge',        component: WordRescue,      duration: 90,  instructions: 'Click falling letters to make words' },
  { id: 'shape-sequence',            name: 'Simple',           component: ShapeSequence,   duration: 60,  instructions: 'Watch and repeat the pattern' },
  { id: 'snake',           dbId: 12, name: 'Snake',            component: Snake,           duration: 75,  instructions: 'Eat food, avoid walls and yourself' },
  { id: 'gravity-ball',              name: 'Gravity Ball',     component: UpYours,         duration: 90,  instructions: 'Tilt to steer, bounce higher on gold springs' },
  { id: 'fake-out',        dbId: 15, name: 'Fake Out',         component: FakeOut,         duration: 60,  instructions: 'Identify if the photo is real or AI-generated' },
  { id: 'hive-mind',       dbId: 13, name: 'Hive Mind',        component: HiveMind,        duration: 60,  instructions: 'Guess what most people chose in each survey' },
  { id: 'slope-rider',               name: 'Slope Rider',      component: SlopeRider,      duration: 90,  instructions: 'Tilt to carve down the slope, dodge obstacles, collect coins' },
  { id: 'neural-pulse',              name: 'Neural Pulse',     component: NeuralPulse,     duration: 90,  instructions: 'Explore the cave, find the glowing exit to advance. Swipe or use arrows.' },
  { id: 'zen-gravity',               name: 'Balls',            component: ZenGravity,      duration: 60,  instructions: 'Tilt your phone to sort marbles into matching colored goals.' },
  { id: 'superlative',     dbId: 16, name: 'Superlative',      component: Superlative,     duration: 90,  instructions: 'Pick which item is bigger, heavier, longer, or older!' },
  { id: 'true-false',                name: 'True or False',    component: TrueFalse,       duration: 90,  instructions: 'Decide if each statement is True or False!' },
  { id: 'multiple-choice',           name: 'Multiple Choice',  component: MultipleChoice,  duration: 90,  instructions: 'Pick the correct answer from three options!' },
  { id: 'tracer',                    name: 'Tracer',           component: Tracer,          duration: 120, instructions: 'Memorize the shape, then trace it from memory!' },
  { id: 'clutch',                    name: 'Clutch',           component: Clutch,          duration: 60,  instructions: 'Tap when the ring hits the sweet spot!' },
  { id: 'flashbang',                 name: 'Flashbang',        component: Flashbang,       duration: 45,  instructions: 'Memorize the lit tiles, then tap them from memory!' },
];

const AVAILABLE_GAMES = GAME_REGISTRY;

const GAME_ID_TO_SLUG: { [key: number]: string } = Object.fromEntries(
  GAME_REGISTRY.filter(g => g.dbId !== undefined).map(g => [g.dbId!, g.id])
);

type PlaylistRoundMetadata =
  | { type: 'procedural'; game_slug: string }
  | { type: 'multi-puzzle'; puzzle_ids: number[] }
  | Record<string, never>;

interface PlaylistRound {
  round_number: number;
  game_id: number | null;
  puzzle_id: number | null;
  ranking_puzzle_id: number | null;
  superlative_puzzle_id: number | null;
  metadata: PlaylistRoundMetadata;
  game_name: string;
}

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
  playlistId?: number;
}

export default function GameSession({ onExit, totalRounds = 5, playlistId }: GameSessionProps) {
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
  const [playlistGames, setPlaylistGames] = useState<string[]>([]);
  // Start loading true if playlist is provided to prevent race condition
  const [playlistLoading, setPlaylistLoading] = useState(!!playlistId);
  const [playlistRounds, setPlaylistRounds] = useState<PlaylistRound[]>([]);
  const [playlistName, setPlaylistName] = useState<string>('');
  const [currentGameSlug, setCurrentGameSlug] = useState<string | null>(null);
  const [currentPuzzleId, setCurrentPuzzleId] = useState<number | null>(null);
  const [currentPuzzleIds, setCurrentPuzzleIds] = useState<number[] | null>(null);
  const [currentRankingPuzzleId, setCurrentRankingPuzzleId] = useState<number | null>(null);
  const [currentSuperlativePuzzleId, setCurrentSuperlativePuzzleId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const currentSessionScore = useMemo(
    () => roundScores.reduce((sum, r) => sum + (r.normalizedScore.totalWithBonus || r.normalizedScore.normalizedScore), 0),
    [roundScores]
  );

  const loadRound = (roundNumber: number, rounds: PlaylistRound[]) => {
    const round = rounds.find(r => r.round_number === roundNumber);
    if (!round) {
      console.error('❌ Round not found:', roundNumber, 'Available rounds:', rounds.map(r => r.round_number));
      setPlaylistLoading(false);
      return;
    }

    let gameSlug: string | null = null;

    if (round.game_id) {
      gameSlug = GAME_ID_TO_SLUG[round.game_id];
      if (!gameSlug) {
        console.error('❌ No mapping found for game_id:', round.game_id, 'Available mappings:', Object.keys(GAME_ID_TO_SLUG));
      }
    } else if ('game_slug' in round.metadata) {
      gameSlug = round.metadata.game_slug;
    }

    if (!gameSlug) {
      console.error('❌ Could not determine game slug for round:', {
        round_number: roundNumber,
        game_id: round.game_id,
        game_name: round.game_name,
        metadata: round.metadata
      });
      setPlaylistLoading(false);
      return;
    }

    console.log(`📍 Loading Round ${roundNumber}:`, {
      gameSlug,
      game_id: round.game_id,
      puzzle_id: round.puzzle_id,
      ranking_puzzle_id: round.ranking_puzzle_id,
      game_name: round.game_name,
      metadata: round.metadata
    });

    setCurrentGameSlug(gameSlug);

    if ('puzzle_ids' in round.metadata) {
      console.log(`✅ Found ${round.metadata.puzzle_ids.length} puzzle IDs in metadata:`, round.metadata.puzzle_ids);
      setCurrentPuzzleIds(round.metadata.puzzle_ids);
      setCurrentPuzzleId(null);
    } else {
      setCurrentPuzzleId(round.puzzle_id);
      setCurrentPuzzleIds(null);  // Clear array
    }

    setCurrentRankingPuzzleId(round.ranking_puzzle_id);
    setCurrentSuperlativePuzzleId(round.superlative_puzzle_id ?? null);
    setPlaylistLoading(false);
  };

  const loadPlaylist = async () => {
    if (!playlistId) {
      console.error('❌ No playlist ID provided');
      setPlaylistLoading(false);
      return;
    }

    setPlaylistLoading(true);
    console.log('🎮 Loading playlist:', playlistId);

    try {
      const { data: playlist, error: playlistError } = await supabase
        .from('playlists')
        .select('id, name, description')
        .eq('id', playlistId)
        .maybeSingle();

      if (playlistError) {
        console.error('❌ Playlist query error:', playlistError);
        throw playlistError;
      }

      if (!playlist) {
        console.error('❌ Playlist not found:', playlistId);
        setLoadError('Playlist not found. Returning to menu...');
        setPlaylistLoading(false);
        setTimeout(onExit, 2000);
        return;
      }

      setPlaylistName(playlist.name);
      console.log('✅ Playlist found:', playlist.name);

      const { data: rounds, error: roundsError } = await supabase
        .from('playlist_rounds')
        .select('round_number, game_id, puzzle_id, ranking_puzzle_id, superlative_puzzle_id, metadata')
        .eq('playlist_id', playlistId)
        .order('round_number');

      if (roundsError) {
        console.error('❌ Playlist rounds query error:', roundsError);
        throw roundsError;
      }

      if (!rounds || rounds.length === 0) {
        console.error('❌ No rounds found for playlist:', playlistId);
        setLoadError('No rounds configured for this playlist. Returning to menu...');
        setPlaylistLoading(false);
        setTimeout(onExit, 2000);
        return;
      }

      console.log('✅ Found', rounds.length, 'rounds');

      const gameIds = rounds
        .map(r => r.game_id)
        .filter(id => id !== null);

      const { data: games } = await supabase
        .from('games')
        .select('id, name')
        .in('id', gameIds);

      console.log('✅ Loaded game names for', games?.length || 0, 'games');

      const transformedRounds: PlaylistRound[] = rounds.map(r => ({
        round_number: r.round_number,
        game_id: r.game_id,
        puzzle_id: r.puzzle_id,
        ranking_puzzle_id: r.ranking_puzzle_id,
        superlative_puzzle_id: r.superlative_puzzle_id ?? null,
        metadata: (r.metadata || {}) as PlaylistRoundMetadata,
        game_name: games?.find(g => g.id === r.game_id)?.name || 'Procedural Game'
      }));

      setPlaylistRounds(transformedRounds);
      console.log('✅ Playlist loaded:', playlist.name, transformedRounds.length, 'rounds');

      loadRound(1, transformedRounds);
      setGameState('intro');
    } catch (error) {
      console.error('❌ Error loading playlist:', error);
      setLoadError('Could not load playlist. Returning to menu...');
      setPlaylistLoading(false);
      setTimeout(onExit, 2000);
    }
  };

  // Load playlist if playlistId is provided
  useEffect(() => {
    console.log('📋 GameSession mounted/updated. playlistId:', playlistId);
    if (playlistId) {
      loadPlaylist();
    } else {
      console.log('⚠️ No playlistId provided, using random game mode');
      setPlaylistLoading(false);
    }
  }, [playlistId]);

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

      const isPerfectGame = session.percentage === 100;

      analytics.gameCompleted(
        'Game Session',
        Math.round(session.totalScore),
        isPerfectGame,
        playtimeSeconds
      );

      analytics.sessionDuration(
        'Game Session',
        playtimeSeconds,
        roundScores.length,
        roundScores.length
      );

      if (!user?.id) {
        setPendingSessionData(sessionData);

        if (playlistId) {
          anonymousSessionManager.update({
            currentPlaylistId: playlistId,
            completedRounds: roundScores.length,
            roundScores: sessionData.results.map(r => ({
              gameId: r.gameId.toString(),
              gameName: roundScores.find(rs => getGameId(rs.gameId) === r.gameId)?.gameName || '',
              rawScore: r.rawScore,
              maxScore: r.maxScore,
              normalizedScore: r.normalizedScore,
              grade: r.grade
            }))
          });
        }
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
  }, [gameState, user?.id, sessionId, roundScores, sessionSaved, playlistId]);

  const selectRandomGame = () => {
    if (playlistId && currentGameSlug) {
      console.log(`🎯 Looking for playlist game with slug: "${currentGameSlug}"`);
      const nextGame = AVAILABLE_GAMES.find(g => g.id === currentGameSlug);
      if (nextGame) {
        setCurrentGame(nextGame);
        setPlayedGames(prev => [...prev, nextGame.id]);
        console.log(`✅ Playing playlist game (Round ${currentRound}):`, nextGame.name, `(${nextGame.id})`);
        return;
      } else {
        console.error('❌ Game not found for slug:', currentGameSlug);
        console.log('Available game IDs:', AVAILABLE_GAMES.map(g => g.id));
      }
    }

    console.log(`🎲 Selecting random game for round ${currentRound}`);
    const availableGames = AVAILABLE_GAMES.filter(
      game => !playedGames.includes(game.id)
    );

    const gamesToChooseFrom = availableGames.length > 0 ? availableGames : AVAILABLE_GAMES;
    const randomGame = gamesToChooseFrom[Math.floor(Math.random() * gamesToChooseFrom.length)];

    setCurrentGame(randomGame);
    setPlayedGames(prev => [...prev, randomGame.id]);
    console.log(`✅ Selected random game:`, randomGame.name, `(${randomGame.id})`);
  };

  const startRound = () => {
    setCurrentGameScore({ score: 0, maxScore: 0 });
    setGameState('playing');

    if (currentGame) {
      analytics.gameStarted(currentGame.name, getGameId(currentGame.id));
    }
  };

  const handleScoreUpdate = useCallback((score: number, maxScore: number) => {
    setCurrentGameScore({ score, maxScore });
  }, []);

  const handleGameComplete = (rawScore: number, maxScore: number, timeRemaining: number = 0) => {
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
        normalizedScore = scoringSystem.rankAndRoll(rawScore, maxScore);
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
        normalizedScore = scoringSystem.zooma(rawScore, maxScore);
        break;

      case 'snapshot':
        const completed = rawScore >= 50;
        normalizedScore = scoringSystem.snapshot(completed, timeRemaining, currentGame.duration);
        break;

      case 'snake':
        normalizedScore = scoringSystem.snake(rawScore);
        break;

      case 'gravity-ball':
        normalizedScore = scoringSystem.gravityBall(rawScore);
        break;

      case 'neural-pulse':
        normalizedScore = scoringSystem.neuralPulse(rawScore);
        break;

      case 'zen-gravity':
        normalizedScore = scoringSystem.oddManOut(rawScore, maxScore);
        break;

      case 'superlative':
        normalizedScore = scoringSystem.superlative(rawScore, maxScore);
        break;

      case 'true-false':
        normalizedScore = scoringSystem.superlative(rawScore, maxScore);
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

    // Apply time bonus if there's time remaining (but NOT for Snake or Gravity Ball)
    if (timeRemaining > 0 && currentGame.duration > 0 && currentGame.id !== 'snake' && currentGame.id !== 'gravity-ball') {
      normalizedScore = applyTimeBonus(normalizedScore, timeRemaining, currentGame.duration);
    }

    setRoundScores(prev => [...prev, {
      gameId: currentGame.id,
      gameName: currentGame.name,
      rawScore,
      maxScore,
      normalizedScore
    }]);

    const finalScore = normalizedScore.totalWithBonus || normalizedScore.normalizedScore;
    const isPerfect = normalizedScore.grade === 'A';
    const isSuccess = normalizedScore.grade !== 'D' && normalizedScore.grade !== 'F';

    analytics.puzzleCompleted(
      currentGame.name,
      currentRound,
      1,
      Math.round(finalScore),
      timeRemaining,
      isPerfect
    );

    analytics.roundScore(
      currentGame.name,
      currentRound,
      Math.round(finalScore),
      100,
      1
    );

    analytics.roundSuccess(
      currentGame.name,
      currentRound,
      isSuccess,
      Math.round(finalScore),
      currentGame.duration - timeRemaining
    );

    // Track round completion with detailed info
    const timeSpent = currentGame.duration - timeRemaining;
    analytics.roundCompleted(
      currentGame.name,
      currentRound,
      Math.round(finalScore),
      isPerfect,
      timeSpent
    );

    setGameState('results');
  };

  const handleNextRound = () => {
    // Track that user clicked continue on results screen
    const lastRoundScore = roundScores[roundScores.length - 1];
    if (lastRoundScore) {
      ReactGA.event({
        category: 'Game',
        action: 'results_continued',
        label: `${lastRoundScore.gameName} - Round ${currentRound}`,
        game_name: lastRoundScore.gameName,
        round_number: currentRound,
        score: Math.round(lastRoundScore.normalizedScore.totalWithBonus || lastRoundScore.normalizedScore.normalizedScore),
      });
    }

    if (currentRound >= totalRounds) {
      setGameState('complete');
    } else {
      const nextRound = currentRound + 1;
      console.log(`⏭️  Moving to round ${nextRound}`);
      setCurrentRound(nextRound);
      setCurrentGame(null);
      setCurrentGameScore({ score: 0, maxScore: 0 });

      if (playlistId && playlistRounds.length > 0) {
        console.log(`📋 Loading playlist round ${nextRound}`);
        loadRound(nextRound, playlistRounds);
        setGameState('intro');
      } else {
        setGameState('playing');
      }
    }
  };

  const handleSkipGame = () => {
    if (currentGame) {
      console.log(`Game skipped: ${currentGame.name}`);

      // Track game skip
      ReactGA.event({
        category: 'Game',
        action: 'game_skipped',
        label: `${currentGame.name} - Round ${currentRound}`,
        game_name: currentGame.name,
        round_number: currentRound,
        user_id: user?.id,
      });

      handleGameComplete(0, 100);
    }
  };

  const handleQuitAndSave = async () => {
    const completedRounds = roundScores.length;
    const playtimeSeconds = sessionStartTimeRef.current
      ? Math.round((Date.now() - sessionStartTimeRef.current) / 1000)
      : 0;

    analytics.gameAbandoned(
      currentGame?.name || 'Unknown',
      currentRound,
      1,
      Math.round(currentSessionScore),
      playtimeSeconds
    );

    // Additional tracking for quit with user info
    ReactGA.event({
      category: 'Game',
      action: 'quit_and_save',
      label: `${currentGame?.name || 'Unknown'} - Round ${currentRound}`,
      game_name: currentGame?.name,
      round_number: currentRound,
      completed_rounds: completedRounds,
      session_score: Math.round(currentSessionScore),
      playtime_seconds: playtimeSeconds,
      user_id: user?.id,
    });

    if (user?.id && sessionId) {
      try {
        const avgScore = completedRounds > 0 ? currentSessionScore / completedRounds : 0;
        const percentage = avgScore;
        const grade = getSessionGrade(percentage);

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

  // Select game when entering intro screen for any round
  // CRITICAL: Don't select game while playlist is loading to avoid race condition
  useEffect(() => {
    if (gameState === 'intro' && !currentGame && !playlistLoading) {
      console.log(`🎬 Intro screen: Selecting game for round ${currentRound}`);
      selectRandomGame();
    }
  }, [gameState, currentRound, currentGame, playlistLoading]);

  // Fallback: Select game when entering playing state without a game (shouldn't happen with playlist)
  useEffect(() => {
    if (gameState === 'playing' && !currentGame && !playlistLoading) {
      console.log(`🎮 No game selected for round ${currentRound}, selecting now`);
      selectRandomGame();
    }
  }, [gameState, currentGame, playlistLoading]);

  // Auto-advance from intro to playing after 4 seconds (works for all rounds in intro)
  useEffect(() => {
    if (gameState === 'intro' && currentGame) {
      console.log(`⏱️ Starting ${currentGame.name} in 4 seconds...`);
      const timer = setTimeout(() => startRound(), 4000);
      return () => clearTimeout(timer);
    }
  }, [gameState, currentGame]);

  // Intro screen (shows before each round in playlist mode)
  if (gameState === 'intro') {

    // Wait for game to be selected or playlist to load
    if (!currentGame || playlistLoading || loadError) {
      return (
        <div className="h-screen w-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <Star className="w-16 h-16 text-cyan-400 animate-pulse mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 20px #00ffff)' }} />
            {loadError
              ? <p className="text-red-400 text-sm max-w-xs mx-auto">{loadError}</p>
              : playlistLoading
                ? <p className="text-cyan-300 text-sm">Loading playlist...</p>
                : <p className="text-cyan-300 text-sm">Loading round...</p>
            }
          </div>
        </div>
      );
    }

    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-4 sm:p-6">
        {/* ROWDY BRANDING - TOP */}
        <div className="mb-8 sm:mb-12">
          <p className="text-6xl sm:text-8xl font-black text-red-500" style={{ textShadow: '0 0 40px #ef4444', letterSpacing: '0.12em' }}>
            ROWDY
          </p>
        </div>

        <div className="text-center max-w-2xl w-full">
          <div className="mb-6 sm:mb-8">
            <Star className="w-16 h-16 sm:w-24 sm:h-24 mx-auto text-cyan-400 animate-pulse" style={{ filter: 'drop-shadow(0 0 20px #00ffff)' }} />
          </div>
          {playlistId && playlistName && (
            <div className="mb-2">
              <span className="inline-block px-3 py-1 text-xs bg-yellow-400/20 border border-yellow-400 text-yellow-300 rounded-full font-semibold" style={{ boxShadow: '0 0 10px rgba(251, 191, 36, 0.3)' }}>
                {playlistName}
              </span>
            </div>
          )}
          <h1 className="text-4xl sm:text-6xl font-bold text-cyan-400 mb-3 sm:mb-4" style={{ textShadow: '0 0 20px #00ffff' }}>Round {currentRound}</h1>
          <h2 className="text-2xl sm:text-3xl font-bold text-pink-400 mb-4" style={{ textShadow: '0 0 15px #ec4899' }}>{currentGame.name}</h2>
          <p className="text-lg sm:text-xl text-cyan-300 mb-6 sm:mb-8">{currentGame.instructions}</p>
          {currentSessionScore > 0 && (
            <div className="mb-4">
              <p className="text-sm text-cyan-400">Session Score: <span className="font-bold text-yellow-400">{Math.round(currentSessionScore)}</span></p>
            </div>
          )}
          <div className="bg-black border-2 border-cyan-400 rounded-lg p-4 sm:p-6 backdrop-blur" style={{ boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)' }}>
            <p className="text-xs sm:text-sm text-cyan-400">Starting in a moment...</p>
          </div>
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

    return (
      <RoundResults
        roundNumber={currentRound}
        gameName={lastRound.gameName}
        gameScore={lastRound.normalizedScore}
        gameId={lastRound.gameId}
        allRoundScores={roundScores.map(r => ({ gameId: r.gameId, gameName: r.gameName, score: r.normalizedScore }))}
        totalSessionScore={Math.round(currentSessionScore)}
        maxSessionScore={currentRound * 100}
        onContinue={handleNextRound}
        isLastRound={currentRound >= totalRounds}
      />
    );
  }

  const getGradeLabel = (score: number): string => {
    if (score >= 100) return "Perfect";
    if (score >= 90) return "Amazeballs!";
    if (score >= 80) return "Exceptional";
    if (score >= 70) return "Very Good";
    if (score >= 60) return "Well Done";
    if (score >= 50) return "Above Average";
    if (score >= 40) return "Pretty Good";
    if (score >= 30) return "Needs Improvement";
    if (score >= 20) return "Keep Trying";
    if (score >= 10) return "Ouch!";
    if (score > 0) return "Poor";
    return "Didn't Even Try!";
  };

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
    console.log('🎊 COMPLETE SCREEN - Game Scores:', gameScores);
    console.log('🎊 Session Total:', sessionTotal);

    const celebrationTiles = roundScores.map((round, idx) => ({
      gameId: round.gameId,
      gameName: round.gameName,
      score: round.normalizedScore,
    }));

    const handlePlayAgain = () => {
      if (!user && !sessionSaved) {
        if (playlistId && !anonymousSessionManager.isLastPlaylist()) {
          anonymousSessionManager.advanceToNextPlaylist();
        }
      }
      onExit();
    };

    return (
      <div>
        <CelebrationScreen
          roundScores={celebrationTiles}
          totalSessionScore={sessionTotal.totalScore}
          maxSessionScore={sessionTotal.maxPossible}
          onPlayAgain={handlePlayAgain}
        />
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

  // Loading screen between rounds
  if (gameState === 'playing' && !currentGame) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-center px-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-cyan-400 mb-4 mx-auto" style={{ boxShadow: '0 0 15px rgba(0, 255, 255, 0.5)' }}></div>
          <p className="text-cyan-400 text-base" style={{ textShadow: '0 0 10px #00ffff' }}>Loading Round {currentRound}...</p>
        </div>
      </div>
    );
  }

  // Playing state - NEON NAV BAR (REFACTORED)
  if (gameState === 'playing' && currentGame) {
    const GameComponent = currentGame.component;
    const previousRoundsScore = currentSessionScore;

    let currentGameNormalizedScore = 0;
    if (currentGameScore.maxScore > 0) {
      const percentage = (currentGameScore.score / currentGameScore.maxScore) * 100;
      currentGameNormalizedScore = percentage;
    }

    const totalSessionScore = previousRoundsScore + currentGameNormalizedScore;
    const maxPossibleScore = currentRound * 100;

    // Shared neon button styling - DRY consolidation
    const neonButtonBase = "flex-shrink-0 bg-transparent border-2 border-cyan-400 text-cyan-400 rounded text-xs sm:text-sm font-semibold transition-all hover:text-black active:scale-95 touch-manipulation";
    const neonButtonStyle = { textShadow: '0 0 8px #00ffff', boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)' };

    return (
      <div className="h-screen w-screen bg-black flex flex-col">
        {/* NEON NAVIGATION BAR - REFACTORED */}
        <div className="flex-shrink-0 bg-black px-2 sm:px-4 py-2 border-b-2 border-cyan-400/40" style={{ boxShadow: '0 2px 15px rgba(0, 255, 255, 0.2)' }}>
          <div className="flex justify-between items-center max-w-6xl mx-auto relative">
            {/* Left: Game info */}
            <div className="text-cyan-400 min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs leading-tight">Round {currentRound} of {totalRounds}</p>
              <p className="text-xs sm:text-sm font-bold truncate leading-tight" style={{ textShadow: '0 0 8px #00ffff' }}>{currentGame.name}</p>
            </div>

            {/* Center: Rowdy Branding (RED) - Absolutely centered */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <p className="text-2xl sm:text-4xl font-black text-red-500" style={{ textShadow: '0 0 25px #ef4444', letterSpacing: '0.08em' }}>
                ROWDY
              </p>
            </div>

            {/* Right: Score + Action buttons */}
            <div className="flex-shrink-0 flex items-center gap-1 sm:gap-2 ml-auto">
              <div className="text-right mr-1">
                <p className="text-[9px] sm:text-[10px] text-cyan-400 leading-tight">Score</p>
                <p className="text-sm sm:text-base font-bold text-yellow-400 leading-tight" style={{ textShadow: '0 0 10px #fbbf24' }}>
                  {Math.round(totalSessionScore)}/
                  <span className="text-cyan-400/60 text-xs sm:text-sm">{maxPossibleScore}</span>
                </p>
              </div>
              {/* Arrow button for next game */}
              <button
                onClick={handleSkipGame}
                className={`${neonButtonBase} px-2 sm:px-2.5 py-1 sm:py-1.5`}
                style={neonButtonStyle}
                title="Skip to next game"
              >
                →
              </button>

              {/* Menu button */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className={`${neonButtonBase} px-2 sm:px-2.5 py-1 sm:py-1.5`}
                  style={neonButtonStyle}
                  title="Menu"
                >
                  ⋮
                </button>

                {/* Dropdown menu */}
                {showMenu && (
                  <div 
                    className="absolute right-0 mt-1 bg-black border-2 border-cyan-400 rounded shadow-lg z-50 min-w-max"
                    style={{ boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)' }}
                  >
                    <button
                      onClick={() => {
                        handleQuitAndSave();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs sm:text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors whitespace-nowrap"
                    >
                      Quit & Save
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Game Content */}
        <div className="flex-1 overflow-auto">
          <GameWrapper
            duration={currentGame.duration}
            onComplete={handleGameComplete}
            gameName={currentGame.name}
            onScoreUpdate={handleScoreUpdate}
          >
            <GameComponent
              puzzleId={currentGame.id === 'superlative' ? currentSuperlativePuzzleId : currentPuzzleId}
              puzzleIds={currentPuzzleIds}
              rankingPuzzleId={currentRankingPuzzleId}
            />
          </GameWrapper>
        </div>
      </div>
    );
  }

  return null;
}