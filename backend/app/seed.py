"""First-boot bootstrap. The production image ships without a database (and Render's free tier has no persistent
disk), so an empty database is the normal state after every deploy/restart: seed the company list, then crawl."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from .config import settings
from .db import get_db_connection, get_utc_now
from .security import sanitize_http_url

logger = logging.getLogger(__name__)
_REQUIRED = ("name", "slug", "source_type", "source_identifier")

# Sources Jobly no longer reads, and employers whose job board has been closed or moved. Their stored rows (a restored snapshot may
# still hold them) are deleted at start and after every crawl, so old listings can't linger until they age out.
RETIRED_SOURCES = ("remotive",)
RETIRED_COMPANY_SLUGS = ("anthropic", "canva", "webflow", "framer", "raycast", "liveblocks", "confluent", "retool", "clay", "deel", "amplitude")


async def retire_stale_rows(db=None) -> int:
    """Delete jobs and employers of retired sources and boards. Returns the number of jobs removed."""
    async def run(conn) -> int:
        marks = ",".join("?" * len(RETIRED_COMPANY_SLUGS))
        srcs = ",".join("?" * len(RETIRED_SOURCES))
        ids = [r["id"] for r in await (await conn.execute(
            f"SELECT id FROM companies WHERE slug IN ({marks}) OR source_type IN ({srcs})", (*RETIRED_COMPANY_SLUGS, *RETIRED_SOURCES))).fetchall()]
        removed = (await conn.execute(f"DELETE FROM jobs WHERE source_type IN ({srcs})", RETIRED_SOURCES)).rowcount
        for cid in ids:
            removed += (await conn.execute("DELETE FROM jobs WHERE company_id = ?", (cid,))).rowcount
            await conn.execute("DELETE FROM companies WHERE id = ?", (cid,))
        await conn.commit()
        return max(removed, 0)
    if db is not None:
        return await run(db)
    async with get_db_connection() as conn:
        return await run(conn)


async def seed_companies_if_missing() -> int:
    """Insert companies from the bundled list that are not in the database yet (existing rows are left alone,
    so toggles and edits survive). Returns how many were inserted."""
    path = settings.COMPANIES_FILE
    if not path.exists():
        logger.warning("[Seed] %s not found; skipping company seed", path)
        return 0
    try:
        companies = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        logger.exception("[Seed] Could not read %s", path)
        return 0

    now = get_utc_now()
    inserted = 0
    async with get_db_connection() as db:
        cursor = await db.execute("SELECT slug FROM companies")
        known = {row["slug"] for row in await cursor.fetchall()}
        for c in companies:
            if not isinstance(c, dict) or any(not c.get(k) for k in _REQUIRED) or c["slug"] in known:
                continue
            await db.execute(
                """INSERT INTO companies (name, slug, careers_url, source_type, source_identifier, industry, logo_url,
                                          is_active, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)""",
                (c["name"], c["slug"], sanitize_http_url(c.get("careers_url")), str(c["source_type"]).lower(),
                 c["source_identifier"], c.get("industry"), sanitize_http_url(c.get("logo_url")), now, now),
            )
            known.add(c["slug"])
            inserted += 1
        await db.commit()
    if inserted:
        logger.info("[Seed] Inserted %d companies", inserted)
    return inserted


async def needs_initial_sync(max_age_hours: float) -> bool:
    """True when there are no jobs yet, or the newest data is older than the sync interval."""
    async with get_db_connection() as db:
        cursor = await db.execute("SELECT COUNT(*) AS n, MAX(last_seen_at) AS newest FROM jobs")
        row = await cursor.fetchone()
    if not row or row["n"] == 0 or not row["newest"]:
        return True
    try:
        newest = datetime.fromisoformat(row["newest"])
    except ValueError:
        return True
    return datetime.now(timezone.utc) - newest > timedelta(hours=max_age_hours)
