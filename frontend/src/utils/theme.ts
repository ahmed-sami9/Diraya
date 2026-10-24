// Light or dark: how the choice is stored and applied. index.html has a tiny
// copy of the read-and-apply part, so the theme is set before the first paint.

export type ThemePreference = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

// Keep both in sync with the script in index.html.
export const THEME_STORAGE_KEY = 'diraya-theme';
// Light until every page has been checked in dark mode; then 'system'.
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'light';

const PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

const isThemePreference = (value: unknown): value is ThemePreference =>
  PREFERENCES.includes(value as ThemePreference);

// localStorage throws in some private modes, so every access is guarded.
export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Still applied for this visit; it just won't be remembered.
  }
}

export const systemDarkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export const resolveTheme = (preference: ThemePreference): Theme =>
  preference === 'system' ? (systemDarkQuery().matches ? 'dark' : 'light') : preference;

// The class switches our colour tokens (index.css); color-scheme switches the
// browser's own parts: scrollbars, autofill, date pickers.
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}
