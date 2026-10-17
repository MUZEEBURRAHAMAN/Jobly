"""Hermetic test environment: a throwaway SQLite DB with seeded rows, never the developer's real one.

The env vars must be set before `backend.app.config` is imported, which is why this lives in conftest.
"""
import asyncio
import atexit
import os
import shutil
import tempfile

_TMP = tempfile.mkdtemp(prefix="jobly-tests-")
atexit.register(shutil.rmtree, _TMP, ignore_errors=True)

os.environ["DATABASE_PATH"] = os.path.join(_TMP, "test.db")
os.environ["ADMIN_TOKEN"] = "test-admin-token"
os.environ["RATE_LIMIT_PER_MIN"] = "0"
os.environ["RATE_LIMIT_WRITES_PER_MIN"] = "0"
os.environ["RATE_LIMIT_SYNC_PER_MIN"] = "0"
os.environ["ENABLE_DOCS"] = "0"
os.environ["EXTENSION_IDS"] = ""
os.environ["RESPONSE_CACHE_TTL_SECONDS"] = "0"  # off by default so tests see fresh data; test_cache.py turns it on
os.environ["SNAPSHOT_REPO"] = ""        # tests never touch the network

from backend.app.db import get_db_connection, get_utc_now, init_db  # noqa: E402

ROLES = ["product_design", "frontend_engineering", "product_management", "ai_ml", "fullstack_engineering"]


async def _seed():
    await init_db()
    now = get_utc_now()
    async with get_db_connection() as db:
        for i, (name, st) in enumerate([("Acme", "greenhouse"), ("Globex", "ashby")], start=1):
            await db.execute(
                "INSERT INTO companies (name, slug, careers_url, source_type, source_identifier, is_active, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?)",
                (name, name.lower(), f"https://example.com/{name.lower()}", st, name.lower(), now, now),
            )
        rows = []
        for n in range(40):
            rows.append((1 + n % 2, "Acme" if n % 2 == 0 else "Globex", "greenhouse", f"ext-{n}", f"Engineer {n}",
                         ROLES[n % 5], "mid", "remote", "Remote", f"https://jobs.example.com/{n}", now, now))
        rows.append((2, "Globex", "ashby", "ext-hourly", "Hourly Contractor Designer", "product_design", "mid", "remote", "Remote",
                     "https://jobs.example.com/hourly", now, now))
        rows.append((2, "Globex", "custom", "ext-js", "Bad Link Engineer", "frontend_engineering", "mid", "remote", "Remote",
                     "javascript:alert(1)", now, now))
        rows.append((1, "Acme", "custom", "ext-pct", "100% Remote Wildcard Role", "ai_ml", "mid", "remote", "Remote",
                     "https://jobs.example.com/pct", now, now))
        for r in rows:
            await db.execute(
                """INSERT INTO jobs (company_id, company_name, source_type, external_id, title, normalized_role, seniority,
                                     work_mode, location, application_url, content_hash, first_seen_at, last_seen_at, status)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'active')""",
                (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[3], r[10], r[11]),
            )
        # hourly rates are floats in real Ashby data
        await db.execute("UPDATE jobs SET min_salary = 60.58, max_salary = 108.17, salary_summary = '$60.58 – $108.17 per hour' WHERE external_id = 'ext-hourly'")
        from datetime import datetime, timedelta, timezone
        t = datetime.now(timezone.utc)
        await db.execute("UPDATE jobs SET posted_at = ? WHERE external_id = 'ext-0'", ((t - timedelta(hours=2)).isoformat(),))
        await db.execute("UPDATE jobs SET posted_at = ? WHERE external_id = 'ext-1'", ((t - timedelta(days=5)).isoformat(),))
        await db.execute("UPDATE jobs SET posted_at = ? WHERE external_id = 'ext-2'", ((t - timedelta(days=29)).isoformat(),))
        await db.execute("UPDATE jobs SET posted_at = ? WHERE external_id = 'ext-3'", ((t - timedelta(days=75)).isoformat(),))   # outside the 60-day window
        await db.commit()


asyncio.run(_seed())
