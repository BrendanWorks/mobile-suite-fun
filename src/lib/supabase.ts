import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: {
      getItem: (key) => {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value);
        } catch (error) {
          console.error('Failed to save to localStorage:', error);
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error('Failed to remove from localStorage:', error);
        }
      }
    }
  }
})

supabase.auth.onAuthStateChange((event, _session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('🔄 Auth token refreshed');
  } else if (event === 'SIGNED_OUT') {
    console.log('👋 User signed out');
  } else if (event === 'USER_UPDATED') {
    console.log('✏️ User updated');
  }
});