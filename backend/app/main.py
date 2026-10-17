import re
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .db import init_db
from .api.routes import router, start_periodic_sync, stop_periodic_sync
from .cache import ResponseCacheMiddleware
from .security import RateLimitMiddleware, SecurityHeadersMiddleware
from .seed import needs_initial_sync, seed_companies_if_missing
from .snapshot import restore_snapshot_if_needed

@asynccontextmanager
async def lifespan(app: FastAPI):
    await restore_snapshot_if_needed()  # empty database + a published snapshot = instant start
    await init_db()
    await seed_companies_if_missing()
    # Empty/stale database (normal after a deploy on a free instance): crawl right away instead of in 2 hours.
    start_periodic_sync(initial_delay=10 if await needs_initial_sync(settings.AUTO_SYNC_INTERVAL_HOURS) else None)
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
app.add_middleware(ResponseCacheMiddleware)   # innermost: rate limits and security headers still apply to cache hits
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
