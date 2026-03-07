import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Trophy, Star, Search, Camera, Triangle, Users, Check,
  ArrowUpDown, Shuffle, CircleX, Layers, BookOpen,
  Gamepad2, Zap, ThumbsUp, X
} from 'lucide-react';
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
import ColorClash from './ColorClash';
import Recall from './Recall';
import DoubleFake from './DoubleFake';
import RoundResults from './RoundResults';
import CelebrationScreen from './CelebrationScreen';
import AuthModal from './AuthModal';
import { scoringSystem, calculateSessionScore, getSessionGrade, GameScore, applyTimeBonus, applyPerfectScoreBonus } from '../lib/scoringSystem';
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
  { id: 'odd-man-out', name: 'Odd Man Out', component: OddManOut, duration: 45, instructions: 'Find what doesn\'t belong', dbId: 3 },
  { id: 'photo-mystery', name: 'Zooma', component: PhotoMystery, duration: 45, instructions: 'Guess the hidden image', dbId: 4 },
  { id: 'rank-and-roll', name: 'Ranky', component: RankAndRoll, duration: 30, instructions: 'Sort by superlatives', dbId: 5 },
  { id: 'snapshot', name: 'SnapShot', component: SnapShot, duration: 60, instructions: 'Complete the jigsaw', dbId: 6 },
  { id: 'split-decision', name: 'Split Decision', component: SplitDecision, duration: 30, instructions: 'Rapid categorization', dbId: 9 },
  { id: 'word-rescue', name: 'Pop', component: WordRescue, duration: 45, instructions: 'Make words from falling letters', dbId: 10 },
  { id: 'shape-sequence', name: 'Shape Sequence', component: ShapeSequence, duration: 45, instructions: 'Remember the pattern', dbId: 11 },
  { id: 'snake', name: 'Snake', component: Snake, duration: 60, instructions: 'Eat pellets and grow', dbId: 12 },
  { id: 'up-yours', name: 'Up Yours', component: UpYours, duration: 30, instructions: 'Guess higher or lower', dbId: 2 },
  { id: 'fake-out', name: 'Fake Out', component: FakeOut, duration: 45, instructions: 'Real photo or AI fake?', dbId: 13 },
  { id: 'hive-mind', name: 'Hive Mind', component: HiveMind, duration: 30, instructions: 'Guess what most people chose', dbId: 14 },
  { id: 'slope-rider', name: 'Slope Rider', component: SlopeRider, duration: 45, instructions: 'Ride the slope without falling', dbId: 15 },
  { id: 'neural-pulse', name: 'Neural Pulse', component: NeuralPulse, duration: 30, instructions: 'Match the pattern', dbId: 16 },
  { id: 'zen-gravity', name: 'Zen Gravity', component: ZenGravity, duration: 45, instructions: 'Balance the objects', dbId: 17 },
  { id: 'superlative', name: 'Superlative', component: Superlative, duration: 45, instructions: 'Pick the bigger, heavier, or older item', dbId: 18 },
  { id: 'true-false', name: 'True/False', component: TrueFalse, duration: 30, instructions: 'Decide if the statement is true', dbId: 19 },
  { id: 'multiple-choice', name: 'Multiple Choice', component: MultipleChoice, duration: 45, instructions: 'Choose the correct answer', dbId: 20 },
  { id: 'tracer', name: 'Tracer', component: Tracer, duration: 45, instructions: 'Follow the pattern', dbId: 21 },
  { id: 'clutch', name: 'Clutch', component: Clutch, duration: 30, instructions: 'Make the clutch decision', dbId: 22 },
  { id: 'flashbang', name: 'Flashbang', component: Flashbang, duration: 45, instructions: 'React quickly to flashes', dbId: 23 },
  { id: 'color-clash', name: 'Color Clash', component: ColorClash, duration: 30, instructions: 'Match colors quickly', dbId: 24 },
  { id: 'recall', name: 'Recall', component: Recall, duration: 45, instructions: 'Remember what you saw', dbId: 25 },
  { id: 'double-fake', name: 'Double Fake', component: DoubleFake, duration: 45, instructions: 'Find the real one among the fakes', dbId: 26 },
];

const AVAILABLE_GAMES = GAME_REGISTRY;

