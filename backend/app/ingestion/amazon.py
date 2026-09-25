import logging
from typing import Any
import httpx
from .base import NormalizedJob, clean_text

logger = logging.getLogger(__name__)

AMAZON_SEARCH_URL = "https://www.amazon.jobs/en/search.json"

async def fetch_amazon_jobs(
    source_identifier: str,
    company_name: str,
    client: httpx.AsyncClient,
    max_pages: int = 5,
    page_size: int = 40
) -> list[NormalizedJob]:
    """
    Ingests live tech openings from Amazon's public JSON API.
    source_identifier can optionally specify categories or keywords, e.g.:
    'software-development' or 'default'
    """
    jobs: list[NormalizedJob] = []
    category = source_identifier if source_identifier and source_identifier != "default" else "software-development"

    for page in range(max_pages):
        offset = page * page_size
        params = {
            "category[]": category,
            "result_limit": page_size,
            "offset": offset,
            "sort": "recent"
        }

        try:
            resp = await client.get(
                AMAZON_SEARCH_URL,
                params=params,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "application/json"
                },
                timeout=12.0
            )

            if resp.status_code != 200:
                logger.warning(f"Amazon Jobs API returned {resp.status_code}")
                break

            data = resp.json()
            raw_jobs = data.get("jobs", [])
            if not raw_jobs:
                break

            for item in raw_jobs:
                title = clean_text(item.get("title", ""))
                if not title:
                    continue

                ext_id = str(item.get("id_icims") or item.get("id") or "")
                job_path = item.get("job_path", "")
                app_url = f"https://www.amazon.jobs{job_path}" if job_path else "https://www.amazon.jobs"

                city = item.get("city") or ""
                country = item.get("country_code") or ""
                norm_loc = item.get("normalized_location")
                location = norm_loc if norm_loc else f"{city}, {country}".strip(", ")

                desc = clean_text(item.get("description_short") or item.get("description"))

                jobs.append(
                    NormalizedJob(
                        company_name=company_name,
                        source_type="amazon",
                        external_id=ext_id,
                        title=title,
                        application_url=app_url,
                        location=location or None,
                        description=desc[:500] if desc else None,
                        source_updated_at=item.get("updated_time") or item.get("posted_date"),
                        raw_data=item
                    )
                )

            total_hits = data.get("hits", 0)
            if offset + len(raw_jobs) >= total_hits:
                break

        except Exception as e:
            logger.error(f"Error fetching Amazon jobs page {page}: {e}")
            break

    logger.info(f"Successfully fetched {len(jobs)} jobs for {company_name} from Amazon Jobs API")
    return jobs
