# Jobly — QA + Security Audit

Date: 2026-10-16 · Commit audited: `bd44c58` · Method: Playwright (Chromium, MV3 extension loaded unpacked), axe-core, `pip-audit`, `npm audit`, direct API probing, code review.

**Safety note.** Every attack/stress probe ran against a **local copy** of the backend + a copy of `hiring_radar.db`, never against production. Exceptions: the service worker can't be network-intercepted, so it made read-only GETs to the live Render URL; and clicking "Refresh" in the popup triggered a real sync crawl on the *local* copy (public job-board GETs from this machine).

Every finding below was reproduced unless it says **(code review)**. Two results from my first test pass were wrong (my harness leaked through the `localhost:8000` fallback) and were discarded and re-run; the list below only contains re-verified items.

---

## Verdict

**Not ready for the Chrome Web Store yet.** The UI is polished and the client-side code is safe against XSS/SQLi, but the backend is a single-user, unauthenticated API: any visitor can crash it, overwrite everyone's settings, or make it fetch arbitrary URLs. Plus one severity-1 functional bug (dashboard empty on first run).

| Severity | Count | Meaning |
|---|---|---|
| P0 | 6 | Fix before publishing |
| P1 | 7 | Fix before publishing (user-visible breakage / a11y failures) |
| P2 | 24 | Fix soon |
| P3 | 9 | Polish |

---

## P0 — Critical

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| **SEC-01** | **One anonymous request can take the server down.** `GET /api/jobs?limit=-1` returns the *entire table* (`limit` has `le=200` but no `ge=1`; SQLite treats `LIMIT -1` as unlimited). | 20,899 rows, **36 MB**, 1.8 s. Server RSS **180 → 266 MB** for one request, **586 MB** for 4 concurrent. Render free = 512 MB. | `limit: int = Query(30, ge=1, le=200)`; add rate limiting. |
| **SEC-02** | **SSRF.** `POST /api/companies` with `source_type:"custom"` makes the *server* `GET` any `careers_url` (`follow_redirects=True`), then parses JSON-LD from the response and stores/serves it. | My local listener on `127.0.0.1:9999` received the server's request; its JSON-LD (`description:"internal-data-exfil-marker"`) came back out via `GET /api/jobs`. On Render this could reach internal services / cloud metadata. | Require auth; restrict to `https`, resolve DNS and reject private/loopback/link-local IPs; disable redirects (or re-validate each hop); drop user-supplied `custom` type. |
| **SEC-03** | **No authentication or authorization on any write endpoint.** | Anonymous callers succeeded at: overwrite preferences (even a 5 MB `custom_keywords`), toggle any company on/off for everyone, mark all notifications read, save/unsave jobs, create companies, trigger syncs. | Per-install identity + token (see SEC-04) and server-side authorization; separate admin-only endpoints for company management. |
| **SEC-04** | **Single global state = unusable once public.** Preferences (`SELECT * FROM preferences LIMIT 1`), `is_saved` (a column on the shared `jobs` table), and notifications are global. | Fresh profile already shows **someone else's saved job** (Saved tab badge "1"). Every installer would overwrite everyone's roles/saved list. Also makes the Web Store privacy claims untrue. | Move preferences + saved jobs into `chrome.storage` and make the API a read-only feed (cleanest, also delivers "privacy-first"); or add per-user rows keyed by an anonymous install ID. |
| **SEC-05** | **Unauthenticated write amplification / DoS.** No rate limiting anywhere; `create_company` schedules `sync_all_sources(new_id)` *directly*, bypassing `_sync_lock`. | 300 anonymous reports accepted in 0.9 s; 15 parallel company creations accepted in 0.1 s, each spawning its own crawl on a 512 MB box. | Rate limit (e.g. `slowapi`), auth on writes, route company-triggered syncs through the lock/queue. |
| **FUNC-01** | **Full-screen dashboard is empty on a fresh install.** Options page requests `limit=500` (and `limit=300`); backend caps at 200 → HTTP **422**. It only looks fine after the popup has primed `cachedJobs`. | Brand-new profile, open `options.html` first: **0 cards**, filter counts all 0, stats header OK (`/api/stats` works). Requests seen: `?limit=500`, `?only_matching=true&limit=300`. | Use `limit ≤ 200` + real pagination (`offset`) in `OptionsApp.tsx:63,100`. |