const GAME_ICONS: { [key: string]: JSX.Element } = {
  'odd-man-out': <CircleX className="w-full h-full" />,
  'photo-mystery': <Search className="w-full h-full" />,
  'rank-and-roll': <Trophy className="w-full h-full" />,
  'snapshot': <Camera className="w-full h-full" />,
  'split-decision': <Layers className="w-full h-full" />,
  'word-rescue': <BookOpen className="w-full h-full" />,
  'shape-sequence': <Triangle className="w-full h-full" />,
  'snake': <Zap className="w-full h-full" />,
  'up-yours': <ArrowUpDown className="w-full h-full" />,
  'fake-out': <CircleX className="w-full h-full" />,
  'hive-mind': <Users className="w-full h-full" />,
  'superlative': <Check className="w-full h-full" />,
};

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

  const loadPlaylist = useCallback(async () => {
    if (!playlistId) return;
    try {
      const { data: playlist, error: playlistError } = await supabase
        .from('playlists')
        .select('name')
        .eq('id', playlistId)
        .maybeSingle();

      if (playlistError) throw playlistError;
      if (!playlist) throw new Error('Playlist not found');

      const { data: rounds, error: roundsError } = await supabase
        .from('playlist_rounds')
        .select('*')
        .eq('playlist_id', playlistId)
        .order('round_number');

      if (roundsError) throw roundsError;

      setPlaylistName(playlist.name || '');
      setPlaylistRounds(rounds || []);
      setPlaylistLoading(false);
    } catch (error) {
      console.error('Error loading playlist:', error);
      setLoadError('Failed to load playlist');
      setPlaylistLoading(false);
    }
  }, [playlistId]);

  useEffect(() => {
    if (playlistId) {
      loadPlaylist();
    }
  }, [playlistId, loadPlaylist]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const createSession = async () => {
      const result = await createGameSession(user.id);
      if (result.success && result.data?.id) {
        setSessionId(result.data.id);
        sessionStartTimeRef.current = Date.now();
      }
    };

    createSession();
  }, [user]);

  useEffect(() => {
    if (gameState === 'playing') {
      const timer = setTimeout(() => setSevenSecondsElapsed(true), 7000);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'complete' && sessionId && user && !sessionSaved) {
      const saveSession = async () => {
        const totalScore = currentSessionScore;
        const maxScore = roundScores.length * 100;
        const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
        const grade = getSessionGrade(percentage);
        const playtimeSeconds = sessionStartTimeRef.current ? Math.floor((Date.now() - sessionStartTimeRef.current) / 1000) : 0;

        const roundResults = roundScores.map((round, idx) => ({
          gameId: getGameId(round.gameId),
          puzzleId: currentPuzzleIds?.[idx] || currentPuzzleId || 0,
          roundNumber: idx + 1,
          rawScore: round.rawScore,
          maxScore: round.maxScore,
          normalizedScore: round.normalizedScore.normalizedScore,
          grade: 'A',
        }));

        const completeResult = await completeGameSession(
          sessionId,
          totalScore,
          maxScore,
          percentage,
          grade,
          roundScores.length,
          playtimeSeconds
        );

        if (completeResult.success) {
          await saveAllRoundResults(sessionId, user.id, roundResults);
          setSessionSaved(true);
          analytics.gameSessionCompleted(roundScores.length, totalScore, grade);
        }
      };

      saveSession();
    }
  }, [gameState, sessionId, user, currentSessionScore, roundScores, sessionSaved, currentPuzzleId, currentPuzzleIds]);

  const selectRandomGame = useCallback(() => {
    const availableGames = AVAILABLE_GAMES.filter(game => !playedGames.includes(game.id));
    if (availableGames.length === 0) return AVAILABLE_GAMES[Math.floor(Math.random() * AVAILABLE_GAMES.length)];
    return availableGames[Math.floor(Math.random() * availableGames.length)];
  }, [playedGames]);

  const startRound = useCallback(() => {
    let game: GameConfig | null = null;
    let puzzleId: number | null = null;
    let puzzleIds: number[] | null = null;
    let rankingPuzzleId: number | null = null;
    let superlativePuzzleId: number | null = null;

    if (playlistId && playlistRounds.length > 0) {
      const playlistRound = playlistRounds.find(r => r.round_number === currentRound);
      if (playlistRound && playlistRound.game_id) {
        const gameRegistry = GAME_REGISTRY.find(g => g.dbId === playlistRound.game_id);
        if (gameRegistry) {
          game = gameRegistry;
          puzzleId = playlistRound.puzzle_id;
          rankingPuzzleId = playlistRound.ranking_puzzle_id;
          superlativePuzzleId = playlistRound.superlative_puzzle_id;
          if (playlistRound.metadata?.puzzle_ids) {
            puzzleIds = playlistRound.metadata.puzzle_ids;
          }
        }
      }
    }

    if (!game) {
      game = selectRandomGame();
    }

    setCurrentGame(game);
    setCurrentGameSlug(game.id);
    setCurrentPuzzleId(puzzleId);
    setCurrentPuzzleIds(puzzleIds);
    setCurrentRankingPuzzleId(rankingPuzzleId);
    setCurrentSuperlativePuzzleId(superlativePuzzleId);
    setPlayedGames(prev => [...prev, game.id]);
    setGameState('playing');
    setCurrentGameScore({ score: 0, maxScore: 0 });
  }, [currentRound, playlistId, playlistRounds, selectRandomGame]);

  const handleScoreUpdate = useCallback((score: number, maxScore: number) => {
    setCurrentGameScore({ score, maxScore });
  }, []);

  const handleGameComplete = useCallback((finalScore: number, maxScore: number) => {
    if (!currentGame) return;

    const normalizedScore = scoringSystem.normalizeScore(finalScore, maxScore);
    const scoreWithTimeBonus = applyTimeBonus(normalizedScore, 45);
    const scoreWithPerfectBonus = applyPerfectScoreBonus(scoreWithTimeBonus);

    setRoundScores(prev => [...prev, {
      gameId: currentGame.id,
      gameName: currentGame.name,
      rawScore: finalScore,
      maxScore: maxScore,
      normalizedScore: scoreWithPerfectBonus,
    }]);

    setGameState('results');
  }, [currentGame]);

  const handleNextRound = useCallback(() => {
    const displayRounds = playlistId && playlistRounds.length > 0 ? playlistRounds.length : totalRounds;
    if (currentRound >= displayRounds) {
      setGameState('complete');
    } else {
      setCurrentRound(prev => prev + 1);
      setGameState('intro');
      setCurrentGame(null);
    }
  }, [currentRound, totalRounds, playlistId, playlistRounds]);

  const handleSkipGame = useCallback(() => {
    handleGameComplete(0, 100);
  }, [handleGameComplete]);

  const handleQuitAndSave = useCallback(() => {
    setGameState('complete');
  }, []);

  if (gameState === 'intro') {
    const displayRounds = playlistId && playlistRounds.length > 0 ? playlistRounds.length : totalRounds;
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md">
          <h1 className="text-4xl font-bold text-cyan-400" style={{ textShadow: '0 0 20px #00ffff' }}>
            {playlistName || 'Game Session'}
          </h1>
          <p className="text-xl text-gray-300">
            Round {currentRound} of {displayRounds}
          </p>
          <button
            onClick={startRound}
            className="w-full bg-cyan-500 text-black font-bold py-3 px-4 rounded hover:bg-cyan-400 transition"
          >
            Start Round
          </button>
          <button
            onClick={onExit}
            className="w-full bg-gray-700 text-white font-bold py-3 px-4 rounded hover:bg-gray-600 transition"
          >
            Exit Session
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'results') {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-4">
        <RoundResults
          score={currentGameScore.score}
          maxScore={currentGameScore.maxScore}
          gameName={currentGame?.name || ''}
          onNext={handleNextRound}
        />
      </div>
    );
  }

  if (gameState === 'complete') {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-4">
        <CelebrationScreen
          totalScore={currentSessionScore}
          roundsCompleted={roundScores.length}
          onExit={onExit}
        />
      </div>
    );
  }

  if (gameState === 'playing' && !currentGame) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl" style={{ textShadow: '0 0 20px #00ffff' }}>
          Loading game...
        </div>
      </div>
    );
  }

  if (gameState === 'playing' && currentGame) {
    const GameComponent = currentGame.component;
    const neonButtonBase = "flex-shrink-0 bg-transparent border-2 border-cyan-400 text-cyan-400 rounded text-xs sm:text-sm font-semibold transition-all hover:text-black active:scale-95 touch-manipulation";
    const neonButtonStyle = { textShadow: '0 0 8px #00ffff', boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)' };
    const displayRounds = playlistId && playlistRounds.length > 0 ? playlistRounds.length : totalRounds;

    return (
      <div className="h-screen w-screen bg-black flex flex-col">
        <div className="flex-shrink-0 bg-black px-2 sm:px-4 py-2 border-b-2 border-cyan-400/40" style={{ boxShadow: '0 2px 15px rgba(0, 255, 255, 0.2)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
              <span className="text-cyan-400 font-semibold text-sm sm:text-base">{currentGame.name}</span>
            </div>
            <div className="text-cyan-400 text-xs sm:text-sm font-mono">
              Round {currentRound}/{displayRounds}
            </div>
            <button
              onClick={handleQuitAndSave}
              className={neonButtonBase}
              style={neonButtonStyle}
            >
              <X className="w-4 h-4" />
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
            <GameComponent
              puzzleId={currentPuzzleId}
              puzzleIds={currentPuzzleIds}
              rankingPuzzleId={currentRankingPuzzleId}
              superlativePuzzleId={currentSuperlativePuzzleId}
            />
          </GameWrapper>
        </div>
      </div>
    );
  }

  return null;
}
