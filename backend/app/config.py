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

    # Required (X-Admin-Token header) for company create/toggle. Empty = those endpoints are disabled.
    ADMIN_TOKEN: str = ""
    # Comma-separated Chrome extension IDs allowed by CORS. Empty = any extension (dev only; set after publishing).
    EXTENSION_IDS: str = ""
    # Interactive API docs are off in production.
    ENABLE_DOCS: bool = False
    # Free-tier persistence: restore the newest snapshot from a GitHub release when the database is empty.
    # Public repo: no token needed. Private repo: set SNAPSHOT_TOKEN (fine-grained token, Contents: read-only).
    SNAPSHOT_REPO: str = "MUZEEBURRAHAMAN/Jobly"
    SNAPSHOT_TAG: str = "snapshot"
    SNAPSHOT_ASSET: str = "jobly.db.gz"
    SNAPSHOT_TOKEN: str = ""
    # Per-IP, per-minute limits. 0 disables a limit.
    RATE_LIMIT_PER_MIN: int = 120
    RATE_LIMIT_WRITES_PER_MIN: int = 30
    RATE_LIMIT_SYNC_PER_MIN: int = 3

    class Config:
        env_file = ".env"

settings = Settings()
