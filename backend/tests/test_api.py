import asyncio
import unittest
import httpx
from backend.app.main import app

class TestAPIEndpoints(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.transport = httpx.ASGITransport(app=app)
        self.client = httpx.AsyncClient(transport=self.transport, base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_health(self):
        res = await self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")

    async def test_stats(self):
        res = await self.client.get("/api/stats")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total_jobs", data)
        self.assertIn("active_companies", data)
        self.assertGreater(data["total_jobs"], 0)

    async def test_preferences_get_and_post(self):
        # GET
        get_res = await self.client.get("/api/preferences")
        self.assertEqual(get_res.status_code, 200)
        prefs = get_res.json()
        self.assertIn("roles", prefs)

        # POST
        prefs["custom_keywords"] = "Figma, React"
        post_res = await self.client.post("/api/preferences", json=prefs)
        self.assertEqual(post_res.status_code, 200)
        self.assertEqual(post_res.json()["custom_keywords"], "Figma, React")

        # Restore original clean preferences
        await self.client.post("/api/preferences", json=get_res.json())

    async def test_jobs_list(self):
        res = await self.client.get("/api/jobs?limit=10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("items", data)
        self.assertGreater(len(data["items"]), 0)

    async def test_companies_list(self):
        res = await self.client.get("/api/companies")
        self.assertEqual(res.status_code, 200)
        companies = res.json()
        self.assertGreater(len(companies), 0)

if __name__ == "__main__":
    unittest.main()

    # Q-7: Role filter returns only matching roles
    async def test_jobs_role_filter(self):
        res = await self.client.get("/api/jobs?role=product_management&limit=10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        for job in data["items"]:
            self.assertEqual(job.get("normalized_role"), "product_management")

    # Q-7: Save then unsave a job
    async def test_save_unsave_job(self):
        jobs_res = await self.client.get("/api/jobs?limit=1")
        items = jobs_res.json().get("items", [])
        if not items:
            return  # No jobs seeded — skip
        job_id = items[0]["id"]

        save_res = await self.client.post(f"/api/jobs/{job_id}/save")
        self.assertEqual(save_res.status_code, 200)
        self.assertTrue(save_res.json()["is_saved"])

        unsave_res = await self.client.request("DELETE", f"/api/jobs/{job_id}/save")
        self.assertEqual(unsave_res.status_code, 200)
        self.assertFalse(unsave_res.json()["is_saved"])

    # Q-7: Report endpoint accepts valid reason
    async def test_report_job_valid(self):
        jobs_res = await self.client.get("/api/jobs?limit=1")
        items = jobs_res.json().get("items", [])
        if not items:
            return
        job_id = items[0]["id"]
        res = await self.client.post(f"/api/jobs/{job_id}/report?reason=spam&details=Test+report")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["success"])

    # Q-7: Report endpoint rejects invalid reason
    async def test_report_job_invalid_reason(self):
        jobs_res = await self.client.get("/api/jobs?limit=1")
        items = jobs_res.json().get("items", [])
        if not items:
            return
        job_id = items[0]["id"]
        res = await self.client.post(f"/api/jobs/{job_id}/report?reason=badvalue")
        self.assertEqual(res.status_code, 422)

    # Q-7: Limit boundary — max is 200 per API Query constraint
    async def test_jobs_limit_boundary(self):
        res = await self.client.get("/api/jobs?limit=201")
        # FastAPI should clamp or reject values above le=200
        self.assertIn(res.status_code, [200, 422])
        if res.status_code == 200:
            # If clamped: items should be <= 200
            self.assertLessEqual(len(res.json()["items"]), 200)
