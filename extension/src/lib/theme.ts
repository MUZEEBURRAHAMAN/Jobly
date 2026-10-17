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
  // First run: follow the operating system instead of forcing dark
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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

/**
 * Switch theme with a circle that grows out of the clicked control (View Transitions API), like the website.
 * `update` must apply the new theme to the DOM synchronously (call React's flushSync inside it).
 * Falls back to an instant switch when the API is missing or the user prefers reduced motion.
 */
export function switchThemeWithReveal(origin: Element | null | undefined, update: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  if (!doc.startViewTransition || !origin || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return; }
  const r = origin.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const t = doc.startViewTransition(update);
  t.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => { /* the theme already switched; only the animation was skipped */ });
}
