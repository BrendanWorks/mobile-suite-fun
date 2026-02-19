import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_supabase) return _supabase;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  _supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: {
        getItem: (k) => {
          try { return localStorage.getItem(k); } catch { return null; }
        },
        setItem: (k, v) => {
          try { localStorage.setItem(k, v); } catch (e) { console.error('localStorage.setItem failed', e); }
        },
        removeItem: (k) => {
          try { localStorage.removeItem(k); } catch (e) { console.error('localStorage.removeItem failed', e); }
        },
      },
    },
  });

  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getClient() as any)[prop];
  },
});
