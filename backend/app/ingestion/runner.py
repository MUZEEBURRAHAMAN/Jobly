from __future__ import annotations
import asyncio
import json
import logging
import re
from typing import Any
import httpx
from ..db import get_db_connection, get_utc_now
from ..matching import (
    detect_role, detect_seniority, detect_work_mode,
    detect_geo_hub, detect_experience_tier, matches_preferences
)
from .base import NormalizedJob, calculate_content_hash
from .greenhouse import fetch_greenhouse_jobs
from .lever import fetch_lever_jobs
from .ashby import fetch_ashby_jobs
from .workday import fetch_workday_jobs
from .amazon import fetch_amazon_jobs
from .custom_portal import fetch_custom_portal_jobs
from .remotive import fetch_remotive_jobs
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


async def upsert_job_record(
    db,
    job: NormalizedJob,
    comp_id: int,
    comp_name: str,
    preferences: dict[str, Any],
    now: str,
    summary: dict[str, Any],
) -> None:
    """Insert or update a job record and trigger notifications if matched."""
    role = job.normalized_role or detect_role(job.title)
    seniority = job.seniority or detect_seniority(job.title)
    work_mode = job.work_mode or detect_work_mode(job.location, job.title)
    geo_hub = detect_geo_hub(job.location, job.title)
    experience_tier = detect_experience_tier(seniority, job.title)
    content_hash = calculate_content_hash(
        comp_name, job.title, job.location, job.application_url
    )
    raw_json = json.dumps(job.raw_data)

    check_cur = await db.execute(
        "SELECT id, content_hash FROM jobs WHERE source_type = ? AND external_id = ?",
        (job.source_type, job.external_id)
    )
    existing = await check_cur.fetchone()

    if existing:
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
                geo_hub = ?,
                experience_tier = ?
            WHERE id = ?
        """, (
            job.title,
            role,
            seniority,
            work_mode,
            job.location,
            job.description,
            job.application_url,
            content_hash,
            now,
            raw_json,
            geo_hub,
            experience_tier,
            existing["id"]
        ))
        summary["updated_jobs"] += 1
    else:
        cursor = await db.execute("""
            INSERT INTO jobs (
                company_id, company_name, source_type, external_id,
                title, normalized_role, seniority, work_mode,
                location, description, application_url, content_hash,
                first_seen_at, last_seen_at, status, raw_json,
                geo_hub, experience_tier
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
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
            job.description,
            job.application_url,
            content_hash,
            now,
            now,
            raw_json,
            geo_hub,
            experience_tier
        ))
        new_job_id = cursor.lastrowid
        summary["new_jobs"] += 1

        # Check notification match
        job_dict = {
            "normalized_role": role,
            "seniority": seniority,
            "work_mode": work_mode,
            "location": job.location,
            "title": job.title,
        }
        if preferences.get("notify_enabled") and matches_preferences(job_dict, preferences):
            try:
                await db.execute("""
                    INSERT OR IGNORE INTO notifications (
                        job_id, title, company_name, role, location, application_url, sent_at, is_read
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                """, (
                    new_job_id,
                    job.title,
                    comp_name,
                    role or "matched_role",
                    job.location or "Remote / Global",
                    job.application_url,
                    now
                ))
            except Exception as notif_err:
                logger.error(f"Error queueing notification: {notif_err}")


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
        elif source_type == "workday":
            jobs = await fetch_workday_jobs(source_id, name, client)
        elif source_type == "amazon":
            jobs = await fetch_amazon_jobs(source_id, name, client)
        elif source_type == "custom":
            jobs = await fetch_custom_portal_jobs(careers_url or source_id, name, client)
        else:
            return company, [], f"Unsupported source type: {source_type}"
        return company, jobs, None
    except Exception as e:
        logger.error(f"Error fetching jobs for {name} ({source_type}:{source_id}): {e}")
        return company, [], str(e)


