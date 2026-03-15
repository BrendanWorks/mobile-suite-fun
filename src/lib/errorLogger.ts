import { supabase } from './supabase';

export async function logClientError(
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('client_errors').insert({
      user_id: session?.user?.id ?? null,
      error_message: err.message || String(error),
      error_stack: err.stack ?? null,
      component_stack: null,
      context: context ?? null,
      url: typeof window !== 'undefined' ? window.location.href : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch {
  }
}
