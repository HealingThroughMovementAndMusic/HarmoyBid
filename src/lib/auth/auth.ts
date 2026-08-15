import { supabase } from '@/lib/supabaseClient';

// Single-user login gate — no signup, no OAuth, by explicit design (see
// CLAUDE.md). Supabase Auth's password grant is identity-by-email, so the
// one fixed account is provisioned under an internal, non-deliverable
// placeholder address; the login screen only ever shows/accepts the
// display username below, never this email.
const FIXED_USERNAME = 'Roman';
const FIXED_ACCOUNT_EMAIL = 'roman@harmonybid.internal';

export async function signIn(username: string, password: string): Promise<{ error: string | null }> {
  // Checked client-side first so a wrong username never even reaches
  // Supabase, and so the error message never reveals which of the two
  // fields was wrong.
  if (username.trim().toLowerCase() !== FIXED_USERNAME.toLowerCase()) {
    return { error: 'שם משתמש או סיסמה שגויים.' };
  }
  const { error } = await supabase.auth.signInWithPassword({ email: FIXED_ACCOUNT_EMAIL, password });
  if (error) return { error: 'שם משתמש או סיסמה שגויים.' };
  return { error: null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
