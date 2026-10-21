"""Placing job locations on the map: country and hub from free-text locations, and the /api/geo numbers."""
import unittest
from datetime import datetime, timedelta, timezone

import httpx

from backend.app.db import get_db_connection, get_utc_now
from backend.app.geo import COUNTRIES, HUBS, place_of
from backend.app.main import app


class TestPlaceOf(unittest.TestCase):
    def test_hubs_and_countries(self):
        cases = {
            "San Mateo, CA United States": ("United States", "San Francisco Bay Area"),
            "Costa Mesa, California, United States": ("United States", "Los Angeles area"),
            "Cambridge, MA": ("United States", "Boston area"),
            "Zürich": ("Switzerland", "Zurich"),
            "Bengaluru, India": ("India", "Bengaluru"),
            "Toronto, Ontario, Canada": ("Canada", "Toronto"),
            "Washington, District of Columbia, United States": ("United States", "Washington, DC"),
            "Cambridge, UK": ("United Kingdom", None),
            "Remote - US": ("United States", None),
            "Remote Canada": ("Canada", None),
            "Texas": ("United States", None),
            "King Abdullah Economic City, 02": ("Saudi Arabia", None),
        }
        for text, expected in cases.items():
            self.assertEqual(place_of(text), expected, text)

    def test_unplaceable_locations_are_not_guessed(self):
        for text in ["Remote", "Hybrid", "Distributed", "2 Locations", "N/A", "Design", "", None]:
            self.assertEqual(place_of(text), (None, None), text)

    def test_every_hub_belongs_to_a_known_country(self):
        for name, country, lat, lng, keywords in HUBS:
            self.assertIn(country, COUNTRIES, name)
            self.assertTrue(-90 <= lat <= 90 and -180 <= lng <= 180 and keywords, name)
        for name, (lat, lng, keywords) in COUNTRIES.items():
            self.assertTrue(-90 <= lat <= 90 and -180 <= lng <= 180 and keywords, name)


