"""Find live job boards for candidate employers and add them to backend/app/data/companies.json.

Candidates (scripts/candidates/):
  names.txt     one employer per line: "Name" or "Name|industry"; a "## Industry" line sets the industry for the
                names after it. Tried on Greenhouse, Lever, Ashby, Workable,
                SmartRecruiters and Recruitee under slugs made from the name ("Acme Corp" -> acmecorp, acme-corp).
  workday.txt   "Name|tenant|site hint" for big employers on Workday; the tenant is tried on the usual hosts
                (wd1, wd3, wd5, wd12...) with the hint and common site names.
A board counts when it answers with at least MIN_JOBS open jobs and, where the system reports the employer's
name, that name resembles the candidate's. Per employer, the board with the most jobs wins.
Every result goes to scripts/candidates/results.jsonl, and names that found nothing to tried.txt (skipped next
time unless --retry), so the job can run in slices.

Usage: python scripts/discover_boards.py [--limit N] [--retry] [--dry-run]
Needs network access to the job boards (it runs in the "Discover companies" GitHub Actions workflow).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
CANDIDATES = ROOT / "scripts" / "candidates"
COMPANIES = ROOT / "backend" / "app" / "data" / "companies.json"
MIN_JOBS = 3
CONCURRENCY = 24
UA = "JoblyBot/1.0 (job index; +https://jobly-88t.pages.dev)"

WORKDAY_HOSTS = ("wd1", "wd5", "wd3", "wd12", "wd103", "wd501")
WORKDAY_SITES = ("External", "Careers", "{t}", "{T}Careers", "{t}_careers", "External_Careers", "ExternalCareers",
                 "{T}_External_Career_Site", "External_Career_Site", "jobs", "Search", "en-US/External")


@dataclass
class Board:
    name: str
    source_type: str
    source_identifier: str
    careers_url: str
    jobs: int
    industry: str | None = None


def norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", text.lower())


def slugs(name: str) -> list[str]:
    """Board slugs to try for an employer name, most likely first."""
    base = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    base = re.sub(r"[&+]", " and ", base)
    base = re.sub(r"\b(inc|llc|ltd|limited|corp|corporation|co|gmbh|plc|sa|ag|bv|the)\b\.?", " ", base)
    words = re.findall(r"[a-z0-9]+", base)
    if not words:
        return []
    out = ["".join(words), "-".join(words)]
    if words[-1] in ("labs", "ai", "hq", "technologies", "technology", "software", "group", "health", "io") and len(words) > 1:
        out.append("".join(words[:-1]))
    if words[-1] != "hq":
        out.append("".join(words) + "hq")
    return list(dict.fromkeys(s for s in out if len(s) >= 2))


def similar(candidate: str, reported: str | None) -> bool:
    """Is the board's own employer name plausibly the candidate? (Unknown names are accepted.)"""
    if not reported:
        return True
    a, b = norm(candidate), norm(reported)
    return bool(a) and bool(b) and (a in b or b in a or a[:6] == b[:6])


async def get_json(client: httpx.AsyncClient, url: str, **kw):
    try:
        r = await client.get(url, **kw)
    except httpx.HTTPError:
        return None
    if r.status_code != 200:
        return None
    try:
        return r.json()
    except ValueError:
        return None


