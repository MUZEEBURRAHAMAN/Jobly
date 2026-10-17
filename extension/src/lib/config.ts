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
