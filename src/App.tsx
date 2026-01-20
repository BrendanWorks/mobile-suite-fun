import React, { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import AuthPage from './components/AuthPage';
import GameSession from './components/GameSession';
import TestMode from './components/TestMode';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGames, setShowGames] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [testGameId, setTestGameId] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('User logged in:', session.user.email);
      }

      if (event === 'SIGNED_OUT') {
        console.log('User logged out');
        setShowGames(false);
      }

      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-blue-900 via-slate-900 to-gray-900 flex items-center justify-center">
        <div className="text-center px-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-400 mb-4 mx-auto"></div>
          <p className="text-white text-base">Loading Game Box...</p>
        </div>
      </div>
    );
  }

  if (testMode) {
    return (
      <TestMode
        onExit={() => {
          setTestMode(false);
          setTestGameId(null);
        }}
        selectedGameId={testGameId}
        onSelectGame={setTestGameId}
      />
    );
  }

  // Show game session if playing
  if (showGames) {
    return (
      <GameSession
        onExit={() => setShowGames(false)}
        totalRounds={5}
      />
    );
  }

  if (!session) {
    return (
      <>
        <AuthPage onPlayAsGuest={() => setShowGames(true)} />
        <button
          onClick={() => setTestMode(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 px-4 sm:px-6 py-2.5 sm:py-3 bg-yellow-600 active:bg-yellow-700 text-white font-semibold rounded-lg shadow-lg transition-all active:scale-[0.98] z-50 text-sm sm:text-base touch-manipulation"
        >
          🧪 Test Mode
        </button>
      </>
    );
  }

  // Main menu after login
  return (
    <div className="h-screen w-screen bg-gradient-to-br from-blue-900 via-slate-900 to-gray-900 overflow-y-auto">
      <div className="min-h-full p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header with user info and logout */}
          <div className="flex justify-between items-start gap-3 mb-6 sm:mb-8">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1 truncate">🎮 Game Box</h1>
              <p className="text-sm sm:text-base text-gray-300 truncate">
                Welcome, {session.user?.email?.split('@')[0] || 'Player'}!
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex-shrink-0 px-4 sm:px-6 py-2.5 sm:py-3 bg-red-600 active:bg-red-700 text-white font-semibold rounded-lg transition-colors text-sm sm:text-base touch-manipulation"
            >
              Sign Out
            </button>
          </div>

          {/* Main content */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6">
            {/* Start Game Card */}
            <div
              onClick={() => setShowGames(true)}
              className="bg-white/10 backdrop-blur rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-white/20 active:border-blue-400/50 cursor-pointer transition-all active:scale-[0.98] touch-manipulation"
            >
              <div className="text-4xl sm:text-5xl mb-3">🚀</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Play Games</h2>
              <p className="text-sm sm:text-base text-gray-300 mb-4">
                Challenge yourself with 5 different mini-games. Test your skills, earn points, and climb the leaderboard!
              </p>
              <div className="flex items-center justify-between text-sm sm:text-base">
                <span className="text-gray-400">5 rounds • ~15 minutes</span>
                <span className="text-xl sm:text-2xl">→</span>
              </div>
            </div>

            {/* Stats Card (placeholder for future) */}
            <div className="bg-white/10 backdrop-blur rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-white/20">
              <div className="text-4xl sm:text-5xl mb-3">📊</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Your Stats</h2>
              <div className="space-y-2.5 text-sm sm:text-base text-gray-300">
                <div className="flex justify-between">
                  <span>Total Games Played:</span>
                  <span className="font-bold text-blue-400">0</span>
                </div>
                <div className="flex justify-between">
                  <span>Best Score:</span>
                  <span className="font-bold text-green-400">--</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Grade:</span>
                  <span className="font-bold text-yellow-400">--</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-4">
                Stats will appear here after your first game!
              </p>
            </div>
          </div>

          {/* Info section */}
          <div className="grid grid-cols-1 gap-3 pb-6">
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-blue-200">
                <span className="font-bold">💡 Tip:</span> Each game tests different skills. Play all 5 to get your session score!
              </p>
            </div>
            <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-green-200">
                <span className="font-bold">✨ Feature:</span> Your scores are saved automatically. Track your progress over time.
              </p>
            </div>
            <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-orange-200">
                <span className="font-bold">🏆 Goal:</span> Earn grades from D to S. Can you hit all S's?
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
