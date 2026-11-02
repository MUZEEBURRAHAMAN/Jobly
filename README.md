# Jobly

> **Fresh jobs from company career pages, in your toolbar.**  
> A free Chrome extension, a website and Jobly Studio, built on job data that a scheduled GitHub job reads from the public job boards of 2,000+ employers. Each job keeps its real posting date; anything older than 60 days is dropped. There is no server and no account: everything is filtered in the browser, and preferences never leave it.

Live: website https://jobly-88t.pages.dev · Studio https://jobly-studio.pages.dev · job data https://jobly-data.pages.dev/v1

---

## Architecture Overview

```
 Employers' public job feeds (Greenhouse, Ashby, Lever, Workday, SmartRecruiters, Workable, Recruitee, Teamtailor, Personio, Keka, Darwinbox, Oracle Recruiting, Amazon)
 + three remote job boards (We Work Remotely, Himalayas, Arbeitnow)
        |
        | every 4 h: GitHub Actions "Crawl and publish jobs" (backend/ code, CRAWL_PROFILE=full)
        v
 Static job data on Cloudflare Pages (jobly-data.pages.dev/v1)      + a database snapshot release (first-seen dates carry over)
        |
        +---------------------------------+-------------------------------------+
        v                                 v                                     v
 Chrome extension (Manifest V3, React)   Website (Astro, Cloudflare Pages)     Jobly Studio (React, Cloudflare Pages)
 popup + dashboard, alerts on-device     guides, jobs by role, world map       tailored resumes and cover letters
```

Every client reads the same public files and filters, matches and sorts them in the browser (`shared/jobdata.ts`).
Reports and company suggestions open the user's email app; nothing is ever sent to Jobly.

---

## Quickstart

### 1. Use the extension

```bash
cd extension && npm ci && npm run build      # outputs extension/dist
```

1. Open `chrome://extensions/`, switch on **Developer mode**, click **Load unpacked** and pick `extension/dist`.
2. Pin **Jobly** to the toolbar. It reads the live job data from `https://jobly-data.pages.dev/v1`.

> `dist/` is the **production** build. This is what you zip for the Chrome Web Store (see `docs/store-listing-1.1.md`).

### 2. Develop against local job data

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt -r backend/requirements-dev.txt

SNAPSHOT_REPO= python -m backend.app.snapshot build /tmp/jobly.db.gz   # seed and crawl into ./hiring_radar.db (CRAWL_PROFILE=full adds Workday)
python -m backend.app.static_export /tmp/jobly-data           # publish it as static job data
python -m http.server 8787 -d /tmp/jobly-data                 # serve it

