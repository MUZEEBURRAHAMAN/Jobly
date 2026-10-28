"""Publish the job database as static JSON files, so clients need no running server.

Layout (all under <out>/v1/):
  meta.json                    generation time, columns, age buckets, categories with counts, file sizes
  companies.json               same shape as GET /api/companies
  stats.json, geo.json         same shapes as GET /api/stats (without preferences) and GET /api/geo
  jobs/<category>/<bucket>.json  {"rows": [[...], ...]} in meta.columns order, newest first
  desc/<id % DESC_SHARDS>.json   {"<job id>": "<plain-text description>"}

A job's bucket is the age of its posting in days, rounded up to the next bound in AGE_BUCKETS, or "u" when the
source gives no posting date. A client wanting jobs posted within N days loads every bucket whose lower bound is
below N and filters the rows exactly; without a date filter it also loads "u". Only active jobs inside
MAX_JOB_AGE_DAYS are published, matching what the API would list.

Usage: python -m backend.app.static_export <out dir>
"""
from __future__ import annotations

import asyncio
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any

from .categories import CATEGORIES, classify_category
from .config import settings

VERSION = 1
AGE_BUCKETS = (1, 3, 7, 14, 30, 60)
DESC_SHARDS = 2048
DESC_CHARS = 1500

COLUMNS = (
    "id", "company_id", "company_name", "title", "normalized_role", "seniority", "work_mode", "location",
    "geo_hub", "experience_tier", "employment_type", "min_salary", "max_salary", "salary_summary",
    "posted_at", "first_seen_at", "application_url", "source_type", "yc_batch",
)

HEADERS = """/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
  Cache-Control: public, max-age=300
  X-Content-Type-Options: nosniff

/v1/desc/*
  Cache-Control: public, max-age=3600
"""

_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"[ \t\r\f\v]+")
_BLANK = re.compile(r"\n\s*\n\s*(\n\s*)+")


def plain_text(html: str | None) -> str:
    """Descriptions arrive as HTML (sometimes escaped twice); clients render them as text."""
    if not html:
        return ""
    text = unescape(unescape(html))
    text = re.sub(r"(?i)<\s*(br|/p|/ul|/ol|/h[1-6]|/div)\s*/?>", "\n", text)
    text = re.sub(r"(?i)<\s*li[^>]*>", "\n• ", text)
    text = _TAG.sub("", text)
    text = _SPACE.sub(" ", text)
    text = _BLANK.sub("\n\n", text)
    return text.strip()[:DESC_CHARS]


def bucket_of(posted_at: str | None, now: datetime) -> str:
    if not posted_at:
        return "u"
    try:
        posted = datetime.fromisoformat(posted_at.replace("Z", "+00:00"))
    except ValueError:
        return "u"
    if posted.tzinfo is None:
        posted = posted.replace(tzinfo=timezone.utc)
    days = (now - posted).total_seconds() / 86400
    for bound in AGE_BUCKETS:
        if days <= bound:
            return str(bound)
    return str(AGE_BUCKETS[-1])


def _write(path: Path, data: Any) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    path.write_text(body, encoding="utf-8")
    return len(body.encode("utf-8"))


async def _api_documents() -> tuple[Any, Any, Any]:
    """Reuse the API's own handlers so the published numbers match the server's to the job."""
    from .api.routes import get_geo, get_stats, list_companies

    stats = await get_stats(prefs_dict={})
    geo = await get_geo()
    companies = await list_companies()
    dump = lambda m: m.model_dump(mode="json")  # noqa: E731
    return dump(stats), dump(geo), [dump(c) for c in companies]


async def export(db_path: Path, out: Path, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    root = out / "v1"
    from .ingestion.runner import age_cutoff_iso

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    rows = con.execute(
        f"""
        SELECT j.id, j.company_id, j.company_name, j.title, j.normalized_role, j.seniority, j.work_mode, j.location,
               j.geo_hub, j.experience_tier, j.employment_type, j.min_salary, j.max_salary, j.salary_summary,
               j.posted_at, j.first_seen_at, j.application_url, j.source_type, c.yc_batch, j.description
        FROM jobs j LEFT JOIN companies c ON c.id = j.company_id
        WHERE j.status = 'active' AND (j.posted_at IS NULL OR j.posted_at >= ?)
        ORDER BY (j.posted_at IS NULL) ASC, j.posted_at DESC, j.id DESC
        """,
        (age_cutoff_iso(settings.MAX_JOB_AGE_DAYS),),
    ).fetchall()
    con.close()

    files: dict[tuple[str, str], list[list[Any]]] = {}
    shards: dict[int, dict[str, str]] = {}
    for r in rows:
        cat = classify_category(r["title"], r["normalized_role"])
        files.setdefault((cat, bucket_of(r["posted_at"], now)), []).append([r[c] for c in COLUMNS])
        desc = plain_text(r["description"])
        if desc:
            shards.setdefault(r["id"] % DESC_SHARDS, {})[str(r["id"])] = desc

    sizes: dict[str, dict[str, dict[str, int]]] = {}
    for (cat, bucket), cat_rows in files.items():
        size = _write(root / "jobs" / cat / f"{bucket}.json", {"rows": cat_rows})
        sizes.setdefault(cat, {})[bucket] = {"jobs": len(cat_rows), "bytes": size}
    for shard, docs in shards.items():
        _write(root / "desc" / f"{shard}.json", docs)

    stats, geo, companies = await _api_documents()
    _write(root / "stats.json", stats)
    _write(root / "geo.json", geo)
    _write(root / "companies.json", companies)

    categories = [
        {**c, "jobs": sum(b["jobs"] for b in sizes.get(str(c["id"]), {}).values())} for c in CATEGORIES
    ]
    meta = {
        "version": VERSION,
        "generated_at": now.isoformat(),
        "max_age_days": settings.MAX_JOB_AGE_DAYS,
        "total": len(rows),
        "companies": len(companies),
        "columns": list(COLUMNS),
        "age_buckets": list(AGE_BUCKETS),
        "desc_shards": DESC_SHARDS,
        "categories": categories,
        "files": sizes,
    }
    _write(root / "meta.json", meta)
    (out / "_headers").write_text(HEADERS, encoding="utf-8")
    (out / "index.html").write_text(
        "<!doctype html><meta charset=utf-8><title>Jobly job data</title>"
        f"<p>Jobly's public job data: {len(rows):,} jobs. Start at <a href=/v1/meta.json>/v1/meta.json</a>.</p>",
        encoding="utf-8",
    )
    return meta


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python -m backend.app.static_export <out dir>")
    result = asyncio.run(export(settings.DATABASE_PATH, Path(sys.argv[1])))
    print(f"static data: {result['total']} jobs, {result['companies']} companies -> {sys.argv[1]}")
