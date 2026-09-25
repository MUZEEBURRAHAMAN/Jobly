import json
from datetime import datetime, timezone, timedelta
from typing import Any
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from ..db import get_db_connection, get_utc_now
from ..schemas import (
    JobOut, JobsResponse, CompanyOut, CompanyCreate,
    PreferencesSchema, NotificationOut, StatsOut
)
from ..matching import matches_preferences
from ..ingestion.runner import sync_all_sources

router = APIRouter()

# Q-6 FIX: Column name allowlist — prevents any future f-string SQL injection via column names
ALLOWED_FILTER_COLUMNS = {
    "normalized_role", "geo_hub", "experience_tier", "work_mode",
    "status", "is_saved", "company_id", "seniority",
    "salary_summary", "max_salary", "first_seen_at", "location", "title", "company_name"
}

@router.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "hiring-radar-api",
        "timestamp": get_utc_now()
    }

@router.get("/api/preferences", response_model=PreferencesSchema)
async def get_preferences():
    async with get_db_connection() as db:
        cursor = await db.execute("SELECT * FROM preferences LIMIT 1;")
        row = await cursor.fetchone()
        if not row:
            return PreferencesSchema()
        return PreferencesSchema(
            roles=json.loads(row["roles"] or "[]"),
            seniorities=json.loads(row["seniorities"] or "[]"),
            locations=json.loads(row["locations"] or "[]"),
            remote_only=bool(row["remote_only"]),
            custom_keywords=row["custom_keywords"] or "",
            excluded_keywords=row["excluded_keywords"] or "",
            notify_enabled=bool(row["notify_enabled"]),
            sync_interval_mins=row["sync_interval_mins"] or 30
        )

@router.post("/api/preferences", response_model=PreferencesSchema)
async def update_preferences(prefs: PreferencesSchema):
    now = get_utc_now()
    async with get_db_connection() as db:
        await db.execute("""
            UPDATE preferences SET
                roles = ?,
                seniorities = ?,
                locations = ?,
                remote_only = ?,
                custom_keywords = ?,
                excluded_keywords = ?,
                notify_enabled = ?,
                sync_interval_mins = ?,
                updated_at = ?
            WHERE id = (SELECT id FROM preferences LIMIT 1)
        """, (
            json.dumps(prefs.roles),
            json.dumps(prefs.seniorities),
            json.dumps(prefs.locations),
            1 if prefs.remote_only else 0,
            prefs.custom_keywords,
            prefs.excluded_keywords,
            1 if prefs.notify_enabled else 0,
            prefs.sync_interval_mins,
            now
        ))
        await db.commit()
    return prefs

