// Backend candidates, tried in order. Local addresses exist only in `--mode development` builds:
// in production every user's browser used to probe 127.0.0.1:8000/localhost:8000, so any local dev server
// answering /health became "ENGINE LIVE" and received the user's preferences.
// One backend. (api.getcatchly.com belongs to another project and must not be used here.)
const PROD_BASES = ['https://jobly-yd6l.onrender.com'];
const DEV_BASES = ['http://127.0.0.1:8000', 'http://localhost:8000'];

export const IS_DEV_BUILD = import.meta.env.MODE === 'development';
export const API_BASES: string[] = IS_DEV_BUILD ? [...DEV_BASES, ...PROD_BASES] : PROD_BASES;

// Largest page the backend accepts (`limit` is capped at 200 server-side; larger values return HTTP 422).
export const MAX_PAGE_SIZE = 200;

// Per-attempt timeouts while waiting for a sleeping free-tier backend to wake (~40s total).
export const WAKE_TIMEOUTS_MS = [6000, 12000, 22000];

// Jobly's job data as static files on Cloudflare Pages (published by the "Crawl and publish jobs" workflow).
// Reads come from here; the API above is the fallback while the data is unreachable, and handles writes.
// Development builds (and the browser tests) look for it on the local server, which has none, so they use the local API.
export const DATA_BASE = IS_DEV_BUILD ? 'http://127.0.0.1:8000/static-data/v1' : 'https://jobly-data.pages.dev/v1';
