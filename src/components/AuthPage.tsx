/**
 * COMPLETE OAUTH AUTH FRAMEWORK
 * All providers configured, only Google enabled to start
 * Paste this into bolt.new as components/AuthPage.tsx
 */

import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';

export default function AuthPage() {
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
            // START HERE: Only Google enabled
            // To add more, just add them to this array:
            // providers={['google', 'discord', 'twitch', 'spotify', 'facebook', 'apple']}
            providers={['google']}
            // Set to true if you want ONLY OAuth (no email/password fallback)
            onlyThirdPartyProviders={false}
            // Show sign-in view by default
            view="sign_in"
            // Redirect after login
           redirectTo="https://frolicking-cheesecake-e94d31.netlify.app/"
          />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-block bg-blue-500/20 border border-blue-500/30 rounded-lg px-4 py-3">
            <p className="text-sm text-blue-200">
              🔒 Secure login powered by Supabase
            </p>
            <p className="text-xs text-blue-300 mt-1">
              No passwords. No extra accounts.
            </p>
          </div>
        </div>

        {/* Provider Info - Remove after you understand how it works */}
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-300 font-mono">
            💡 More providers available:<br/>
            discord • twitch • spotify • facebook • apple
          </p>
        </div>
      </div>
    </div>
  );
}
