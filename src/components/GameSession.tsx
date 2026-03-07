/**
 * GameSession.tsx - NEON EDITION (with mobile audio unlock)
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Trophy, Star, Search, Camera, Triangle, Users, Check,
  ArrowUpDown, Shuffle, CircleX, Layers, BookOpen,
  Gamepad2, Zap, ThumbsUp
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
import RoundResults from './RoundResults';
import CelebrationScreen from './CelebrationScreen';
import AuthModal from './AuthModal';
import { scoringSystem, calculateSessionScore, getSessionGrade, GameScore, applyTimeBonus, applyPerfectScoreBonus } from '../lib/scoringSystem';
import { analytics } from '../lib/analytics';
import ReactGA from 'react-ga4';
import { audioManager } from '../path/to/AudioManager';  // Adjust import path as needed

interface GameConfig {
  id: string;
  name: string;
  component: React.ComponentType<any>;
  duration: number;
  instructions: string;
  dbId?: number;
}

const GAME_REGISTRY: GameConfig[] = [
  // ... (your full GAME_REGISTRY array remains unchanged)
  // Omitted for brevity — keep your original list here
];

const AVAILABLE_GAMES = GAME_REGISTRY;

const GAME_ICONS: { [key: string]: JSX.Element } = {
  // ... (your GAME_ICONS remain unchanged)
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

  // NEW: Audio unlock on first user interaction (critical for iOS Safari)
  useEffect(() => {
    const unlockHandler = async () => {
      console.log('User interacted — attempting audio unlock');
      const unlocked = await audioManager.unlockAudio(true); // silent prime
      if (unlocked) {
        console.log('Audio unlocked successfully for mobile');
        // Optional: If sounds were preloaded early, reload them post-unlock
        // await audioManager.reloadAll();
      } else {
        console.warn('Audio unlock failed — sounds may not play on iOS');
      }
    };

    // Listen for touch/click/pointer events (touchend is most reliable on iOS)
    const events = ['touchend', 'click', 'pointerup'];
    events.forEach(event => {
      document.addEventListener(event, unlockHandler, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, unlockHandler);
      });
    };
  }, []);

  const currentSessionScore = useMemo(
    () => roundScores.reduce((sum, r) => sum + (r.normalizedScore.totalWithBonus || r.normalizedScore.normalizedScore), 0),
    [roundScores]
  );

  // ... (loadRound, loadPlaylist, useEffects for playlist, user, session creation, etc. remain mostly unchanged)

  // Keep your existing useEffects for loading, session creation, saving, etc.
  // Omitted for brevity in this paste — insert your original logic here for:
  // - loadPlaylist
  // - useEffect for playlistId
  // - useEffect for user/auth
  // - useEffect for session creation
  // - useEffect for 7-second timer
  // - useEffect for saving on complete
  // - selectRandomGame
  // - startRound
  // - handleScoreUpdate
  // - handleGameComplete
  // - handleNextRound
  // - handleSkipGame
  // - handleQuitAndSave

  // Intro, results, complete, playing renders remain the same
  // Just ensure GameWrapper and individual games use audioManager.play(...)

  if (gameState === 'intro') {
    // ... (your intro screen JSX unchanged)
  }

  if (gameState === 'results') {
    // ... (your results JSX unchanged)
  }

  if (gameState === 'complete') {
    // ... (your complete JSX unchanged)
  }

  if (gameState === 'playing' && !currentGame) {
    // ... (loading screen unchanged)
  }

  if (gameState === 'playing' && currentGame) {
    const GameComponent = currentGame.component;
    const neonButtonBase = "flex-shrink-0 bg-transparent border-2 border-cyan-400 text-cyan-400 rounded text-xs sm:text-sm font-semibold transition-all hover:text-black active:scale-95 touch-manipulation";
    const neonButtonStyle = { textShadow: '0 0 8px #00ffff', boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)' };

    return (
      <div className="h-screen w-screen bg-black flex flex-col">
        {/* NEON NAV BAR */}
        <div className="flex-shrink-0 bg-black px-2 sm:px-4 py-2 border-b-2 border-cyan-400/40" style={{ boxShadow: '0 2px 15px rgba(0, 255, 255, 0.2)' }}>
          {/* ... your nav bar JSX unchanged */}
        </div>

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