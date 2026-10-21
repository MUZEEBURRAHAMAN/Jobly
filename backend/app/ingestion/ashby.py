import httpx
import logging
from .base import NormalizedJob, clean_text, with_places

logger = logging.getLogger(__name__)

async def fetch_ashby_jobs(
    board_name: str,
    company_name: str,
    client: httpx.AsyncClient | None = None
) -> list[NormalizedJob]:
    url = f"https://api.ashbyhq.com/posting-api/job-board/{board_name}?includeCompensation=true"
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
            logger.warning(f"Ashby board not found: {board_name}")
            return []
        response.raise_for_status()
        data = response.json()
        raw_jobs = data.get("jobs", [])

        normalized: list[NormalizedJob] = []
        for item in raw_jobs:
            title = clean_text(item.get("title"))
            if not title:
                continue

            external_id = str(item.get("id") or item.get("jobUrl") or title)
            app_url = item.get("jobUrl") or f"https://jobs.ashbyhq.com/{board_name}/{external_id}"
            postal = ((item.get("address") or {}).get("postalAddress") or {})
            extras = [postal.get("addressCountry")] + [x.get("location") for x in (item.get("secondaryLocations") or [])]
            location = with_places(item.get("location"), *extras)

            normalized.append(
                NormalizedJob(
                    company_name=company_name,
                    source_type="ashby",
                    external_id=external_id,
                    title=title,
                    application_url=app_url,
                    location=location,
                    description=clean_text(item.get("descriptionPlain")),
                    source_updated_at=item.get("publishedAt"),
                    raw_data={
                        "department": item.get("department"),
                        "team": item.get("team"),
                        "employmentType": item.get("employmentType"),
                        "isRemote": item.get("isRemote"),
                        "compensation": item.get("compensation"),
                    }
                )
            )
        return normalized
    finally:
        if close_client:
            await client.aclose()
