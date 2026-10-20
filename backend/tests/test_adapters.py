import asyncio
import unittest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx
from backend.app.ingestion.workday import fetch_workday_jobs
from backend.app.ingestion.amazon import fetch_amazon_jobs
from backend.app.ingestion.custom_portal import fetch_custom_portal_jobs

class TestAdapters(unittest.TestCase):
    def test_workday_parsing(self):
        async def run():
            mock_client = AsyncMock(spec=httpx.AsyncClient)
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "total": 1,
                "jobPostings": [
                    {
                        "title": "Senior AI Systems Engineer",
                        "externalPath": "/job/San-Jose/Senior-AI-Systems-Engineer_R12345",
                        "locationsText": "San Jose, CA",
                        "postedOn": "Posted 2 Days Ago",
                    }
                ]
            }
            mock_client.post.return_value = mock_response

            jobs = await fetch_workday_jobs("adobe.wd5/external_experienced", "Adobe", mock_client, max_pages=1, only_roles=False)
            self.assertEqual(len(jobs), 1)
            self.assertEqual(jobs[0].title, "Senior AI Systems Engineer")
            self.assertEqual(jobs[0].source_type, "workday")
            self.assertEqual(jobs[0].external_id, "R12345")
            self.assertIn("adobe.wd5.myworkdayjobs.com", jobs[0].application_url)

        asyncio.run(run())

    def test_amazon_parsing(self):
        async def run():
            mock_client = AsyncMock(spec=httpx.AsyncClient)
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "hits": 1,
                "jobs": [
                    {
                        "title": "Software Development Engineer II",
                        "id_icims": "999888",
                        "job_path": "/en/jobs/999888/sde-ii",
                        "city": "Seattle",
                        "country_code": "USA",
                        "description_short": "Build distributed cloud services.",
                        "posted_date": "September 24, 2026",
                    }
                ]
            }
            mock_client.get.return_value = mock_response

            jobs = await fetch_amazon_jobs("software-development", "Amazon", mock_client, max_pages=1)
            self.assertEqual(len(jobs), 1)
            self.assertEqual(jobs[0].title, "Software Development Engineer II")
            self.assertEqual(jobs[0].source_type, "amazon")
            self.assertEqual(jobs[0].external_id, "999888")
            self.assertEqual(jobs[0].application_url, "https://www.amazon.jobs/en/jobs/999888/sde-ii")

        asyncio.run(run())

    def test_custom_portal_schema_parsing(self):
        async def run():
            page = """
            <html>
            <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org/",
              "@type": "JobPosting",
              "title": "Staff Product Designer",
              "url": "https://careers.google.com/jobs/results/12345",
              "identifier": {"@type": "PropertyValue", "value": "GOOG-12345"},
              "jobLocation": {
                "@type": "Place",
                "address": {
                  "addressLocality": "Mountain View",
                  "addressRegion": "CA",
                  "addressCountry": "US"
                }
              },
              "description": "Lead design systems across Google products."
            }
            </script>
            </head>
            <body></body>
            </html>
            """
            transport = httpx.MockTransport(lambda request: httpx.Response(200, text=page))
            # The SSRF guard resolves the hostname first; pin it to a public address so the test needs no network.
            with patch("socket.getaddrinfo", return_value=[(2, 1, 6, "", ("142.250.80.46", 0))]):
                async with httpx.AsyncClient(transport=transport) as client:
                    jobs = await fetch_custom_portal_jobs("https://careers.google.com", "Google", client)
            self.assertEqual(len(jobs), 1)
            self.assertEqual(jobs[0].title, "Staff Product Designer")
            self.assertEqual(jobs[0].source_type, "custom")
            self.assertEqual(jobs[0].external_id, "GOOG-12345")
            self.assertIn("Mountain View", jobs[0].location)

        asyncio.run(run())


class TestWorkdaySearches(unittest.IsolatedAsyncioTestCase):
    async def test_searches_are_merged_without_duplicates_and_only_role_jobs_are_kept(self):
        postings = {
            "product manager": [{"title": "Senior Product Manager", "externalPath": "/job/A/Senior-Product-Manager_R1", "locationsText": "Dublin", "postedOn": "Posted Today"},
                                {"title": "Forklift Operator", "externalPath": "/job/B/Forklift-Operator_R2", "locationsText": "Dublin", "postedOn": "Posted Today"}],
            "software engineer": [{"title": "Senior Product Manager", "externalPath": "/job/A/Senior-Product-Manager_R1", "locationsText": "Dublin", "postedOn": "Posted Today"},
                                  {"title": "Software Engineer II", "externalPath": "/job/C/Software-Engineer-II_R3", "locationsText": "Pune", "postedOn": "Posted 3 Days Ago"}],
        }
        asked = []

        def handler(request: httpx.Request) -> httpx.Response:
            import json
            query = json.loads(request.content)["searchText"]
            asked.append(query)
            rows = postings.get(query, [])
            return httpx.Response(200, json={"total": len(rows), "jobPostings": rows})

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            jobs = await fetch_workday_jobs("acme.wd1/External", "Acme", client, queries=("product manager", "software engineer", "ux designer"))
        self.assertEqual(asked, ["product manager", "software engineer", "ux designer"])
        self.assertEqual(sorted(j.external_id for j in jobs), ["R1", "R3"])   # R1 only once; the forklift job is not one of Jobly's roles


if __name__ == "__main__":
    unittest.main()
