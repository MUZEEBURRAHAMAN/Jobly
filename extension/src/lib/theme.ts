export type Theme = 'dark' | 'light';

const THEME_KEY = 'muzeeb_theme_preference';

// S-6 FIX: Use chrome.storage.sync (syncs across devices) with localStorage as fallback
// for non-extension contexts (Vite dev server).
export const getInitialTheme = (): Theme => {
  try {
    // Fastest synchronous read: localStorage (will be kept in sync by applyTheme)
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // restricted context
  }
  return 'dark'; // Default dark-first per Muzeeb Design System spec
};

export const applyTheme = (theme: Theme): void => {
  // Write to both so they stay in sync
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }

  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    chrome.storage.sync.set({ [THEME_KEY]: theme }).catch(() => {});
  }

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
    if (document.body) document.body.setAttribute('data-theme', theme);
  }
};

// Call once on extension load to pull the synced value and override local default
export const syncThemeFromStorage = (callback: (theme: Theme) => void): void => {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    chrome.storage.sync.get(THEME_KEY).then((result) => {
      const stored = result[THEME_KEY];
      if (stored === 'light' || stored === 'dark') {
        applyTheme(stored);
        callback(stored);
      }
    }).catch(() => {});
  }
};
