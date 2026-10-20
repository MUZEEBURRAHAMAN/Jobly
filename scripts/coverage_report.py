"""Where Jobly's jobs come from: employers and jobs by source, role and country, as Markdown.

    .venv/bin/python scripts/coverage_report.py                       # live server, printed
    .venv/bin/python scripts/coverage_report.py --out report.md       # saved to a file
    .venv/bin/python scripts/coverage_report.py --base http://127.0.0.1:8000

Run it before and after adding employers to see what changed. Countries come from each job's free-text location
(the same rules as the website's map, backend/app/geo.py), so they are approximate; locations that name no country
("Remote") are listed separately instead of guessed.
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.app.geo import place_of  # noqa: E402

ROLES = {
    "product_design": "Product design", "frontend_engineering": "Frontend engineering", "product_management": "Product management",
    "ai_ml": "AI & machine learning", "fullstack_engineering": "Fullstack engineering",
}
SOURCES = {
    "greenhouse": ("Greenhouse", True), "ashby": ("Ashby", True), "lever": ("Lever", True), "workday": ("Workday", True), "amazon": ("Amazon Jobs", True),
    "smartrecruiters": ("SmartRecruiters", True), "personio": ("Personio", True), "workable": ("Workable", True), "recruitee": ("Recruitee", True), "teamtailor": ("Teamtailor", True),
    "weworkremotely": ("We Work Remotely", False), "himalayas": ("Himalayas", False), "arbeitnow": ("Arbeitnow", False),
}


def fetch(base: str) -> tuple[list[dict], list[dict]]:
    with httpx.Client(base_url=base, timeout=90) as client:
        companies = client.get("/api/companies").json()
        jobs, offset = [], 0
        while True:
            page = client.get("/api/jobs", params={"limit": 200, "offset": offset}).json()
            jobs += page["items"]
            offset += 200
            if offset >= page["total"]:
                return companies, jobs


def report(companies: list[dict], jobs: list[dict], now: datetime) -> str:
    def within(job, days):  # posted in the last `days` days; jobs with no date are never counted
        return bool(job.get("posted_at")) and now - datetime.fromisoformat(job["posted_at"]) <= timedelta(days=days)

    for j in jobs:
        j["country"] = place_of(j["location"])[0]
    role_jobs = [j for j in jobs if j["normalized_role"] in ROLES]
    n = lambda it: sum(1 for _ in it)  # noqa: E731
    out = [f"# Jobly coverage, {now:%Y-%m-%d %H:%M} UTC", ""]

    direct = n(c for c in companies if SOURCES.get(c["source_type"], ("", True))[1])
    out += ["## Summary", "", "| | Count |", "|---|---|",
            f"| Employers | {len(companies)} ({direct} through their own career pages, {len(companies) - direct} found on job boards) |",
            f"| Open jobs stored | {len(jobs):,} |",
            f"| Jobs in the five roles | {len(role_jobs):,} ({len(role_jobs) * 100 // max(len(jobs), 1)}%) |",
            f"| Role jobs posted in the last 24 hours / 7 days | {n(j for j in role_jobs if within(j, 1))} / {n(j for j in role_jobs if within(j, 7))} |",
            f"| Role jobs outside the US | {n(j for j in role_jobs if j['country'] and j['country'] != 'United States')} |",
            f"| Role jobs with no country stated | {n(j for j in role_jobs if not j['country'])} |",
            f"| Countries with at least 20 role jobs | {sum(1 for c, v in Counter(j['country'] for j in role_jobs if j['country']).items() if v >= 20)} |", ""]

    out += ["## By source", "", "| Source | Kind | Employers | Open jobs | Role jobs | Role jobs outside the US |", "|---|---|---|---|---|---|"]
    for key in sorted({c["source_type"] for c in companies}, key=lambda k: -n(j for j in jobs if j["source_type"] == k)):
        label, direct_ = SOURCES.get(key, (key, True))
        mine = [j for j in jobs if j["source_type"] == key]
        rj = [j for j in mine if j["normalized_role"] in ROLES]
        out.append(f"| {label} | {'Career pages' if direct_ else 'Job board'} | {n(c for c in companies if c['source_type'] == key)} | {len(mine):,} | {len(rj):,} | "
                   f"{n(j for j in rj if j['country'] and j['country'] != 'United States')} |")

    out += ["", "## By role", "", "| Role | Open jobs | Last 7 days | Remote | Outside the US |", "|---|---|---|---|---|"]
    for key, label in ROLES.items():
        mine = [j for j in jobs if j["normalized_role"] == key]
        out.append(f"| {label} | {len(mine):,} | {n(j for j in mine if within(j, 7))} | {n(j for j in mine if j['work_mode'] == 'remote')} | "
                   f"{n(j for j in mine if j['country'] and j['country'] != 'United States')} |")

    out += ["", "## By country (jobs in the five roles)", "", "| Country | Role jobs | " + " | ".join(ROLES.values()) + " |", "|---|---|" + "---|" * len(ROLES)]
    by_country = Counter(j["country"] for j in role_jobs if j["country"])
    for country, total in by_country.most_common():
        per = Counter(j["normalized_role"] for j in role_jobs if j["country"] == country)
        out.append(f"| {country} | {total} | " + " | ".join(str(per[r]) for r in ROLES) + " |")

    out += ["", "## Employers with the most role jobs", "", "| Employer | Source | Role jobs | Main country |", "|---|---|---|---|"]
    by_firm = Counter(j["company_id"] for j in role_jobs)
    names = {c["id"]: c for c in companies}
    for firm, total in by_firm.most_common(25):
        mine = Counter(j["country"] for j in role_jobs if j["company_id"] == firm and j["country"])
        out.append(f"| {names[firm]['name']} | {SOURCES.get(names[firm]['source_type'], (names[firm]['source_type'],))[0]} | {total} | {mine.most_common(1)[0][0] if mine else 'not stated'} |")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", default="https://jobly-yd6l.onrender.com", help="API address")
    parser.add_argument("--out", help="write to this file instead of printing")
    args = parser.parse_args()
    companies, jobs = fetch(args.base)
    text = report(companies, jobs, datetime.now(timezone.utc))
    Path(args.out).write_text(text, encoding="utf-8") if args.out else print(text)
