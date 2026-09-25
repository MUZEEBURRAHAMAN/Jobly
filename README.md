# Hiring Radar 🎯

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

## Quickstart (Zero-Cost Local Setup)

### 1. Start the Local Python Engine

```bash
# Activate virtual environment
source .venv/bin/activate

# Seed curated tech companies (OpenAI, Stripe, Figma, Linear, Ramp, etc.)
python scripts/seed_companies.py

# Sync real live job postings from ATS feeds
python scripts/sync_jobs.py

# Start local FastAPI server on port 8000
uvicorn backend.app.main:app --reload --port 8000
```

> **API Documentation**: Once running, visit [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) to test interactive OpenAPI endpoints.

---

### 2. Load the Chrome Extension

1. In Google Chrome, navigate to `chrome://extensions/`
2. Enable **"Developer mode"** in the top-right corner.
3. Click **"Load unpacked"**.
4. Select the folder:
   ```
   JOB EXTENSION/extension/dist
   ```
5. Pin **Hiring Radar** to your Chrome toolbar!

---

### 3. Build & Development Commands

```bash
# Run tests
.venv/bin/python -m unittest backend/tests/test_radar.py
.venv/bin/python -m unittest backend/tests/test_api.py

# Extension frontend development
cd extension
npm run dev     # Starts Vite dev preview
npm run build   # Compiles TypeScript & bundles into extension/dist
```

---

## Supported ATS Platforms & Seed Catalog

| Platform | Endpoint Type | Cost | Examples Tracked |
| :--- | :--- | :--- | :--- |
| **Greenhouse** | Public Board JSON API | ₹0 | Stripe, Figma, Airbnb, GitLab, Datadog, Robinhood, Pinterest |
| **Ashby** | Public Job Postings API | ₹0 | OpenAI, Linear, Ramp, Notion, Cursor, Perplexity, Replit, Sentry |
| **Lever** | Public Postings API | ₹0 | Palantir, Wealthfront |

### Adding Any New Company
You can add any company with a public Greenhouse, Ashby, or Lever board directly from the extension's **"Companies"** tab by entering their board token (e.g. `supabase`, `datadog`).

---

## Background Automated Ingestion (Optional Cron)

On macOS/Linux, you can schedule the sync script to run automatically in the background using `cron`:

```bash
# Edit crontab
crontab -e

# Run sync every 30 minutes (adjust paths to your machine)
*/30 * * * * cd "/Users/muzeeburrahaman/Downloads/ai agents/JOB EXTENSION" && .venv/bin/python scripts/sync_jobs.py >> /tmp/hiring_radar_sync.log 2>&1
```

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
│   │   ├── config.py             # App settings & database paths
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
│   │   ├── components/           # RadarFeed, JobCard, Watchlist, Preferences
│   │   ├── lib/                  # Local API client & storage caching
│   │   ├── popup/                # Extension popup app
│   │   ├── options/              # Full dashboard app
│   │   └── styles/               # Glassmorphism dark mode design system
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
