import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    APP_NAME: str = "Jobly API"
    APP_VERSION: str = "0.1.0"
    # Render persistent disk mounts to /data — override DATABASE_PATH env var to use it.
    # Local dev falls back to project root.
    DATABASE_PATH: Path = Path(os.environ.get("DATABASE_PATH", str(BASE_DIR / "hiring_radar.db")))
    COMPANIES_FILE: Path = Path(__file__).resolve().parent / "data" / "companies.json"  # ships inside the Docker image
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    # Internal self-scheduled sync — replaces the external cron-job.org "Auto-Sync" pinger,
    # which was an unreliable way to trigger real background work from a 3rd-party watchdog.
    AUTO_SYNC_INTERVAL_HOURS: float = 2

    # "light" (the default, for the free server): skip the heavy sources (Workday's many searches) and read fewer Arbeitnow pages.
    # "full" (the scheduled snapshot job on GitHub Actions, which costs the server nothing): read everything. The server restores
    # that snapshot whenever it starts, so heavy sources stay fresh without the server crawling them.
    CRAWL_PROFILE: str = "light"

    # Jobs posted longer ago than this are never stored or shown (stale/ghost listings; keeps the DB small).
    MAX_JOB_AGE_DAYS: int = 60

    # Required (X-Admin-Token header) for company create/toggle. Empty = those endpoints are disabled.
    ADMIN_TOKEN: str = ""
    # Comma-separated Chrome extension IDs allowed by CORS. Empty = any extension (dev only; set after publishing).
    EXTENSION_IDS: str = ""
    # The public website may read job counts (hero search, freshness chart, companies list). Comma-separated origins.
    SITE_ORIGINS: str = "https://joblyextension.netlify.app"
    # Interactive API docs are off in production.
    ENABLE_DOCS: bool = False
    # Free-tier persistence: restore the newest snapshot from a GitHub release when the database is empty.
    # Public repo: no token needed. Private repo: set SNAPSHOT_TOKEN (fine-grained token, Contents: read-only).
    SNAPSHOT_REPO: str = "MUZEEBURRAHAMAN/Jobly"
    SNAPSHOT_TAG: str = "snapshot"
    SNAPSHOT_ASSET: str = "jobly.db.gz"
    SNAPSHOT_TOKEN: str = ""
    # Read-path protection for the small free instance (see cache.py).
    RESPONSE_CACHE_TTL_SECONDS: int = 120      # identical job/stat/company queries are answered from memory; 0 disables
    MAX_CONCURRENT_QUERIES: int = 6            # database-heavy requests running at once (each holds several MB)
    QUERY_QUEUE_TIMEOUT_SECONDS: float = 8     # how long an extra request waits before a quick 503
    # Per-IP, per-minute limits. 0 disables a limit.
    RATE_LIMIT_PER_MIN: int = 120
    RATE_LIMIT_WRITES_PER_MIN: int = 30
    RATE_LIMIT_SYNC_PER_MIN: int = 3

    class Config:
        env_file = ".env"

settings = Settings()
