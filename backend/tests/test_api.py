import unittest
from unittest.mock import AsyncMock, patch

import httpx

from backend.app.main import app

ADMIN = {"X-Admin-Token": "test-admin-token"}
EXT_ORIGIN = "chrome-extension://" + "a" * 32


class APITestCase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()


class TestBasics(APITestCase):
    async def test_health_get_and_head(self):
        res = await self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")
        # uptime monitors commonly use HEAD; it used to 405
        self.assertEqual((await self.client.head("/health")).status_code, 200)

    async def test_docs_disabled(self):
        for path in ("/docs", "/redoc", "/openapi.json"):
            self.assertEqual((await self.client.get(path)).status_code, 404, path)

    async def test_security_headers(self):
        res = await self.client.get("/health")
        self.assertEqual(res.headers["x-content-type-options"], "nosniff")
        self.assertEqual(res.headers["x-frame-options"], "DENY")
        self.assertEqual(res.headers["referrer-policy"], "no-referrer")

    async def test_stats(self):
        data = (await self.client.get("/api/stats")).json()
        self.assertGreater(data["total_jobs"], 0)
        self.assertEqual(data["active_companies"], 2)

    async def test_companies_list(self):
        companies = (await self.client.get("/api/companies")).json()
        self.assertEqual({c["name"] for c in companies}, {"Acme", "Globex"})


class TestJobsList(APITestCase):
    async def test_jobs_list(self):
        data = (await self.client.get("/api/jobs?limit=10")).json()
        self.assertEqual(len(data["items"]), 10)
        self.assertEqual(data["limit"], 10)

    async def test_role_filter_returns_only_that_role(self):
        data = (await self.client.get("/api/jobs?role=product_management&limit=50")).json()
        self.assertGreater(len(data["items"]), 0)
        for job in data["items"]:
            self.assertEqual(job["normalized_role"], "product_management")

    async def test_limit_bounds_are_enforced(self):
        # limit=-1 used to return the entire table (SQLite treats negative LIMIT as unlimited)
        for bad in ("-1", "0", "201", "500", "abc"):
            self.assertEqual((await self.client.get(f"/api/jobs?limit={bad}")).status_code, 422, bad)
        self.assertEqual((await self.client.get("/api/jobs?limit=200")).status_code, 200)

    async def test_numeric_params_cannot_overflow(self):
        for q in ("freshness_days=99999999999", "freshness_days=-5", "min_budget=99999999999999999999",
                  "offset=99999999999999999999", "offset=-1", "company_id=99999999999999999999"):
            self.assertEqual((await self.client.get(f"/api/jobs?{q}")).status_code, 422, q)

    async def test_search_length_is_bounded(self):
        long_query = "+".join(["a"] * 1000)
        self.assertEqual((await self.client.get(f"/api/jobs?search={long_query}")).status_code, 422)
        self.assertEqual((await self.client.get(f"/api/jobs?location={'x' * 101}")).status_code, 422)

    async def test_search_wildcards_are_literal(self):
        everything = (await self.client.get("/api/jobs?limit=1")).json()["total"]
        pct = (await self.client.get("/api/jobs", params={"search": "%"})).json()
        self.assertEqual(pct["total"], 1)  # only "100% Remote Wildcard Role"
        self.assertLess(pct["total"], everything)
        # "_" is a single-character wildcard in LIKE: unescaped, "e_g" would match "eng" in "Engineer"
        self.assertEqual((await self.client.get("/api/jobs", params={"search": "e_g"})).json()["total"], 0)

    async def test_sql_injection_payloads_are_inert(self):
        before = (await self.client.get("/api/stats")).json()["total_jobs"]
        for payload in ("'; DROP TABLE jobs;--", "' OR '1'='1", '" OR 1=1 --'):
            res = await self.client.get("/api/jobs", params={"search": payload, "role": payload, "location": payload})
            self.assertEqual(res.status_code, 200)
        self.assertEqual((await self.client.get("/api/stats")).json()["total_jobs"], before)

    async def test_fractional_hourly_salary_does_not_break_the_endpoint(self):
        res = await self.client.get("/api/jobs", params={"search": "hourly"})
        self.assertEqual(res.status_code, 200)  # used to 500: ValidationError int_from_float
        self.assertEqual(res.json()["items"][0]["min_salary"], 60.58)

    async def test_non_http_apply_links_are_never_emitted(self):
        item = (await self.client.get("/api/jobs", params={"search": "bad link"})).json()["items"][0]
        self.assertEqual(item["application_url"], "")
        notif = (await self.client.get("/api/notifications")).json()
        self.assertTrue(all(not n["application_url"].startswith("javascript:") for n in notif))


