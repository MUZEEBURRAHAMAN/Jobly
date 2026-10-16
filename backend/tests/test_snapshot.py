import gzip
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import httpx

from backend.app.config import settings
from backend.app.db import get_db_connection, get_utc_now, init_db
from backend.app.ingestion.base import normalize_posted_at
from backend.app.security import download_github_release_asset
from backend.app.snapshot import export_snapshot, install_snapshot, restore_snapshot_if_needed, validate_snapshot

NOW = datetime(2026, 10, 17, 12, 0, tzinfo=timezone.utc)


class TestPostedAt(unittest.TestCase):
    def check(self, value, expected):
        self.assertEqual(normalize_posted_at(value, NOW), expected, repr(value))

    def test_iso_epoch_and_rfc822(self):
        self.check("2026-10-10T08:30:00Z", "2026-10-10T08:30:00+00:00")
        self.check("2026-10-10T08:30:00+05:30", "2026-10-10T03:00:00+00:00")
        self.check(1760000000, datetime.fromtimestamp(1760000000, timezone.utc).isoformat())           # seconds
        self.check(1760000000000, datetime.fromtimestamp(1760000000, timezone.utc).isoformat())        # milliseconds (Lever)
        self.check("Fri, 10 Oct 2026 08:30:00 +0000", "2026-10-10T08:30:00+00:00")
        self.check("March 12, 2026", "2026-03-12T00:00:00+00:00")

    def test_workday_relative_text(self):
        self.check("Posted Today", NOW.isoformat())
        self.check("Posted Yesterday", (NOW - timedelta(days=1)).isoformat())
        self.check("Posted 3 Days Ago", (NOW - timedelta(days=3)).isoformat())
        self.check("Posted 30+ Days Ago", (NOW - timedelta(days=30)).isoformat())
        self.check("2 weeks ago", (NOW - timedelta(weeks=2)).isoformat())

    def test_unknown_or_nonsense_is_none_and_future_is_clamped(self):
        for bad in (None, "", "   ", "soon", True, "0000-00-00", 123, "1999-01-01"):
            self.check(bad, None)
        self.check("2027-01-01T00:00:00Z", NOW.isoformat())   # never report the future


class TestSnapshots(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.patch = patch.object(settings, "DATABASE_PATH", self.dir / "live" / "jobly.db")
        self.patch.start()
        await init_db()

    async def asyncTearDown(self):
        self.patch.stop()
        self.tmp.cleanup()

    async def add_jobs(self, n):
        now = get_utc_now()
        async with get_db_connection() as db:
            await db.execute("INSERT INTO companies (name, slug, source_type, source_identifier, created_at, updated_at) VALUES ('A','a','custom','a',?,?)", (now, now))
            for i in range(n):
                await db.execute("""INSERT INTO jobs (company_id, company_name, source_type, external_id, title, application_url, content_hash,
                                    first_seen_at, last_seen_at, status, is_saved, raw_json) VALUES (1,'A','custom',?,?,?,?,?,?, 'active', 1, '{"x":1}')""",
                                 (f"e{i}", f"T{i}", "https://x.com", f"h{i}", now, now))
            await db.execute("INSERT INTO notifications (job_id, title, company_name, role, application_url, sent_at) VALUES (1,'t','A','r','https://x.com',?)", (now,))
            await db.commit()

    async def test_export_strips_user_state_and_round_trips(self):
        await self.add_jobs(5)
        gz = self.dir / "out.gz"
        self.assertEqual(export_snapshot(settings.DATABASE_PATH, gz), 5)
        restored = self.dir / "restored.db"
        self.assertEqual(install_snapshot(gz, restored), 5)
        con = sqlite3.connect(restored)
        self.assertEqual(con.execute("SELECT COUNT(*) FROM notifications").fetchone()[0], 0)       # alerts are not shipped
        self.assertEqual(con.execute("SELECT COUNT(*) FROM jobs WHERE is_saved = 1 OR raw_json IS NOT NULL").fetchone()[0], 0)
        con.close()

    def test_corrupt_or_foreign_files_are_rejected_and_never_installed(self):
        target = self.dir / "target.db"
        for name, payload in (("garbage", b"not a database at all" * 50), ("empty", b"")):
            gz = self.dir / f"{name}.gz"
            gz.write_bytes(gzip.compress(payload))
            with self.assertRaises(ValueError):
                install_snapshot(gz, target)
            self.assertFalse(target.exists())
        foreign = self.dir / "foreign.db"
        con = sqlite3.connect(foreign); con.execute("CREATE TABLE other (x)"); con.commit(); con.close()
        with self.assertRaises(ValueError):
            validate_snapshot(foreign)

    async def test_restore_only_runs_on_an_empty_database(self):
        await self.add_jobs(3)
        with patch.object(settings, "SNAPSHOT_REPO", "owner/repo"), patch("backend.app.snapshot.download_github_release_asset") as dl:
            self.assertFalse(await restore_snapshot_if_needed())
            dl.assert_not_called()                      # never overwrite data we already have

    async def test_missing_release_falls_back_quietly(self):
        handler = lambda request: httpx.Response(404, json={"message": "Not Found"})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with patch.object(settings, "SNAPSHOT_REPO", "owner/repo"):
                self.assertFalse(await restore_snapshot_if_needed(client))


class TestReleaseDownload(unittest.IsolatedAsyncioTestCase):
    async def test_token_goes_to_github_api_only_not_to_the_storage_host(self):
        seen = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append((request.url.host, request.headers.get("authorization")))
            if request.url.path.endswith("/releases/tags/snapshot"):
                return httpx.Response(200, json={"assets": [{"name": "jobly.db.gz", "size": 5, "url": "https://api.github.com/repos/o/r/releases/assets/7"}]})
            if request.url.host == "api.github.com":
                return httpx.Response(302, headers={"location": "https://93.184.216.34/signed/blob"})
            return httpx.Response(200, content=b"hello")

        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "a.gz"
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                with patch("socket.getaddrinfo", return_value=[(2, 1, 6, "", ("140.82.112.5", 0))]):
                    self.assertTrue(await download_github_release_asset(client, "o/r", "snapshot", "jobly.db.gz", dest, token="SECRET"))
            self.assertEqual(dest.read_bytes(), b"hello")
        api_hosts = [a for h, a in seen if h == "api.github.com"]
        storage = [a for h, a in seen if h == "93.184.216.34"]
        self.assertTrue(api_hosts and all(a == "Bearer SECRET" for a in api_hosts))
        self.assertEqual(storage, [None])               # the signed URL must not receive the token

    async def test_oversized_asset_is_refused(self):
        handler = lambda r: httpx.Response(200, json={"assets": [{"name": "jobly.db.gz", "size": 10**10, "url": "https://api.github.com/x"}]})
        with tempfile.TemporaryDirectory() as tmp:
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                self.assertFalse(await download_github_release_asset(client, "o/r", "snapshot", "jobly.db.gz", Path(tmp) / "a", max_bytes=1000))


if __name__ == "__main__":
    unittest.main()
