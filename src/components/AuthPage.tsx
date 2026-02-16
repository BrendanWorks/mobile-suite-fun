import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';

interface AuthPageProps {
  onPlayAsGuest?: () => void;
}

export default function AuthPage({ onPlayAsGuest }: AuthPageProps) {
  return (
    <div className="h-screen w-screen bg-gradient-to-br from-red-900/40 via-black to-black flex items-center justify-center p-4 sm:p-6">
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
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#ef4444',
                    brandAccent: '#dc2626',
                    brandButtonText: 'white',
                    defaultButtonBackground: '#1f2937',
                    defaultButtonBorder: '#ef4444',
                    defaultButtonText: '#ffffff',
                    dividerBackground: '#ef4444',
                    focusedInputBorder: '#ef4444',
                    inputBackground: '#1f2937',
                    inputBorder: '#4b5563',
                    inputBorderFocus: '#ef4444',
                    inputText: '#ffffff',
                    inputPlaceholder: '#9ca3af',
                  },
                  borderWidths: {
                    buttonBorderWidth: '2px',
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

        <p className="mt-6 sm:mt-8 text-red-500/70 text-xs sm:text-sm">
          Sign in to see less of the same crap
        </p>
      </div>
    </div>
  );
}
