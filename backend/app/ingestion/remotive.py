"""
Remotive.com adapter — uses the free public REST API.
Endpoint: https://remotive.com/api/remote-jobs
No auth, no proxies, always reliable.
Covers: design, engineering, product, AI/ML remote roles.
"""
from __future__ import annotations
import logging
import hashlib
from typing import Any
import httpx
from .base import NormalizedJob, clean_text

logger = logging.getLogger(__name__)

# Map Remotive categories to our internal role categories for matching
REMOTIVE_CATEGORY_ROLE_MAP: dict[str, str] = {
    "Design":                   "product_design",
    "Product":                  "product_management",
    "Software Development":     "fullstack_engineering",
    "Frontend":                 "frontend_engineering",
    "Backend":                  "fullstack_engineering",
    "Full-Stack":               "fullstack_engineering",
    "Mobile":                   "fullstack_engineering",
    "DevOps / Sysadmin":       "fullstack_engineering",
    "Data":                     "ai_ml",
    "AI":                       "ai_ml",
    "Machine Learning":         "ai_ml",
    "QA":                       "fullstack_engineering",
    "Management & Finance":     "product_management",
    "Marketing":                None,   # skip
    "Sales":                    None,   # skip
    "Writing":                  None,   # skip
    "Customer Service":         None,   # skip
    "Human Resources":          None,   # skip
    "Legal":                    None,   # skip
    "Business":                 None,   # skip
    "Healthcare":               None,   # skip
}

# Only fetch these categories — avoids flooding the DB with unrelated roles
TARGET_CATEGORIES = [
    "Design",
    "Product",
    "Software Development",
    "Frontend",
    "Backend",
    "Full-Stack",
    "Mobile",
    "Data",
    "AI",
    "Machine Learning",
]

REMOTIVE_API = "https://remotive.com/api/remote-jobs"


async def fetch_remotive_jobs(
    client: httpx.AsyncClient | None = None,
) -> list[NormalizedJob]:
    """Fetch remote jobs from Remotive's free public API."""
    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=30.0)
        close_client = True

    headers = {"User-Agent": "HiringRadar/1.0 (+https://github.com/hiring-radar)"}
    all_jobs: list[NormalizedJob] = []
    seen_ids: set[str] = set()

    try:
        for category in TARGET_CATEGORIES:
            try:
                resp = await client.get(
                    REMOTIVE_API,
                    params={"category": category, "limit": 100},
                    headers=headers,
                )
                if resp.status_code != 200:
                    logger.warning(f"Remotive returned {resp.status_code} for category={category}")
                    continue

                data = resp.json()
                raw_jobs: list[dict[str, Any]] = data.get("jobs", [])
                mapped_role = REMOTIVE_CATEGORY_ROLE_MAP.get(category)

                for item in raw_jobs:
                    external_id = str(item.get("id", ""))
                    if not external_id or external_id in seen_ids:
                        continue
                    seen_ids.add(external_id)

                    title = clean_text(item.get("title", ""))
                    company_name = clean_text(item.get("company_name", ""))
                    if not title or not company_name:
                        continue

                    url = item.get("url", "")
                    location = clean_text(item.get("candidate_required_location") or "Remote / Global")
                    description = clean_text(item.get("description", ""))[:1000]  # cap at 1KB

                    all_jobs.append(
                        NormalizedJob(
                            company_name=company_name,
                            source_type="remotive",
                            external_id=external_id,
                            title=title,
                            application_url=url,
                            location=location or "Remote",
                            description=description or None,
                            normalized_role=mapped_role,  # pre-mapped from category
                            work_mode="remote",            # Remotive is 100% remote by definition
                            source_updated_at=item.get("publication_date"),
                            raw_data={
                                "category": category,
                                "tags": item.get("tags", []),
                                "job_type": item.get("job_type", ""),
                                "company_logo": item.get("company_logo_url", ""),
                                "salary": item.get("salary", ""),
                            },
                        )
                    )

            except Exception as e:
                logger.error(f"Remotive error for category '{category}': {e}")
                continue

        logger.info(f"[Remotive] Fetched {len(all_jobs)} jobs across {len(TARGET_CATEGORIES)} categories")
        return all_jobs

    finally:
        if close_client:
            await client.aclose()
