// Theme persistence — localStorage ONLY, never business_settings (per
// explicit product decision: theme is a personal client-side preference,
// not business data). Zod-validated on read per CLAUDE.md's localStorage
// rule, even though the only writer is setStoredTheme() itself below.

import { z } from 'zod';

const STORAGE_KEY = 'harmonybid-theme';

const ThemePreferenceSchema = z.enum(['dark', 'light']);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

// Returns null when nothing has been saved yet, or the stored value fails
// validation — the caller decides the default (the app's existing default
// is dark; see dashboard-layout.tsx).
export function getStoredTheme(): ThemePreference | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = ThemePreferenceSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function setStoredTheme(theme: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Non-fatal — theme just won't persist across reloads this session.
  }
}
