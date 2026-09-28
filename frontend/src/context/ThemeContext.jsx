import React, { createContext, useContext, useState, useEffect } from 'react';
import { Storage } from '../utils/storage';

const THEME_STORAGE_KEY = 'trustsphere_theme';
const ThemeContext = createContext(null);

function getInitialTheme() {
  try {
    const direct = localStorage.getItem(THEME_STORAGE_KEY);
    if (direct === 'light' || direct === 'dark') {
      return direct;
    }
    const savedSettings = Storage.getSettings();
    if (savedSettings?.theme === 'light') {
      return 'light';
    }
  } catch (e) {
    // Ignore localStorage access errors
  }
  return 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    const normalized = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', normalized);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalized);
      const currentSettings = Storage.getSettings();
      if (currentSettings.theme !== normalized) {
        Storage.setSettings({ ...currentSettings, theme: normalized });
      }
    } catch (e) {
      console.error('Failed to persist theme:', e);
    }
  }, [theme]);

  const setTheme = (nextTheme) => {
    setThemeState(nextTheme === 'light' ? 'light' : 'dark');
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