## P1 — High

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| **FUNC-02** | **Fractional salaries 500 the whole jobs endpoint.** `JobOut.min_salary/max_salary` are `int`; 3 Ashby (OpenAI hourly-rate) rows hold floats (60.58, 108.17). Any page containing one fails validation. | `GET /api/jobs?search=openai&limit=200` → 500 (`ValidationError … int_from_float`). Hidden on default pages only because those rows sit at feed position ~16,800. | Type as `float` or round on ingest (`extract_salary_info`). |
| **COLD-1** | **First open while Render is waking = broken-looking app.** Health timeout is 1.8 s, data timeout 4 s; free-tier wake is ~10–30 s. | Backend delayed 9 s: at 2 s header says **"ENGINE LIVE"** with all zeros; from 6 s **"OFFLINE CACHED"**; still **0 jobs at 22 s** (no retry) with the misleading empty-state "NO POSITIONS MATCH TARGET RULES". | "Connecting… (server waking up, up to 30 s)" state; exponential-backoff retry; longer first-request timeout; don't claim LIVE before first success. |
| **OPS-01** | **`api.getcatchly.com` no longer resolves** (nameservers moved from Cloudflare to GoDaddy `ns53/54.domaincontrol.com`). Keep-alive cron targets it, so Render sleeps → COLD-1. | `Could not resolve host`; `jobly-yd6l.onrender.com` works (32 s cold start). | Point cron at the onrender URL; restore/renew the domain or remove it from manifest/CSP/code. |
| **FUNC-03** | **Saved jobs vanish from the dashboard.** Options derives saved jobs from the 500 newest rows (`jobsData.items.filter(is_saved)`, `OptionsApp.tsx:71`). | API `saved_jobs = 2`; Options "SAVED SHORTLIST" = **0**. Gets worse as the feed grows. | Fetch with `saved_only=true`. |
| **SW-01** | **First-run spam + fragile scheduling.** Service worker alerts for *all* unread global notifications at install, and the alarm is only created in `onInstalled`. | `TRIGGER_BACKGROUND_CHECK` produced a digest notification and stored 50 alerted IDs. After `chrome.alarms.clearAll()` nothing recreates it (Chrome may drop alarms on restart — **docs-based**, not reproduced). | On install, mark existing notifications as seen without alerting; create the alarm at SW startup if `alarms.get()` is empty. |
| **A11Y-01** | **No visible keyboard focus.** `.btn { outline:none }` (`index.css:181`) and no `:focus-visible` rule exist. | 27 of 40 tab stops (search, FILTERS, SAVE, Share…) have no outline/box-shadow. WCAG 2.4.7. | Add a global `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }`. |
| **A11Y-02** | **Unlabeled form controls** (axe *critical*). The two checkboxes in Rules (popup and options) have no accessible name; the watchlist search input has only a placeholder. | axe `label` ×2 on Rules (both pages). | `aria-label` / `<label>`. |

## P2 — Medium

**Reliability / honesty of the UI**
| ID | Finding | Evidence |
|---|---|---|
| FUNC-04 | Out-of-order responses overwrite newer search results (no abort/sequencing). | Typed `zz` (slow) then `palantir`: box says "palantir", list shows **0 results**. |
| FUNC-05 | Save fails silently (no rollback/error). | Server `saved_jobs` stayed 2 while UI showed SAVED. |
| FUNC-06 | Report dialog says "REPORT RECEIVED… action within 24 hours" even if the request failed; promise has no workflow behind it (reports table is write-only). | Observed with POSTs blocked. |
| FUNC-07 | Preferences show "✓ SAVED!" when the request failed (falls back to local cache, later reverts to server value). | Observed with POSTs blocked. |
| FUNC-08 | Add-company failure: no feedback + unhandled promise rejection (`try/finally` without `catch`, stale copy "Local engine is unreachable"). | `pageerrors: 1`, no message. |
| FUNC-09 | A backend 500 is presented as "ENGINE LIVE" + "NO POSITIONS MATCH TARGET RULES". `safeFetch` treats any non-2xx as "offline" and retries *non-idempotent POSTs* against every fallback host. | `/api/jobs` forced to 500. **(POST retry: code review)** |

**Backend validation / hardening**
| ID | Finding | Evidence |
|---|---|---|
| SEC-06 | Input validation gaps → unhandled 500s: `freshness_days=99999999999` (OverflowError), `min_budget=2^64`, `offset=2^64`, search with ≥1000 words (SQLite variable limit). No `max_length` on any field. | all returned 500. |
| SEC-07 | Hostile URLs accepted and stored (`javascript:`, `file:///`, `data:`); phishing lookalike links render identically to real ATS links. | API returned 200 for `careers_url=javascript:alert(1)`/`file:///etc/passwd`. **CSP did block execution** (console: "Running the JavaScript URL violates… script-src 'self'"), so this is defense-in-depth, not live XSS. |
| SEC-08 | Raw DB error leaked to clients. | `{"detail":"Failed to create company: UNIQUE constraint failed: companies.slug"}` |
| SEC-09 | `/docs`, `/redoc`, `/openapi.json` public; no security headers on API. | all 200; no `x-content-type-options`, etc. |
| SEC-10 | CORS reflects **any** `chrome-extension://*` origin (evil web origins correctly get none). Pin to your published extension ID. | `ACAO: chrome-extension://abcdef…`. |
| SEC-11 | Extension probes `127.0.0.1:8000` / `localhost:8000` on every user's machine and POSTs preferences there. Any local dev server answering `/health` becomes "ENGINE LIVE". | `api.ts`, `service-worker.ts`, manifest `host_permissions` + CSP. Remove from production build. |
| BUG-01 | `HEAD /health` → 405. This is what broke the cron monitor. | Use `@router.api_route("/health", methods=["GET","HEAD"])`. |
| BUG-02 | Custom-portal jobs without an identifier use `hash(title+url)` as `external_id`; Python randomizes `str` hashes per process → **duplicates after every restart** (Render sleeps/wakes constantly). **(code review)** | Use `hashlib.sha1`. |

