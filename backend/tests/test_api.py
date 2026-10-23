import json
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
    async def test_role_tech_means_any_classified_job(self):
        everyone = (await self.client.get("/api/jobs?limit=200")).json()["items"]
        tech = (await self.client.get("/api/jobs?role=tech&limit=200")).json()["items"]
        self.assertEqual(len(tech), len([j for j in everyone if j["normalized_role"]]))
        self.assertTrue(all(j["normalized_role"] for j in tech))

    async def test_yc_filter_returns_only_tagged_employers_and_shows_the_batch(self):
        from backend.app.db import get_db_connection
        async with get_db_connection() as db:
            await db.execute("UPDATE companies SET yc_batch = 'W21' WHERE name = 'Globex'"); await db.commit()
        try:
            data = (await self.client.get("/api/jobs?yc=true&limit=50")).json()
            self.assertGreater(len(data["items"]), 0)
            self.assertEqual({j["company_name"] for j in data["items"]}, {"Globex"})
            self.assertEqual({j["yc_batch"] for j in data["items"]}, {"W21"})
            everyone = (await self.client.get("/api/jobs?limit=50")).json()["items"]
            self.assertEqual({j["yc_batch"] for j in everyone if j["company_name"] == "Acme"}, {None})
            self.assertEqual({c["yc_batch"] for c in (await self.client.get("/api/companies")).json() if c["name"] == "Globex"}, {"W21"})
        finally:
            async with get_db_connection() as db:
                await db.execute("UPDATE companies SET yc_batch = NULL"); await db.commit()

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


class TestPostingDates(APITestCase):
    async def test_list_is_slim_and_ordered_by_real_posting_date(self):
        items = (await self.client.get("/api/jobs?limit=5")).json()["items"]
        self.assertTrue(all(i["description"] is None for i in items), "descriptions are ~70% of the payload and unused by the list")
        self.assertEqual(items[0]["posted_at"] is not None, True)          # newest real posting first
        self.assertTrue(items[0]["title"] == "Engineer 0")

    async def test_freshness_filter_uses_posted_at_and_ignores_unknown_dates(self):
        day = (await self.client.get("/api/jobs?freshness_days=1")).json()
        week = (await self.client.get("/api/jobs?freshness_days=7")).json()
        self.assertEqual([i["title"] for i in day["items"]], ["Engineer 0"])
        self.assertEqual({i["title"] for i in week["items"]}, {"Engineer 0", "Engineer 1"})

    async def test_new_today_counts_postings_not_crawl_time(self):
        self.assertEqual((await self.client.get("/api/stats")).json()["new_jobs_today"], 1)

    async def test_detail_endpoint_still_returns_the_description_field(self):
        job_id = (await self.client.get("/api/jobs?limit=1")).json()["items"][0]["id"]
        self.assertEqual((await self.client.get(f"/api/jobs/{job_id}")).status_code, 200)


class TestAgeWindow(APITestCase):
    async def titles(self, query=""):
        data = (await self.client.get(f"/api/jobs?limit=200{query}")).json()
        return {i["title"] for i in data["items"]}, data["total"]

    async def test_jobs_older_than_60_days_are_never_listed(self):
        titles, _ = await self.titles()
        self.assertNotIn("Engineer 3", titles)             # posted 75 days ago
        self.assertIn("Engineer 2", titles)                # 29 days ago
        self.assertIn("Engineer 5", titles)                # unknown date: still shown (sorted last)

    async def test_the_window_cannot_be_widened_by_the_client(self):
        titles, _ = await self.titles("&freshness_days=3650")
        self.assertNotIn("Engineer 3", titles)

    async def test_date_posted_filter_steps(self):
        for days, expected in ((1, {"Engineer 0"}), (7, {"Engineer 0", "Engineer 1"}), (30, {"Engineer 0", "Engineer 1", "Engineer 2"})):
            titles, _ = await self.titles(f"&freshness_days={days}")
            self.assertEqual(titles, expected, f"past {days} days")

    async def test_stats_count_only_what_the_list_shows(self):
        stats = (await self.client.get("/api/stats")).json()
        _, total = await self.titles()
        self.assertEqual(stats["total_jobs"], total)


def prefs_json(**over):
    base = {"roles": [], "seniorities": [], "locations": [], "remote_only": False, "custom_keywords": "", "excluded_keywords": ""}
    return json.dumps({**base, **over})


