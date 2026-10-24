import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import {
  THEME_STORAGE_KEY,
  applyTheme,
  readThemePreference,
  resolveTheme,
  saveThemePreference,
  systemDarkQuery,
  type ThemePreference,
} from '../utils/theme';

type ThemeContextType = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

// Wraps the whole app (main.tsx), not just Settings, so "System" keeps
// following the device on every page.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference);

  useEffect(() => {
    applyTheme(resolveTheme(preference));

    if (preference !== 'system') return;

    const query = systemDarkQuery();
    const follow = () => applyTheme(resolveTheme('system'));

    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, [preference]);

  // The storage event fires in the OTHER tabs, so a change reaches all of them.
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) setPreferenceState(readThemePreference());
    };

    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    saveThemePreference(next);
    setPreferenceState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return context;
};
