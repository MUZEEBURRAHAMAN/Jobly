from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .db import init_db
from .api.routes import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Find jobs. Apply smarter — Zero-cost job discovery and matching engine for Jobly Chrome Extension",
    lifespan=lifespan
)

# S-1 FIX: Tightened CORS — no wildcard, no credentials (none are used)
ALLOWED_ORIGINS = [
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"chrome-extension://.*",  # Allow any installed extension ID
    allow_credentials=False,   # No cookies used — safe to disable
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)

app.include_router(router)
