"""
Aggregator and remote RSS adapters:
- Himalayas RSS (remote tech/design/product jobs with company names & logos)
- Arbeitnow API (European & remote tech jobs)
- Remotive.io RSS feed
All free, zero authentication, reliable.
"""
from __future__ import annotations
import logging
import hashlib
import re
from email.utils import parsedate_to_datetime
from typing import Any
import httpx
import feedparser
from .base import NormalizedJob, clean_text

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; HiringRadar/1.0; +https://hiringradar.app)"}


def _stable_id(source: str, url: str, title: str) -> str:
    payload = f"{source}|{url}|{title}".encode("utf-8")
    return hashlib.sha1(payload).hexdigest()[:16]


def _split_company_title(raw: str) -> tuple[str, str]:
    """Split common 'Company: Title' or 'Title @ Company' strings."""
    raw = raw.strip()
    if ": " in raw:
        parts = raw.split(": ", 1)
        return parts[0].strip(), parts[1].strip()
    if " @ " in raw:
        parts = raw.split(" @ ", 1)
        return parts[1].strip(), parts[0].strip()
    match = re.search(r"\s+at\s+(.+)$", raw, re.IGNORECASE)
    if match:
        company = match.group(1).strip()
        title = raw[:match.start()].strip()
        return company, title
    return "Unknown Company", raw


async def fetch_himalayas_jobs() -> list[NormalizedJob]:
    """Fetch remote jobs from Himalayas RSS feed."""
    url = "https://himalayas.app/jobs/rss"
    jobs: list[NormalizedJob] = []
    seen: set[str] = set()

    try:
        feed = feedparser.parse(url)
        for entry in feed.entries:
            title = clean_text(entry.get("title", ""))
            link = entry.get("link", "")
            if not title or not link:
                continue

            company_name = entry.get("himalayasjobs_companyname")
            if not company_name:
                company_name = clean_text(entry.get("author", "")) or "Remote Company"
            company_logo = entry.get("himalayasjobs_companylogo")
            location = entry.get("himalayasjobs_locationrestriction") or "Remote"

            pub_date = None
            if hasattr(entry, "published"):
                try:
                    pub_date = parsedate_to_datetime(entry.published).isoformat()
                except Exception:
                    pass

            description = clean_text(entry.get("summary", ""))[:1000]
            ext_id = _stable_id("himalayas", link, title)
            if ext_id in seen:
                continue
            seen.add(ext_id)

            jobs.append(
                NormalizedJob(
                    company_name=company_name,
                    source_type="himalayas",
                    external_id=ext_id,
                    title=title,
                    application_url=link,
                    location=location,
                    description=description or None,
                    work_mode="remote",
                    source_updated_at=pub_date,
                    raw_data={
                        "company_logo": company_logo,
                        "source": "himalayas",
                    }
                )
            )
        logger.info(f"[Himalayas] Fetched {len(jobs)} jobs")
        return jobs
    except Exception as e:
        logger.error(f"[Himalayas] Error: {e}")
        return []


async def fetch_arbeitnow_jobs(client: httpx.AsyncClient | None = None) -> list[NormalizedJob]:
    """Fetch jobs from Arbeitnow's public job board API."""
    url = "https://www.arbeitnow.com/api/job-board-api?page=1"
    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=30.0)
        close_client = True

    jobs: list[NormalizedJob] = []
    seen: set[str] = set()

    try:
        resp = await client.get(url, headers=HEADERS)
        if resp.status_code != 200:
            logger.warning(f"[Arbeitnow] HTTP {resp.status_code}")
            return []

        data = resp.json().get("data", [])
        for item in data:
            title = clean_text(item.get("title", ""))
            company = clean_text(item.get("company_name", ""))
            link = item.get("url", "")
            if not title or not company or not link:
                continue

            slug = item.get("slug") or link
            ext_id = _stable_id("arbeitnow", link, slug)
            if ext_id in seen:
                continue
            seen.add(ext_id)

            is_remote = bool(item.get("remote"))
            location = clean_text(item.get("location") or ("Remote" if is_remote else "Global"))
            description = clean_text(item.get("description", ""))[:1000]

            jobs.append(
                NormalizedJob(
                    company_name=company,
                    source_type="arbeitnow",
                    external_id=ext_id,
                    title=title,
                    application_url=link,
                    location=location,
                    description=description or None,
                    work_mode="remote" if is_remote else "hybrid",
                    source_updated_at=item.get("created_at"),
                    raw_data={
                        "tags": item.get("tags", []),
                        "source": "arbeitnow"
                    }
                )
            )
        logger.info(f"[Arbeitnow] Fetched {len(jobs)} jobs")
        return jobs
    except Exception as e:
        logger.error(f"[Arbeitnow] Error: {e}")
        return []
    finally:
        if close_client:
            await client.aclose()


async def fetch_all_remote_rss_jobs(client: httpx.AsyncClient | None = None) -> list[NormalizedJob]:
    """Aggregate jobs from all secondary feeds: Himalayas and Arbeitnow."""
    himalayas_jobs = await fetch_himalayas_jobs()
    arbeitnow_jobs = await fetch_arbeitnow_jobs(client)
    total = himalayas_jobs + arbeitnow_jobs
    logger.info(f"[Remote Feeds] Total aggregated jobs: {len(total)}")
    return total
