import React, { useState, useEffect } from 'react';
import {
  Search, Camera, Triangle, Square, Circle, Users, Check,
  ChartBar, Shuffle, CircleX, Layers, BookOpen, Gamepad2,
  ThumbsUp, Zap, ArrowUpDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
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
import ZenGravity from './ZenGravity';
import Superlative from './Superlative';
import TrueFalse from './TrueFalse';
import MultipleChoice from './MultipleChoice';
import Tracer from './Tracer';
import Clutch from './Clutch';
import Flashbang from './Flashbang';
import Recall from './Recall';
import GameSession from './GameSession';

const GAME_ICONS_LOOKUP: Record<string, React.ReactNode> = {
  'odd-man-out': <CircleX className="w-full h-full" />,
  'photo-mystery': <Search className="w-full h-full" />,
  'rank-and-roll': <ArrowUpDown className="w-full h-full" />,
  'snapshot': <Camera className="w-full h-full" />,
  'split-decision': <Layers className="w-full h-full" />,
  'word-rescue': <BookOpen className="w-full h-full" />,
  'shape-sequence': <Triangle className="w-full h-full" />,
  'snake': <Gamepad2 className="w-full h-full" />,
  'gravity-ball': <Zap className="w-full h-full" />,
  'fake-out': <CircleX className="w-full h-full" />,
  'hive-mind': <Users className="w-full h-full" />,
  'zen-gravity': <Circle className="w-full h-full" />,
  'superlative': <ThumbsUp className="w-full h-full" />,
  'true-false': <Shuffle className="w-full h-full" />,
  'multiple-choice': <Check className="w-full h-full" />,
  'tracer': <Zap className="w-full h-full" />,
  'clutch': <Gamepad2 className="w-full h-full" />,
  'flashbang': <Zap className="w-full h-full" />,
  'recall': <Zap className="w-full h-full" />,
};

interface DebugModeProps {
  onExit: () => void;
}

const TEST_GAMES = [
  { id: 'odd-man-out', name: 'Odd Man Out', duration: 60, component: OddManOut },
  { id: 'photo-mystery', name: 'Zooma', duration: 15, component: PhotoMystery },
  { id: 'rank-and-roll', name: 'Ranky', duration: 30, component: RankAndRoll },
  { id: 'snapshot', name: 'Jigsaw', duration: 60, component: SnapShot },
  { id: 'split-decision', name: 'Split Decision', duration: 60, component: SplitDecision },
  { id: 'word-rescue', name: 'Pop', duration: 90, component: WordRescue },
  { id: 'shape-sequence', name: 'Simple', duration: 60, component: ShapeSequence },
  { id: 'snake', name: 'Snake', duration: 75, component: Snake },
  { id: 'gravity-ball', name: 'Gravity Ball', duration: 90, component: UpYours },
  { id: 'fake-out', name: 'Fake Out', duration: 60, component: FakeOut },
  { id: 'hive-mind', name: 'Hive Mind', duration: 60, component: HiveMind },
  { id: 'zen-gravity', name: 'Zen Gravity', duration: 90, component: ZenGravity },
  { id: 'superlative', name: 'Superlative', duration: 90, component: Superlative },
  { id: 'true-false', name: 'True or False', duration: 90, component: TrueFalse },
  { id: 'multiple-choice', name: 'Multiple Choice', duration: 90, component: MultipleChoice },
  { id: 'tracer', name: 'Tracer', duration: 120, component: Tracer },
  { id: 'clutch', name: 'Clutch', duration: 60, component: Clutch },
  { id: 'flashbang', name: 'Flashbang', duration: 45, component: Flashbang },
  { id: 'recall', name: 'Recall', duration: 60, component: Recall },
];

interface Playlist {
  id: number;
  name: string;
  description: string;
  difficulty: string;
}

export default function DebugMode({ onExit }: DebugModeProps) {
  const [view, setView] = useState<'menu' | 'game' | 'playlist'>('menu');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPlaylists = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('playlists')
          .select('id, name, description, difficulty')
          .eq('is_active', true)
          .order('sequence_order');

        if (error) throw error;
        setPlaylists(data || []);
      } catch (error) {
        console.error('Error loading playlists:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPlaylists();
  }, []);

  if (view === 'playlist' && selectedPlaylistId) {
    return (
      <GameSession
        playlistId={selectedPlaylistId}
        onExit={() => {
          setView('menu');
          setSelectedPlaylistId(null);
        }}
        totalRounds={5}
      />
    );
  }

  if (view === 'game' && selectedGameId) {
    const game = TEST_GAMES.find(g => g.id === selectedGameId);
    if (!game) return null;

    const GameComponent = game.component;

    return (
      <div className="h-screen w-screen bg-gray-900 flex flex-col">
        <div className="flex-shrink-0 bg-gray-800 px-3 sm:px-6 py-2.5 sm:py-4 border-b border-gray-700">
          <div className="flex justify-between items-center max-w-6xl mx-auto gap-3">
            <div className="text-white min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-400">Debug Mode</p>
              <p className="text-base sm:text-lg font-bold truncate">Testing {game.name}</p>
            </div>
            <button
              onClick={() => {
                setView('menu');
                setSelectedGameId(null);
              }}
              className="flex-shrink-0 px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm sm:text-base touch-manipulation"
            >
              Back
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <GameWrapper
            duration={game.duration}
            onComplete={() => {}}
            gameName={game.name}
            onScoreUpdate={() => {}}
          >
            {game.id === 'fake-out' ? (
              <GameComponent puzzleIds={[777, 778, 779, 780, 781]} />
            ) : (
              <GameComponent />
            )}
          </GameWrapper>
        </div>
      </div>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'text-green-400 border-green-400';
      case 'medium': return 'text-yellow-400 border-yellow-400';
      case 'hard': return 'text-red-400 border-red-400';
      default: return 'text-cyan-400 border-cyan-400';
    }
  };

  return (
    <div className="h-screen w-screen bg-black overflow-y-auto">
      <div className="min-h-full p-4 sm:p-6 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-yellow-400" style={{ textShadow: '0 0 20px rgba(251, 191, 36, 0.5)' }}>
              Debug Mode
            </h1>
            <button
              onClick={onExit}
              className="px-4 py-2 bg-transparent border-2 border-red-500 text-red-400 hover:bg-red-500 hover:text-black font-semibold rounded-lg transition-all text-sm sm:text-base touch-manipulation"
              style={{ textShadow: '0 0 8px rgba(239, 68, 68, 0.4)' }}
            >
              Exit
            </button>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4" style={{ textShadow: '0 0 15px rgba(0, 255, 255, 0.4)' }}>
              Test Playlists
            </h2>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-cyan-400 mx-auto"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={() => {
                      setSelectedPlaylistId(playlist.id);
                      setView('playlist');
                    }}
                    className="bg-black border-2 border-cyan-400/50 hover:border-cyan-400 rounded-lg p-4 text-left transition-all active:scale-95 touch-manipulation"
                    style={{ boxShadow: '0 0 10px rgba(0, 255, 255, 0.2)' }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-bold text-cyan-400 flex-1" style={{ textShadow: '0 0 10px rgba(0, 255, 255, 0.4)' }}>
                        {playlist.name}
                      </h3>
                      <span className={`text-xs px-2 py-1 border rounded uppercase font-semibold ${getDifficultyColor(playlist.difficulty)}`}>
                        {playlist.difficulty}
                      </span>
                    </div>
                    <p className="text-cyan-300 text-sm">
                      {playlist.description}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-pink-400 mb-4" style={{ textShadow: '0 0 15px rgba(236, 72, 153, 0.4)' }}>
              Test Individual Games
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {TEST_GAMES.map((game) => (
                <button
                  key={game.id}
                  onClick={() => {
                    setSelectedGameId(game.id);
                    setView('game');
                  }}
                  className="bg-gradient-to-br from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold py-5 sm:py-6 px-3 sm:px-4 rounded-xl shadow-lg transition-all active:scale-95 border-2 border-pink-400/50 touch-manipulation"
                >
                  <div className="text-2xl sm:text-3xl mb-2">
                    {GAME_ICONS_LOOKUP[game.id] ? (
                      <div className="w-8 h-8 mx-auto text-pink-300">
                        {GAME_ICONS_LOOKUP[game.id]}
                      </div>
                    ) : '⚙️'}
                  </div>
                  <div className="text-xs sm:text-sm">{game.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4" style={{ textShadow: '0 0 15px rgba(0, 255, 255, 0.4)' }}>
              Icon Reference
            </h2>
            <div className="bg-black border-2 border-cyan-400/30 rounded-lg p-6">
              <p className="text-cyan-300 text-sm mb-4">Current icon assignments for celebration screen:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(GAME_ICONS_LOOKUP).map(([gameId, icon]) => (
                  <div key={gameId} className="flex flex-col items-center gap-2 p-3 bg-black border border-cyan-400/20 rounded-lg hover:border-cyan-400/50 transition-colors">
                    <div className="w-10 h-10 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px #00ffff)' }}>
                      {icon}
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-cyan-300 font-mono break-words">{gameId}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-500/20 border-2 border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-200">
              Note: Debug mode bypasses normal flow and does not save scores.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}