class TestWrites(APITestCase):
    async def test_preferences_roundtrip_and_validation(self):
        original = (await self.client.get("/api/preferences")).json()
        changed = dict(original, custom_keywords="Figma, React")
        res = await self.client.post("/api/preferences", json=changed)
        self.assertEqual(res.status_code, 200)
        self.assertEqual((await self.client.get("/api/preferences")).json()["custom_keywords"], "Figma, React")
        await self.client.post("/api/preferences", json=original)
        for bad in (dict(original, roles=["x"] * 21), dict(original, custom_keywords="A" * 501),
                    dict(original, sync_interval_mins=0), dict(original, roles=["<script>"])):
            self.assertEqual((await self.client.post("/api/preferences", json=bad)).status_code, 422)

    async def test_save_then_unsave_job(self):
        job_id = (await self.client.get("/api/jobs?limit=1")).json()["items"][0]["id"]
        saved = await self.client.post(f"/api/jobs/{job_id}/save")
        self.assertTrue(saved.json()["is_saved"])
        self.assertEqual((await self.client.get("/api/jobs?saved_only=true")).json()["total"], 1)
        unsaved = await self.client.request("DELETE", f"/api/jobs/{job_id}/save")
        self.assertFalse(unsaved.json()["is_saved"])

    async def test_report_valid_and_invalid(self):
        job_id = (await self.client.get("/api/jobs?limit=1")).json()["items"][0]["id"]
        ok = await self.client.post(f"/api/jobs/{job_id}/report?reason=spam&details=Test")
        self.assertTrue(ok.json()["success"])
        self.assertEqual((await self.client.post(f"/api/jobs/{job_id}/report?reason=badvalue")).status_code, 422)
        self.assertEqual((await self.client.post(f"/api/jobs/{job_id}/report", params={"reason": "spam", "details": "x" * 501})).status_code, 422)
        self.assertEqual((await self.client.post("/api/jobs/99999999/report?reason=spam")).status_code, 404)

    async def test_sync_default_is_public_but_synchronous_mode_is_admin_only(self):
        with patch("backend.app.api.routes.sync_all_sources", new=AsyncMock(return_value={})):
            self.assertEqual((await self.client.post("/api/sync")).status_code, 200)
            self.assertEqual((await self.client.post("/api/sync?wait_for_completion=true")).status_code, 403)
            ok = await self.client.post("/api/sync?wait_for_completion=true", headers=ADMIN)
            self.assertEqual(ok.json()["status"], "completed")


class TestCompanyManagement(APITestCase):
    payload = {"name": "Initech", "source_type": "custom", "source_identifier": "initech",
               "careers_url": "http://93.184.216.34/jobs"}

    async def test_requires_admin_token(self):
        self.assertEqual((await self.client.post("/api/companies", json=self.payload)).status_code, 403)
        self.assertEqual((await self.client.post("/api/companies", json=self.payload, headers={"X-Admin-Token": "nope"})).status_code, 403)
        self.assertEqual((await self.client.patch("/api/companies/1/toggle")).status_code, 403)

    async def test_ssrf_targets_are_rejected(self):
        for url in ("http://127.0.0.1:9999/x", "http://localhost/x", "http://169.254.169.254/latest/meta-data/",
                    "http://10.0.0.5/", "http://[::1]/", "http://192.168.1.1/", "http://[::ffff:127.0.0.1]/",
                    "file:///etc/passwd", "javascript:alert(1)", "ftp://example.com/", "http://user:pw@93.184.216.34/",
                    "http://93.184.216.34:6379/"):
            res = await self.client.post("/api/companies", json=dict(self.payload, name=f"x{abs(hash(url))}", careers_url=url), headers=ADMIN)
            self.assertIn(res.status_code, (400, 422), url)

    async def test_create_toggle_and_duplicate_without_leaking_db_errors(self):
        with patch("backend.app.api.routes._guarded_sync_once", new=AsyncMock()):
            created = await self.client.post("/api/companies", json=self.payload, headers=ADMIN)
            self.assertEqual(created.status_code, 200, created.text)
            dup = await self.client.post("/api/companies", json=self.payload, headers=ADMIN)
        self.assertEqual(dup.status_code, 409)
        self.assertNotIn("UNIQUE", dup.text)
        self.assertNotIn("constraint", dup.text.lower())
        cid = created.json()["id"]
        toggled = await self.client.patch(f"/api/companies/{cid}/toggle", headers=ADMIN)
        self.assertEqual(toggled.status_code, 200)
        self.assertFalse(toggled.json()["is_active"])

    async def test_bad_input_is_rejected(self):
        for body in (dict(self.payload, source_type="evil"), dict(self.payload, source_identifier="a b;c"),
                     dict(self.payload, name=""), dict(self.payload, name="x" * 121), dict(self.payload, logo_url="javascript:1")):
            self.assertEqual((await self.client.post("/api/companies", json=body, headers=ADMIN)).status_code, 422, body)


class TestCORS(APITestCase):
    async def preflight(self, origin):
        return await self.client.options("/api/preferences", headers={"Origin": origin, "Access-Control-Request-Method": "POST"})

    async def test_extension_origin_allowed_web_origin_blocked(self):
        ok = await self.preflight(EXT_ORIGIN)
        self.assertEqual(ok.headers.get("access-control-allow-origin"), EXT_ORIGIN)
        self.assertIsNone((await self.preflight("https://evil.example")).headers.get("access-control-allow-origin"))
        self.assertIsNone((await self.preflight("chrome-extension://evil")).headers.get("access-control-allow-origin"))


if __name__ == "__main__":
    unittest.main()