**Accessibility / visual**
| ID | Finding | Evidence |
|---|---|---|
| A11Y-03 | Light theme fails contrast badly: green `#22c55e` on light = **1.99–2.27 : 1** ("ENGINE LIVE", REMOTE, stats); orange `#e8602a` = 3.1–3.4 : 1; dark theme: white-on-orange 3.42 : 1. Need 4.5 : 1. | axe `color-contrast` ×10–25 per view. |
| A11Y-04 | Text is tiny: **37 elements at 8.5 px, 167 at 10 px**, nav labels 9–9.5 px. | computed styles. |
| A11Y-05 | Report dialog: focus doesn't move in on open, no focus trap (14 Tabs never entered it), focus lost on close. (Escape works.) | measured. |
| A11Y-06 | Bottom nav has no `role=tab/aria-selected/aria-current`; no `<main>`/h1 landmarks (axe moderate); 481–676 identical "TRACKING" buttons with no company name in their accessible name; 94 targets < 24 px on Options. | axe + DOM. |
| VIS-01 | Brand fonts never load: `@import` of Google Fonts is blocked by the extension CSP (`default-src 'self'`) → system-ui fallback + console error. | `loadedFonts: []`. Bundle `woff2` locally. |
| VIS-02 | **Refresh icon never spins.** `@keyframes spin` lives in an inline `<style>` in `Header.tsx:148`, which CSP blocks. | `spinKeyframes: false`; element references `animation: … spin`. Move to `index.css`. |

**Quality / process**
| ID | Finding | Evidence |
|---|---|---|
| TEST-01 | **5 of 10 API tests never run** (nested under `if __name__ == "__main__":` after `unittest.main()`). Others `return` silently when there are no jobs (false green). | `--collect-only`: "5 tests collected". |
| TEST-02 | Tests aren't hermetic: no `init_db`, assert on a real populated DB, and one POSTs to real preferences. Fresh checkout / CI: **4 failed, 9 passed**; with a DB: 13 passed. | pytest. No CI exists. |
| DEP-01 | `requirements.txt` uses `>=` only (unreproducible builds — also why a PyPI blip broke your last deploy); container runs as root. | Dockerfile has no `USER`. |
| PRIV-01 | Third-party calls not disclosed: `t2.gstatic.com` favicons (Google learns which companies each user views), Google Fonts. `CHROMEWEBSTORE.md` still says "Hiring Radar… runs locally… no third-party" — inaccurate. | network log. |

## P3 — Polish
- Hardcoded stats copy: "357 ATS monitors", "357 employers", "20,000+" vs real 481–676 companies / 23–27 k jobs; UI shows "V2.5" while manifest is `0.1.0`.
- Popup fetches 150 jobs (~180 KB) per query but renders 30; refetches every keystroke without abort; watchlist renders all rows (no virtualization).
- 400-char unbroken title renders **4,084 px wide**, clipped (no ellipsis/wrap).
- Options page not responsive below ~800 px (16 overflowing elements at 768, 454 at 375).
- Defaults to dark theme ignoring `prefers-color-scheme` (theme choice does persist via `storage.sync`).
- Manifest lacks `minimum_chrome_version`, `homepage_url`, `author`; description 122/132 chars OK.
- `alertedNotificationIds` grows unbounded; caches ≈ 350 KB in `storage.local` (fine for now).
- `npm audit`: 3 *dev-tool-only* advisories (vite/esbuild dev server, source-map-js); not shipped. Fix with `npm audit fix`.
- Dead code in `list_jobs` (`limit.default if hasattr(limit, "default")`).

---

## What passed
- **SQL injection:** all queries parameterized; 3 payloads tried, tables intact.
- **XSS:** React escaping works; payloads in search and in job descriptions never executed (0 dialogs); no `innerHTML`/`eval`; `javascript:` links blocked by CSP.
- Minimal permissions (`storage`, `notifications`, `alarms`); no content scripts; MV3; `script-src 'self'`.
- `tsc` and production build pass cleanly; `pip-audit`: no known vulnerabilities.
- Offline with a warm cache shows cached jobs labelled "OFFLINE CACHED" and client-side search works.
- Refresh double-click sends one sync; Escape closes the dialog; theme persists across popup reopen.

## Not covered
Real screen-reader testing, Firefox/Safari (N/A for Chrome-only MV3), Chrome-restart alarm persistence, Web Store review itself, load testing beyond the local probe.

## Suggested order of work
1. **Backend hardening (SEC-01…05, SEC-06, BUG-01):** `ge=1` on limit, auth + rate limits, SSRF guard, validation, error handling. ~half a day.
2. **Move user state into `chrome.storage` (SEC-04)** — removes most of the auth surface.
3. **FUNC-01/02/03** — three small, high-impact fixes.
4. **Cold-start UX + domain/cron (COLD-1, OPS-01).**
5. **A11y + CSP asset fixes (A11Y-01…06, VIS-01/02)** — mostly CSS.
6. Tests/CI, then privacy policy + listing text, then submit.
