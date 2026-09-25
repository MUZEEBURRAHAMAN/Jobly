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

            jobs = await fetch_workday_jobs("adobe.wd5/external_experienced", "Adobe", mock_client, max_pages=1)
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
            mock_client = AsyncMock(spec=httpx.AsyncClient)
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.text = """
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
            mock_client.get.return_value = mock_response

            jobs = await fetch_custom_portal_jobs("https://careers.google.com", "Google", mock_client)
            self.assertEqual(len(jobs), 1)
            self.assertEqual(jobs[0].title, "Staff Product Designer")
            self.assertEqual(jobs[0].source_type, "custom")
            self.assertEqual(jobs[0].external_id, "GOOG-12345")
            self.assertIn("Mountain View", jobs[0].location)

        asyncio.run(run())

if __name__ == "__main__":
    unittest.main()
