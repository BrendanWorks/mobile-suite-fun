import React, { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { initGA, trackPageView, analytics } from './lib/analytics';
import AuthPage from './components/AuthPage';
import GameSession from './components/GameSession';
import TestMode from './components/TestMode';
import AdminTools from './components/AdminTools';
import PlaylistSelector from './components/PlaylistSelector';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGames, setShowGames] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [testGameId, setTestGameId] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPlaylistTest, setShowPlaylistTest] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);

  // Initialize analytics on mount
  useEffect(() => {
    initGA();
    trackPageView('/');
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error('❌ Session error:', error.message);
        if (error.message.includes('refresh_token_not_found')) {
          console.log('🧹 Clearing invalid session');
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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event);

      setSession(session);

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ User logged in:', session.user.email);
        analytics.signedIn('email', session.user.id);
      }

      if (event === 'SIGNED_OUT') {
        console.log('👋 User logged out');
        analytics.signedOut();
        setShowGames(false);
      }

      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-center px-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-cyan-400 mb-4 mx-auto" style={{ boxShadow: '0 0 15px rgba(0, 255, 255, 0.5)' }}></div>
          <p className="text-cyan-400 text-base" style={{ textShadow: '0 0 10px #00ffff' }}>Loading Game Box...</p>
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

  if (testMode) {
    return (
      <TestMode
        onExit={() => {
          trackPageView('/menu');
          setTestMode(false);
          setTestGameId(null);
        }}
        selectedGameId={testGameId}
        onSelectGame={setTestGameId}
      />
    );
  }

  if (showPlaylistTest && !selectedPlaylistId) {
    return (
      <PlaylistSelector
        onSelectPlaylist={(id) => setSelectedPlaylistId(id)}
        onBack={() => {
          setShowPlaylistTest(false);
          trackPageView('/menu');
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
          setShowPlaylistTest(false);
          trackPageView('/menu');
        }}
        totalRounds={5}
      />
    );
  }

  if (showGames) {
    return (
      <GameSession
        onExit={() => {
          trackPageView('/menu');
          setShowGames(false);
        }}
        totalRounds={5}
      />
    );
  }

  const handlePlayAsGuest = () => {
    console.log('Analytics: Guest play started');
    trackPageView('/game-session');
    setShowGames(true);
  };

  const handleTestMode = () => {
    console.log('Analytics: Test mode entered');
    trackPageView('/test-mode');
    setTestMode(true);
  };

  const handlePlayGames = () => {
    console.log('Analytics: Authenticated play started');
    trackPageView('/game-session');
    setShowGames(true);
  };

  if (!session) {
    return (
      <>
        <AuthPage onPlayAsGuest={handlePlayAsGuest} />
        <button
          onClick={handleTestMode}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 px-4 sm:px-6 py-2.5 sm:py-3 bg-transparent border-2 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black font-semibold rounded-lg transition-all active:scale-[0.98] z-50 text-sm sm:text-base touch-manipulation"
          style={{ textShadow: '0 0 8px #fbbf24', boxShadow: '0 0 15px rgba(251, 191, 36, 0.4)' }}
        >
          🧪 Test Mode
        </button>
        <button
          onClick={() => setShowAdmin(true)}
          className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 px-4 sm:px-6 py-2.5 sm:py-3 bg-transparent border-2 border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-black font-semibold rounded-lg transition-all active:scale-[0.98] z-50 text-sm sm:text-base touch-manipulation"
          style={{ textShadow: '0 0 8px #c084fc', boxShadow: '0 0 15px rgba(192, 132, 252, 0.4)' }}
        >
          🔧 Admin
        </button>
      </>
    );
  }

  return (
    <div className="h-screen w-screen bg-black overflow-y-auto">
      <div className="min-h-full p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-start gap-3 mb-6 sm:mb-8">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold text-cyan-400 mb-1 truncate" style={{ textShadow: '0 0 15px #00ffff' }}>🎮 Game Box</h1>
              <p className="text-sm sm:text-base text-cyan-300 truncate">
                Welcome, {session.user?.email?.split('@')[0] || 'Player'}!
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex-shrink-0 px-4 sm:px-6 py-2.5 sm:py-3 bg-transparent border-2 border-red-500 text-red-400 hover:bg-red-500 hover:text-black font-semibold rounded-lg transition-all text-sm sm:text-base touch-manipulation"
              style={{ textShadow: '0 0 8px #ff0066', boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)' }}
            >
              Sign Out
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6">
            <div
              onClick={handlePlayGames}
              className="bg-black backdrop-blur rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-cyan-400/40 hover:border-cyan-400 cursor-pointer transition-all active:scale-[0.98] touch-manipulation"
              style={{ boxShadow: '0 0 25px rgba(0, 255, 255, 0.3)' }}
            >
              <div className="text-4xl sm:text-5xl mb-3">🚀</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-cyan-400 mb-2" style={{ textShadow: '0 0 10px #00ffff' }}>Play Games</h2>
              <p className="text-sm sm:text-base text-cyan-300 mb-4">
                Challenge yourself with 5 different mini-games. Test your skills, earn points, and climb the leaderboard!
              </p>
              <div className="flex items-center justify-between text-sm sm:text-base">
                <span className="text-cyan-400">5 rounds • ~15 minutes</span>
                <span className="text-xl sm:text-2xl text-cyan-400">→</span>
              </div>
            </div>

            <div
              onClick={() => setShowPlaylistTest(true)}
              className="bg-black backdrop-blur rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-yellow-400/40 hover:border-yellow-400 cursor-pointer transition-all active:scale-[0.98] touch-manipulation"
              style={{ boxShadow: '0 0 25px rgba(251, 191, 36, 0.3)' }}
            >
              <div className="text-4xl sm:text-5xl mb-3">🧪</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-yellow-400 mb-2" style={{ textShadow: '0 0 10px #fbbf24' }}>Test Playlists</h2>
              <p className="text-sm sm:text-base text-yellow-300 mb-4">
                Try out curated game playlists. Test different difficulty levels and sequences!
              </p>
              <div className="flex items-center justify-between text-sm sm:text-base">
                <span className="text-yellow-400">5 rounds • Custom sequences</span>
                <span className="text-xl sm:text-2xl text-yellow-400">→</span>
              </div>
            </div>

            <div className="bg-black backdrop-blur rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-cyan-400/40" style={{ boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)' }}>
              <div className="text-4xl sm:text-5xl mb-3">📊</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-cyan-400 mb-3" style={{ textShadow: '0 0 10px #00ffff' }}>Your Stats</h2>
              <div className="space-y-2.5 text-sm sm:text-base text-cyan-300">
                <div className="flex justify-between">
                  <span>Total Games Played:</span>
                  <span className="font-bold text-cyan-400" style={{ textShadow: '0 0 8px #00ffff' }}>0</span>
                </div>
                <div className="flex justify-between">
                  <span>Best Score:</span>
                  <span className="font-bold text-green-400" style={{ textShadow: '0 0 8px #22c55e' }}>--</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Grade:</span>
                  <span className="font-bold text-yellow-400" style={{ textShadow: '0 0 8px #fbbf24' }}>--</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-cyan-500 mt-4">
                Stats will appear here after your first game!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 pb-6">
            <div className="bg-cyan-500/10 border-2 border-cyan-500/40 rounded-lg p-3 sm:p-4" style={{ boxShadow: '0 0 10px rgba(0, 255, 255, 0.2)' }}>
              <p className="text-xs sm:text-sm text-cyan-300">
                <span className="font-bold">💡 Tip:</span> Each game tests different skills. Play all 5 to get your session score!
              </p>
            </div>
            <div className="bg-green-500/10 border-2 border-green-500/40 rounded-lg p-3 sm:p-4" style={{ boxShadow: '0 0 10px rgba(34, 197, 94, 0.2)' }}>
              <p className="text-xs sm:text-sm text-green-300">
                <span className="font-bold">✨ Feature:</span> Your scores are saved automatically. Track your progress over time.
              </p>
            </div>
            <div className="bg-yellow-500/10 border-2 border-yellow-500/40 rounded-lg p-3 sm:p-4" style={{ boxShadow: '0 0 10px rgba(251, 191, 36, 0.2)' }}>
              <p className="text-xs sm:text-sm text-yellow-300">
                <span className="font-bold">🏆 Goal:</span> Earn grades from D to S. Can you hit all S's?
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
