import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { initGA, trackPageView, analytics } from './lib/analytics';
import { anonymousSessionManager } from './lib/anonymousSession';
import { audioManager } from './lib/audioManager';
import { preloadGameSounds, preloadTimerSounds } from './lib/sounds';
import { getSavedSfxLevel, applySfxLevel } from './components/SfxVolumeControl';
import AuthPage from './components/AuthPage';
import GameSession from './components/GameSession';
import LandingPage from './components/LandingPage';
import DebugMode from './components/DebugMode';
import AdminTools from './components/AdminTools';
import SfxVolumeControl from './components/SfxVolumeControl';
import ErrorBoundary from './components/ErrorBoundary';
import TipJar from './components/TipJar';
import TipPrompt from './components/TipPrompt';
import { useUserStats } from './hooks/useUserStats';

const TIP_PROMPT_LEVELS = [5, 9];
const TIP_LEVELS_KEY = 'rowdy_levels_completed';
const TIP_DISMISSED_KEY = 'rowdy_tip_dismissed_at';

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

const PARTICLE_COUNT = 18;

interface Particle {
  x: number; y: number; vx: number; vy: number;
  radius: number; opacity: number; fadeDir: number;
}

function initParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w, y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.22,
    radius: Math.random() * 1.6 + 0.6,
    opacity: Math.random() * 0.35 + 0.08,
    fadeDir: Math.random() > 0.5 ? 1 : -1,
  };
}

interface ReturningUserScreenProps {
  session: Session;
  userStats: ReturnType<typeof import('./hooks/useUserStats').useUserStats>;
  showTipPrompt: boolean;
  showTipJar: boolean;
  onPlay: () => void;
  onLogout: () => void;
  onDebugMode: () => void;
  onOpenTipJar: () => void;
  onCloseTipJar: () => void;
  onDismissTipPrompt: () => void;
  onOpenTipJarFromPrompt: () => void;
}

const LETTERS = ['R', 'O', 'W', 'D', 'Y'];

