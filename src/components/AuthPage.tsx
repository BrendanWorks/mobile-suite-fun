/**
 * AuthPage - CLEAN & MINIMAL
 * Google OAuth only, no email/password form
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
      <div className="w-full max-w-md text-center">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-white mb-3">🎮 Game Box</h1>
          <p className="text-xl text-gray-300">Play. Score. Compete.</p>
        </div>

        {/* Play as Guest Button */}
        {onPlayAsGuest && (
          <button
            onClick={onPlayAsGuest}
            className="w-full mb-6 py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-105 text-lg"
          >
            Play as Guest
          </button>
        )}

        {/* Google Sign In */}
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
            providers={['google']}
            onlyThirdPartyProviders={true}
            view="sign_in"
            redirectTo={window.location.origin}
          />
        </div>

        {/* Footer Text */}
        <p className="mt-8 text-gray-400 text-sm">
          Sign in to save your progress
        </p>
      </div>
    </div>
  );
}