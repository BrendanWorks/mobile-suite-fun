/**
 * APP.TSX - Main app with auth state management
 * Paste into bolt.new as App.tsx
 * Handles login/logout and routing
 */

import React, { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { createUserProfile } from './lib/supabaseHelpers';
import AuthPage from './components/AuthPage';
import GameSession from './components/GameSession';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGames, setShowGames] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        ensureUserProfile(session.user.id, session.user.email || '');
      }
      setLoading(false);
    });

    // Listen for auth changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // Auto-create user profile on first login
        await ensureUserProfile(session.user.id, session.user.email || '');
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

  // Ensure user profile exists in database
  const ensureUserProfile = async (userId: string, email: string) => {
    try {
      const { success } = await createUserProfile(
        userId,
        email,
        email.split('@')[0] // Use email prefix as username
      );
      
      if (success) {
        console.log('User profile created/verified');
      }
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-400 mb-4 mx-auto"></div>
          <p className="text-white text-lg">Loading Game Box...</p>
        </div>
      </div>
    );
  }

  // Not logged in - show auth page
  if (!session) {
    return <AuthPage />;
  }

  // Logged in - show game menu or game session
  if (showGames) {
    return (
      <GameSession
        onExit={() => setShowGames(false)}
        totalRounds={5}
      />
    );
  }

  // Main menu after login
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header with user info and logout */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-5xl font-bold text-white mb-2">🎮 Game Box</h1>
            <p className="text-gray-300">
              Welcome, {session.user?.email?.split('@')[0] || 'Player'}!
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Start Game Card */}
          <div
            onClick={() => setShowGames(true)}
            className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20 hover:border-blue-400/50 cursor-pointer transition-all hover:shadow-2xl hover:shadow-blue-500/20 transform hover:scale-105"
          >
            <div className="text-5xl mb-4">🚀</div>
            <h2 className="text-3xl font-bold text-white mb-3">Play Games</h2>
            <p className="text-gray-300 mb-6">
              Challenge yourself with 5 different mini-games. Test your skills, earn points, and climb the leaderboard!
            </p>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">5 rounds • ~15 minutes</span>
              <span className="text-2xl">→</span>
            </div>
          </div>

          {/* Stats Card (placeholder for future) */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-3xl font-bold text-white mb-3">Your Stats</h2>
            <div className="space-y-3 text-gray-300">
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
            <p className="text-sm text-gray-500 mt-6">
              Stats will appear here after your first game!
            </p>
          </div>
        </div>

        {/* Info section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-200">
              <span className="font-bold">💡 Tip:</span> Each game tests different skills. Play all 5 to get your session score!
            </p>
          </div>
          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
            <p className="text-sm text-green-200">
              <span className="font-bold">✨ Feature:</span> Your scores are saved automatically. Track your progress over time.
            </p>
          </div>
          <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4">
            <p className="text-sm text-purple-200">
              <span className="font-bold">🏆 Goal:</span> Earn grades from D to S. Can you hit all S's?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
