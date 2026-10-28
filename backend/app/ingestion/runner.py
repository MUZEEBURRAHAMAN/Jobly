from __future__ import annotations
import asyncio
import json
from datetime import datetime, timedelta, timezone
import logging
import re
from typing import Any
import httpx
from ..db import get_db_connection, get_utc_now
from ..matching import (
    classify_role, classify_employment, detect_seniority, detect_work_mode,
    detect_geo_hub, detect_experience_tier
)
from ..config import settings
from ..security import sanitize_http_url
from .base import NormalizedJob, calculate_content_hash, normalize_posted_at
from .greenhouse import fetch_greenhouse_jobs
from .lever import fetch_lever_jobs
from .ashby import fetch_ashby_jobs
from .workday import fetch_workday_jobs
from .more_boards import (
    fetch_personio_jobs, fetch_recruitee_jobs, fetch_smartrecruiters_jobs, fetch_teamtailor_jobs, fetch_workable_jobs,
)
from .amazon import fetch_amazon_jobs
from .custom_portal import fetch_custom_portal_jobs
from .weworkremotely import fetch_wwr_jobs
from .remote_rss import fetch_all_remote_rss_jobs

logger = logging.getLogger(__name__)


async def get_or_create_company(
    db,
    company_name: str,
    source_type: str,
    careers_url: str | None = None,
    logo_url: str | None = None,
    cache: dict[str, int] | None = None,
) -> int:
    """Find company ID by name or insert a new record if not exists."""
    name_clean = company_name.strip()
    if not name_clean:
        name_clean = "Unknown Company"

    cache_key = name_clean.lower()
    if cache is not None and cache_key in cache:
        return cache[cache_key]

    # Query existing company by name
    cur = await db.execute("SELECT id FROM companies WHERE LOWER(name) = LOWER(?) LIMIT 1;", (name_clean,))
    row = await cur.fetchone()
    if row:
        comp_id = row["id"]
        if cache is not None:
            cache[cache_key] = comp_id
        return comp_id

    # Generate unique slug
    base_slug = re.sub(r"[^a-z0-9]+", "-", name_clean.lower()).strip("-") or "company"
    slug = base_slug
    counter = 1
    while True:
        check = await db.execute("SELECT id FROM companies WHERE slug = ? LIMIT 1;", (slug,))
        if not await check.fetchone():
            break
        counter += 1
        slug = f"{base_slug}-{counter}"

    now = get_utc_now()
    cur = await db.execute("""
        INSERT INTO companies (
            name, slug, careers_url, source_type, source_identifier,
            logo_url, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    """, (name_clean, slug, careers_url, source_type, slug, logo_url, now, now))

    comp_id = cur.lastrowid
    if cache is not None:
        cache[cache_key] = comp_id
    return comp_id


def age_cutoff_iso(days: int | None = None) -> str:
    """ISO timestamp of the oldest posting date we keep."""
    return (datetime.now(timezone.utc) - timedelta(days=days or settings.MAX_JOB_AGE_DAYS)).isoformat()


def _as_int(value: Any) -> int | None:
    """Hourly rates arrive as floats (60.58); the column is INTEGER."""
    try:
        return None if value is None else int(round(float(value)))
    except (TypeError, ValueError):
        return None


def extract_salary_info(source_type: str, raw_data: dict[str, Any] | None, description: str | None) -> tuple[str | None, int | None, int | None]:
    """Extract salary range and min/max numbers without keeping bulky payloads."""
    if source_type == 'ashby' and raw_data:
        try:
            comp = raw_data.get('compensation') or {}
            if comp:
                summary = comp.get('scrapeableCompensationSalarySummary') or comp.get('compensationTierSummary')
                min_v, max_v = None, None
                tiers = comp.get('compensationTiers', [])
                for t in tiers:
                    for c in t.get('components', []):
                        if c.get('compensationType') == 'Salary':
                            min_v = c.get('minValue')
                            max_v = c.get('maxValue')
                            break
                if summary:
                    summary = summary.replace('• Offers Equity', '• Equity').strip()
                    return summary, _as_int(min_v), _as_int(max_v)
        except Exception:
            pass

    text = description or ''
    if text:
        m = re.search(r'\$([0-9]{2,3}),?([0-9]{3})\s*(?:-|to|–)\s*\$([0-9]{2,3}),?([0-9]{3})', text)
        if m:
            v1 = int(m.group(1) + m.group(2))
            v2 = int(m.group(3) + m.group(4))
            return f"${v1//1000}K - ${v2//1000}K", v1, v2
        m_k = re.search(r'\$([0-9]{2,3})[kK]\s*(?:-|to|–)\s*\$([0-9]{2,3})[kK]', text)
        if m_k:
            v1 = int(m_k.group(1)) * 1000
            v2 = int(m_k.group(2)) * 1000
            return f"${m_k.group(1)}K - ${m_k.group(2)}K", v1, v2
        m_inr = re.search(r'(?:₹|INR)\s*([0-9]{1,2}(?:\.[0-9]+)?)\s*(?:-|to|–)\s*([0-9]{1,2}(?:\.[0-9]+)?)\s*(?:LPA|Lakhs|L)', text, re.I)
        if m_inr:
            v1 = int(float(m_inr.group(1)) * 100000)
            v2 = int(float(m_inr.group(2)) * 100000)
            return f"₹{m_inr.group(1)}L - ₹{m_inr.group(2)}L", v1, v2

    return None, None, None


