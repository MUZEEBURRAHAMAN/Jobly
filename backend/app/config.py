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
    COMPANIES_FILE: Path = BASE_DIR / "data" / "companies.json"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    # Internal self-scheduled sync — replaces the external cron-job.org "Auto-Sync" pinger,
    # which was an unreliable way to trigger real background work from a 3rd-party watchdog.
    AUTO_SYNC_INTERVAL_HOURS: float = 2

    class Config:
        env_file = ".env"

settings = Settings()
