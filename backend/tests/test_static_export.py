import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from backend.app.config import settings
from backend.app.db import get_db_connection, get_utc_now, init_db
from backend.app.static_export import COLUMNS, bucket_of, export, plain_text

NOW = datetime(2026, 10, 28, 12, 0, tzinfo=timezone.utc)


class TestHelpers(unittest.TestCase):
    def test_buckets(self):
        ago = lambda d: (NOW - timedelta(days=d)).isoformat()  # noqa: E731
        self.assertEqual(bucket_of(ago(0.2), NOW), "1")
        self.assertEqual(bucket_of(ago(2), NOW), "3")
        self.assertEqual(bucket_of(ago(5), NOW), "7")
        self.assertEqual(bucket_of(ago(13.9), NOW), "14")
        self.assertEqual(bucket_of(ago(45), NOW), "60")
        self.assertEqual(bucket_of(None, NOW), "u")
        self.assertEqual(bucket_of("not a date", NOW), "u")

    def test_plain_text(self):
        html = "&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;<ul><li>React</li><li>Go</li></ul>"
        self.assertEqual(plain_text(html), "Hello & welcome\n\n• React\n• Go")
        self.assertEqual(plain_text(None), "")


class TestExport(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.patch = patch.object(settings, "DATABASE_PATH", self.dir / "jobly.db")
        self.patch.start()
        await init_db()
        now = get_utc_now()
        recent = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        old = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        async with get_db_connection() as db:
            await db.execute("INSERT INTO companies (name, slug, source_type, source_identifier, created_at, updated_at, yc_batch) "
                             "VALUES ('Acme','acme','greenhouse','acme',?,?,'W21')", (now, now))
            jobs = [
                ("1", "Senior Product Designer", "product_design", recent, "active", "<p>Design &amp; ship</p>"),
                ("2", "Account Executive", None, recent, "active", None),
                ("3", "Backend Engineer", None, None, "active", "Go and Postgres"),
                ("4", "Old Designer", "product_design", old, "active", None),       # too old: never published
                ("5", "Closed Designer", "product_design", recent, "closed", None),  # closed: never published
            ]
            for ext, title, role, posted, status, desc in jobs:
                await db.execute(
                    "INSERT INTO jobs (company_id, company_name, source_type, external_id, title, normalized_role, location, "
                    "description, application_url, content_hash, first_seen_at, last_seen_at, status, posted_at) "
                    "VALUES (1,'Acme','greenhouse',?,?,?,'Remote',?,'https://example.com/j','h',?,?,?,?)",
                    (ext, title, role, desc, now, now, status, posted),
                )
            await db.commit()

    async def asyncTearDown(self):
        self.patch.stop()
        self.tmp.cleanup()

    async def test_layout_and_contents(self):
        out = self.dir / "out"
        meta = await export(settings.DATABASE_PATH, out)
        v1 = out / "v1"
        self.assertEqual(meta["total"], 3)
        self.assertEqual(meta["columns"], list(COLUMNS))
        self.assertEqual(meta["files"]["product_design"]["3"]["jobs"], 1)
        self.assertEqual(meta["files"]["sales"]["3"]["jobs"], 1)
        self.assertEqual(meta["files"]["backend"]["u"]["jobs"], 1)
        cats = {c["id"]: c["jobs"] for c in meta["categories"]}
        self.assertEqual((cats["product_design"], cats["sales"], cats["other"]), (1, 1, 0))

        rows = json.loads((v1 / "jobs" / "product_design" / "3.json").read_text())["rows"]
        job = dict(zip(COLUMNS, rows[0]))
        self.assertEqual((job["title"], job["yc_batch"]), ("Senior Product Designer", "W21"))

        descs = {}
        for f in (v1 / "desc").glob("*.json"):
            descs.update(json.loads(f.read_text()))
        self.assertEqual(sorted(descs.values()), ["Design & ship", "Go and Postgres"])

        stats = json.loads((v1 / "stats.json").read_text())
        self.assertEqual(stats["total_jobs"], 3)
        # Design & IT: the designer (recent) and the backend engineer (no date); not the account executive
        self.assertEqual((stats["design_it_jobs"], stats["design_it_week"], stats["jobs_week"]), (2, 1, 2))
        self.assertEqual(json.loads((v1 / "companies.json").read_text())[0]["job_count"], 4)  # API counts all active
        self.assertIn("Access-Control-Allow-Origin: *", (out / "_headers").read_text())


if __name__ == "__main__":
    unittest.main()
