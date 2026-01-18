import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface AuthPageProps {
  onAuthSuccess?: () => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { signUp, signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) throw error;
        setSuccess('Account created successfully! You can now sign in.');
        setIsSignUp(false);
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        setSuccess('Signed in successfully!');
        setTimeout(() => {
          if (onAuthSuccess) onAuthSuccess();
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==')] opacity-30"></div>

      <div className="w-full max-w-md relative">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-2xl mb-4 shadow-lg">
                <Sparkles size={32} className="text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </h1>
              <p className="text-blue-200">
                {isSignUp
                  ? 'Sign up to start your journey'
                  : 'Sign in to continue your progress'
                }
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-blue-100 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-blue-300" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all backdrop-blur-sm"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-blue-100 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-blue-300" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all backdrop-blur-sm"
                    placeholder="••••••••"
                  />
                </div>
                {isSignUp && (
                  <p className="text-xs text-blue-200 mt-2">
                    Password must be at least 6 characters long
                  </p>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-500/20 border border-red-400/50 rounded-xl backdrop-blur-sm">
                  <p className="text-sm text-red-100">{error}</p>
                </div>
              )}

              {success && (
                <div className="p-4 bg-green-500/20 border border-green-400/50 rounded-xl backdrop-blur-sm">
                  <p className="text-sm text-green-100">{success}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-semibold rounded-xl hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 group"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <User size={20} />
                    <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setSuccess(null);
                }}
                className="text-sm text-cyan-300 hover:text-cyan-200 transition-colors font-medium"
              >
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"
                }
              </button>
            </div>
          </div>

          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400"></div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-blue-200">
            Secure authentication powered by Supabase
          </p>
        </div>
      </div>
    </div>
  );
}
