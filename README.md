# Jobly

> **Fresh tech jobs from company career pages, in your toolbar.**  
> A free Chrome extension, a website and a small server that read the public job boards of about 600 employers, keep each job's real posting date, hide anything older than 60 days and alert you to new matches. No account; preferences stay in the browser.

Live: website https://joblyextension.netlify.app · server https://jobly-yd6l.onrender.com (`/health` shows its state).

---

## Architecture Overview

```
 Employers' public job feeds (Greenhouse, Ashby, Lever, Workday, SmartRecruiters, Workable, Recruitee, Teamtailor, Personio, Amazon)
 + three remote job boards (We Work Remotely, Himalayas, Arbeitnow)
        |                                      \
        | every 4 h, full crawl                 \ every 2 h, light crawl
        v                                        v
 GitHub Actions "snapshot" job  ---- release ---> Render server (FastAPI + SQLite, free plan)
 (CRAWL_PROFILE=full, free)        asset          restores the snapshot at start, then crawls the light sources
                                                   |
                          +------------------------+-----------------------+
                          v                                                v
        Chrome extension (Manifest V3, React)                Website (Astro, Netlify)
        popup + dashboard, alerts computed on-device         guides, jobs by role, world map, forms
```

Why two crawls: Render's free plan has no disk, so every restart starts empty. The scheduled GitHub job does the heavy
reading (Workday's many searches, deeper Arbeitnow pages) and publishes a database snapshot; the server downloads it in a
second when it starts and then refreshes the lighter sources itself (`CRAWL_PROFILE=light`).

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
> This is what you zip for the Chrome Web Store (see `store-assets/LISTING.md`).

### 2. Develop against a local backend

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt -r backend/requirements-dev.txt

# Starts empty, seeds the bundled company list and crawls on its own (a few minutes for ~25k jobs; set CRAWL_PROFILE=full to include Workday)
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
| `SITE_ORIGINS` | `https://joblyextension.netlify.app` | Comma-separated web origins allowed by CORS: the website and Jobly Studio (for example `https://jobly-studio.pages.dev`) |
| `ENABLE_DOCS` | `false` | Serves `/docs` when `true` |
| `AUTO_SYNC_INTERVAL_HOURS` | `2` | Background crawl interval |
| `SNAPSHOT_REPO` / `SNAPSHOT_TAG` / `SNAPSHOT_ASSET` | `MUZEEBURRAHAMAN/Jobly` / `snapshot` / `jobly.db.gz` | Where an empty server restores a database snapshot from (set `SNAPSHOT_REPO=` empty to disable) |
| `SNAPSHOT_TOKEN` | *(unset)* | Read-only GitHub token; **required while the repo is private** |
| `RATE_LIMIT_PER_MIN` / `_WRITES_PER_MIN` / `_SYNC_PER_MIN` | `120` / `30` / `3` | Per-IP limits (`0` disables) |

### Warm starts (free tier has no disk)

`.github/workflows/snapshot.yml` crawls every 6 hours and publishes a ~4 MB database snapshot to the `snapshot` release.
An empty server downloads it on boot and serves jobs in under a second instead of re-crawling for ~2 minutes
(it then refreshes in the background). Run it once with **Actions → Publish job snapshot → Run workflow**.
With a private repo, create a fine-grained token (this repo, *Contents: read-only*) and set it as `SNAPSHOT_TOKEN` on Render.

The design system (tokens, type scale, components) lives in `extension/src/styles/index.css`; empty/error illustrations
come from [`@lucasmarkes/hairline`](https://hairline.lucasmarkes.com) via `extension/src/components/EmptyState.tsx`.

---

## Supported hiring systems

| System | How it is read | Notes |
| :--- | :--- | :--- |
| **Greenhouse**, **Ashby**, **Lever** | Public job-board APIs | Bulk of the jobs; real publish dates |
| **SmartRecruiters**, **Workable**, **Recruitee**, **Teamtailor**, **Personio** | Public feeds employers embed on their careers pages | `backend/app/ingestion/more_boards.py` |
| **Workday** | Public careers-site search, one search per role family | Heavy: full crawl only |
| **Amazon Jobs** | Public search | |
| We Work Remotely, Himalayas, Arbeitnow | RSS / public APIs | Cards say "via <board>" |

Employers are listed in `backend/app/data/companies.json`; find and add them with `scripts/verify_employers.py`
(see `backend/app/data/README.md`). Coverage by source, role and country: `scripts/coverage_report.py`.

### Adding Any New Company
Add it to `backend/app/data/companies.json` (or, in a dev build, use the **Companies → Add** form with `ADMIN_TOKEN` set). The server picks up new entries on its next start.

---

## Jobly Studio

`studio/` is a separate web app: tailored resumes and cover letters from one profile, with a fact check that keeps drafts to what the profile says, and an application tracker. It runs entirely in the browser (no server, no account) and deploys as a static site. See [studio/README.md](studio/README.md).

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
├── scripts/
│   ├── seed_companies.py         # Seed companies into SQLite
│   ├── sync_jobs.py              # Ingestion CLI trigger
│   └── generate_icons.py         # PNG icon generator
├── web/                          # The website (Astro, static): landing, guides, jobs by role, privacy; deployed on Netlify
├── netlify.toml                  # Netlify: build web/ and publish web/dist
├── render.yaml                   # Render blueprint (the live service is configured in the Render dashboard)
├── store-assets/                 # Web Store screenshots, promo tile and LISTING.md (npm run e2e:screens)
└── README.md
```

## Freshness and testing

- Jobs older than `MAX_JOB_AGE_DAYS` (default **60**) are never stored or shown; closed postings are removed.
  The dashboard has a LinkedIn-style **Date posted** filter (24 h / 3 days / week / 2 weeks / month).
- Backend tests: `.venv/bin/python -m pytest -q`
- End-to-end + accessibility tests in real Chromium: `cd extension && npm run e2e` (screenshots: `npm run e2e:screens`)

## Capacity (free Render instance: 0.1 CPU, 512 MB)

Most traffic is the extension's background check (every 60-90 minutes per browser). To keep that cheap:

- `backend/app/cache.py` answers identical `/api/jobs`, `/api/stats` and `/api/companies` queries from memory for
  `RESPONSE_CACHE_TTL_SECONDS` (120; 0 turns it off). Identical requests that arrive together are computed once, and the cache
  is cleared when a crawl finishes. It is bounded (400 entries / 24 MB).
- Responses carry an `ETag`; the browser revalidates and gets an empty `304` when nothing changed.
- At most `MAX_CONCURRENT_QUERIES` (6) database-heavy requests run at once; extra ones wait up to
  `QUERY_QUEUE_TIMEOUT_SECONDS` (8) and then get a quick `503` (the extension shows "Jobly is busy right now" and keeps its cached list)
  instead of piling up until the instance runs out of memory.
- Local load test on a 20k-job database with 40% of simulated users having unique preferences (cache cannot help them):
  throughput 34-45 → 76-133 requests/s, median latency 26 ms → 1.4 ms, memory after 50 concurrent clients 395 MB → 86 MB.
  Render's free CPU is roughly 10x slower than a laptop core, so scale those numbers down accordingly.
