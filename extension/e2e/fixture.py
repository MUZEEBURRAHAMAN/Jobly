"""Deterministic demo/test database: fictional companies, 160 jobs spread over the last 55 days, plus a few
edge cases (a 75-day-old job that must never show, hostile links, an unknown posting date).

    DATABASE_PATH=/tmp/e2e.db python extension/e2e/fixture.py
"""
import asyncio
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.app.db import get_db_connection, get_utc_now, init_db  # noqa: E402

COMPANIES = ["Northwind Labs", "Paperplane", "Brightloop", "Harbor & Co", "Quill Systems", "Fernbank", "Lumen Works",
             "Tidewater", "Copperfield AI", "Mosaic Health", "Redwood Pay", "Skylark"]
ROLES = {
    "product_design": ["Senior Product Designer", "Design Systems Lead", "UX Researcher", "Product Designer, Growth"],
    "frontend_engineering": ["Frontend Engineer", "Staff Frontend Engineer", "Senior React Engineer"],
    "product_management": ["Product Manager", "Senior Product Manager, Platform", "Technical Product Manager"],
    "ai_ml": ["Machine Learning Engineer", "Applied Scientist", "AI Research Engineer"],
    "fullstack_engineering": ["Full-Stack Engineer", "Senior Software Engineer", "Backend Engineer"],
}
PLACES = [("San Francisco, CA", "us"), ("New York, NY", "us"), ("Remote", "global"), ("Bengaluru, India", "india"), ("London, UK", "europe"), ("Berlin, Germany", "europe")]
SALARY = ["$150K – $210K", "$170K – $240K", "$120K – $160K", "$200K – $280K"]


async def main():
    rnd = random.Random(7)
    await init_db()
    now = datetime.now(timezone.utc)
    stamp = get_utc_now()
    async with get_db_connection() as db:
        for i, name in enumerate(COMPANIES, 1):
            await db.execute("INSERT INTO companies (name, slug, careers_url, source_type, source_identifier, industry, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,1,?,?)",
                             (name, name.lower().replace(" ", "-").replace("&", "and"), "https://example.com/careers", "greenhouse", f"demo{i}", "Technology", stamp, stamp))
        n = 0

        async def add(title, role, company_idx, place, posted, url=None, remote=False, salary=None, seniority="mid", tier="2-5"):
            nonlocal n
            n += 1
            loc, hub = place
            await db.execute(
                """INSERT INTO jobs (company_id, company_name, source_type, external_id, title, normalized_role, seniority, work_mode, location,
                   application_url, content_hash, first_seen_at, last_seen_at, posted_at, status, salary_summary, max_salary, geo_hub, experience_tier)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'active', ?,?,?,?)""",
                (company_idx + 1, COMPANIES[company_idx], "greenhouse", f"fx{n}", title, role, seniority, "remote" if remote else "onsite", loc,
                 url or f"https://example.com/jobs/{n}", f"h{n}", stamp, stamp, posted.isoformat() if posted else None,
                 salary, int(salary.split("–")[1].strip().strip("$K")) * 1000 if salary else None, hub, tier))

        for _ in range(160):
            role = rnd.choice(list(ROLES))
            place = rnd.choice(PLACES)
            days = rnd.choice([0, 0, 1, 1, 2, 3, 4, 6, 9, 12, 16, 21, 28, 35, 44, 52, 55])
            await add(rnd.choice(ROLES[role]), role, rnd.randrange(len(COMPANIES)), place, now - timedelta(days=days, hours=rnd.randrange(20)),
                      remote=place[0] == "Remote", salary=rnd.choice(SALARY) if rnd.random() < 0.6 else None,
                      seniority=rnd.choice(["junior", "mid", "senior", "lead"]), tier=rnd.choice(["0-2", "2-5", "5-8", "8+"]))
        # edge cases
        await add("Ancient Listing (must never show)", "frontend_engineering", 0, PLACES[0], now - timedelta(days=75))
        await add("Unknown Date Engineer", "fullstack_engineering", 1, PLACES[2], None, remote=True)
        # internships (employment type set as a board would)
        await add("Product Design Intern", "product_design", 4, PLACES[0], now - timedelta(days=1), seniority="intern", tier="0-2")
        await add("Frontend Engineering Intern", "frontend_engineering", 8, PLACES[2], now - timedelta(days=2), remote=True, seniority="intern", tier="0-2")
        await db.execute("UPDATE jobs SET employment_type = 'internship' WHERE title LIKE '% Intern'")
        # jobs outside the five tech roles (listed under "More roles")
        await add("Enterprise Account Executive", None, 5, PLACES[0], now - timedelta(days=1))
        await add("Technical Recruiter", None, 6, PLACES[2], now - timedelta(days=3), remote=True)
        await add("Senior Java Developer", None, 7, PLACES[1], now - timedelta(days=2))
        await add("Broken Link Designer", "product_design", 2, PLACES[1], now - timedelta(days=2), url="javascript:alert(1)")
        await add("Extraordinarily Long Title " + "Wordsmith " * 18 + "Engineer", "frontend_engineering", 3, PLACES[4], now - timedelta(days=1))
        await db.commit()
    print(f"fixture ready: {n} jobs, {len(COMPANIES)} companies")


asyncio.run(main())
