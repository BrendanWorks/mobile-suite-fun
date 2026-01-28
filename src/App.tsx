import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { initGA, trackPageView, analytics } from './lib/analytics';
import AuthPage from './components/AuthPage';
import MainMenu from './components/MainMenu';
import GameWrapper from './components/GameWrapper';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);

  // Initialize GA4 on app mount
  useEffect(() => {
    initGA();
    trackPageView('/');
  }, []);

  // Auth state management
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      
      if (session?.user) {
        analytics.signedIn('google', session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
      if (_event === 'SIGNED_IN' && session?.user) {
        analytics.signedIn('google', session.user.id);
      } else if (_event === 'SIGNED_OUT') {
        analytics.signedOut();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle game selection from menu
  const handleGameSelect = (gameId: number) => {
    setSelectedGameId(gameId);
  };

  // Handle returning to menu
  const handleBackToMenu = () => {
    setSelectedGameId(null);
    trackPageView('/menu');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  if (selectedGameId) {
    return (
      <GameWrapper
        gameId={selectedGameId}
        userId={session.user.id}
        onQuit={handleBackToMenu}
      />
    );
  }

  return (
    <MainMenu
      session={session}
      onGameSelect={handleGameSelect}
    />
  );
}

export default App;