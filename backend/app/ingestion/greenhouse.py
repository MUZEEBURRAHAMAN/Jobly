import httpx
import logging
from .base import NormalizedJob, clean_text

logger = logging.getLogger(__name__)

async def fetch_greenhouse_jobs(
    board_token: str,
    company_name: str,
    client: httpx.AsyncClient | None = None
) -> list[NormalizedJob]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=false"
    headers = {"User-Agent": "HiringRadar/1.0 (+https://github.com/hiring-radar)"}

    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=25.0)
        close_client = True

    try:
        response = await client.get(url, headers=headers)
        if response.status_code == 404:
            logger.warning(f"Greenhouse board not found: {board_token}")
            return []
        response.raise_for_status()
        data = response.json()
        raw_jobs = data.get("jobs", [])

        normalized: list[NormalizedJob] = []
        for item in raw_jobs:
            title = clean_text(item.get("title"))
            if not title:
                continue

            external_id = str(item.get("id"))
            app_url = item.get("absolute_url") or f"https://boards.greenhouse.io/{board_token}/jobs/{external_id}"
            location_obj = item.get("location") or {}
            location = clean_text(location_obj.get("name"))

            normalized.append(
                NormalizedJob(
                    company_name=company_name,
                    source_type="greenhouse",
                    external_id=external_id,
                    title=title,
                    application_url=app_url,
                    location=location or None,
                    description=None,
                    source_updated_at=item.get("updated_at"),
                    raw_data={
                        "departments": item.get("departments", []),
                        "offices": item.get("offices", []),
                    }
                )
            )
        return normalized
    finally:
        if close_client:
            await client.aclose()