async def sync_all_sources(company_id_filter: int | None = None, include_aggregators: bool = True) -> dict[str, Any]:
    now = get_utc_now()
    summary = {
        "timestamp": now,
        "companies_checked": 0,
        "jobs_fetched": 0,
        "new_jobs": 0,
        "updated_jobs": 0,
        "board_jobs_fetched": 0,
        "errors": []
    }

    async with get_db_connection() as db:
        # Load user preferences for notifications matching
        pref_cursor = await db.execute("SELECT * FROM preferences LIMIT 1;")
        pref_row = await pref_cursor.fetchone()
        preferences = {}
        if pref_row:
            preferences = {
                "roles": json.loads(pref_row["roles"] or "[]"),
                "seniorities": json.loads(pref_row["seniorities"] or "[]"),
                "locations": json.loads(pref_row["locations"] or "[]"),
                "remote_only": bool(pref_row["remote_only"]),
                "custom_keywords": pref_row["custom_keywords"] or "",
                "excluded_keywords": pref_row["excluded_keywords"] or "",
                "notify_enabled": bool(pref_row["notify_enabled"]),
            }

        # Cache known companies in memory for instant lookups
        cursor = await db.execute("SELECT id, name FROM companies;")
        company_cache: dict[str, int] = {
            row["name"].strip().lower(): row["id"] for row in await cursor.fetchall()
        }

        # 1. Company ATS Sync (only query direct ATS sources)
        query = """
            SELECT * FROM companies
            WHERE is_active = 1
              AND source_type IN ('greenhouse', 'lever', 'ashby', 'workday', 'amazon', 'custom')
        """
        params = []
        if company_id_filter:
            query += " AND id = ?"
            params.append(company_id_filter)
            include_aggregators = False

        cursor = await db.execute(query, params)
        companies = [dict(row) for row in await cursor.fetchall()]
        summary["companies_checked"] = len(companies)

        limits = httpx.Limits(max_keepalive_connections=10, max_connections=20)
        async with httpx.AsyncClient(timeout=30.0, limits=limits) as client:
            if companies:
                tasks = [fetch_company_jobs(comp, client) for comp in companies]
                results = await asyncio.gather(*tasks)

                for comp, jobs, err in results:
                    if err:
                        summary["errors"].append({"company": comp["name"], "error": err})
                        continue

                    summary["jobs_fetched"] += len(jobs)
                    comp_id = comp["id"]
                    comp_name = comp["name"]

                    for job in jobs:
                        await upsert_job_record(db, job, comp_id, comp_name, preferences, now, summary)

                    await db.execute(
                        "UPDATE companies SET updated_at = ? WHERE id = ?",
                        (now, comp_id)
                    )

            # 2. Board Aggregators Sync (Remotive, WWR, Himalayas, Arbeitnow)
            if include_aggregators:
                logger.info("[Ingestion] Starting board feeds sync (Remotive, WWR, Himalayas, Arbeitnow)...")
                try:
                    aggregator_tasks = [
                        fetch_remotive_jobs(client),
                        fetch_wwr_jobs(),
                        fetch_all_remote_rss_jobs(client),
                    ]
                    aggregator_results = await asyncio.gather(*aggregator_tasks, return_exceptions=True)

                    board_jobs: list[NormalizedJob] = []
                    for res in aggregator_results:
                        if isinstance(res, list):
                            board_jobs.extend(res)
                        elif isinstance(res, Exception):
                            logger.error(f"[Aggregator] Task error: {res}")
                            summary["errors"].append({"source": "aggregator", "error": str(res)})

                    summary["board_jobs_fetched"] = len(board_jobs)
                    summary["jobs_fetched"] += len(board_jobs)

                    for b_job in board_jobs:
                        b_comp_name = b_job.company_name or "Remote Employer"
                        b_logo = b_job.raw_data.get("company_logo")
                        comp_id = await get_or_create_company(
                            db,
                            company_name=b_comp_name,
                            source_type=b_job.source_type,
                            careers_url=b_job.application_url,
                            logo_url=b_logo,
                            cache=company_cache,
                        )
                        await upsert_job_record(db, b_job, comp_id, b_comp_name, preferences, now, summary)

                except Exception as agg_err:
                    logger.error(f"[Ingestion] Aggregator sync failed: {agg_err}")
                    summary["errors"].append({"source": "aggregators", "error": str(agg_err)})

        await db.commit()
    return summary


async def sync_board_sources() -> dict[str, Any]:
    """Sync only board/aggregator sources (Remotive, WWR, Himalayas, Arbeitnow)."""
    now = get_utc_now()
    summary = {
        "timestamp": now,
        "board_jobs_fetched": 0,
        "new_jobs": 0,
        "updated_jobs": 0,
        "errors": []
    }

    async with get_db_connection() as db:
        pref_cursor = await db.execute("SELECT * FROM preferences LIMIT 1;")
        pref_row = await pref_cursor.fetchone()
        preferences = {}
        if pref_row:
            preferences = {
                "roles": json.loads(pref_row["roles"] or "[]"),
                "seniorities": json.loads(pref_row["seniorities"] or "[]"),
                "locations": json.loads(pref_row["locations"] or "[]"),
                "remote_only": bool(pref_row["remote_only"]),
                "custom_keywords": pref_row["custom_keywords"] or "",
                "excluded_keywords": pref_row["excluded_keywords"] or "",
                "notify_enabled": bool(pref_row["notify_enabled"]),
            }

        cursor = await db.execute("SELECT id, name FROM companies;")
        company_cache: dict[str, int] = {
            row["name"].strip().lower(): row["id"] for row in await cursor.fetchall()
        }

        limits = httpx.Limits(max_keepalive_connections=10, max_connections=20)
        async with httpx.AsyncClient(timeout=30.0, limits=limits) as client:
            aggregator_tasks = [
                fetch_remotive_jobs(client),
                fetch_wwr_jobs(),
                fetch_all_remote_rss_jobs(client),
            ]
            aggregator_results = await asyncio.gather(*aggregator_tasks, return_exceptions=True)

            board_jobs: list[NormalizedJob] = []
            for res in aggregator_results:
                if isinstance(res, list):
                    board_jobs.extend(res)
                elif isinstance(res, Exception):
                    logger.error(f"[Aggregator] Task error: {res}")
                    summary["errors"].append({"source": "aggregator", "error": str(res)})

            summary["board_jobs_fetched"] = len(board_jobs)

            for b_job in board_jobs:
                b_comp_name = b_job.company_name or "Remote Employer"
                b_logo = b_job.raw_data.get("company_logo")
                comp_id = await get_or_create_company(
                    db,
                    company_name=b_comp_name,
                    source_type=b_job.source_type,
                    careers_url=b_job.application_url,
                    logo_url=b_logo,
                    cache=company_cache,
                )
                await upsert_job_record(db, b_job, comp_id, b_comp_name, preferences, now, summary)

        await db.commit()
    return summary