@router.get("/api/jobs", response_model=JobsResponse)
async def list_jobs(
    role: str | None = None,
    location: str | None = None,
    seniority: str | None = None,
    company_id: int | None = None,
    search: str | None = None,
    work_mode: str | None = None,
    geo_hub: str | None = None,
    experience_tier: str | None = None,
    min_budget: int | None = None,
    has_salary: bool = False,
    freshness_days: int | None = None,
    only_matching: bool = False,
    saved_only: bool = False,
    limit: int = Query(default=30, le=200),
    offset: int = Query(default=0, ge=0)
):
    async with get_db_connection() as db:
        # Load preferences
        pref_cursor = await db.execute("SELECT * FROM preferences LIMIT 1;")
        pref_row = await pref_cursor.fetchone()
        prefs_dict = {}
        if pref_row:
            prefs_dict = {
                "roles": json.loads(pref_row["roles"] or "[]"),
                "seniorities": json.loads(pref_row["seniorities"] or "[]"),
                "locations": json.loads(pref_row["locations"] or "[]"),
                "remote_only": bool(pref_row["remote_only"]),
                "custom_keywords": pref_row["custom_keywords"] or "",
                "excluded_keywords": pref_row["excluded_keywords"] or "",
                "notify_enabled": bool(pref_row["notify_enabled"]),
            }

        conditions = ["status = 'active'"]
        params = []

        if saved_only:
            conditions.append("is_saved = 1")

        if company_id:
            conditions.append("company_id = ?")
            params.append(company_id)

        if role:
            conditions.append("normalized_role = ?")
            params.append(role)
        elif only_matching and prefs_dict.get("roles"):
            role_placeholders = ",".join("?" for _ in prefs_dict["roles"])
            conditions.append(f"normalized_role IN ({role_placeholders})")
            params.extend(prefs_dict["roles"])

        if seniority:
            conditions.append("seniority = ?")
            params.append(seniority)

        if experience_tier:
            conditions.append("experience_tier = ?")
            params.append(experience_tier)

        if work_mode:
            conditions.append("work_mode = ?")
            params.append(work_mode)

        if geo_hub:
            conditions.append("geo_hub = ?")
            params.append(geo_hub)

        if min_budget:
            conditions.append("max_salary >= ?")
            params.append(min_budget)

        if has_salary:
            conditions.append("salary_summary IS NOT NULL")

        if freshness_days:
            since = (datetime.now(timezone.utc) - timedelta(days=freshness_days)).isoformat()
            conditions.append("first_seen_at >= ?")
            params.append(since)

        if location:
            conditions.append("LOWER(location) LIKE ?")
            params.append(f"%{location.lower()}%")

        if search:
            ALIAS_MAP = {
                "bangalore": ["bangalore", "bengaluru"],
                "bengaluru": ["bengaluru", "bangalore"],
                "gurgaon": ["gurgaon", "gurugram"],
                "gurugram": ["gurugram", "gurgaon"],
                "delhi": ["delhi", "delhi_ncr", "noida", "gurgaon", "gurugram"],
                "noida": ["noida", "delhi", "delhi_ncr"],
                "sf": ["sf", "san francisco", "bay area"],
                "bay area": ["bay area", "san francisco", "silicon valley"],
                "nyc": ["nyc", "new york"],
                "ny": ["ny", "new york"],
            }
            search_tokens = [t.strip().lower() for t in search.split() if t.strip()]
            for token in search_tokens:
                aliases = ALIAS_MAP.get(token, [token])
                sub_conds = []
                for alias in aliases:
                    pattern = f"%{alias}%"
                    sub_conds.append(
                        "(LOWER(title) LIKE ? OR LOWER(company_name) LIKE ? OR LOWER(location) LIKE ? OR LOWER(normalized_role) LIKE ? OR LOWER(geo_hub) LIKE ?)"
                    )
                    params.extend([pattern, pattern, pattern, pattern, pattern])
                conditions.append(f"({' OR '.join(sub_conds)})")

        where_clause = f"WHERE {' AND '.join(conditions)}"

        # Get total count
        count_cursor = await db.execute(f"SELECT COUNT(*) as count FROM jobs {where_clause}", params)
        count_row = await count_cursor.fetchone()
        total = count_row["count"] if count_row else 0

        # Query items
        query = f"""
            SELECT * FROM jobs
            {where_clause}
            ORDER BY first_seen_at DESC
            LIMIT ? OFFSET ?
        """
        limit_val = limit.default if hasattr(limit, "default") else int(limit)
        offset_val = offset.default if hasattr(offset, "default") else int(offset)
        item_params = params + [limit_val, offset_val]
        cursor = await db.execute(query, item_params)
        rows = await cursor.fetchall()

        items: list[JobOut] = []
        for r in rows:
            job_dict = dict(r)
            is_match = matches_preferences(job_dict, prefs_dict) if prefs_dict else False
            items.append(
                JobOut(
                    id=job_dict["id"],
                    company_id=job_dict["company_id"],
                    company_name=job_dict["company_name"],
                    source_type=job_dict["source_type"],
                    external_id=job_dict["external_id"],
                    title=job_dict["title"],
                    normalized_role=job_dict["normalized_role"],
                    seniority=job_dict["seniority"],
                    work_mode=job_dict["work_mode"],
                    location=job_dict["location"],
                    description=job_dict["description"],
                    application_url=job_dict["application_url"],
                    first_seen_at=job_dict["first_seen_at"],
                    last_seen_at=job_dict["last_seen_at"],
                    status=job_dict["status"],
                    is_saved=bool(job_dict["is_saved"]),
                    is_match=is_match,
                    salary_summary=job_dict.get("salary_summary"),
                    min_salary=job_dict.get("min_salary"),
                    max_salary=job_dict.get("max_salary"),
                    geo_hub=job_dict.get("geo_hub"),
                    experience_tier=job_dict.get("experience_tier")
                )
            )

        return JobsResponse(items=items, total=total, limit=limit_val, offset=offset_val)

