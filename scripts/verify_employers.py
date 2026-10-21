"""Find out which candidate employers Jobly can read, and add the useful ones to the employer list.

    .venv/bin/python scripts/verify_employers.py                    # dry run: test every candidate, print a report
    .venv/bin/python scripts/verify_employers.py --write            # also add the eligible ones to backend/app/data/companies.json
    .venv/bin/python scripts/verify_employers.py --only ca,in       # only these regions of the candidate file
    .venv/bin/python scripts/verify_employers.py --recheck          # test the employers already in the list, report dead boards

Each candidate (scripts/employer_candidates.csv) is tried on Greenhouse, Ashby, Lever, SmartRecruiters, Workable, Recruitee, Teamtailor and Personio under a few board names, using the
same readers the server uses. An employer is eligible when its board answers and has at least --min-role jobs in Jobly's
five roles outside the United States (for candidates tagged "us": anywhere). Nothing is written unless --write is given.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import re
import sys
from collections import Counter
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.app.geo import place_of  # noqa: E402
from backend.app.ingestion.ashby import fetch_ashby_jobs  # noqa: E402
from backend.app.ingestion.greenhouse import fetch_greenhouse_jobs  # noqa: E402
from backend.app.ingestion.lever import fetch_lever_jobs  # noqa: E402
from backend.app.ingestion.more_boards import (  # noqa: E402
    fetch_personio_jobs, fetch_recruitee_jobs, fetch_smartrecruiters_jobs, fetch_teamtailor_jobs, fetch_workable_jobs,
)
from backend.app.matching import classify_role  # noqa: E402

logging.disable(logging.CRITICAL)  # the readers warn on every missing board; that is expected here
READERS = {
    "greenhouse": fetch_greenhouse_jobs, "ashby": fetch_ashby_jobs, "lever": fetch_lever_jobs, "smartrecruiters": fetch_smartrecruiters_jobs,
    "workable": fetch_workable_jobs, "recruitee": fetch_recruitee_jobs, "teamtailor": fetch_teamtailor_jobs, "personio": fetch_personio_jobs,
}
COMPANIES = ROOT / "backend" / "app" / "data" / "companies.json"
CANDIDATES = ROOT / "scripts" / "employer_candidates.csv"
TRIED = ROOT / "scripts" / "employer_tried.txt"
USER_AGENT = "HiringRadar/1.0 (job discovery; +https://joblyextension.netlify.app)"


def slug_variants(name: str, extra: list[str]) -> list[str]:
    base = re.sub(r"\.(com|io|ai|co)$", "", name.lower())
    plain = re.sub(r"[^a-z0-9]", "", base)
    dashed = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    return list(dict.fromkeys([plain, dashed, *extra]))


def read_candidates(regions: set[str] | None) -> list[dict]:
    out = []
    for line in CANDIDATES.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        name, domain, region = parts[0], parts[1], parts[2]
        extra = [x.strip() for x in parts[3].split(",")] if len(parts) > 3 and parts[3] else []
        if regions and region not in regions:
            continue
        out.append({"name": name, "domain": domain, "region": region, "slugs": slug_variants(name, extra)})
    seen, unique = set(), []
    for c in out:  # a name listed twice (for two regions) is tested once
        if c["name"].lower() not in seen:
            seen.add(c["name"].lower()); unique.append(c)
    return unique


def same_company(candidate: str, board_name: str | None) -> bool:
    """A slug can belong to a different company. Boards that name themselves must resemble the candidate; boards that don't are trusted."""
    if not board_name:
        return True
    norm = lambda t: re.sub(r"[^a-z0-9]", "", re.sub(r"\.(com|io|ai|co)\b", "", t.lower()))  # noqa: E731
    a, b = norm(candidate), norm(board_name)
    return bool(a and b and (a in b or b in a or a[:5] == b[:5]))


def score(jobs) -> dict:
    mine = [(j, classify_role(j.title, j.normalized_role)) for j in jobs]
    role = [j for j, r in mine if r]
    countries = Counter(place_of(j.location)[0] for j in role)
    outside = sum(n for c, n in countries.items() if c and c != "United States")
    return {"jobs": len(jobs), "role": len(role), "outside": outside, "countries": [(c or "not stated", n) for c, n in countries.most_common(4)]}


async def try_board(client, sem, kind: str, slug: str, name: str):
    async with sem:
        try:
            jobs = await READERS[kind](slug, name, client)
        except Exception:
            return None
    if not jobs:
        return None
    board = next((j.raw_data.get("board_name") for j in jobs if j.raw_data.get("board_name")), None)
    if not same_company(name, board):
        return None
    return (kind, slug, score(jobs))


async def best_board(client, sem, cand: dict):
    results = [r for r in await asyncio.gather(*[try_board(client, sem, k, s, cand["name"]) for s in cand["slugs"] for k in READERS]) if r]
    return max(results, key=lambda r: (r[2]["outside"], r[2]["role"], r[2]["jobs"])) if results else None