cd extension && VITE_JOBLY_DATA=http://127.0.0.1:8787/v1 npm run build:dev   # outputs extension/dist-dev
```

Load `extension/dist-dev` instead of `dist` (the manifest is named "Jobly (DEV)" and is allowed to read the local address).

### 3. Tests and quality checks

```bash
.venv/bin/python -m pytest -q                # backend: crawler, matching, categories, static export
cd extension && npx tsc --noEmit             # type-check
cd extension && npm run e2e                  # real Chromium with the built extension, reading a fixture published as static data
cd studio && npm test                        # Studio and the shared job-data client
```

### Local API (development only)

`backend/app/main.py` is a FastAPI app over the same database. Nothing in production uses it; it is handy for inspecting
a local crawl (`uvicorn backend.app.main:app --reload --port 8000`). Its settings:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `DATABASE_PATH` | `./hiring_radar.db` | SQLite file |
| `ADMIN_TOKEN` | *(unset)* | Enables company create/toggle and `?wait_for_completion=true` via the `X-Admin-Token` header. Unset = disabled |
| `ENABLE_DOCS` | `false` | Serves `/docs` when `true` |
| `AUTO_SYNC_INTERVAL_HOURS` | `2` | Background crawl interval |
| `SNAPSHOT_REPO` / `SNAPSHOT_TAG` / `SNAPSHOT_ASSET` | `MUZEEBURRAHAMAN/Jobly` / `snapshot` / `jobly.db.gz` | Where an empty database is restored from: the snapshot from (set `SNAPSHOT_REPO=` empty to disable) |
| `SNAPSHOT_TOKEN` | *(unset)* | Read-only GitHub token, needed only if the repo is private |
| `RATE_LIMIT_PER_MIN` / `_WRITES_PER_MIN` / `_SYNC_PER_MIN` | `120` / `30` / `3` | Per-IP limits (`0` disables) |

The design system (tokens, type scale, components) lives in `extension/src/styles/index.css`; empty/error illustrations
come from [`@lucasmarkes/hairline`](https://hairline.lucasmarkes.com) via `extension/src/components/EmptyState.tsx`.

---

## Supported hiring systems

| System | How it is read | Notes |
| :--- | :--- | :--- |
| **Greenhouse**, **Ashby**, **Lever** | Public job-board APIs | Bulk of the jobs; real publish dates |
| **SmartRecruiters**, **Workable**, **Recruitee**, **Teamtailor**, **Personio**, **Keka**, **Darwinbox**, **Oracle Recruiting** | Public feeds employers embed on their careers pages (Keka and Darwinbox: many Indian employers) | `backend/app/ingestion/more_boards.py` |
| **Workday** | Public careers-site search, one search per role family | Heavy: full crawl only |
| **Amazon Jobs** | Public search | |
| We Work Remotely, Himalayas, Arbeitnow | RSS / public APIs | Cards say "via <board>" |

Employers are listed in `backend/app/data/companies.json`; find and add them with `scripts/verify_employers.py`
(see `backend/app/data/README.md`). Coverage by source, role and country: `scripts/coverage_report.py`.

### Adding Any New Company
Add it to `backend/app/data/companies.json`; the next "Crawl and publish jobs" run picks it up. Users can suggest one from the extension (Companies → Suggest a company opens an email).

---

## Job data (static files, no server needed)

The extension, the website and Jobly Studio read jobs from static JSON files on Cloudflare Pages
(`https://jobly-data.pages.dev/v1/`), and filter, match and sort them in the browser (`shared/jobdata.ts`, with the same
rules as the local API). There is no other backend.

- **Every role, tech highlighted.** Each job has a category (`backend/app/categories.py`): one of the five tech roles, or a broad
  family (engineering, data, sales, marketing, people, finance, operations, ...). The extension lists the others under "More roles".
- **"Crawl and publish jobs" workflow** (`.github/workflows/jobs-data.yml`, every 4 hours): restores the last snapshot, crawls every
  board with the full profile (all roles, Workday and Amazon included), runs `python -m backend.app.static_export site`, deploys
  `site/` to the `jobly-data` Pages project, and republishes the snapshot release so the next run keeps first-seen dates.
- **"Discover companies" workflow** (`.github/workflows/discover-companies.yml`): tests the employers listed in `scripts/candidates/`
  against Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee and Workday (`scripts/discover_boards.py`) and commits the
  boards that answer with jobs to `backend/app/data/companies.json`.
- **Layout:** `meta.json` (columns, age buckets, categories, file sizes), `jobs/<category>/<age bucket>.json` (rows, newest first),
  `desc/<id % 2048>.json` (descriptions), `companies.json`, `stats.json`, `geo.json`. A query reads only its categories and the
  newest buckets it needs: tech roles posted in the last week are about 0.7 MB compressed at 200,000 jobs.

**One-time setup:** make the repository public (unlimited Actions minutes; a private repo's 2,000 free minutes a month aren't enough),
then add the repository secrets `CLOUDFLARE_API_TOKEN` (permission: Account → Cloudflare Pages → Edit) and `CLOUDFLARE_ACCOUNT_ID`.
Run "Discover companies" once, then "Crawl and publish jobs".

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
│   │   ├── lib/                  # Job-data client, storage, tracker, profiles, autofill
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
├── web/                          # The website (Astro, static): landing, guides, jobs by role, privacy; deployed to Cloudflare Pages by .github/workflows/web.yml
├── studio/                       # Jobly Studio (React, static): tailored resumes and cover letters
├── shared/jobdata.ts             # The static job-data client used by the extension, website and Studio
├── store-assets/                 # Web Store screenshots and promo tiles (npm run e2e:screens)
└── README.md
```

## Freshness and testing

- Jobs older than `MAX_JOB_AGE_DAYS` (default **60**) are never stored or shown; closed postings are removed.
  The dashboard has a LinkedIn-style **Date posted** filter (24 h / 3 days / week / 2 weeks / month).
- Backend tests: `.venv/bin/python -m pytest -q`
- End-to-end + accessibility tests in real Chromium: `cd extension && npm run e2e` (screenshots: `npm run e2e:screens`)