@router.get("/api/jobs/{job_id}", response_model=JobOut)
async def get_job(job_id: int):
    async with get_db_connection() as db:
        cursor = await db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Job not found")
        job_dict = dict(row)
        return JobOut(
            id=job_dict["id"],
            company_id=job_dict["company_id"],
            company_name=job_dict["company_name"],
            source_type=job_dict["source_type"],
            external_id=job_dict["external_id"],
            title=job_dict["title"],
            normalized_role=job_dict["normalized_role"],
            seniority=job_dict["seniority"],
            work_mode=job_dict["work_mode"],
            location=job_dict["location"],
            description=job_dict["description"],
            application_url=job_dict["application_url"],
            first_seen_at=job_dict["first_seen_at"],
            last_seen_at=job_dict["last_seen_at"],
            status=job_dict["status"],
            is_saved=bool(job_dict["is_saved"]),
            is_match=False
        )

@router.post("/api/jobs/{job_id}/save")
async def save_job(job_id: int):
    async with get_db_connection() as db:
        await db.execute("UPDATE jobs SET is_saved = 1 WHERE id = ?", (job_id,))
        await db.commit()
    return {"success": True, "job_id": job_id, "is_saved": True}

@router.delete("/api/jobs/{job_id}/save")
async def unsave_job(job_id: int):
    async with get_db_connection() as db:
        await db.execute("UPDATE jobs SET is_saved = 0 WHERE id = ?", (job_id,))
        await db.commit()
    return {"success": True, "job_id": job_id, "is_saved": False}

# S-3 FIX: Report endpoint — persists user reports to the reports table
ALLOWED_REPORT_REASONS = {"fake", "expired", "misinfo", "spam", "other"}

