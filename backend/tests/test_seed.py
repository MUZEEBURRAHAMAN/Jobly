import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

from backend.app.config import settings
from backend.app.db import get_db_connection, get_utc_now, init_db
from backend.app.seed import RETIRED_COMPANY_SLUGS, needs_initial_sync, retire_stale_rows, seed_companies_if_missing


class TestBootstrap(unittest.IsolatedAsyncioTestCase):
    """A brand-new database (the normal state after every Render deploy) must become useful on its own."""

    async def asyncSetUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self._patch = patch.object(settings, "DATABASE_PATH", Path(self._tmp.name) / "nested" / "fresh.db")
        self._patch.start()
        await init_db()  # also creates the missing parent directory

    async def asyncTearDown(self):
        self._patch.stop()
        self._tmp.cleanup()

    async def test_light_crawl_skips_workday_and_full_crawl_reads_it(self):
        from backend.app.ingestion import runner
        now = get_utc_now()
        async with get_db_connection() as db:
            for name, src in [("Big Co", "workday"), ("Small Co", "greenhouse")]:
                await db.execute("INSERT INTO companies (name, slug, careers_url, source_type, source_identifier, is_active, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?)",
                                 (name, name.lower().replace(" ", "-"), "https://example.com", src, "x", now, now))
            await db.commit()
        for profile, expected in [("light", ["Small Co"]), ("full", ["Big Co", "Small Co"])]:
            seen = []

            async def fake(company, client, seen=seen):
                seen.append(company["name"]); return company, [], None

            with patch.object(settings, "CRAWL_PROFILE", profile), patch.object(runner, "fetch_company_jobs", AsyncMock(side_effect=fake)):
                await runner.sync_all_sources(include_aggregators=False)
            self.assertEqual(sorted(seen), expected, profile)

    async def test_retired_boards_and_sources_are_removed_with_their_jobs(self):
        now = get_utc_now()
        async with get_db_connection() as db:
            for name, slug, src in [("Gone Co", RETIRED_COMPANY_SLUGS[0], "ashby"), ("Board Co", "board-co", "remotive"), ("Live Co", "live-co", "greenhouse")]:
                cur = await db.execute("INSERT INTO companies (name, slug, careers_url, source_type, source_identifier, is_active, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?)",
                                       (name, slug, "https://example.com", src, slug, now, now))
                await db.execute("""INSERT INTO jobs (company_id, company_name, source_type, external_id, title, application_url, content_hash, first_seen_at, last_seen_at, status)
                                    VALUES (?,?,?,?,?,?,?,?,?, 'active')""", (cur.lastrowid, name, src, f"x-{slug}", "Engineer", "https://example.com/j", slug, now, now))
            await db.commit()
        self.assertEqual(await retire_stale_rows(), 2)
        async with get_db_connection() as db:
            left = [r["name"] for r in await (await db.execute("SELECT name FROM companies ORDER BY name")).fetchall()]
            jobs = [r["company_name"] for r in await (await db.execute("SELECT company_name FROM jobs")).fetchall()]
        self.assertEqual((left, jobs), (["Live Co"], ["Live Co"]))
        self.assertEqual(await retire_stale_rows(), 0)

    async def test_company_list_ships_with_the_backend_and_seeds_idempotently(self):
        self.assertTrue(settings.COMPANIES_FILE.exists(), "seed list must live inside backend/app (Docker context is ./backend)")
        expected = len({c["slug"] for c in json.loads(settings.COMPANIES_FILE.read_text())})
        self.assertGreater(expected, 100)
        self.assertEqual(await seed_companies_if_missing(), expected)
        self.assertEqual(await seed_companies_if_missing(), 0)  # restart-safe
        async with get_db_connection() as db:
            cur = await db.execute("SELECT COUNT(*) AS n, SUM(is_active) AS active FROM companies")
            row = await cur.fetchone()
        self.assertEqual((row["n"], row["active"]), (expected, expected))

    async def test_existing_edits_survive_reseeding(self):
        await seed_companies_if_missing()
        async with get_db_connection() as db:
            await db.execute("UPDATE companies SET is_active = 0 WHERE slug = 'openai'")
            await db.commit()
        await seed_companies_if_missing()
        async with get_db_connection() as db:
            cur = await db.execute("SELECT is_active FROM companies WHERE slug = 'openai'")
            self.assertEqual((await cur.fetchone())["is_active"], 0)

    async def test_initial_sync_is_needed_when_empty_or_stale_only(self):
        self.assertTrue(await needs_initial_sync(2))  # no jobs at all
        await seed_companies_if_missing()

        async def add_job(last_seen: datetime):
            now = get_utc_now()
            async with get_db_connection() as db:
                await db.execute(
                    """INSERT INTO jobs (company_id, company_name, source_type, external_id, title, application_url,
                       content_hash, first_seen_at, last_seen_at, status) VALUES (1,'X','custom','e1','T','https://x.com','h',?,?, 'active')""",
                    (now, last_seen.isoformat()))
                await db.commit()

        await add_job(datetime.now(timezone.utc) - timedelta(hours=10))
        self.assertTrue(await needs_initial_sync(2))   # stale
        async with get_db_connection() as db:
            await db.execute("UPDATE jobs SET last_seen_at = ?", (datetime.now(timezone.utc).isoformat(),))
            await db.commit()
        self.assertFalse(await needs_initial_sync(2))  # fresh


if __name__ == "__main__":
    unittest.main()