function ReturningUserScreen({
  session, userStats, showTipPrompt, showTipJar,
  onPlay, onLogout, onDebugMode, onOpenTipJar, onCloseTipJar,
  onDismissTipPrompt, onOpenTipJarFromPrompt,
}: ReturningUserScreenProps) {
  const [visibleLetters, setVisibleLetters] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const username = session.user?.email?.split('@')[0] || 'Player';

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    LETTERS.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleLetters(i + 1), i * 80 + 120));
    });
    timers.push(setTimeout(() => setPulseActive(true), LETTERS.length * 80 + 600));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => initParticle(canvas.width, canvas.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let lastTime = 0;
    const draw = (now: number) => {
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx * dt * 0.5; p.y += p.vy * dt * 0.5;
        p.opacity += p.fadeDir * 0.0008 * dt;
        if (p.opacity > 0.43 || p.opacity < 0.05) p.fadeDir *= -1;
        if (p.x < -4) p.x = canvas.width + 4; else if (p.x > canvas.width + 4) p.x = -4;
        if (p.y < -4) p.y = canvas.height + 4; else if (p.y > canvas.height + 4) p.y = -4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239,68,68,${p.opacity.toFixed(3)})`;
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  const contentVisible = visibleLetters >= LETTERS.length;

  return (
    <>
      {showTipPrompt && !showTipJar && (
        <TipPrompt
          onOpenTipJar={onOpenTipJarFromPrompt}
          onDismiss={onDismissTipPrompt}
        />
      )}
      {showTipJar && <TipJar onClose={onCloseTipJar} />}

      <div className="w-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden" style={{ minHeight: '100dvh' }}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />
        <div className="absolute inset-0 bg-gradient-radial from-red-900/20 via-black to-black" />

        <div className="relative z-10 text-center max-w-md w-full flex flex-col items-center">

          <div className="mb-2">
            <div className="inline-flex items-center justify-center mb-3 relative">
              <div style={{
                position: 'absolute', inset: '-40px -60px', borderRadius: '50%',
                background: 'radial-gradient(ellipse at center, rgba(239,68,68,0.28) 0%, rgba(239,68,68,0.10) 40%, transparent 72%)',
                opacity: pulseActive ? 1 : 0, transition: 'opacity 1200ms ease', pointerEvents: 'none',
                animation: pulseActive ? 'rowdyGlowPulse 4s ease-in-out infinite' : 'none',
              }} />
              <h1 className="font-black tracking-wider relative" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 'clamp(4rem, 18vw, 9rem)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                {LETTERS.map((letter, i) => (
                  <span key={letter + i} style={{
                    display: 'inline-block', color: '#ef4444',
                    opacity: visibleLetters > i ? 1 : 0,
                    transform: visibleLetters > i ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.85)',
                    transition: 'opacity 320ms cubic-bezier(0.22,1,0.36,1), transform 380ms cubic-bezier(0.22,1,0.36,1)',
                    animation: pulseActive ? `rowdyTextPulse 4s ease-in-out infinite ${i * 80}ms` : 'none',
                  }}>
                    {letter}
                  </span>
                ))}
              </h1>
            </div>

            <p className="text-lg sm:text-xl font-semibold tracking-wide" style={{
              color: 'rgba(239,68,68,0.75)',
              opacity: contentVisible ? 1 : 0,
              transform: contentVisible ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 500ms ease 100ms, transform 500ms ease 100ms',
            }}>
              Welcome back, <span style={{ color: '#ef4444', textShadow: '0 0 12px rgba(239,68,68,0.6)' }}>{username}</span>
            </p>
          </div>

          <div className="w-full space-y-3 mb-4 sm:mb-8" style={{
            opacity: contentVisible ? 1 : 0,
            transform: contentVisible ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 500ms ease 300ms, transform 500ms ease 300ms',
          }}>
            <button
              onClick={onPlay}
              className="w-full flex items-center justify-center gap-3 px-8 py-4 sm:py-5 bg-red-600 text-white font-bold text-xl rounded-xl active:scale-[0.97] touch-manipulation returning-play-btn"
              style={{ boxShadow: '0 0 30px rgba(239,68,68,0.5)', transition: 'transform 300ms ease, background-color 300ms ease, box-shadow 300ms ease' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Keep Playing
            </button>

            {!userStats.loading && userStats.totalGamesPlayed > 0 && (
              <div className="flex items-center justify-center gap-6 py-1 sm:py-2">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(251,191,36,0.5)' }}>Games</p>
                  <p className="text-xl font-black tabular-nums" style={{ color: '#facc15', textShadow: '0 0 10px rgba(251,191,36,0.6)' }}>{userStats.totalGamesPlayed}</p>
                </div>
                <div className="w-px h-8" style={{ background: 'rgba(239,68,68,0.2)' }} />
                <div className="text-center">
                  <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(34,197,94,0.5)' }}>Best</p>
                  <p className="text-xl font-black tabular-nums" style={{ color: '#4ade80', textShadow: '0 0 10px rgba(34,197,94,0.6)' }}>{userStats.bestScore}</p>
                </div>
                <div className="w-px h-8" style={{ background: 'rgba(239,68,68,0.2)' }} />
                <div className="text-center">
                  <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(0,255,255,0.5)' }}>Vibe</p>
                  <p className="text-xl font-black" style={{ color: '#00ffff', textShadow: '0 0 10px rgba(0,255,255,0.6)' }}>{userStats.vibe}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-2 pb-4 sm:pb-6" style={{
          opacity: contentVisible ? 1 : 0,
          transition: 'opacity 500ms ease 500ms',
        }}>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <SfxVolumeControl />
            <button
              onClick={onOpenTipJar}
              className="flex items-center gap-1.5 px-4 py-2.5 sm:py-3 bg-transparent border-2 border-red-500/30 hover:border-red-500/60 text-red-400/60 hover:text-red-400 font-semibold rounded-lg transition-all active:scale-95 text-sm touch-manipulation"
              style={{ boxShadow: '0 0 8px rgba(239,68,68,0.1)' }}
            >
              Tip Jar
            </button>
            <button
              onClick={onLogout}
              className="px-5 py-2.5 sm:py-3 bg-transparent border-2 border-red-500/30 hover:border-red-500/60 text-red-400/50 hover:text-red-400 font-semibold rounded-lg transition-all active:scale-95 text-sm touch-manipulation"
            >
              Sign Out
            </button>
          </div>
          <button
            onClick={onDebugMode}
            className="px-4 py-1.5 bg-transparent text-white/15 hover:text-white/40 transition-colors active:scale-95 text-xs touch-manipulation"
          >
            Debug Mode
          </button>
        </div>

        <style>{`
          @keyframes rowdyTextPulse {
            0%, 100% { text-shadow: 0 0 24px rgba(239,68,68,0.65), 0 0 50px rgba(239,68,68,0.28), 0 0 80px rgba(239,68,68,0.10); }
            50%       { text-shadow: 0 0 14px rgba(239,68,68,0.40), 0 0 30px rgba(239,68,68,0.16), 0 0 55px rgba(239,68,68,0.06); }
          }
          @keyframes rowdyGlowPulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.55; }
          }
          .returning-play-btn:hover {
            background-color: #ef4444;
            box-shadow: 0 0 50px rgba(239,68,68,0.75), 0 0 90px rgba(239,68,68,0.3) !important;
            transform: scale(1.03);
          }
        `}</style>
      </div>
    </>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAuthPage, setShowAuthPage] = useState(false);
  const [showTipJar, setShowTipJar] = useState(false);
  const [showTipPrompt, setShowTipPrompt] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [autoStartAfterLogin, setAutoStartAfterLogin] = useState(false);
  const userStats = useUserStats(session?.user?.id);

  // Initialize audio and analytics on mount
  useEffect(() => {
    initGA();
    trackPageView('/');

    const initAudio = () => {
      audioManager.initialize();
      applySfxLevel(getSavedSfxLevel());
      preloadGameSounds();
      preloadTimerSounds();
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };

    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });

    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
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
        analytics.signedIn('email');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (event === 'SIGNED_IN' && session?.user) {
        analytics.signedIn('email');
        setShowAuthPage(false);
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
    setShowTipPrompt(false);
    setShowTipJar(false);
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
    setShowTipPrompt(false);
    setShowTipJar(false);
    setSelectedPlaylistId(anonymousSessionManager.getCurrentPlaylistId());
  }, []);

  const handleLevelComplete = useCallback(() => {
    const prev = parseInt(localStorage.getItem(TIP_LEVELS_KEY) ?? '0', 10);
    const next = prev + 1;
    localStorage.setItem(TIP_LEVELS_KEY, String(next));

    if (!TIP_PROMPT_LEVELS.includes(next)) return;

    const dismissedAt = parseInt(localStorage.getItem(TIP_DISMISSED_KEY) ?? '0', 10);
    const hoursSinceDismiss = (Date.now() - dismissedAt) / (1000 * 60 * 60);
    if (hoursSinceDismiss < 24) return;

    setShowTipPrompt(true);
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
      <ErrorBoundary onReset={() => setSelectedPlaylistId(null)} context={{ playlist_id: selectedPlaylistId, user_id: session?.user?.id ?? null }}>
        <GameSession
          playlistId={selectedPlaylistId}
          onExit={() => {
            handleLevelComplete();
            setSelectedPlaylistId(null);
            if (session) {
              trackPageView('/menu');
            } else {
              trackPageView('/');
            }
          }}
          totalRounds={5}
        />
      </ErrorBoundary>
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

  return <ReturningUserScreen
    session={session}
    userStats={userStats}
    showTipPrompt={showTipPrompt}
    showTipJar={showTipJar}
    onPlay={handlePlayGames}
    onLogout={handleLogout}
    onDebugMode={handleDebugMode}
    onOpenTipJar={() => setShowTipJar(true)}
    onCloseTipJar={() => setShowTipJar(false)}
    onDismissTipPrompt={() => {
      localStorage.setItem(TIP_DISMISSED_KEY, String(Date.now()));
      setShowTipPrompt(false);
    }}
    onOpenTipJarFromPrompt={() => { setShowTipPrompt(false); setShowTipJar(true); }}
  />;
}
