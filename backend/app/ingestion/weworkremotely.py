"""
We Work Remotely (WWR) adapter — RSS feed, completely free.
No auth, no proxies, very reliable.
Feeds: design, programming, product, front-end.
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

# WWR RSS endpoints — one per category
WWR_FEEDS: list[dict[str, str]] = [
    {
        "url": "https://weworkremotely.com/categories/remote-design-jobs.rss",
        "role": "product_design",
    },
    {
        "url": "https://weworkremotely.com/categories/remote-product-jobs.rss",
        "role": "product_management",
    },
    {
        "url": "https://weworkremotely.com/categories/remote-programming-jobs.rss",
        "role": "fullstack_engineering",
    },
    {
        "url": "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
        "role": "frontend_engineering",
    },
    {
        "url": "https://weworkremotely.com/categories/remote-data-science-jobs.rss",
        "role": "ai_ml",
    },
    {
        "url": "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
        "role": "fullstack_engineering",
    },
]


def _extract_company_from_title(raw_title: str) -> tuple[str, str]:
    """
    WWR titles look like: "CompanyName: Job Title at CompanyName"
    or: "FEATURED: CompanyName: Job Title"
    Returns (company_name, job_title)
    """
    title = raw_title.strip()

    # Strip FEATURED prefix if present
    title = re.sub(r"^FEATURED:\s*", "", title, flags=re.IGNORECASE).strip()

    # Format: "Company: Job Title"
    if ": " in title:
        parts = title.split(": ", 1)
        return parts[0].strip(), parts[1].strip()

    # Fallback: use the whole thing as title, company unknown
    return "Unknown Company", title


def _stable_external_id(url: str, title: str) -> str:
    """Generate a stable unique ID from the listing URL + title."""
    payload = f"{url}|{title}".encode("utf-8")
    return hashlib.sha1(payload).hexdigest()[:16]


async def fetch_wwr_jobs() -> list[NormalizedJob]:
    """Parse all WWR RSS feeds and return normalised jobs."""
    all_jobs: list[NormalizedJob] = []
    seen_ids: set[str] = set()

    for feed_info in WWR_FEEDS:
        feed_url = feed_info["url"]
        role = feed_info["role"]

        try:
            # feedparser is synchronous; acceptable for small RSS feeds
            feed = feedparser.parse(feed_url)

            if feed.bozo and not feed.entries:
                logger.warning(f"[WWR] Failed to parse feed: {feed_url}")
                continue

            for entry in feed.entries:
                raw_title = clean_text(entry.get("title", ""))
                link = entry.get("link", "")

                if not raw_title or not link:
                    continue

                company_name, job_title = _extract_company_from_title(raw_title)
                external_id = _stable_external_id(link, job_title)

                if external_id in seen_ids:
                    continue
                seen_ids.add(external_id)

                # Parse publish date
                published_str = None
                if hasattr(entry, "published"):
                    try:
                        dt = parsedate_to_datetime(entry.published)
                        published_str = dt.isoformat()
                    except Exception:
                        pass

                # Description from RSS summary (often contains HTML)
                description = clean_text(entry.get("summary", ""))[:1000]

                # Location tag — WWR usually says "Anywhere" or a region
                location_tag = ""
                for tag in entry.get("tags", []):
                    term = tag.get("term", "")
                    if term and term.lower() not in ("job", ""):
                        location_tag = term
                        break
                location = location_tag or "Remote / Anywhere"

                all_jobs.append(
                    NormalizedJob(
                        company_name=company_name,
                        source_type="weworkremotely",
                        external_id=external_id,
                        title=job_title,
                        application_url=link,
                        location=location,
                        description=description or None,
                        normalized_role=role,
                        work_mode="remote",
                        source_updated_at=published_str,
                        raw_data={
                            "feed_url": feed_url,
                            "raw_title": raw_title,
                        },
                    )
                )

        except Exception as e:
            logger.error(f"[WWR] Error parsing feed {feed_url}: {e}")
            continue

    logger.info(f"[WWR] Fetched {len(all_jobs)} jobs from {len(WWR_FEEDS)} feeds")
    return all_jobs
