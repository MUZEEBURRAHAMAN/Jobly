import logging
import re
from typing import Any
import httpx
from ..matching import classify_role
from .base import NormalizedJob, clean_text

logger = logging.getLogger(__name__)

# Big employers list thousands of jobs, and Workday has no "newest first" or role filter we can rely on. Searching for each
# role family's usual titles (and merging the results) finds the jobs Jobly shows, within a few requests per employer.
ROLE_QUERIES = (
    "software engineer", "frontend engineer", "full stack", "product manager", "product designer", "ux designer",
    "machine learning", "ai engineer", "applied scientist",
)


async def fetch_workday_jobs(
    source_identifier: str,
    company_name: str,
    client: httpx.AsyncClient,
    max_pages: int = 3,
    page_size: int = 20,
    queries: tuple[str, ...] = ROLE_QUERIES,
    only_roles: bool = True,
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
    seen: set[str] = set()
    for query in queries:
        jobs += await _search(client, endpoint, base_host, site_id, company_name, query, max_pages, page_size, seen)

    if only_roles:  # a search for "engineer" also finds hardware, sales and plant jobs; keep what Jobly shows
        jobs = [j for j in jobs if classify_role(j.title)]
    logger.info(f"Fetched {len(jobs)} role jobs for {company_name} from Workday ({len(queries)} searches)")
    return jobs


async def _search(client, endpoint, base_host, site_id, company_name, query, max_pages, page_size, seen) -> list[NormalizedJob]:
    """One search term, paged. `seen` holds the ids already collected for this employer, so overlapping searches add nothing twice."""
    jobs: list[NormalizedJob] = []
    offset = 0
    for page in range(max_pages):
        payload = {
            "appliedFacets": {},
            "limit": page_size,
            "offset": offset,
            "searchText": query
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
                if location and re.match(r"^\d+ locations?$", location.strip(), re.I) and ext_path.count("/") >= 3:
                    # "2 Locations" says nothing; the link names the first one: /job/US-CA-Santa-Clara/Title_R1
                    location = ext_path.split("/")[2].replace("-", " ")
                posted_on = item.get("postedOn")

                if ext_id in seen:
                    continue
                seen.add(ext_id)
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

    return jobs
