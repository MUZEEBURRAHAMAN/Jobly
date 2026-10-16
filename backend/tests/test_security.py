import hashlib
import unittest
from unittest.mock import patch

import httpx
from fastapi import FastAPI

from backend.app.ingestion.custom_portal import fetch_custom_portal_jobs
from backend.app.security import (
    RateLimitMiddleware, SecurityHeadersMiddleware, UnsafeURL, check_url_syntax,
    fetch_public_text, sanitize_http_url, validate_public_url,
)


class TestUrlSanitizing(unittest.TestCase):
    def test_only_plain_http_urls_pass(self):
        for good in ("https://boards.greenhouse.io/acme/jobs/1", "http://example.com/a?b=c"):
            self.assertEqual(sanitize_http_url(good), good)
        for bad in (None, "", "javascript:alert(1)", "data:text/html,<script>1</script>", "file:///etc/passwd",
                    "//evil.com", "https://", "https://a b.com", "https://x.com/\nSet-Cookie: a=b", "x" * 3000):
            self.assertIsNone(sanitize_http_url(bad), bad)


class TestSSRFGuard(unittest.IsolatedAsyncioTestCase):
    async def test_blocks_private_and_special_addresses(self):
        for url in ("http://127.0.0.1/", "http://localhost/", "http://foo.localhost/", "http://169.254.169.254/",
                    "http://10.1.2.3/", "http://172.16.0.1/", "http://192.168.0.1/", "http://100.64.0.1/",
                    "http://0.0.0.0/", "http://[::1]/", "http://[fd00::1]/", "http://[::ffff:10.0.0.1]/",
                    "http://metadata.internal/", "http://u:p@93.184.216.34/", "http://93.184.216.34:22/"):
            with self.assertRaises(UnsafeURL, msg=url):
                await validate_public_url(url)

    async def test_allows_public_literals(self):
        self.assertEqual(check_url_syntax("https://93.184.216.34/jobs"), "https://93.184.216.34/jobs")
        self.assertEqual(await validate_public_url("http://93.184.216.34/"), "http://93.184.216.34/")

    async def test_hostname_resolving_to_private_ip_is_blocked(self):
        with patch("socket.getaddrinfo", return_value=[(2, 1, 6, "", ("10.0.0.5", 0))]):
            with self.assertRaises(UnsafeURL):
                await validate_public_url("https://innocent-looking.example.com/")
        with patch("socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 0)), (2, 1, 6, "", ("127.0.0.1", 0))]):
            with self.assertRaises(UnsafeURL):  # one bad record among good ones is enough
                await validate_public_url("https://mixed.example.com/")

    async def test_redirect_to_internal_address_is_blocked(self):
        def handler(request):
            return httpx.Response(302, headers={"location": "http://127.0.0.1:8000/admin"})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(UnsafeURL):
                await fetch_public_text(client, "http://93.184.216.34/")

    async def test_redirect_loop_and_body_cap(self):
        def loop(request):
            return httpx.Response(302, headers={"location": "http://93.184.216.34/again"})
        async with httpx.AsyncClient(transport=httpx.MockTransport(loop)) as client:
            with self.assertRaises(UnsafeURL):
                await fetch_public_text(client, "http://93.184.216.34/", max_redirects=2)
        big = httpx.MockTransport(lambda r: httpx.Response(200, content=b"a" * 5_000_000))
        async with httpx.AsyncClient(transport=big) as client:
            status, text = await fetch_public_text(client, "http://93.184.216.34/", max_bytes=1000)
        self.assertEqual(status, 200)
        self.assertLessEqual(len(text), 1_000_000)  # truncated well below the 5 MB body


class TestCustomPortalIngestion(unittest.IsolatedAsyncioTestCase):
    HTML = ('<html><script type="application/ld+json">{"@type":"JobPosting","title":"Designer",'
            '"url":"javascript:alert(1)"}</script></html>')

    async def run_once(self):
        transport = httpx.MockTransport(lambda r: httpx.Response(200, text=self.HTML))
        async with httpx.AsyncClient(transport=transport) as client:
            return await fetch_custom_portal_jobs("http://93.184.216.34/careers", "Initech", client)

    async def test_external_id_is_stable_and_hostile_urls_are_replaced(self):
        first, second = await self.run_once(), await self.run_once()
        self.assertEqual(len(first), 1)
        self.assertEqual(first[0].external_id, second[0].external_id)  # hash() would differ per process
        expected = hashlib.sha1(("Designer" + "http://93.184.216.34/careers").encode()).hexdigest()[:16]
        self.assertEqual(first[0].external_id, expected)
        self.assertEqual(first[0].application_url, "http://93.184.216.34/careers")

    async def test_internal_portal_url_is_never_fetched(self):
        calls = []
        transport = httpx.MockTransport(lambda r: calls.append(r) or httpx.Response(200, text=self.HTML))
        async with httpx.AsyncClient(transport=transport) as client:
            jobs = await fetch_custom_portal_jobs("http://169.254.169.254/latest/meta-data/", "Evil", client)
        self.assertEqual(jobs, [])
        self.assertEqual(calls, [])


class TestRateLimit(unittest.IsolatedAsyncioTestCase):
    def build(self):
        mini = FastAPI()
        mini.add_middleware(RateLimitMiddleware, general_per_min=5, write_per_min=2, sync_per_min=1)
        mini.add_middleware(SecurityHeadersMiddleware)

        @mini.get("/x")
        async def x():
            return {"ok": True}

        @mini.post("/w")
        async def w():
            return {"ok": True}

        @mini.post("/api/sync")
        async def sync():
            return {"ok": True}

        @mini.get("/health")
        async def health():
            return {"ok": True}

        return httpx.AsyncClient(transport=httpx.ASGITransport(app=mini), base_url="http://test")

    async def test_general_write_and_sync_limits(self):
        async with self.build() as c:
            codes = [(await c.get("/x")).status_code for _ in range(7)]
            self.assertEqual(codes, [200] * 5 + [429] * 2)
            limited = await c.get("/x")
            self.assertIn("retry-after", limited.headers)
            self.assertEqual(limited.headers["x-content-type-options"], "nosniff")
        async with self.build() as c:
            self.assertEqual([(await c.post("/w")).status_code for _ in range(3)], [200, 200, 429])
        async with self.build() as c:
            self.assertEqual([(await c.post("/api/sync")).status_code for _ in range(2)], [200, 429])

    async def test_health_is_never_limited_and_clients_are_isolated(self):
        async with self.build() as c:
            for _ in range(20):
                self.assertEqual((await c.get("/health")).status_code, 200)
            for _ in range(5):
                await c.get("/x", headers={"cf-connecting-ip": "1.1.1.1"})
            self.assertEqual((await c.get("/x", headers={"cf-connecting-ip": "1.1.1.1"})).status_code, 429)
            self.assertEqual((await c.get("/x", headers={"cf-connecting-ip": "2.2.2.2"})).status_code, 200)
            # X-Forwarded-For is attacker-controlled and must not create a fresh bucket
            self.assertEqual((await c.get("/x", headers={"cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "9.9.9.9"})).status_code, 429)


if __name__ == "__main__":
    unittest.main()
