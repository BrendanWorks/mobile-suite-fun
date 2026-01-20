import React from 'react';
import { X } from 'lucide-react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueAsGuest?: () => void;
}

export default function AuthModal({ isOpen, onClose, onContinueAsGuest }: AuthModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-white/20">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">
            Sign In to Save Your Score
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-300" />
          </button>
        </div>

        <div className="p-6">
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
            providers={[]}
            onlyThirdPartyProviders={false}
            view="sign_in"
            redirectTo={window.location.origin}
          />

          <div className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
            <p className="text-xs text-green-200 text-center">
              Your game session will be saved immediately after sign in!
            </p>
          </div>

          {onContinueAsGuest && (
            <button
              onClick={() => {
                onContinueAsGuest();
                onClose();
              }}
              className="mt-4 w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              Continue Playing as Guest
            </button>
          )}
        </div>
      </div>
    </div>
  );
}