async def upsert_job_record(
    db,
    job: NormalizedJob,
    comp_id: int,
    comp_name: str,
    now: str,
    summary: dict[str, Any],
) -> None:
    """Insert or update a job record with minimal memory overhead and fast-path hash check."""
    # Drop jobs whose apply link isn't plain http(s): they would render as dead or malicious buttons.
    clean_url = sanitize_http_url(job.application_url)
    if clean_url is None:
        return
    job.application_url = clean_url
    role = classify_role(job.title, job.normalized_role)
    seniority = job.seniority or detect_seniority(job.title)
    work_mode = job.work_mode or detect_work_mode(job.location, job.title)
    geo_hub = detect_geo_hub(job.location, job.title)
    experience_tier = detect_experience_tier(seniority, job.title)
    employment = classify_employment(job.title, job.raw_data)
    content_hash = calculate_content_hash(
        comp_name, job.title, job.location, job.application_url
    )

    posted_at = normalize_posted_at(job.source_updated_at)
    if posted_at and posted_at < age_cutoff_iso():
        summary["skipped_old"] = summary.get("skipped_old", 0) + 1   # older than MAX_JOB_AGE_DAYS: never stored
        return

    # Bound description length to avoid holding multi-megabyte HTML strings in memory/DB
    desc = (job.description or "").strip()
    compact_desc = desc[:1500] if desc else None

    check_cur = await db.execute(
        "SELECT id, content_hash FROM jobs WHERE source_type = ? AND external_id = ?",
        (job.source_type, job.external_id)
    )
    existing = await check_cur.fetchone()

    if existing:
        if existing["content_hash"] == content_hash:
            # FAST-PATH: Job content hasn't changed. Update last_seen_at with minimal I/O & memory.
            await db.execute(
                "UPDATE jobs SET last_seen_at = ?, status = 'active', employment_type = COALESCE(employment_type, ?) WHERE id = ?",
                (now, employment, existing["id"])
            )
            return

        # Full update only when content actually changed
        salary_summary, min_sal, max_sal = extract_salary_info(job.source_type, job.raw_data, desc)
        compact_raw = None
        if job.raw_data:
            clean_raw = {
                k: v for k, v in job.raw_data.items()
                if k in ("company_logo", "salary", "compensation") and v
            }
            if clean_raw:
                compact_raw = json.dumps(clean_raw)

        await db.execute("""
            UPDATE jobs SET
                title = ?,
                normalized_role = ?,
                seniority = ?,
                work_mode = ?,
                location = ?,
                description = ?,
                application_url = ?,
                content_hash = ?,
                last_seen_at = ?,
                status = 'active',
                raw_json = ?,
                salary_summary = COALESCE(?, salary_summary),
                min_salary = COALESCE(?, min_salary),
                max_salary = COALESCE(?, max_salary),
                geo_hub = ?,
                experience_tier = ?,
                posted_at = COALESCE(?, posted_at),
                employment_type = COALESCE(?, employment_type)
            WHERE id = ?
        """, (
            job.title,
            role,
            seniority,
            work_mode,
            job.location,
            compact_desc,
            job.application_url,
            content_hash,
            now,
            compact_raw,
            salary_summary,
            min_sal,
            max_sal,
            geo_hub,
            experience_tier,
            posted_at,
            employment,
            existing["id"]
        ))
        summary["updated_jobs"] += 1
    else:
        # New job insertion
        salary_summary, min_sal, max_sal = extract_salary_info(job.source_type, job.raw_data, desc)
        compact_raw = None
        if job.raw_data:
            clean_raw = {
                k: v for k, v in job.raw_data.items()
                if k in ("company_logo", "salary", "compensation") and v
            }
            if clean_raw:
                compact_raw = json.dumps(clean_raw)

        cursor = await db.execute("""
            INSERT INTO jobs (
                company_id, company_name, source_type, external_id,
                title, normalized_role, seniority, work_mode,
                location, description, application_url, content_hash,
                first_seen_at, last_seen_at, status, raw_json,
                salary_summary, min_salary, max_salary,
                geo_hub, experience_tier, posted_at, employment_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            comp_id,
            comp_name,
            job.source_type,
            job.external_id,
            job.title,
            role,
            seniority,
            work_mode,
            job.location,
            compact_desc,
            job.application_url,
            content_hash,
            now,
            now,
            compact_raw,
            salary_summary,
            min_sal,
            max_sal,
            geo_hub,
            experience_tier,
            posted_at,
            employment
        ))
        summary["new_jobs"] += 1


async def fetch_company_jobs(
    company: dict[str, Any],
    client: httpx.AsyncClient
) -> tuple[dict[str, Any], list[NormalizedJob], str | None]:
    source_type = company["source_type"].lower()
    source_id = company["source_identifier"]
    name = company["name"]
    careers_url = company.get("careers_url") or ""

    try:
        if source_type == "greenhouse":
            jobs = await fetch_greenhouse_jobs(source_id, name, client)
        elif source_type == "lever":
            jobs = await fetch_lever_jobs(source_id, name, client)
        elif source_type == "ashby":
            jobs = await fetch_ashby_jobs(source_id, name, client)
        elif source_type == "smartrecruiters":
            jobs = await fetch_smartrecruiters_jobs(source_id, name, client)
        elif source_type == "workable":
            jobs = await fetch_workable_jobs(source_id, name, client)
        elif source_type == "recruitee":
            jobs = await fetch_recruitee_jobs(source_id, name, client)
        elif source_type == "teamtailor":
            jobs = await fetch_teamtailor_jobs(source_id, name, client)
        elif source_type == "personio":
            jobs = await fetch_personio_jobs(source_id, name, client)
        elif source_type == "workday":
            if settings.CRAWL_PROFILE == "full":
                # The scheduled full crawl lists every role: page through the whole board instead of tech searches
                jobs = await fetch_workday_jobs(source_id, name, client, max_pages=settings.WORKDAY_MAX_PAGES, queries=("",), only_roles=False)
            else:
                jobs = await fetch_workday_jobs(source_id, name, client)
        elif source_type == "amazon":
            if settings.CRAWL_PROFILE == "full":
                jobs = await fetch_amazon_jobs("all", name, client, max_pages=100)
            else:
                jobs = await fetch_amazon_jobs(source_id, name, client)
        elif source_type == "custom":
            jobs = await fetch_custom_portal_jobs(careers_url or source_id, name, client)
        else:
            return company, [], f"Unsupported source type: {source_type}"
        return company, jobs, None
    except Exception as e:
        logger.error(f"Error fetching jobs for {name} ({source_type}:{source_id}): {e}")
        return company, [], str(e)


# Boards read at once, and companies per database commit (settings.CRAWL_CONCURRENCY: 5 on the free server).
SEMAPHORE_LIMIT = max(1, settings.CRAWL_CONCURRENCY)
BATCH_SIZE = max(10, 2 * SEMAPHORE_LIMIT)


async def sync_all_sources(company_id_filter: int | None = None, include_aggregators: bool = True) -> dict[str, Any]:
    """Low-memory streaming ingestion: processes companies in batches of 10 and commits frequently."""
    import gc
    now = get_utc_now()
    summary = {
        "timestamp": now,
        "companies_checked": 0,
        "jobs_fetched": 0,
        "new_jobs": 0,
        "updated_jobs": 0,
        "board_jobs_fetched": 0,
        "skipped_old": 0,
        "closed_jobs": 0,
        "errors": []
    }

    async with get_db_connection() as db:

        # Cache company names
        cursor = await db.execute("SELECT id, name FROM companies;")
        company_cache: dict[str, int] = {
            row["name"].strip().lower(): row["id"] for row in await cursor.fetchall()
        }

        # 1. Company ATS Sync in controlled batches of 10
        # Workday costs about ten requests per employer; on the free server those come from the restored snapshot instead.
        heavy = ("workday",) if settings.CRAWL_PROFILE != "full" else ()
        sources = [t for t in ('greenhouse', 'lever', 'ashby', 'workday', 'amazon', 'custom',
                               'smartrecruiters', 'workable', 'recruitee', 'teamtailor', 'personio') if t not in heavy]
        query = f"""
            SELECT * FROM companies
            WHERE is_active = 1
              AND source_type IN ({",".join("'" + t + "'" for t in sources)})
        """
        params = []
        if company_id_filter:
            query += " AND id = ?"
            params.append(company_id_filter)
            include_aggregators = False

        cursor = await db.execute(query, params)
        companies = [dict(row) for row in await cursor.fetchall()]
        summary["companies_checked"] = len(companies)

        limits = httpx.Limits(max_keepalive_connections=SEMAPHORE_LIMIT, max_connections=2 * SEMAPHORE_LIMIT)
        async with httpx.AsyncClient(timeout=25.0, limits=limits) as client:
            sem = asyncio.Semaphore(SEMAPHORE_LIMIT)

            async def _fetch_safe(comp: dict[str, Any]):
                async with sem:
                    return await fetch_company_jobs(comp, client)

            for i in range(0, len(companies), BATCH_SIZE):
                batch = companies[i : i + BATCH_SIZE]
                tasks = [_fetch_safe(comp) for comp in batch]
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)

                for item in batch_results:
                    if isinstance(item, Exception):
                        continue
                    comp, jobs, err = item
                    if err:
                        summary["errors"].append({"company": comp["name"], "error": err})
                        continue

                    summary["jobs_fetched"] += len(jobs)
                    comp_id = comp["id"]
                    comp_name = comp["name"]

                    for job in jobs:
                        await upsert_job_record(db, job, comp_id, comp_name, now, summary)

                    if jobs:
                        # The board answered with jobs: anything of this company we did NOT see this time is gone.
                        closed = await db.execute(
                            "UPDATE jobs SET status = 'closed' WHERE company_id = ? AND status = 'active' AND last_seen_at < ?",
                            (comp_id, now),
                        )
                        summary["closed_jobs"] += max(closed.rowcount, 0)

                    await db.execute(
                        "UPDATE companies SET updated_at = ? WHERE id = ?",
                        (now, comp_id)
                    )

                # Commit after every batch to keep dirty pages and WAL memory flat
                await db.commit()
                del batch_results
                del tasks

                # Periodic garbage collection every 5 batches (50 companies)
                if (i // BATCH_SIZE) % 5 == 0:
                    gc.collect()

            # 2. Board Aggregators Sync (processed sequentially to prevent memory peaks)
            if include_aggregators:
                # 2A. WeWorkRemotely
                try:
                    logger.info("[Ingestion] Fetching WWR feeds...")
                    wwr_jobs = await fetch_wwr_jobs()
                    summary["board_jobs_fetched"] += len(wwr_jobs)
                    summary["jobs_fetched"] += len(wwr_jobs)
                    for b_job in wwr_jobs:
                        b_comp_name = b_job.company_name or "Remote Employer"
                        b_logo = b_job.raw_data.get("company_logo") if b_job.raw_data else None
                        comp_id = await get_or_create_company(
                            db, company_name=b_comp_name, source_type=b_job.source_type,
                            careers_url=b_job.application_url, logo_url=b_logo, cache=company_cache
                        )
                        await upsert_job_record(db, b_job, comp_id, b_comp_name, now, summary)
                    await db.commit()
                    del wwr_jobs
                    gc.collect()
                except Exception as wwr_err:
                    logger.error(f"[Ingestion] WWR sync error: {wwr_err}")
                    summary["errors"].append({"source": "wwr", "error": str(wwr_err)})

                # 2C. Remote RSS Feeds (Himalayas, Arbeitnow, etc.)
                try:
                    logger.info("[Ingestion] Fetching Remote RSS feeds...")
                    rss_jobs = await fetch_all_remote_rss_jobs(client)
                    summary["board_jobs_fetched"] += len(rss_jobs)
                    summary["jobs_fetched"] += len(rss_jobs)
                    for b_job in rss_jobs:
                        b_comp_name = b_job.company_name or "Remote Employer"
                        b_logo = b_job.raw_data.get("company_logo") if b_job.raw_data else None
                        comp_id = await get_or_create_company(
                            db, company_name=b_comp_name, source_type=b_job.source_type,
                            careers_url=b_job.application_url, logo_url=b_logo, cache=company_cache
                        )
                        await upsert_job_record(db, b_job, comp_id, b_comp_name, now, summary)
                    await db.commit()
                    del rss_jobs
                    gc.collect()
                except Exception as rss_err:
                    logger.error(f"[Ingestion] RSS sync error: {rss_err}")
                    summary["errors"].append({"source": "rss", "error": str(rss_err)})

        from ..seed import retire_stale_rows  # imported here: seed imports the database layer, which imports this module
        await retire_stale_rows(db)
        # Re-check stored roles, so rule changes also apply to jobs whose content hasn't changed
        summary["reclassified"] = await reclassify_roles(db)

        # Purge what we'd never show anyway: postings older than the age limit and long-closed jobs
        await db.execute("DELETE FROM jobs WHERE posted_at IS NOT NULL AND posted_at < ?", (age_cutoff_iso(),))
        await db.execute("DELETE FROM jobs WHERE status = 'closed' AND last_seen_at < ?", (age_cutoff_iso(14),))

        # Final commit and garbage collection
        await db.commit()
        gc.collect()
    return summary


async def reclassify_roles(db) -> int:
    """Apply the current role rules to every active job. The stored role doubles as the category hint,
    which keeps this stable from one run to the next. Returns how many jobs changed role."""
    cur = await db.execute("SELECT id, title, normalized_role, employment_type FROM jobs WHERE status = 'active'")
    rows = await cur.fetchall()
    changes = [(new, row["id"]) for row in rows
               if (new := classify_role(row["title"], row["normalized_role"])) != row["normalized_role"]]
    # Jobs stored before employment types existed get one from their title (boards that say so set it on the next change).
    kinds = [(kind, row["id"]) for row in rows if row["employment_type"] is None and (kind := classify_employment(row["title"]))]
    if changes:
        await db.executemany("UPDATE jobs SET normalized_role = ? WHERE id = ?", changes)
    if kinds:
        await db.executemany("UPDATE jobs SET employment_type = ? WHERE id = ?", kinds)
    if changes or kinds:
        await db.commit()
        logger.info(f"[Ingestion] Re-classified {len(changes)} job roles")
    return len(changes)


async def sync_board_sources() -> dict[str, Any]:
    """Sync only board/aggregator sources sequentially to keep RAM minimal."""
    import gc
    now = get_utc_now()
    summary = {
        "timestamp": now,
        "board_jobs_fetched": 0,
        "new_jobs": 0,
        "updated_jobs": 0,
        "errors": []
    }

    async with get_db_connection() as db:

        cursor = await db.execute("SELECT id, name FROM companies;")
        company_cache: dict[str, int] = {
            row["name"].strip().lower(): row["id"] for row in await cursor.fetchall()
        }

        limits = httpx.Limits(max_keepalive_connections=SEMAPHORE_LIMIT, max_connections=2 * SEMAPHORE_LIMIT)
        async with httpx.AsyncClient(timeout=25.0, limits=limits) as client:
            # 2. WWR
            try:
                wwr_jobs = await fetch_wwr_jobs()
                summary["board_jobs_fetched"] += len(wwr_jobs)
                for b_job in wwr_jobs:
                    b_comp_name = b_job.company_name or "Remote Employer"
                    b_logo = b_job.raw_data.get("company_logo") if b_job.raw_data else None
                    comp_id = await get_or_create_company(
                        db, company_name=b_comp_name, source_type=b_job.source_type,
                        careers_url=b_job.application_url, logo_url=b_logo, cache=company_cache
                    )
                    await upsert_job_record(db, b_job, comp_id, b_comp_name, now, summary)
                await db.commit()
                del wwr_jobs
                gc.collect()
            except Exception as e:
                summary["errors"].append({"source": "wwr", "error": str(e)})

            # 3. RSS
            try:
                rss_jobs = await fetch_all_remote_rss_jobs(client)
                summary["board_jobs_fetched"] += len(rss_jobs)
                for b_job in rss_jobs:
                    b_comp_name = b_job.company_name or "Remote Employer"
                    b_logo = b_job.raw_data.get("company_logo") if b_job.raw_data else None
                    comp_id = await get_or_create_company(
                        db, company_name=b_comp_name, source_type=b_job.source_type,
                        careers_url=b_job.application_url, logo_url=b_logo, cache=company_cache
                    )
                    await upsert_job_record(db, b_job, comp_id, b_comp_name, now, summary)
                await db.commit()
                del rss_jobs
                gc.collect()
            except Exception as e:
                summary["errors"].append({"source": "rss", "error": str(e)})

        summary["reclassified"] = await reclassify_roles(db)
        await db.commit()
        gc.collect()
    return summary
