import React, { useEffect, useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { initGA, trackPageView, analytics } from './lib/analytics';
import { anonymousSessionManager } from './lib/anonymousSession';
import AuthPage from './components/AuthPage';
import GameSession from './components/GameSession';
import LandingPage from './components/LandingPage';
import DebugMode from './components/DebugMode';
import AdminTools from './components/AdminTools';
import { useUserStats } from './hooks/useUserStats';

export type GameId =
  | 'odd-man-out'
  | 'photo-mystery'
  | 'rank-and-roll'
  | 'snapshot'
  | 'split-decision'
  | 'word-rescue'
  | 'shape-sequence'
  | 'snake'
  | 'gravity-ball'
  | 'fake-out'
  | 'hive-mind'
  | 'superlative';

const GLOW_STYLES = {
  cyan: {
    textShadow: '0 0 10px #00ffff',
    boxShadow: '0 0 15px rgba(0, 255, 255, 0.4)',
  },
  yellow: {
    textShadow: '0 0 10px #fbbf24',
    boxShadow: '0 0 15px rgba(251, 191, 36, 0.4)',
  },
  red: {
    textShadow: '0 0 8px #ff0066',
    boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)',
  },
  purple: {
    textShadow: '0 0 8px #c084fc',
    boxShadow: '0 0 15px rgba(192, 132, 252, 0.4)',
  },
  green: {
    textShadow: '0 0 8px #22c55e',
  },
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAuthPage, setShowAuthPage] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [autoStartAfterLogin, setAutoStartAfterLogin] = useState(false);
  const userStats = useUserStats(session?.user?.id);

  // Initialize analytics on mount
  useEffect(() => {
    initGA();
    trackPageView('/');
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        if (error.message.includes('refresh_token_not_found')) {
          await supabase.auth.signOut();
        }
        setSession(null);
        setLoading(false);
        return;
      }

      setSession(session);
      setLoading(false);

      if (session?.user) {
        analytics.signedIn('email', session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (event === 'SIGNED_IN' && session?.user) {
        analytics.signedIn('email', session.user.id);
        setAutoStartAfterLogin(true);
      }

      if (event === 'SIGNED_OUT') {
        analytics.signedOut();
        setSelectedPlaylistId(null);
        setAutoStartAfterLogin(false);
      }

      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && autoStartAfterLogin) {
      setSelectedPlaylistId(anonymousSessionManager.getCurrentPlaylistId());
      setAutoStartAfterLogin(false);
    }
  }, [session, autoStartAfterLogin]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const handlePlayNow = useCallback(() => {
    trackPageView('/game-session');
    setSelectedPlaylistId(anonymousSessionManager.getCurrentPlaylistId());
  }, []);

  const handleSignIn = useCallback(() => {
    setShowAuthPage(true);
  }, []);

  const handleDebugMode = useCallback(() => {
    trackPageView('/debug-mode');
    setDebugMode(true);
  }, []);

  const handlePlayGames = useCallback(() => {
    trackPageView('/game-session');
    setSelectedPlaylistId(anonymousSessionManager.getCurrentPlaylistId());
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-center px-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-red-500 mb-4 mx-auto" style={{ boxShadow: '0 0 15px rgba(239, 68, 68, 0.5)' }}></div>
          <p className="text-red-400 text-base" style={{ textShadow: '0 0 10px rgba(239, 68, 68, 0.6)' }}>Loading Rowdy...</p>
        </div>
      </div>
    );
  }

  if (showAdmin) {
    return (
      <div>
        <button
          onClick={() => setShowAdmin(false)}
          className="fixed top-4 left-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg z-50"
        >
          ← Back
        </button>
        <AdminTools />
      </div>
    );
  }

  if (debugMode) {
    return (
      <DebugMode
        onExit={() => {
          trackPageView('/');
          setDebugMode(false);
        }}
      />
    );
  }

  if (selectedPlaylistId) {
    return (
      <GameSession
        playlistId={selectedPlaylistId}
        onExit={() => {
          setSelectedPlaylistId(null);
          if (session) {
            trackPageView('/menu');
          } else {
            trackPageView('/');
          }
        }}
        totalRounds={5}
      />
    );
  }

  if (showAuthPage && !session) {
    return (
      <>
        <AuthPage onPlayAsGuest={() => {
          setShowAuthPage(false);
          handlePlayNow();
        }} />
        <button
          onClick={() => setShowAuthPage(false)}
          className="fixed top-4 left-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg z-50"
        >
          ← Back
        </button>
      </>
    );
  }

  if (!session) {
    return (
      <LandingPage
        onPlayNow={handlePlayNow}
        onSignIn={handleSignIn}
        onDebugMode={handleDebugMode}
      />
    );
  }

  return (
    <div className="h-screen w-screen bg-black overflow-y-auto">
      <div className="min-h-full p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-start gap-3 mb-6 sm:mb-8">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold text-red-500 mb-1 truncate" style={{ textShadow: '0 0 15px rgba(239, 68, 68, 0.8)' }}>Rowdy</h1>
              <p className="text-sm sm:text-base text-red-400 truncate">
                Welcome, {session.user?.email?.split('@')[0] || 'Player'}!
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex-shrink-0 px-4 sm:px-6 py-2.5 sm:py-3 bg-transparent border-2 border-red-500 text-red-400 hover:bg-red-500 hover:text-black font-semibold rounded-lg transition-all text-sm sm:text-base touch-manipulation"
              style={GLOW_STYLES.red}
            >
              Sign Out
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6">
            <div
              onClick={handlePlayGames}
              className="bg-black backdrop-blur rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-red-500/40 hover:border-red-500 cursor-pointer transition-all active:scale-[0.98] touch-manipulation"
              style={{ boxShadow: '0 0 25px rgba(239, 68, 68, 0.3)' }}
            >
              <div className="text-4xl sm:text-5xl mb-3">🚀</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-red-400 mb-2" style={{ textShadow: '0 0 15px rgba(239, 68, 68, 0.6)' }}>Continue Playing</h2>
              <p className="text-sm sm:text-base text-red-300 mb-4">
                Progress through the playlist sequence!
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm sm:text-base">
                  <span className="text-red-400">Current Playlist:</span>
                  <span className="text-red-400 font-bold">{anonymousSessionManager.getCurrentPlaylistId()}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-red-300/60">
                  <span>Next:</span>
                  <span>{anonymousSessionManager.getNextPlaylistId()}</span>
                </div>
              </div>
            </div>

            <div className="bg-black backdrop-blur rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-yellow-400/40" style={{ boxShadow: '0 0 20px rgba(251, 191, 36, 0.2)' }}>
              <div className="text-4xl sm:text-5xl mb-3">📊</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-yellow-400 mb-3" style={GLOW_STYLES.yellow}>Your Stats</h2>
              {userStats.loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-yellow-400"></div>
                </div>
              ) : userStats.totalGamesPlayed === 0 ? (
                <div>
                  <div className="space-y-2.5 text-sm sm:text-base text-yellow-300 opacity-50">
                    <div className="flex justify-between">
                      <span>Total Games Played:</span>
                      <span className="font-bold text-yellow-400">0</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Best Score:</span>
                      <span className="font-bold text-green-400">--</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Average Grade:</span>
                      <span className="font-bold text-cyan-400">--</span>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-yellow-500 mt-4">
                    Stats will appear here after your first game!
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 text-sm sm:text-base text-yellow-300">
                  <div className="flex justify-between">
                    <span>Total Games Played:</span>
                    <span className="font-bold text-yellow-400" style={GLOW_STYLES.yellow}>{userStats.totalGamesPlayed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Best Score:</span>
                    <span className="font-bold text-green-400" style={GLOW_STYLES.green}>{userStats.bestScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Grade:</span>
                    <span className="font-bold text-cyan-400" style={GLOW_STYLES.cyan}>{userStats.averageGrade}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-center mt-6">
            <button
              onClick={handleDebugMode}
              className="px-6 py-3 bg-transparent border-2 border-yellow-400/50 hover:border-yellow-400 text-yellow-400 font-semibold rounded-lg transition-all active:scale-95 text-sm touch-manipulation"
              style={{ textShadow: '0 0 8px rgba(251, 191, 36, 0.4)', boxShadow: '0 0 10px rgba(251, 191, 36, 0.2)' }}
            >
              Debug Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
