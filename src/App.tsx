/**
 * APP.TSX - Main app with auth state management
 * Paste into bolt.new as App.tsx
 * Handles login/logout and routing
 */

import React, { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import AuthPage from './components/AuthPage';
import GameSession from './components/GameSession';
import GameWrapper from './components/GameWrapper';
import OddManOut from './components/OddManOut';
import PhotoMystery from './components/PhotoMystery.jsx';
import RankAndRoll from './components/RankAndRoll';
import DalmatianPuzzle from './components/DalmatianPuzzle';
import SplitDecision from './components/SplitDecision';
import WordRescue from './components/WordRescue';
import ShapeSequence from './components/ShapeSequence';

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
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-400 mb-4 mx-auto"></div>
          <p className="text-white text-lg">Loading Game Box...</p>
        </div>
      </div>
    );
  }

  // Test mode - show test game UI
  if (testMode && testGameId) {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
          <div className="flex justify-between items-center max-w-6xl mx-auto">
            <div className="text-white">
              <p className="text-sm text-gray-400">🧪 Test Mode</p>
              <p className="text-lg font-bold">Testing Game</p>
            </div>
            <button
              onClick={() => {
                setTestMode(false);
                setTestGameId(null);
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Exit Test
            </button>
          </div>
        </div>
        <div className="p-6 max-w-4xl mx-auto">
          {testGameId === 'odd-man-out' && <GameWrapper duration={60} onComplete={() => {}} gameName="Odd Man Out" showCompletionModal={false}><OddManOut /></GameWrapper>}
          {testGameId === 'photo-mystery' && <GameWrapper duration={15} onComplete={() => {}} gameName="Zooma" showCompletionModal={false}><PhotoMystery /></GameWrapper>}
          {testGameId === 'rank-and-roll' && <GameWrapper duration={30} onComplete={() => {}} gameName="Ranky" showCompletionModal={false}><RankAndRoll /></GameWrapper>}
          {testGameId === 'dalmatian-puzzle' && <GameWrapper duration={60} onComplete={() => {}} gameName="Dalmatian Puzzle" showCompletionModal={false}><DalmatianPuzzle /></GameWrapper>}
          {testGameId === 'split-decision' && <GameWrapper duration={60} onComplete={() => {}} gameName="Split Decision" showCompletionModal={false}><SplitDecision /></GameWrapper>}
          {testGameId === 'word-rescue' && <GameWrapper duration={90} onComplete={() => {}} gameName="Pop" showCompletionModal={false}><WordRescue /></GameWrapper>}
          {testGameId === 'shape-sequence' && <GameWrapper duration={60} onComplete={() => {}} gameName="Shape Sequence" showCompletionModal={false}><ShapeSequence /></GameWrapper>}
        </div>
      </div>
    );
  }

  // Not logged in - show auth page with test mode option
  if (!session) {
    return (
      <>
        <AuthPage />
        {/* Test Mode Button - Fixed Position */}
        <button
          onClick={() => setTestMode(true)}
          className="fixed bottom-6 right-6 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg shadow-lg transition-all hover:scale-105 z-50"
        >
          🧪 Test Mode
        </button>

        {/* Test Mode Modal */}
        {testMode && !testGameId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-2xl w-full border border-yellow-500/30">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white">🧪 Test Mode</h2>
                <button
                  onClick={() => setTestMode(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              <p className="text-gray-300 mb-6">
                Select a game to test directly without logging in:
              </p>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'odd-man-out', name: 'Odd Man Out', icon: '🔍' },
                  { id: 'photo-mystery', name: 'Zooma', icon: '📷' },
                  { id: 'rank-and-roll', name: 'Ranky', icon: '📊' },
                  { id: 'dalmatian-puzzle', name: 'Dalmatian Puzzle', icon: '🧩' },
                  { id: 'split-decision', name: 'Split Decision', icon: '⚡' },
                  { id: 'word-rescue', name: 'Pop', icon: '📝' },
                  { id: 'shape-sequence', name: 'Shape Sequence', icon: '🔷' },
                ].map((game) => (
                  <button
                    key={game.id}
                    onClick={() => setTestGameId(game.id)}
                    className="bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-6 px-4 rounded-xl shadow-lg transition-all hover:scale-105 border-2 border-blue-400/50"
                  >
                    <div className="text-3xl mb-2">{game.icon}</div>
                    <div className="text-sm">{game.name}</div>
                  </button>
                ))}
              </div>

              <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-200">
                  ⚠️ Note: Test mode bypasses authentication and does not save scores.
                </p>
              </div>
            </div>
          </div>
        )}
      </>
    );
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
