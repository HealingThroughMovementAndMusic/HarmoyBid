import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars are missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
}

// createClient() throws synchronously if given an empty/invalid URL — fall
// back to a syntactically-valid placeholder so the app doesn't crash at
// import time when Supabase isn't configured yet. Any real call still fails
// (network/auth error) rather than silently succeeding, which is the
// correct "not configured" behavior for features gated behind it (e.g.
// isGoogleCalendarConfigured() in src/lib/googleCalendar.ts).
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-anon-key');