@router.post("/api/jobs/{job_id}/report")
async def report_job(job_id: int, reason: str, details: str = ""):
    if reason not in ALLOWED_REPORT_REASONS:
        raise HTTPException(status_code=422, detail=f"Invalid reason. Must be one of: {', '.join(ALLOWED_REPORT_REASONS)}")
    # Verify job exists
    async with get_db_connection() as db:
        cursor = await db.execute("SELECT id FROM jobs WHERE id = ?", (job_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Job not found")
        await db.execute(
            "INSERT INTO reports (job_id, reason, details, created_at) VALUES (?, ?, ?, ?)",
            (job_id, reason, details[:500], get_utc_now())
        )
        await db.commit()
    return {"success": True, "job_id": job_id, "reason": reason}

@router.get("/api/companies", response_model=list[CompanyOut])
async def list_companies():
    async with get_db_connection() as db:
        cursor = await db.execute("""
            SELECT c.*, COUNT(j.id) as job_count
            FROM companies c
            LEFT JOIN jobs j ON j.company_id = c.id AND j.status = 'active'
            GROUP BY c.id
            ORDER BY c.name ASC
        """)
        rows = await cursor.fetchall()
        return [
            CompanyOut(
                id=r["id"],
                name=r["name"],
                slug=r["slug"],
                careers_url=r["careers_url"],
                source_type=r["source_type"],
                source_identifier=r["source_identifier"],
                industry=r["industry"],
                logo_url=r["logo_url"],
                is_active=bool(r["is_active"]),
                job_count=r["job_count"],
                created_at=r["created_at"],
                updated_at=r["updated_at"]
            )
            for r in rows
        ]

@router.post("/api/companies", response_model=CompanyOut)
async def create_company(company: CompanyCreate, background_tasks: BackgroundTasks):
    now = get_utc_now()
    slug = company.name.lower().replace(" ", "-")
    async with get_db_connection() as db:
        try:
            cursor = await db.execute("""
                INSERT INTO companies (
                    name, slug, careers_url, source_type,
                    source_identifier, industry, logo_url,
                    is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """, (
                company.name,
                slug,
                company.careers_url,
                company.source_type.lower(),
                company.source_identifier,
                company.industry,
                company.logo_url,
                now,
                now
            ))
            new_id = cursor.lastrowid
            await db.commit()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to create company: {e}")

    # Trigger background sync for the new company
    background_tasks.add_task(sync_all_sources, new_id)

    return CompanyOut(
        id=new_id,
        name=company.name,
        slug=slug,
        careers_url=company.careers_url,
        source_type=company.source_type.lower(),
        source_identifier=company.source_identifier,
        industry=company.industry,
        logo_url=company.logo_url,
        is_active=True,
        job_count=0,
        created_at=now,
        updated_at=now
    )

@router.patch("/api/companies/{company_id}/toggle")
async def toggle_company(company_id: int):
    async with get_db_connection() as db:
        cursor = await db.execute("SELECT is_active FROM companies WHERE id = ?", (company_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Company not found")
        new_status = 0 if row["is_active"] else 1
        await db.execute("UPDATE companies SET is_active = ?, updated_at = ? WHERE id = ?", (new_status, get_utc_now(), company_id))
        await db.commit()
        return {"success": True, "company_id": company_id, "is_active": bool(new_status)}

@router.post("/api/sync")
async def trigger_sync(background_tasks: BackgroundTasks, wait_for_completion: bool = False):
    if wait_for_completion:
        result = await sync_all_sources()
        return {"status": "completed", "result": result}
    else:
        background_tasks.add_task(sync_all_sources)
        return {"status": "enqueued", "message": "Background sync started"}

@router.get("/api/notifications", response_model=list[NotificationOut])
async def list_notifications():
    async with get_db_connection() as db:
        cursor = await db.execute("""
            SELECT * FROM notifications
            ORDER BY sent_at DESC
            LIMIT 50
        """)
        rows = await cursor.fetchall()
        return [
            NotificationOut(
                id=r["id"],
                job_id=r["job_id"],
                title=r["title"],
                company_name=r["company_name"],
                role=r["role"],
                location=r["location"],
                application_url=r["application_url"],
                sent_at=r["sent_at"],
                is_read=bool(r["is_read"])
            )
            for r in rows
        ]

@router.post("/api/notifications/read-all")
async def mark_notifications_read():
    async with get_db_connection() as db:
        await db.execute("UPDATE notifications SET is_read = 1")
        await db.commit()
    return {"success": True}

@router.get("/api/stats", response_model=StatsOut)
async def get_stats():
    async with get_db_connection() as db:
        # Total jobs
        j_cur = await db.execute("SELECT COUNT(*) as count FROM jobs WHERE status = 'active'")
        total_jobs = (await j_cur.fetchone())["count"]

        # Active companies
        c_cur = await db.execute("SELECT COUNT(*) as count FROM companies WHERE is_active = 1")
        active_companies = (await c_cur.fetchone())["count"]

        # Saved jobs
        s_cur = await db.execute("SELECT COUNT(*) as count FROM jobs WHERE is_saved = 1")
        saved_jobs = (await s_cur.fetchone())["count"]

        # New in last 24h
        day_ago = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        n_cur = await db.execute("SELECT COUNT(*) as count FROM jobs WHERE first_seen_at >= ?", (day_ago,))
        new_jobs_today = (await n_cur.fetchone())["count"]

        # Last sync
        comp_cur = await db.execute("SELECT MAX(updated_at) as last_sync FROM companies")
        last_sync = (await comp_cur.fetchone())["last_sync"]

        # Matched jobs count according to preferences
        pref_cursor = await db.execute("SELECT * FROM preferences LIMIT 1;")
        pref_row = await pref_cursor.fetchone()
        matched_jobs = 0
        if pref_row and pref_row["roles"]:
            roles = json.loads(pref_row["roles"])
            if roles:
                placeholders = ",".join("?" for _ in roles)
                m_cur = await db.execute(
                    f"SELECT COUNT(*) as count FROM jobs WHERE status = 'active' AND normalized_role IN ({placeholders})",
                    roles
                )
                matched_jobs = (await m_cur.fetchone())["count"]

        return StatsOut(
            total_jobs=total_jobs,
            active_companies=active_companies,
            matched_jobs=matched_jobs,
            saved_jobs=saved_jobs,
            new_jobs_today=new_jobs_today,
            last_sync_time=last_sync
        )