async def careers_url(client, domain: str) -> str:
    """The employer's own careers page when one answers; otherwise its home page (never a guess that might 404)."""
    root = domain[4:] if domain.startswith("www.") else domain
    for url in (f"https://www.{root}/careers", f"https://{root}/careers", f"https://careers.{root}", f"https://jobs.{root}",
                f"https://www.{root}/jobs", f"https://{root}/jobs", f"https://www.{root}/en/careers", f"https://{root}/company/careers"):
        try:
            r = await client.get(url, follow_redirects=True, timeout=15)
            if r.status_code < 400 and str(r.url).startswith("https://"):
                return str(r.url)
        except Exception:
            continue
    return f"https://{root}"


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--write", action="store_true", help="add eligible employers to companies.json")
    ap.add_argument("--only", help="comma-separated regions from the candidate file")
    ap.add_argument("--min-role", type=int, default=2, help="minimum role jobs outside the US (default 2); region 'us' counts role jobs anywhere")
    ap.add_argument("--fix-links", action="store_true", help="re-resolve careers links that are just a home page")
    ap.add_argument("--retry", action="store_true", help="test candidates again even if an earlier run found nothing")
    ap.add_argument("--recheck", action="store_true", help="test the employers already in the list instead")
    args = ap.parse_args()
    sem = asyncio.Semaphore(10)
    async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=25.0) as client:
        existing = json.loads(COMPANIES.read_text(encoding="utf-8"))
        if args.recheck:
            await recheck(client, sem, existing)
            return
        if args.fix_links:
            domains = {c["name"].lower(): c["domain"] for c in read_candidates(None)}
            todo = [c for c in existing if "region" in c and c["careers_url"].count("/") < 3 and c["name"].lower() in domains]
            for c, url in zip(todo, await asyncio.gather(*[careers_url(client, domains[c["name"].lower()]) for c in todo])):
                if url != c["careers_url"]:
                    print(f"{c['name']:24}{c['careers_url']}  ->  {url}"); c["careers_url"] = url
            COMPANIES.write_text(json.dumps(existing, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            return
        known_ids = {(c["source_type"], c["source_identifier"].lower()) for c in existing}
        known_slugs = {c["slug"] for c in existing}
        known_names = {c["name"].lower() for c in existing}
        tried = set() if args.retry or not TRIED.exists() else {l.strip().lower() for l in TRIED.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")}
        cands = [c for c in read_candidates(set(args.only.split(",")) if args.only else None) if c["name"].lower() not in known_names | tried]
        print(f"testing {len(cands)} candidates on {len(READERS)} systems...", flush=True)
        found = await asyncio.gather(*[best_board(client, sem, c) for c in cands])

        eligible, rows = [], []
        for cand, hit in zip(cands, found):
            if not hit:
                rows.append((cand, None, "no board found")); continue
            kind, slug, sc = hit
            if (kind, slug.lower()) in known_ids:
                rows.append((cand, hit, "already in the list")); continue
            ok = (sc["role"] if cand["region"] == "us" else sc["outside"]) >= args.min_role
            rows.append((cand, hit, "ELIGIBLE" if ok else f"only {sc['outside']} role jobs outside the US"))
            if ok:
                eligible.append((cand, kind, slug, sc))

        for cand, hit, verdict in rows:
            if hit:
                kind, slug, sc = hit
                print(f"{cand['name']:26}{cand['region']:11}{kind:11}{slug:20} jobs={sc['jobs']:4} role={sc['role']:3} outside-US={sc['outside']:3}  {verdict}  {sc['countries'][:3]}")
        misses = [c["name"] for c, h, _ in rows if not h]
        print(f"\nno board found for {len(misses)}: {', '.join(misses)}")
        print(f"\n{len(eligible)} eligible employers, {sum(e[3]['outside'] for e in eligible)} role jobs outside the US between them")
        by_region = Counter(e[0]["region"] for e in eligible)
        print("by region:", dict(by_region))

        if args.write:  # remember the misses so the next run starts with new names only
            lost = [c["name"] for c, h, v in rows if v not in ("ELIGIBLE", "already in the list")]
            old = TRIED.read_text(encoding="utf-8").splitlines() if TRIED.exists() else []
            TRIED.write_text("\n".join(old + [n for n in lost if n not in old]) + "\n", encoding="utf-8")
        if args.write and eligible:
            urls = await asyncio.gather(*[careers_url(client, e[0]["domain"]) for e in eligible])
            added = 0
            for (cand, kind, slug, sc), url in zip(eligible, urls):
                base = re.sub(r"[^a-z0-9]+", "-", cand["name"].lower()).strip("-")
                unique = base if base not in known_slugs else f"{base}-{kind}"
                existing.append({"name": cand["name"], "slug": unique, "careers_url": url, "source_type": kind, "source_identifier": slug,
                                 "industry": None, "region": cand["region"]})
                known_slugs.add(unique); added += 1
            COMPANIES.write_text(json.dumps(existing, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print(f"wrote {added} employers to {COMPANIES.relative_to(ROOT)} ({len(existing)} in total)")


async def recheck(client, sem, existing: list[dict]) -> None:
    """Employers already in the list whose board no longer answers (a company changed hiring systems or closed its board)."""
    async def one(c):
        if c["source_type"] not in READERS:
            return c, "skipped (not a Greenhouse/Ashby/Lever board)"
        hit = await try_board(client, sem, c["source_type"], c["source_identifier"], c["name"])
        return c, ("ok" if hit else "NO JOBS OR BOARD GONE")
    for c, verdict in await asyncio.gather(*[one(c) for c in existing]):
        if verdict.startswith("NO"):
            print(f"{c['name']:28}{c['source_type']:11}{c['source_identifier']:22}{verdict}")
    print("recheck done")


if __name__ == "__main__":
    asyncio.run(main())
