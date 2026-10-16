import hashlib
import json
import logging
import re
from typing import Any
import httpx
from .base import NormalizedJob, clean_text
from ..security import UnsafeURL, fetch_public_text, sanitize_http_url

logger = logging.getLogger(__name__)

async def fetch_custom_portal_jobs(
    career_url: str,
    company_name: str,
    client: httpx.AsyncClient
) -> list[NormalizedJob]:
    """
    Crawls custom career portals using Schema.org JobPosting JSON-LD metadata.
    Standardized across modern employer pages (Google, Meta, and major tech portals).
    """
    jobs: list[NormalizedJob] = []
    if not career_url:
        return []

    try:
        # SSRF-safe fetch: public hosts only, every redirect re-validated, body size capped.
        status, html = await fetch_public_text(
            client,
            career_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            },
            timeout=12.0,
        )

        if status != 200:
            logger.warning(f"Custom portal returned {status} for {company_name} ({career_url})")
            return []

        # Extract all JSON-LD script blocks
        json_ld_blocks = re.findall(r'<script[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>', html, re.DOTALL | re.IGNORECASE)

        for block in json_ld_blocks:
            try:
                data = json.loads(block.strip())
                items = []
                if isinstance(data, list):
                    items = data
                elif isinstance(data, dict):
                    if data.get("@type") == "JobPosting":
                        items = [data]
                    elif "@graph" in data and isinstance(data["@graph"], list):
                        items = [i for i in data["@graph"] if i.get("@type") == "JobPosting"]

                for item in items:
                    title = clean_text(item.get("title", ""))
                    if not title:
                        continue

                    # URL
                    # Never trust a scheme coming from a third-party page (javascript:, data:, ...)
                    app_url = sanitize_http_url(item.get("url")) or career_url
                    ident = item.get("identifier")
                    ident_value = ident.get("value") if isinstance(ident, dict) else ident
                    # hashlib, not hash(): str hashes are randomised per process, which duplicated jobs on every restart
                    ext_id = str(ident_value or hashlib.sha1((title + app_url).encode("utf-8")).hexdigest()[:16])

                    # Location
                    loc_val = ""
                    job_loc = item.get("jobLocation")
                    if isinstance(job_loc, dict):
                        addr = job_loc.get("address", {})
                        if isinstance(addr, dict):
                            loc_val = f"{addr.get('addressLocality', '')}, {addr.get('addressRegion', '')} {addr.get('addressCountry', '')}".strip(", ")
                        elif isinstance(addr, str):
                            loc_val = addr
                    elif isinstance(job_loc, list) and job_loc:
                        first = job_loc[0]
                        if isinstance(first, dict):
                            addr = first.get("address", {})
                            if isinstance(addr, dict):
                                loc_val = f"{addr.get('addressLocality', '')}, {addr.get('addressCountry', '')}".strip(", ")

                    desc = clean_text(item.get("description", ""))

                    jobs.append(
                        NormalizedJob(
                            company_name=company_name,
                            source_type="custom",
                            external_id=ext_id,
                            title=title,
                            application_url=app_url,
                            location=loc_val or None,
                            description=desc[:500] if desc else None,
                            source_updated_at=item.get("datePosted"),
                            raw_data=item
                        )
                    )
            except Exception:
                continue

    except UnsafeURL as e:
        logger.warning(f"Refused to crawl {company_name}: {e}")
    except Exception as e:
        logger.error(f"Error crawling custom portal for {company_name}: {e}")

    logger.info(f"Custom portal parser found {len(jobs)} jobs for {company_name}")
    return jobs