async def probe_greenhouse(client, name, slug) -> Board | None:
    data = await get_json(client, f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=false")
    jobs = len((data or {}).get("jobs") or [])
    if jobs < MIN_JOBS:
        return None
    meta = await get_json(client, f"https://boards-api.greenhouse.io/v1/boards/{slug}")
    if not similar(name, (meta or {}).get("name")):
        return None
    return Board(name, "greenhouse", slug, f"https://boards.greenhouse.io/{slug}", jobs)


async def probe_lever(client, name, slug) -> Board | None:
    data = await get_json(client, f"https://api.lever.co/v0/postings/{slug}?mode=json")
    if not isinstance(data, list) or len(data) < MIN_JOBS:
        return None
    return Board(name, "lever", slug, f"https://jobs.lever.co/{slug}", len(data))


async def probe_ashby(client, name, slug) -> Board | None:
    data = await get_json(client, f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
    jobs = len((data or {}).get("jobs") or [])
    if jobs < MIN_JOBS:
        return None
    return Board(name, "ashby", slug, f"https://jobs.ashbyhq.com/{slug}", jobs)


async def probe_workable(client, name, slug) -> Board | None:
    data = await get_json(client, f"https://apply.workable.com/api/v1/widget/accounts/{slug}")
    jobs = len((data or {}).get("jobs") or [])
    if jobs < MIN_JOBS or not similar(name, (data or {}).get("name")):
        return None
    return Board(name, "workable", slug, f"https://apply.workable.com/{slug}", jobs)


async def probe_smartrecruiters(client, name, slug) -> Board | None:
    ident = slug if not slug.islower() else "".join(w.capitalize() for w in slug.split("-"))
    data = await get_json(client, f"https://api.smartrecruiters.com/v1/companies/{ident}/postings?limit=1")
    jobs = int((data or {}).get("totalFound") or 0)
    if jobs < MIN_JOBS:
        return None
    items = (data or {}).get("content") or []
    reported = ((items[0].get("company") or {}).get("name")) if items else None
    if not similar(name, reported):
        return None
    return Board(name, "smartrecruiters", ident, f"https://jobs.smartrecruiters.com/{ident}", jobs)


async def probe_recruitee(client, name, slug) -> Board | None:
    if "-" in slug:
        return None
    data = await get_json(client, f"https://{slug}.recruitee.com/api/offers/")
    jobs = len((data or {}).get("offers") or [])
    if jobs < MIN_JOBS:
        return None
    return Board(name, "recruitee", slug, f"https://{slug}.recruitee.com", jobs)


PROBES = (probe_greenhouse, probe_ashby, probe_lever, probe_workable, probe_smartrecruiters, probe_recruitee)


async def probe_workday(client, name, tenant, hint) -> Board | None:
    t = tenant.lower()
    sites = [hint] if hint else []
    sites += [s.format(t=t, T=tenant[:1].upper() + tenant[1:]) for s in WORKDAY_SITES]
    for host in WORKDAY_HOSTS:
        for site in dict.fromkeys(sites):
            url = f"https://{t}.{host}.myworkdayjobs.com/wday/cxs/{t}/{site}/jobs"
            try:
                r = await client.post(url, json={"appliedFacets": {}, "limit": 1, "offset": 0, "searchText": ""},
                                      headers={"Accept": "application/json"})
            except httpx.HTTPError:
                break   # this host doesn't exist for the tenant
            if r.status_code != 200:
                continue
            try:
                total = int(r.json().get("total") or 0)
            except (ValueError, AttributeError):
                continue
            if total >= MIN_JOBS:
                return Board(name, "workday", f"{t}.{host}/{site}", f"https://{t}.{host}.myworkdayjobs.com/{site}", total)
    return None


async def discover_name(client, sem, name: str, industry: str | None) -> Board | None:
    best: Board | None = None
    async with sem:
        for slug in slugs(name):
            found = await asyncio.gather(*(p(client, name, slug) for p in PROBES))
            for b in found:
                if b and (best is None or b.jobs > best.jobs):
                    best = b
            if best:
                break
    if best:
        best.industry = industry
    return best


def read_lines(path: Path) -> list[list[str]]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            rows.append([p.strip() for p in line.split("|")])
    return rows


def read_names(path: Path) -> list[tuple[str, str | None]]:
    out, industry = [], None
    for line in path.read_text(encoding="utf-8").splitlines() if path.exists() else []:
        line = line.strip()
        if line.startswith("## "):
            industry = line[3:].strip() or None
        elif line and not line.startswith("#"):
            name, _, own = line.partition("|")
            out.append((name.strip(), own.strip() or industry))
    return out


def company_entry(b: Board, taken: set[str]) -> dict:
    slug = re.sub(r"[^a-z0-9]+", "-", b.name.lower()).strip("-") or b.source_identifier
    if slug in taken:
        slug = f"{slug}-{b.source_type}"
    taken.add(slug)
    return {"name": b.name, "slug": slug, "careers_url": b.careers_url, "source_type": b.source_type,
            "source_identifier": b.source_identifier, "industry": b.industry}


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="test at most this many new names")
    ap.add_argument("--retry", action="store_true", help="also retry names in tried.txt")
    ap.add_argument("--dry-run", action="store_true", help="don't change companies.json")
    args = ap.parse_args()

    companies = json.loads(COMPANIES.read_text(encoding="utf-8"))
    have_names = {norm(c["name"]) for c in companies}
    have_boards = {(c["source_type"], c["source_identifier"].lower()) for c in companies}
    taken = {c["slug"] for c in companies}
    tried_file = CANDIDATES / "tried.txt"
    tried = set() if args.retry else {norm(r[0]) for r in read_lines(tried_file)}

    names = read_names(CANDIDATES / "names.txt")
    names = [n for n in {norm(n[0]): n for n in reversed(names)}.values() if norm(n[0]) not in have_names and norm(n[0]) not in tried][::-1]
    workday = [r for r in read_lines(CANDIDATES / "workday.txt") if norm(r[0]) not in have_names and norm(r[0]) not in tried]
    if args.limit:
        names = names[: args.limit]
    print(f"testing {len(names)} names and {len(workday)} Workday employers", flush=True)

    sem = asyncio.Semaphore(CONCURRENCY)
    limits = httpx.Limits(max_connections=CONCURRENCY * 4, max_keepalive_connections=CONCURRENCY * 2)
    async with httpx.AsyncClient(timeout=15, limits=limits, headers={"User-Agent": UA}, follow_redirects=False) as client:
        async def wd(row):
            async with sem:
                b = await probe_workday(client, row[0], row[1], row[2] if len(row) > 2 else "")
            if b and len(row) > 3:
                b.industry = row[3]
            return row[0], b
        async def gh(row):
            return row[0], await discover_name(client, sem, row[0], row[1])
        results = await asyncio.gather(*(gh(r) for r in names), *(wd(r) for r in workday))

    added, misses = [], []
    with open(CANDIDATES / "results.jsonl", "a", encoding="utf-8") as log:
        for name, b in results:
            log.write(json.dumps({"name": name, "board": b.__dict__ if b else None}) + "\n")
            if not b:
                misses.append(name)
                continue
            if (b.source_type, b.source_identifier.lower()) in have_boards:
                continue
            have_boards.add((b.source_type, b.source_identifier.lower()))
            added.append((company_entry(b, taken), b.jobs))

    print(f"found {len(added)} new boards ({sum(j for _, j in added):,} open jobs); {len(misses)} names found nothing")
    for entry, jobs in sorted(added, key=lambda x: -x[1])[:40]:
        print(f"  {jobs:6d}  {entry['name']}  ({entry['source_type']}:{entry['source_identifier']})")
    if not args.dry_run:
        companies.extend(e for e, _ in added)
        COMPANIES.write_text(json.dumps(companies, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        with open(tried_file, "a", encoding="utf-8") as f:
            f.writelines(f"{m}\n" for m in misses)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