class TestGeoEndpoint(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        now = get_utc_now()
        old = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        rows = [  # location, role, company, posted_at
            ("San Francisco, CA", "product_design", 1, now), ("Palo Alto, CA", "ai_ml", 2, now),
            ("Remote - US", "fullstack_engineering", 1, now), ("London, UK", "product_management", 2, now),
            ("Remote", "ai_ml", 1, now),                       # names no country: counted as unplaced
            ("Berlin, Germany", None, 1, now),                 # not one of the five roles: left out
            ("Dublin, Ireland", "ai_ml", 2, old),              # past the age limit: left out
        ]
        async with get_db_connection() as db:
            await db.execute("DELETE FROM jobs WHERE external_id LIKE 'geo-%'")
            for i, (loc, role, company, posted) in enumerate(rows):
                await db.execute(
                    """INSERT INTO jobs (company_id, company_name, source_type, external_id, title, normalized_role, work_mode, location,
                                         application_url, content_hash, first_seen_at, last_seen_at, posted_at, status)
                       VALUES (?, 'Co', 'greenhouse', ?, 'Geo test', ?, 'remote', ?, 'https://jobs.example.com/g', ?, ?, ?, ?, 'active')""",
                    (company, f"geo-{i}", role, loc, f"geo-{i}", now, now, posted),
                )
            await db.commit()

    async def asyncTearDown(self):
        async with get_db_connection() as db:
            await db.execute("DELETE FROM jobs WHERE external_id LIKE 'geo-%'")
            await db.commit()
        await self.client.aclose()

    async def test_counts_by_place(self):
        data = (await self.client.get("/api/geo")).json()
        us_jobs = sum(c["jobs"] for c in data["by_country"] if c["country"] == "United States")
        by_name = {p["name"]: p for p in data["places"]}
        # the seeded rows (all "Remote") add to total and unplaced; ours add the rest
        self.assertEqual(by_name["San Francisco Bay Area"]["jobs"], 2)
        self.assertEqual(by_name["San Francisco Bay Area"]["kind"], "hub")
        self.assertEqual(by_name["San Francisco Bay Area"]["roles"], {"product_design": 1, "ai_ml": 1})
        self.assertEqual(by_name["United States"]["kind"], "country")       # "Remote - US" sits at the country, not in a hub
        self.assertEqual(by_name["United States"]["jobs"], 1)
        self.assertEqual(us_jobs, 3)
        self.assertEqual(by_name["London"]["jobs"], 1)
        self.assertNotIn("Berlin", by_name)
        self.assertNotIn("Dublin", by_name)
        self.assertEqual(data["countries"], 2)
        self.assertEqual(sum(data["roles"].values()), data["total"])
        self.assertGreaterEqual(data["unplaced"], 1)
        self.assertEqual(data["total"], data["unplaced"] + sum(p["jobs"] for p in data["places"]))

    async def test_places_have_map_coordinates_and_are_sorted(self):
        data = (await self.client.get("/api/geo")).json()
        self.assertEqual([p["jobs"] for p in data["places"]], sorted((p["jobs"] for p in data["places"]), reverse=True))
        sf = next(p for p in data["places"] if p["name"] == "San Francisco Bay Area")
        self.assertTrue(30 < sf["lat"] < 40 and -125 < sf["lng"] < -120)
        self.assertEqual(sf["employers"], 2)

    async def test_stats_have_tech_only_counts(self):
        """The website quotes the tech_* numbers: a job outside the five roles (our Berlin row) must not be in them."""
        stats = (await self.client.get("/api/stats")).json()
        self.assertEqual(stats["tech_jobs"], stats["total_jobs"] - 1)
        self.assertEqual(stats["tech_jobs_today"], stats["new_jobs_today"] - 1)
        self.assertGreaterEqual(stats["tech_jobs_week"], stats["tech_jobs_today"])
        self.assertLessEqual(stats["tech_jobs_week"], stats["tech_jobs"])


class TestWiderMatching(unittest.TestCase):
    """Countries and unambiguous cities beyond the hand-made list, in a job's location text and at the end of its title."""

    def test_location_text(self):
        from backend.app.geo import place_of_job
        cases = {
            "US, Remote": "United States", "Remote Eligible, US": "United States", "IND-Trivandrum-Equifax Analytics-PEC": "India",
            "HSINCHU": "Taiwan", "Ljubljana, Slovenia": "Slovenia", "Makati City": "Philippines", "Yerevan": "Armenia", "Edmonton": "Canada",
            "Vancouver, British Columbia, CAN": "Canada", "Sydney, New South Wales, Australia": "Australia", "Porto Alegre, Rio Grande do Sul, Brazil": "Brazil",
            "Amsterdam": "Netherlands", "McLean VA": "United States", "IL   Work from home": "United States",
        }
        for text, country in cases.items():
            self.assertEqual(place_of_job(text)[0], country, text)

    def test_ambiguous_or_placeless_text_is_left_alone(self):
        from backend.app.geo import place_of_job
        for text in ["Cambridge", "Remote", "Hybrid", "Global", "Europe", "2 Locations", "Mobile", "Design", "Home based - Worldwide", "Product", ""]:
            self.assertEqual(place_of_job(text)[0], None, text)

    def test_the_end_of_a_title_can_name_a_country_but_abbreviations_cannot(self):
        from backend.app.geo import place_of_job
        self.assertEqual(place_of_job("Remote", "Product Designer - Germany")[0], "Germany")
        self.assertEqual(place_of_job("Remote", "Engineer (Canada)")[0], "Canada")
        for title in ["Senior AI Engineer (SWE-3)", "Product Manager, GTM Engineering", "Staff Engineer, Retail Media & Audiences", "Platform Engineer, Systems"]:
            self.assertEqual(place_of_job("Remote", title)[0], None, title)
        self.assertEqual(place_of_job("Toronto", "Engineer - Germany")[0], "Canada")   # a real location beats the title

    def test_every_country_the_map_can_show_has_a_point(self):
        from backend.app.geo import country_point
        for country in ("United States", "Slovenia", "Armenia", "Philippines", "Taiwan"):
            lat, lng = country_point(country)
            self.assertTrue((lat, lng) != (0.0, 0.0) and -90 <= lat <= 90 and -180 <= lng <= 180, country)

    def test_hand_made_countries_use_the_same_names_as_the_world_table(self):
        from backend.app.geo import COUNTRIES, _world
        names = {c["name"] for c in _world()["raw"]["countries"].values()}
        self.assertEqual([c for c in COUNTRIES if c not in names], [])
