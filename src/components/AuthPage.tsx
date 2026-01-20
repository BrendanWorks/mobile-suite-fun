/**
 * COMPLETE OAUTH AUTH FRAMEWORK - GOOGLE ONLY
 * All providers configured in code comments, only Google enabled to start
 * Paste this into bolt.new as components/AuthPage.tsx
 */

import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';

interface AuthPageProps {
  onPlayAsGuest?: () => void;
}

export default function AuthPage({ onPlayAsGuest }: AuthPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-3">🎮 Game Box</h1>
          <p className="text-xl text-gray-300 mb-1">Play. Score. Compete.</p>
          <p className="text-sm text-gray-400">
            Sign in to save your progress and compete with others
          </p>
        </div>

        {/* Play as Guest Button */}
        {onPlayAsGuest && (
          <>
            <button
              onClick={onPlayAsGuest}
              className="w-full mb-4 py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-105"
            >
              Play as Guest
            </button>
            <div className="flex items-center mb-4">
              <div className="flex-1 h-px bg-white/20"></div>
              <span className="px-4 text-sm text-gray-400">or</span>
              <div className="flex-1 h-px bg-white/20"></div>
            </div>
          </>
        )}

        {/* Auth Card */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20 shadow-2xl">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#3b82f6',
                    brandAccent: '#1e40af',
                    brandButtonText: 'white',
                    defaultButtonBackground: '#1f2937',
                    defaultButtonBorder: '#4b5563',
                    defaultButtonText: '#ffffff',
                    dividerBackground: '#4b5563',
                    focusedInputBorder: '#3b82f6',
                    inputBackground: '#374151',
                    inputBorder: '#4b5563',
                    inputBorderFocus: '#3b82f6',
                    inputText: '#ffffff',
                    inputPlaceholder: '#9ca3af',
                    anchorTextColor: '#60a5fa',
                    anchorTextHoverColor: '#93c5fd',
                  },
                  borderWidths: {
                    buttonBorderWidth: '1px',
                    inputBorderWidth: '1px',
                  },
                  radii: {
                    borderRadiusButton: '0.75rem',
                    buttonBorderRadius: '0.75rem',
                    inputBorderRadius: '0.5rem',
                  },
                },
              },
            }}
            providers={['google']} // Only Google enabled for now
            // Other providers available (uncomment to enable):
            // providers={['google', 'discord', 'facebook', 'twitch', 'github']}
            onlyThirdPartyProviders={false}
            view="sign_in"
            redirectTo={window.location.origin}
          />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-4">
          {onPlayAsGuest && (
            <div className="bg-green-500/20 border border-green-500/30 rounded-lg px-4 py-3">
              <p className="text-sm text-green-200">
                Playing as guest? Your score won't be saved!
              </p>
              <p className="text-xs text-green-300 mt-1">
                Sign in after playing to save your progress.
              </p>
            </div>
          )}
          <div className="inline-block bg-blue-500/20 border border-blue-500/30 rounded-lg px-4 py-3">
            <p className="text-sm text-blue-200">
              🔒 Secure login powered by Supabase
            </p>
          </div>
        </div>

        {/* Provider Info */}
        <div className="mt-6 p-4 bg-gray-500/10 border border-gray-500/20 rounded-lg">
          <p className="text-xs text-gray-300 text-center">
            Sign in with Google or create an account with email.<br/>
            More providers coming soon!
          </p>
        </div>
      </div>
    </div>
  );
}