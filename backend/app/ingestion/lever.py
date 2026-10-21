import httpx
import logging
from .base import NormalizedJob, clean_text, with_places

logger = logging.getLogger(__name__)

async def fetch_lever_jobs(
    site_name: str,
    company_name: str,
    client: httpx.AsyncClient | None = None
) -> list[NormalizedJob]:
    url = f"https://api.lever.co/v0/postings/{site_name}?mode=json"
    headers = {
        "User-Agent": "HiringRadar/1.0 (+https://github.com/hiring-radar)",
        "Accept": "application/json"
    }

    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=25.0)
        close_client = True

    try:
        response = await client.get(url, headers=headers)
        if response.status_code == 404:
            logger.warning(f"Lever board not found: {site_name}")
            return []
        response.raise_for_status()
        data = response.json()

        normalized: list[NormalizedJob] = []
        for item in data:
            title = clean_text(item.get("text"))
            if not title:
                continue

            external_id = str(item.get("id"))
            app_url = item.get("hostedUrl") or item.get("applyUrl") or f"https://jobs.lever.co/{site_name}/{external_id}"
            categories = item.get("categories") or {}
            location = with_places(categories.get("location"), *(categories.get("allLocations") or []))

            normalized.append(
                NormalizedJob(
                    company_name=company_name,
                    source_type="lever",
                    external_id=external_id,
                    title=title,
                    application_url=app_url,
                    location=location,
                    description=clean_text(item.get("descriptionPlain")),
                    source_updated_at=item.get("createdAt"),
                    raw_data={
                        "team": categories.get("team"),
                        "department": categories.get("department"),
                        "commitment": categories.get("commitment"),
                    }
                )
            )
        return normalized
    finally:
        if close_client:
            await client.aclose()
