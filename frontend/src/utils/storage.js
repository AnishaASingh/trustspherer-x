const KEYS = {
  SESSION: 'trustsphere_session',
  TOKEN: 'trustsphere_token',
  SETTINGS: 'trustsphere_settings'
};

// Safe JSON parser
function safeParse(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error('Failed to parse localStorage data:', e);
    return fallback;
  }
}

// General helpers
export function getItem(key, fallback) {
  return safeParse(localStorage.getItem(key), fallback);
}

export function setItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to write to localStorage:', e);
  }
}

// Domain-specific getters & setters for UI preferences and local session caching
export const Storage = {
  KEYS,
  initialize: () => {},

  // Session
  getSession: () => getItem(KEYS.SESSION, null),
  setSession: (session) => setItem(KEYS.SESSION, session),
  clearSession: () => localStorage.removeItem(KEYS.SESSION),

  // Settings
  getSettings: () => getItem(KEYS.SETTINGS, {
    theme: 'dark',
    compactMode: false,
    notificationsSound: false,
    autoAnalyze: true,
    mfaEnabled: true,
    sessionTimeout: 60
  }),
  setSettings: (settings) => setItem(KEYS.SETTINGS, settings)
};