class TestStatelessPreferences(APITestCase):
    """Preferences arrive with each request (`prefs=` JSON); nothing is stored on the server."""

    async def jobs(self, prefs=None, **extra):
        params = {"limit": 200, **extra}
        if prefs is not None:
            params["prefs"] = prefs
        res = await self.client.get("/api/jobs", params=params)
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()

    async def test_without_prefs_nothing_is_marked_as_a_match(self):
        data = await self.jobs()
        self.assertTrue(data["items"])
        self.assertFalse(any(j["is_match"] for j in data["items"]))
        self.assertTrue(all("is_saved" not in j for j in data["items"]))

    async def test_roles_filter_and_match_flag(self):
        everything = await self.jobs()
        data = await self.jobs(prefs_json(roles=["product_management"]), only_matching="true")
        self.assertGreater(len(data["items"]), 0)
        self.assertLess(len(data["items"]), len(everything["items"]))
        self.assertTrue(all(j["normalized_role"] == "product_management" and j["is_match"] for j in data["items"]))
        flagged = await self.jobs(prefs_json(roles=["product_management"]))
        self.assertEqual(sum(j["is_match"] for j in flagged["items"]), len(data["items"]))

    async def test_explicit_role_overrides_preferred_roles(self):
        data = await self.jobs(prefs_json(roles=["product_management"]), only_matching="true", role="ai_ml")
        self.assertTrue(data["items"])
        self.assertTrue(all(j["normalized_role"] == "ai_ml" for j in data["items"]))

    async def test_keywords_and_exclusions(self):
        wanted = await self.jobs(prefs_json(custom_keywords="hourly, nothing-like-this"), only_matching="true")
        self.assertEqual([j["title"] for j in wanted["items"]], ["Hourly Contractor Designer"])
        dropped = await self.jobs(prefs_json(excluded_keywords="engineer"), only_matching="true")
        self.assertTrue(dropped["items"])
        self.assertFalse(any("engineer" in j["title"].lower() for j in dropped["items"]))

    async def test_location_and_remote_rules(self):
        # every fixture job is remote, so a location the jobs don't mention still matches them
        self.assertTrue((await self.jobs(prefs_json(locations=["Atlantis"]), only_matching="true"))["items"])
        self.assertTrue((await self.jobs(prefs_json(remote_only=True), only_matching="true"))["items"])

    async def test_sql_filter_agrees_with_the_python_matcher(self):
        prefs = {"roles": ["frontend_engineering", "ai_ml"], "seniorities": ["mid"], "locations": [], "remote_only": True,
                 "custom_keywords": "engineer, remote", "excluded_keywords": "wildcard"}
        flagged = await self.jobs(json.dumps(prefs))
        via_sql = await self.jobs(json.dumps(prefs), only_matching="true")
        self.assertEqual({j["id"] for j in via_sql["items"]}, {j["id"] for j in flagged["items"] if j["is_match"]})

    async def test_matched_count_in_stats(self):
        prefs = prefs_json(roles=["product_management"])
        stats = (await self.client.get("/api/stats", params={"prefs": prefs})).json()
        listed = await self.jobs(prefs, only_matching="true")
        self.assertEqual(stats["matched_jobs"], listed["total"])
        self.assertNotIn("saved_jobs", stats)
        self.assertEqual((await self.client.get("/api/stats")).json()["matched_jobs"], 0)

    async def test_bad_prefs_are_rejected(self):
        for bad in ("not json", prefs_json(roles=["x"] * 21), prefs_json(custom_keywords="A" * 501), prefs_json(roles=["<script>"]), "A" * 2501):
            res = await self.client.get("/api/jobs", params={"prefs": bad})
            self.assertEqual(res.status_code, 422, bad[:40])
            self.assertEqual((await self.client.get("/api/stats", params={"prefs": bad})).status_code, 422)

    async def test_sql_wildcards_in_keywords_are_literal(self):
        data = await self.jobs(prefs_json(custom_keywords="100%"), only_matching="true")
        self.assertEqual([j["title"] for j in data["items"]], ["100% Remote Wildcard Role"])


class TestWrites(APITestCase):
    async def test_user_state_endpoints_are_gone(self):
        # Preferences, saved jobs and alerts live on the user's device; the server must not store them.
        for method, path in (("GET", "/api/preferences"), ("POST", "/api/preferences"), ("GET", "/api/notifications"),
                             ("POST", "/api/notifications/read-all"), ("POST", "/api/jobs/1/save"), ("DELETE", "/api/jobs/1/save")):
            res = await self.client.request(method, path)
            self.assertIn(res.status_code, (404, 405), f"{method} {path}")

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


class TestPublicSyncIsRare(APITestCase):
    """A stranger pressing Refresh over and over must not be able to make the free server crawl over and over."""

    async def test_no_crawl_while_data_is_fresh_and_one_per_cooldown_otherwise(self):
        from backend.app.api import routes
        from backend.app.config import settings
        started = []

        async def fake_sync():
            started.append(1)

        with patch.object(routes, "_guarded_sync_once", fake_sync):
            routes._last_sync_timestamp = 0.0
            # the seeded jobs were just seen: the data is fresh, so nothing is started
            fresh = (await self.client.post("/api/sync")).json()
            self.assertEqual((fresh["status"], started), ("cached", []))
            # with a zero cooldown the data counts as stale: one crawl starts, the next press is refused
            with patch.object(settings, "PUBLIC_SYNC_COOLDOWN_SECONDS", 0):
                self.assertEqual((await self.client.post("/api/sync")).json()["status"], "enqueued")
            routes._last_sync_timestamp = routes.time.time()
            self.assertEqual((await self.client.post("/api/sync")).json()["status"], "cached")
        routes._last_sync_timestamp = 0.0


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
        return await self.client.options("/api/jobs", headers={"Origin": origin, "Access-Control-Request-Method": "GET"})

    async def test_the_website_may_read_jobs(self):
        site = "https://joblyextension.netlify.app"
        res = await self.client.get("/api/jobs", params={"limit": 1}, headers={"Origin": site})
        self.assertEqual(res.headers.get("access-control-allow-origin"), site)
        self.assertEqual((await self.preflight(site)).headers.get("access-control-allow-origin"), site)
        lookalike = "https://joblyextension.netlify.app.evil.example"
        self.assertIsNone((await self.preflight(lookalike)).headers.get("access-control-allow-origin"))

    async def test_extension_origin_allowed_web_origin_blocked(self):
        ok = await self.preflight(EXT_ORIGIN)
        self.assertEqual(ok.headers.get("access-control-allow-origin"), EXT_ORIGIN)
        self.assertIsNone((await self.preflight("https://evil.example")).headers.get("access-control-allow-origin"))
        self.assertIsNone((await self.preflight("chrome-extension://evil")).headers.get("access-control-allow-origin"))


if __name__ == "__main__":
    unittest.main()
