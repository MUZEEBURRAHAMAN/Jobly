"""Readers for SmartRecruiters, Workable, Recruitee, Teamtailor and Personio, against payloads shaped like the real feeds."""
import unittest

import httpx

from backend.app.ingestion.base import normalize_posted_at
from backend.app.ingestion.more_boards import (
    fetch_personio_jobs, fetch_recruitee_jobs, fetch_smartrecruiters_jobs, fetch_teamtailor_jobs, fetch_workable_jobs,
)


def client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


class TestSmartRecruiters(unittest.IsolatedAsyncioTestCase):
    async def test_pages_dates_and_links(self):
        calls = []

        def handler(req: httpx.Request) -> httpx.Response:
            offset = int(req.url.params["offset"]); calls.append(offset)
            item = lambda i: {"id": f"600{i}", "name": f"Engineer {i}", "company": {"identifier": "Canva", "name": "Canva"},
                              "releasedDate": "2026-10-20T06:23:28.820Z",
                              "location": {"city": "Sydney", "country": "au", "remote": i == 0, "hybrid": i == 1, "fullLocation": "Sydney, NSW, Australia"}}
            return httpx.Response(200, json={"offset": offset, "limit": 100, "totalFound": 130,
                                             "content": [item(i) for i in range(offset, min(offset + 100, 130))]})

        async with client(handler) as c:
            jobs = await fetch_smartrecruiters_jobs("canva", "Canva", c)
        self.assertEqual(calls, [0, 100])
        self.assertEqual(len(jobs), 130)
        self.assertEqual(jobs[0].application_url, "https://jobs.smartrecruiters.com/Canva/6000")
        self.assertEqual((jobs[0].work_mode, jobs[1].work_mode, jobs[2].work_mode), ("remote", "hybrid", None))
        self.assertEqual(jobs[0].location, "Sydney, NSW, Australia")
        self.assertEqual(jobs[0].raw_data["board_name"], "Canva")
        self.assertTrue(normalize_posted_at(jobs[0].source_updated_at).startswith("2026-10-20"))

    async def test_missing_board_gives_no_jobs(self):
        async with client(lambda r: httpx.Response(404)) as c:
            self.assertEqual(await fetch_smartrecruiters_jobs("nope", "Nope", c), [])


class TestPoliteRetries(unittest.IsolatedAsyncioTestCase):
    async def test_a_429_is_retried_and_then_succeeds(self):
        from unittest.mock import patch
        calls = []

        def handler(req: httpx.Request) -> httpx.Response:
            calls.append(1)
            return httpx.Response(429, headers={"retry-after": "1"}) if len(calls) == 1 else httpx.Response(200, json={"name": "Acme", "jobs": [{"title": "Engineer", "url": "https://apply.workable.com/j/1", "shortcode": "1"}]})

        with patch("backend.app.ingestion.more_boards.asyncio.sleep") as slept:
            async with client(handler) as c:
                jobs = await fetch_workable_jobs("acme", "Acme", c)
        self.assertEqual((len(calls), len(jobs)), (2, 1))
        slept.assert_awaited_once_with(1.0)

    async def test_gives_up_after_three_tries(self):
        from unittest.mock import patch
        calls = []
        with patch("backend.app.ingestion.more_boards.asyncio.sleep"):
            async with client(lambda r: (calls.append(1), httpx.Response(503))[1]) as c:
                self.assertEqual(await fetch_workable_jobs("acme", "Acme", c), [])
        self.assertEqual(len(calls), 3)


class TestWorkable(unittest.IsolatedAsyncioTestCase):
    async def test_fields(self):
        payload = {"name": "Starling Bank", "jobs": [{"title": "Data Scientist", "shortcode": "ABC123", "url": "https://apply.workable.com/j/ABC123", "published_on": "2026-10-09",
                                                       "country": "United Kingdom", "city": "London", "state": "England", "telecommuting": True}, {"title": "", "url": "x"}]}
        async with client(lambda r: httpx.Response(200, json=payload)) as c:
            jobs = await fetch_workable_jobs("starling-bank", "Starling Bank", c)
        self.assertEqual(len(jobs), 1)
        j = jobs[0]
        self.assertEqual((j.title, j.location, j.work_mode, j.external_id), ("Data Scientist", "London, England, United Kingdom", "remote", "ABC123"))
        self.assertEqual(j.raw_data["board_name"], "Starling Bank")
        self.assertTrue(normalize_posted_at(j.source_updated_at).startswith("2026-10-09"))


class TestRecruitee(unittest.IsolatedAsyncioTestCase):
    async def test_fields_and_date_format(self):
        payload = {"offers": [{"id": 2783543, "title": "Head of Product", "careers_url": "https://careers.bunq.com/o/head-of-product-6", "status": "published",
                               "location": "Amsterdam, Noord-Holland, Netherlands", "published_at": "2026-10-15 09:31:36 UTC", "remote": False, "hybrid": True, "company_name": "bunq"},
                              {"id": 1, "title": "Draft role", "careers_url": "https://x/y", "status": "draft"}]}
        async with client(lambda r: httpx.Response(200, json=payload)) as c:
            jobs = await fetch_recruitee_jobs("bunq", "Bunq", c)
        self.assertEqual([j.title for j in jobs], ["Head of Product"])
        self.assertEqual(jobs[0].work_mode, "hybrid")
        self.assertEqual(normalize_posted_at(jobs[0].source_updated_at)[:16], "2026-10-15T09:31")


RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:tt="https://teamtailor.com/locations"><channel><title>Sendcloud</title>
<item><title>Frontend Engineer</title><description>&lt;p&gt;Long text&lt;/p&gt;</description><pubDate>Mon, 19 Oct 2026 17:04:42 +0200</pubDate>
<link>https://jobs.sendcloud.com/jobs/8570978-frontend-engineer</link><remoteStatus>hybrid</remoteStatus><guid>608e5be3</guid>
<tt:locations><tt:location><tt:name>Eindhoven HQ</tt:name><tt:city>Eindhoven</tt:city><tt:country>Netherlands</tt:country></tt:location></tt:locations><tt:department>Tech</tt:department></item>
</channel></rss>"""


class TestTeamtailor(unittest.IsolatedAsyncioTestCase):
    async def test_rss_with_namespaced_locations(self):
        async with client(lambda r: httpx.Response(200, text=RSS)) as c:
            jobs = await fetch_teamtailor_jobs("sendcloud", "Sendcloud", c)
        self.assertEqual(len(jobs), 1)
        j = jobs[0]
        self.assertEqual((j.title, j.location, j.work_mode, j.external_id), ("Frontend Engineer", "Eindhoven, Netherlands", "hybrid", "608e5be3"))
        self.assertEqual(j.raw_data["board_name"], "Sendcloud")
        self.assertTrue(normalize_posted_at(j.source_updated_at).startswith("2026-10-19"))

    async def test_html_error_page_is_not_a_feed(self):
        async with client(lambda r: httpx.Response(200, text="<!DOCTYPE html><html><body>nope</body>")) as c:
            self.assertEqual(await fetch_teamtailor_jobs("x", "X", c), [])


XML = """<?xml version="1.0" encoding="UTF-8"?><workzag-jobs>
<position><id>2678260</id><office>Düsseldorf</office><additionalOffices><office>Berlin</office></additionalOffices><department>Tech</department>
<name>Senior Backend Engineer (m/f/d)</name><jobDescriptions><jobDescription><name>Team</name><value><![CDATA[Text]]></value></jobDescription></jobDescriptions>
<createdAt>2026-06-18T14:36:44+00:00</createdAt></position></workzag-jobs>"""


class TestPersonio(unittest.IsolatedAsyncioTestCase):
    async def test_xml_positions(self):
        async with client(lambda r: httpx.Response(200, content=XML.encode())) as c:
            jobs = await fetch_personio_jobs("kiwi", "Kiwi.com", c)
        self.assertEqual(len(jobs), 1)
        self.assertEqual((jobs[0].title, jobs[0].location), ("Senior Backend Engineer (m/f/d)", "Düsseldorf, Berlin"))
        self.assertEqual(jobs[0].application_url, "https://kiwi.jobs.personio.de/job/2678260")
        self.assertTrue(normalize_posted_at(jobs[0].source_updated_at).startswith("2026-06-18"))


if __name__ == "__main__":
    unittest.main()


class TestLocationsFromSources(unittest.IsolatedAsyncioTestCase):
    async def test_workday_uses_the_link_for_n_locations(self):
        from backend.app.ingestion.workday import fetch_workday_jobs
        rows = [{"title": "Senior Software Engineer", "externalPath": "/job/Israel-Raanana/Senior-Software-Engineer_R1", "locationsText": "2 Locations", "postedOn": "Posted Today"},
                {"title": "Software Engineer", "externalPath": "/job/US-CA-Santa-Clara/Software-Engineer_R2", "locationsText": "3 Locations", "postedOn": "Posted Today"},
                {"title": "Software Engineer II", "externalPath": "/job/Pune/Software-Engineer-II_R3", "locationsText": "Pune, India", "postedOn": "Posted Today"}]
        handler = lambda r: httpx.Response(200, json={"total": 3, "jobPostings": rows})
        async with client(handler) as c:
            jobs = await fetch_workday_jobs("acme.wd1/External", "Acme", c, queries=("software engineer",))
        self.assertEqual({j.external_id: j.location for j in jobs}, {"R1": "Israel Raanana", "R2": "US CA Santa Clara", "R3": "Pune, India"})

    async def test_ashby_adds_secondary_locations_to_a_bare_remote(self):
        from backend.app.ingestion.ashby import fetch_ashby_jobs
        payload = {"jobs": [{"id": "1", "title": "Engineer", "location": "Remote", "jobUrl": "https://jobs.ashbyhq.com/x/1", "publishedAt": "2026-10-01T00:00:00Z",
                             "secondaryLocations": [{"location": "Australia"}, {"location": "Singapore"}], "address": {"postalAddress": {}}},
                            {"id": "2", "title": "Designer", "location": "London, United Kingdom", "jobUrl": "https://jobs.ashbyhq.com/x/2", "secondaryLocations": [{"location": "Paris"}]}]}
        async with client(lambda r: httpx.Response(200, json=payload)) as c:
            jobs = await fetch_ashby_jobs("x", "X", c)
        self.assertEqual([j.location for j in jobs], ["Remote, Australia, Singapore", "London, United Kingdom"])

    async def test_lever_adds_all_locations_to_a_bare_remote(self):
        from backend.app.ingestion.lever import fetch_lever_jobs
        payload = [{"id": "a", "text": "Engineer", "hostedUrl": "https://jobs.lever.co/x/a", "categories": {"location": "Remote", "allLocations": ["Germany", "Spain"]}}]
        async with client(lambda r: httpx.Response(200, json=payload)) as c:
            jobs = await fetch_lever_jobs("x", "X", c)
        self.assertEqual(jobs[0].location, "Remote, Germany, Spain")
