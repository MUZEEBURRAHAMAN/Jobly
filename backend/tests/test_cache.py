import asyncio
import json
import time
import unittest
from unittest.mock import patch

import httpx

from backend.app import cache
from backend.app.cache import ResponseCacheMiddleware, clear_response_cache
from backend.app.config import settings
from backend.app.main import app


async def call(mw, path="/api/jobs", query=b"", headers=None, method="GET"):
    """Drive a middleware directly and return (status, headers dict, body)."""
    out = {}
    body = []

    async def send(msg):
        if msg["type"] == "http.response.start":
            out["status"] = msg["status"]
            out["headers"] = {k.decode(): v.decode() for k, v in msg["headers"]}
        else:
            body.append(msg.get("body", b""))

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    scope = {"type": "http", "method": method, "path": path, "query_string": query,
             "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]}
    await mw(scope, receive, send)
    return out["status"], out["headers"], b"".join(body)


class CountingApp:
    """A downstream app that counts how often it is really called."""
    def __init__(self, body=b'{"items":[1],"total":1,"limit":1,"offset":0}', status=200, delay=0.0):
        self.calls = 0
        self.active = 0
        self.peak = 0
        self.body, self.status, self.delay = body, status, delay

    async def __call__(self, scope, receive, send):
        self.calls += 1
        self.active += 1
        self.peak = max(self.peak, self.active)
        try:
            await asyncio.sleep(self.delay)
        finally:
            self.active -= 1
        await send({"type": "http.response.start", "status": self.status,
                    "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(self.body)).encode())]})
        await send({"type": "http.response.body", "body": self.body})


class CacheTestCase(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        clear_response_cache()
        patcher = patch.object(settings, "RESPONSE_CACHE_TTL_SECONDS", 60)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(clear_response_cache)


class TestResponseCache(CacheTestCase):
    async def test_second_identical_request_comes_from_memory(self):
        down = CountingApp(); mw = ResponseCacheMiddleware(down)
        s1, h1, b1 = await call(mw, query=b"limit=10&a=1")
        s2, h2, b2 = await call(mw, query=b"a=1&limit=10")   # same query, different order
        self.assertEqual((s1, h1["x-cache"], s2, h2["x-cache"]), (200, "MISS", 200, "HIT"))
        self.assertEqual(b1, b2)
        self.assertEqual(down.calls, 1)

    async def test_different_queries_are_separate_entries(self):
        down = CountingApp(); mw = ResponseCacheMiddleware(down)
        await call(mw, query=b"limit=10"); await call(mw, query=b"limit=11"); await call(mw, path="/api/stats")
        self.assertEqual(down.calls, 3)

    async def test_etag_gives_a_tiny_304(self):
        down = CountingApp(); mw = ResponseCacheMiddleware(down)
        _, h, _ = await call(mw)
        etag = h["etag"]
        self.assertIn("no-cache", h["cache-control"])
        status, h2, body = await call(mw, headers={"If-None-Match": etag})
        self.assertEqual((status, body), (304, b""))
        self.assertNotIn("content-length", h2)
        status, _, body = await call(mw, headers={"If-None-Match": f"W/{etag}"})   # a proxy may weaken the tag
        self.assertEqual(status, 304)
        status, _, body = await call(mw, headers={"If-None-Match": '"other"'})
        self.assertEqual(status, 200)
        self.assertTrue(body)

    async def test_etag_changes_when_the_data_changes(self):
        down = CountingApp(); mw = ResponseCacheMiddleware(down)
        _, h1, _ = await call(mw)
        clear_response_cache(); down.body = b'{"items":[2],"total":1,"limit":1,"offset":0}'
        _, h2, _ = await call(mw)
        self.assertNotEqual(h1["etag"], h2["etag"])

    async def test_entries_expire(self):
        down = CountingApp(); mw = ResponseCacheMiddleware(down)
        await call(mw)
        with patch.object(cache.time, "monotonic", return_value=time.monotonic() + 61):
            _, h, _ = await call(mw)
        self.assertEqual((h["x-cache"], down.calls), ("MISS", 2))

    async def test_clearing_forgets_everything(self):
        down = CountingApp(); mw = ResponseCacheMiddleware(down)
        await call(mw); clear_response_cache(); await call(mw)
        self.assertEqual(down.calls, 2)

    async def test_errors_and_empty_gathering_answers_are_not_kept(self):
        for path, body, status in (("/api/jobs", b'{"items":[],"total":0,"limit":1,"offset":0}', 200),
                                   ("/api/stats", b'{"total_jobs":5,"is_syncing":true,"x":1}', 200),
                                   ("/api/stats", b'{"total_jobs":0,"x":1}', 200),
                                   ("/api/jobs", b'{"detail":"boom"}', 500)):
            clear_response_cache()
            down = CountingApp(body=body, status=status); mw = ResponseCacheMiddleware(down)
            await call(mw, path=path); await call(mw, path=path)
            self.assertEqual(down.calls, 2, (path, body))

    async def test_only_cheap_safe_reads_are_cached(self):
        down = CountingApp(); mw = ResponseCacheMiddleware(down)
        await call(mw, path="/api/jobs/5"); await call(mw, path="/api/jobs/5")        # not a cacheable path
        await call(mw, path="/api/jobs", method="POST"); await call(mw, path="/api/jobs", method="POST")
        await call(mw, path="/health"); await call(mw, path="/health")
        self.assertEqual(down.calls, 6)

    async def test_memory_is_bounded(self):
        down = CountingApp(); mw = ResponseCacheMiddleware(down)
        with patch.object(cache, "MAX_ENTRIES", 5):
            for i in range(20):
                await call(mw, query=f"search=q{i}".encode())
        self.assertLessEqual(len(cache._store.entries), 5)
        self.assertEqual(cache._store.total_bytes, sum(len(e[2]) for e in cache._store.entries.values()))

    async def test_disabled_with_ttl_zero(self):
        down = CountingApp(); mw = ResponseCacheMiddleware(down)
        with patch.object(settings, "RESPONSE_CACHE_TTL_SECONDS", 0):
            await call(mw); await call(mw)
        self.assertEqual(down.calls, 2)


class TestLoadProtection(CacheTestCase):
    async def test_a_crowd_asking_the_same_thing_computes_it_once(self):
        down = CountingApp(delay=0.1); mw = ResponseCacheMiddleware(down)
        results = await asyncio.gather(*[call(mw, query=b"limit=50") for _ in range(30)])
        self.assertEqual(down.calls, 1)
        self.assertTrue(all(r[0] == 200 and r[2] == results[0][2] for r in results))

    async def test_only_a_few_heavy_queries_run_at_once(self):
        down = CountingApp(delay=0.05); mw = ResponseCacheMiddleware(down, max_concurrent=3, queue_timeout=5)
        results = await asyncio.gather(*[call(mw, query=f"search=u{i}".encode()) for i in range(20)])
        self.assertEqual(down.peak, 3)
        self.assertTrue(all(r[0] == 200 for r in results))

    async def test_when_the_queue_is_too_long_the_answer_is_a_quick_503(self):
        down = CountingApp(delay=0.3); mw = ResponseCacheMiddleware(down, max_concurrent=1, queue_timeout=0.05)
        results = await asyncio.gather(*[call(mw, query=f"search=v{i}".encode()) for i in range(4)])
        statuses = sorted(r[0] for r in results)
        self.assertEqual(statuses[0], 200)
        self.assertIn(503, statuses)
        busy = next(r for r in results if r[0] == 503)
        self.assertEqual(busy[1]["retry-after"], "3")
        self.assertIn("busy", json.loads(busy[2])["detail"])
        self.assertEqual((await call(mw, query=b"search=after"))[0], 200)   # recovers once the queue drains

    async def test_cache_hits_never_wait_in_the_queue(self):
        down = CountingApp(delay=0.3); mw = ResponseCacheMiddleware(down, max_concurrent=1, queue_timeout=0.05)
        await call(mw, query=b"limit=1")
        slow = asyncio.create_task(call(mw, query=b"search=slow"))
        await asyncio.sleep(0.02)
        started = time.monotonic()
        status, h, _ = await call(mw, query=b"limit=1")
        self.assertEqual((status, h["x-cache"]), (200, "HIT"))
        self.assertLess(time.monotonic() - started, 0.1)
        await slow

    async def test_a_failing_request_does_not_leak_its_slot_or_lock(self):
        class Boom:
            async def __call__(self, scope, receive, send):
                raise RuntimeError("db down")
        mw = ResponseCacheMiddleware(Boom(), max_concurrent=1, queue_timeout=0.2)
        for _ in range(3):
            with self.assertRaises(RuntimeError):
                await call(mw, query=b"limit=3")
        mw.app = CountingApp()
        self.assertEqual((await call(mw, query=b"limit=3"))[0], 200)
        self.assertEqual(mw._flights, {})


class TestThroughTheRealApp(CacheTestCase):
    async def test_real_endpoints_are_cached_and_revalidate(self):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            first = await client.get("/api/jobs", params={"limit": 5})
            second = await client.get("/api/jobs", params={"limit": 5})
            self.assertEqual((first.headers["x-cache"], second.headers["x-cache"]), ("MISS", "HIT"))
            self.assertEqual(first.json(), second.json())
            again = await client.get("/api/jobs", params={"limit": 5}, headers={"If-None-Match": first.headers["etag"]})
            self.assertEqual(again.status_code, 304)
            self.assertEqual(again.headers["x-content-type-options"], "nosniff")   # outer middleware still applies
            stats = await client.get("/api/stats"); self.assertEqual((await client.get("/api/stats")).headers["x-cache"], "HIT")
            self.assertEqual(stats.status_code, 200)
            bad = await client.get("/api/jobs", params={"prefs": "nope"}); self.assertEqual(bad.status_code, 422)
            self.assertNotIn("x-cache", bad.headers)
            self.assertEqual((await client.get("/api/jobs", params={"limit": 5, "prefs": json.dumps({"roles": ["ai_ml"]})})).headers["x-cache"], "MISS")
            self.assertNotIn("x-cache", (await client.get("/health")).headers)

    async def test_cors_headers_are_present_on_cache_hits_and_304s(self):
        origin = "chrome-extension://" + "a" * 32
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            await client.get("/api/companies", headers={"Origin": origin})
            hit = await client.get("/api/companies", headers={"Origin": origin})
            self.assertEqual((hit.headers["x-cache"], hit.headers["access-control-allow-origin"]), ("HIT", origin))
            nm = await client.get("/api/companies", headers={"Origin": origin, "If-None-Match": hit.headers["etag"]})
            self.assertEqual((nm.status_code, nm.headers["access-control-allow-origin"]), (304, origin))
