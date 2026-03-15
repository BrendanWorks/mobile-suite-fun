import React, { useState } from 'react';
import { Mail, CircleCheck as CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthPageProps {
  onPlayAsGuest?: () => void;
}

export default function AuthPage({ onPlayAsGuest }: AuthPageProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen bg-gradient-to-br from-red-900/40 via-black to-black flex items-center justify-center p-4 sm:p-6" style={{ minHeight: '100dvh' }}>
      <div className="w-full max-w-md text-center">
        <div className="mb-8 sm:mb-12">
          <h1 className="text-5xl sm:text-6xl font-black text-red-500 mb-2 sm:mb-3" style={{ textShadow: '0 0 30px rgba(239, 68, 68, 0.8)' }}>ROWDY</h1>
          <p className="text-lg sm:text-xl text-red-400" style={{ textShadow: '0 0 10px rgba(239, 68, 68, 0.4)' }}>Rated "R" for a reason</p>
        </div>

        {onPlayAsGuest && (
          <button
            onClick={onPlayAsGuest}
            className="w-full mb-4 sm:mb-6 py-3.5 sm:py-4 px-6 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] text-base sm:text-lg touch-manipulation"
            style={{ boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)' }}
          >
            Play as Guest
          </button>
        )}

        <div className="bg-black/80 backdrop-blur rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-red-500/30 shadow-2xl" style={{ boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)' }}>
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-100 text-gray-800 font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 border-t border-red-500/20"></div>
            <span className="text-xs text-red-500/60">or</span>
            <div className="flex-1 border-t border-red-500/20"></div>
          </div>

          {!showEmailForm ? (
            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-transparent border-2 border-red-500/40 hover:border-red-500 text-red-400 hover:text-red-300 font-semibold rounded-xl transition-all"
            >
              <Mail size={18} />
              <span>Sign in with Email Link</span>
            </button>
          ) : sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle size={40} className="text-green-400" />
              <p className="text-white font-semibold">Check your inbox!</p>
              <p className="text-sm text-gray-400">
                We sent a sign-in link to <span className="text-white">{email}</span>.
                <br />It expires in 24 hours.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="text-xs text-red-400 hover:text-red-300 transition-colors mt-1"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3">
              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-xs text-red-200">{error}</p>
                </div>
              )}
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500/50" />
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full pl-9 pr-4 py-3 bg-gray-900/80 border border-red-500/30 focus:border-red-500 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)' }}
              >
                {loading ? 'Sending...' : 'Send Magic Link'}
              </button>
              <p className="text-xs text-red-500/50">
                No password needed — link expires in 24 hours.
              </p>
              <button
                type="button"
                onClick={() => setShowEmailForm(false)}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Back
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 sm:mt-8 text-red-500/70 text-xs sm:text-sm">
          Sign in to see less of the same crap
        </p>
      </div>
    </div>
  );
}
