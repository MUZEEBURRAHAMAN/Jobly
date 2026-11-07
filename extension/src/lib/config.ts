// Jobly has no server. The job list is a set of static files on Cloudflare Pages, re-published every few hours by the
// "Crawl and publish jobs" workflow; the extension reads them and does all filtering and matching in the browser.
// Local development can point at a local export with VITE_JOBLY_DATA (the browser tests answer this address themselves).
export const DATA_BASE = (import.meta.env.VITE_JOBLY_DATA as string | undefined) || 'https://jobly-data.pages.dev/v1';

// Largest page asked for at once.
export const MAX_PAGE_SIZE = 200;

// Per-attempt timeouts while connecting to the job data (it's on a CDN, so a long wait means it can't be reached).
export const CONNECT_TIMEOUTS_MS = [8000, 15000];

/** Reports and company suggestions open the user's email app addressed here; Jobly itself sends nothing. */
export const SUPPORT_EMAIL = 'rahamanmuzeeb1108@gmail.com';

/**
 * Parts of Jobly that are switched off for now. Their code and the user's data stay (backups still include them), so
 * switching one back on restores everything.
 * - tracker: the Tracker board, Interviews, Tasks, their reminders and calendar import. Jobs you applied to still
 *   show under Saved › Applied, which "Did you apply?", "You applied here before" and autofill rely on.
 */
export const FEATURES = { tracker: false } as const;
