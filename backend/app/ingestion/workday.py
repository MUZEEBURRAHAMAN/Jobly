import logging
from typing import Any
import httpx
from .base import NormalizedJob, clean_text

logger = logging.getLogger(__name__)

async def fetch_workday_jobs(
    source_identifier: str,
    company_name: str,
    client: httpx.AsyncClient,
    max_pages: int = 5,
    page_size: int = 20
) -> list[NormalizedJob]:
    """
    Ingests live jobs from Workday's unauthenticated CXS JSON API.
    source_identifier format: '{tenant}.{instance}/{site_id}'
    Example: 'adobe.wd5/external_experienced' or 'nvidia.wd5/NVIDIAExternalCareerSite'
    """
    try:
        parts = source_identifier.strip().split("/")
        if len(parts) != 2:
            logger.error(f"Invalid Workday source_identifier '{source_identifier}'. Expected 'tenant.instance/site_id'")
            return []
        
        host_prefix, site_id = parts[0], parts[1]
        tenant = host_prefix.split(".")[0]
        base_host = f"https://{host_prefix}.myworkdayjobs.com"
        endpoint = f"{base_host}/wday/cxs/{tenant}/{site_id}/jobs"
    except Exception as e:
        logger.error(f"Error parsing Workday identifier '{source_identifier}': {e}")
        return []

    jobs: list[NormalizedJob] = []
    offset = 0

    for page in range(max_pages):
        payload = {
            "appliedFacets": {},
            "limit": page_size,
            "offset": offset,
            "searchText": ""
        }

        try:
            resp = await client.post(
                endpoint,
                json=payload,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                timeout=12.0
            )

            if resp.status_code != 200:
                logger.warning(f"Workday API returned {resp.status_code} for {company_name} ({endpoint})")
                break

            data = resp.json()
            postings = data.get("jobPostings", [])
            if not postings:
                break

            for item in postings:
                title = clean_text(item.get("title", ""))
                if not title:
                    continue

                ext_path = item.get("externalPath", "")
                app_url = f"{base_host}/en-US/{site_id}{ext_path}" if ext_path else base_host

                # Workday external paths usually contain ID e.g. /job/..._R12345
                ext_id = ext_path.split("_")[-1] if "_" in ext_path else ext_path
                if not ext_id:
                    ext_id = str(hash(title + app_url))

                location = item.get("locationsText")
                posted_on = item.get("postedOn")

                jobs.append(
                    NormalizedJob(
                        company_name=company_name,
                        source_type="workday",
                        external_id=ext_id,
                        title=title,
                        application_url=app_url,
                        location=location,
                        description=f"Posted: {posted_on}" if posted_on else None,
                        source_updated_at=posted_on,
                        raw_data=item
                    )
                )

            total = data.get("total", 0)
            offset += len(postings)
            if offset >= total:
                break

        except Exception as e:
            logger.error(f"Error fetching Workday page {page} for {company_name}: {e}")
            break

    logger.info(f"Successfully fetched {len(jobs)} jobs for {company_name} from Workday")
    return jobs
