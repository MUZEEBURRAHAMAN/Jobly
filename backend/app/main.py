import re
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .db import init_db
from .api.routes import router, start_periodic_sync, stop_periodic_sync
from .security import RateLimitMiddleware, SecurityHeadersMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    start_periodic_sync()
    yield
    stop_periodic_sync()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Find jobs. Apply smarter — Zero-cost job discovery and matching engine for Jobly Chrome Extension",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_DOCS else None,
    openapi_url="/openapi.json" if settings.ENABLE_DOCS else None,
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

_ext_ids = [i.strip() for i in settings.EXTENSION_IDS.split(",") if i.strip()]
# Pin CORS to the published extension ID(s) in production (EXTENSION_IDS); any extension only when unset (dev).
_EXTENSION_ORIGIN_REGEX = (
    r"^chrome-extension://(" + "|".join(re.escape(i) for i in _ext_ids) + r")$" if _ext_ids else r"^chrome-extension://[a-p]{32}$"
)

# add_middleware() wraps: the LAST one added is outermost. CORS must be outermost so even 429s carry CORS headers.
app.add_middleware(RateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=_EXTENSION_ORIGIN_REGEX,
    allow_credentials=False,   # No cookies used — safe to disable
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)

app.include_router(router)
