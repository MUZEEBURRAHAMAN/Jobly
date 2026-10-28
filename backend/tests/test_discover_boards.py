import asyncio
import importlib.util
import sys
import json
import unittest
from pathlib import Path

import httpx

_spec = importlib.util.spec_from_file_location("discover_boards", Path(__file__).resolve().parents[2] / "scripts" / "discover_boards.py")
db = importlib.util.module_from_spec(_spec)
sys.modules["discover_boards"] = db   # dataclasses look the module up while the file runs
_spec.loader.exec_module(db)


def fake_boards(request: httpx.Request) -> httpx.Response:
    url = str(request.url)
    if url == "https://boards-api.greenhouse.io/v1/boards/acmecorp/jobs?content=false":
        return httpx.Response(200, json={"jobs": [{}] * 12})
    if url == "https://boards-api.greenhouse.io/v1/boards/acmecorp":
        return httpx.Response(200, json={"name": "Acme Corp"})
    if url == "https://api.ashbyhq.com/posting-api/job-board/acmecorp":
        return httpx.Response(200, json={"jobs": [{}] * 40})      # more jobs: wins
    if url == "https://boards-api.greenhouse.io/v1/boards/globex/jobs?content=false":
        return httpx.Response(200, json={"jobs": [{}] * 9})
    if url == "https://boards-api.greenhouse.io/v1/boards/globex":
        return httpx.Response(200, json={"name": "Totally Different Ltd"})  # someone else's board: rejected
    if url.startswith("https://bigco.wd5.myworkdayjobs.com/wday/cxs/bigco/External/jobs"):
        return httpx.Response(200, json={"total": 1800})
    return httpx.Response(404)


class TestDiscovery(unittest.TestCase):
    def run_async(self, coro):
        return asyncio.run(coro)

    def client(self):
        return httpx.AsyncClient(transport=httpx.MockTransport(fake_boards))

    def test_slugs(self):
        self.assertEqual(db.slugs("Acme Corp, Inc."), ["acme", "acmehq"])
        self.assertEqual(db.slugs("Scale AI")[:3], ["scaleai", "scale-ai", "scale"])
        self.assertEqual(db.slugs("Procter & Gamble")[:2], ["procterandgamble", "procter-and-gamble"])

    def test_best_board_wins_and_wrong_names_are_rejected(self):
        async def go():
            async with self.client() as c:
                sem = asyncio.Semaphore(4)
                acme = await db.discover_name(c, sem, "AcmeCorp", "Robots")
                globex = await db.discover_name(c, sem, "Globex", None)
                wd = await db.probe_workday(c, "BigCo", "bigco", "")
            return acme, globex, wd
        acme, globex, wd = self.run_async(go())
        self.assertEqual((acme.source_type, acme.source_identifier, acme.jobs, acme.industry), ("ashby", "acmecorp", 40, "Robots"))
        self.assertIsNone(globex)
        self.assertEqual((wd.source_identifier, wd.jobs), ("bigco.wd5/External", 1800))

    def test_entry_slugs_are_unique(self):
        taken = {"acme"}
        e = db.company_entry(db.Board("Acme", "lever", "acme", "https://jobs.lever.co/acme", 5), taken)
        self.assertEqual(e["slug"], "acme-lever")
        json.dumps(e)


if __name__ == "__main__":
    unittest.main()
