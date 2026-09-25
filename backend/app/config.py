from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    APP_NAME: str = "Hiring Radar API"
    APP_VERSION: str = "0.1.0"
    DATABASE_PATH: Path = BASE_DIR / "hiring_radar.db"
    COMPANIES_FILE: Path = BASE_DIR / "data" / "companies.json"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "chrome-extension://*",
        "*"
    ]

    class Config:
        env_file = ".env"

settings = Settings()
