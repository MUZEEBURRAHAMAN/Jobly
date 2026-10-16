# Jobly

> **Zero-Cost, Role-Based Hiring Radar Chrome Extension MVP**  
> A proactive job-discovery engine and Chrome extension that tracks top tech companies and alerts you when positions matching your role preferences are published.

---

## Architecture Overview

```
                      +-----------------------------------+
                      |   Public ATS Feeds (Zero Cost)    |
                      |   Greenhouse · Lever · Ashby      |
                      +-----------------+-----------------+
                                        |
                                        v
+-------------------------------------------------------------------------+
| Local Python Engine (FastAPI + SQLite + HTTPX)                          |
|  - ATS Ingestion Adapters (Greenhouse, Lever, Ashby)                    |
|  - Normalization & SHA-256 Content Deduplication                       |
|  - Deterministic Role & Seniority Matching                              |
|  - REST API (http://127.0.0.1:8000)                                    |
+-----------------------------------+-------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| Chrome Extension (Manifest V3 · React + TypeScript + Vite)             |
|  - Popup UI: Role feed, company watchlist, saved jobs, rule settings    |
|  - Background Service Worker: chrome.alarms + grouped push notifications|
|  - Options Dashboard: Full screen search, company manager, stats strip  |
+-------------------------------------------------------------------------+
```

---

## Quickstart

### 1. Use the extension (production backend)

```bash
cd extension && npm ci && npm run build      # outputs extension/dist
```

1. Open `chrome://extensions/`, switch on **Developer mode**, click **Load unpacked** and pick `extension/dist`.
2. Pin **Jobly** to the toolbar. It talks to the hosted backend (`https://jobly-yd6l.onrender.com`).
   The free server sleeps when idle: the first open can take ~30 s ("Connecting…"), then it works normally.

> `dist/` is the **production** build: it only talks to the hosted backend and never to localhost.
> This is what you zip for the Chrome Web Store (see `CHROMEWEBSTORE.md`).

### 2. Develop against a local backend

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt -r backend/requirements-dev.txt

# Starts empty, seeds the bundled company list and crawls on its own (~1-2 min for ~18k jobs)
uvicorn backend.app.main:app --reload --port 8000

cd extension && npm run build:dev            # outputs extension/dist-dev (allows localhost)
```

Load `extension/dist-dev` instead of `dist` (the manifest is named "Jobly (DEV)").

### 3. Tests and quality checks

```bash
pytest                                       # 44 tests, hermetic (temp database, never your real one)
cd extension && npx tsc --noEmit             # type-check
```

### Server settings (environment variables)

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `DATABASE_PATH` | `./hiring_radar.db` | SQLite file. Render's free tier has no persistent disk: the server re-seeds and re-crawls on every restart |
| `ADMIN_TOKEN` | *(unset)* | Enables company create/toggle and `?wait_for_completion=true` via the `X-Admin-Token` header. Unset = disabled |
| `EXTENSION_IDS` | *(any extension)* | Comma-separated Chrome extension IDs allowed by CORS. **Set this after publishing** |
| `ENABLE_DOCS` | `false` | Serves `/docs` when `true` |
| `AUTO_SYNC_INTERVAL_HOURS` | `2` | Background crawl interval |
| `RATE_LIMIT_PER_MIN` / `_WRITES_PER_MIN` / `_SYNC_PER_MIN` | `120` / `30` / `3` | Per-IP limits (`0` disables) |

The design system (tokens, type scale, components) lives in `extension/src/styles/index.css`; empty/error illustrations
come from [`@lucasmarkes/hairline`](https://hairline.lucasmarkes.com) via `extension/src/components/EmptyState.tsx`.

---

## Supported ATS Platforms & Seed Catalog

| Platform | Endpoint Type | Cost | Examples Tracked |
| :--- | :--- | :--- | :--- |
| **Greenhouse** | Public Board JSON API | ₹0 | Stripe, Figma, Airbnb, GitLab, Datadog, Robinhood, Pinterest |
| **Ashby** | Public Job Postings API | ₹0 | OpenAI, Linear, Ramp, Notion, Cursor, Perplexity, Replit, Sentry |
| **Lever** | Public Postings API | ₹0 | Palantir, Wealthfront |

### Adding Any New Company
Add it to `backend/app/data/companies.json` (or, in a dev build, use the **Companies → Add** form with `ADMIN_TOKEN` set). The server picks up new entries on its next start.

---

## Directory Structure

```
JOB EXTENSION/
├── backend/
│   ├── app/
│   │   ├── api/routes.py         # REST endpoints for jobs, companies, preferences
│   │   ├── ingestion/
│   │   │   ├── base.py           # NormalizedJob dataclass & hash calculation
│   │   │   ├── greenhouse.py     # Greenhouse ATS adapter
│   │   │   ├── lever.py          # Lever ATS adapter
│   │   │   ├── ashby.py          # Ashby ATS adapter
│   │   │   └── runner.py         # Concurrent ingestion & sync runner
│   │   ├── config.py             # App settings (env-driven) & database paths
│   │   ├── security.py           # SSRF guard, URL sanitising, rate limiting, security headers
│   │   ├── seed.py               # First-boot company seeding + initial-sync check
│   │   ├── data/companies.json   # Bundled company list (ships in the Docker image)
│   │   ├── db.py                 # Async SQLite connection & table schemas
│   │   ├── matching.py           # Deterministic role & seniority matcher
│   │   ├── schemas.py            # Pydantic models
│   │   └── main.py               # FastAPI application
│   └── tests/                    # Unit and integration test suite
├── extension/
│   ├── public/
│   │   ├── icons/                # 16, 48, 128 px radar icons
│   │   └── manifest.json         # Manifest V3 configuration
│   ├── src/
│   │   ├── background/           # Service worker & notification alarm
│   │   ├── components/           # JobsFeed, JobCard, Companies, Saved, Alerts, Preferences, EmptyState
│   │   ├── lib/                  # Local API client & storage caching
│   │   ├── popup/                # Extension popup app
│   │   ├── options/              # Full dashboard app
│   │   └── styles/               # Design system: tokens, type scale, components (light + dark)
│   ├── dist/                     # Production build ready for Chrome
│   ├── package.json
│   └── vite.config.ts
├── data/
│   └── companies.json            # Curated catalog of tech employers
├── scripts/
│   ├── seed_companies.py         # Seed companies into SQLite
│   ├── sync_jobs.py              # Ingestion CLI trigger
│   └── generate_icons.py         # PNG icon generator
├── CHROMEWEBSTORE.md             # Chrome Web Store listing metadata & disclosures
└── README.md
```
