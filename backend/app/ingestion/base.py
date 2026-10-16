from __future__ import annotations
import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any

@dataclass
class NormalizedJob:
    company_name: str
    source_type: str
    external_id: str
    title: str
    application_url: str
    location: str | None = None
    description: str | None = None
    normalized_role: str | None = None
    seniority: str | None = None
    work_mode: str | None = None
    source_updated_at: str | None = None
    raw_data: dict[str, Any] = field(default_factory=dict)

def clean_text(text: str | None) -> str:
    if not text:
        return ""
    # Strip HTML tags if present
    clean = re.sub(r"<[^>]+>", " ", text)
    # Normalize whitespaces
    return " ".join(clean.split()).strip()

def calculate_content_hash(company_name: str, title: str, location: str | None, application_url: str) -> str:
    payload = {
        "company": company_name.strip().lower(),
        "title": title.strip().lower(),
        "location": (location or "").strip().lower(),
        "url": application_url.strip(),
    }
    serialized = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


_EARLIEST = datetime(2015, 1, 1, tzinfo=timezone.utc)


def normalize_posted_at(value: Any, now: datetime | None = None) -> str | None:
    """Best-effort conversion of whatever a source calls its posting date into an ISO-8601 UTC string.

    Handles ISO strings, epoch seconds/milliseconds, RFC 822 dates, "March 12, 2025" and relative text such as
    Workday's "Posted 3 Days Ago" / "Posted Today" / "Posted 30+ Days Ago". Returns None when it can't tell:
    an honest "unknown" beats claiming every job was posted at crawl time."""
    now = now or datetime.now(timezone.utc)
    if value is None or isinstance(value, bool):
        return None

    dt: datetime | None = None
    if isinstance(value, (int, float)) or (isinstance(value, str) and re.fullmatch(r"\d{9,14}(\.\d+)?", value.strip())):
        num = float(value)
        try:
            dt = datetime.fromtimestamp(num / 1000 if num > 1e11 else num, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    elif isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        low = text.lower()
        if "today" in low or "just now" in low:
            dt = now
        elif "yesterday" in low:
            dt = now - timedelta(days=1)
        else:
            rel = re.search(r"(\d+)\+?\s*(minute|hour|day|week|month)s?\s*ago|^(\d+)\+?\s*(minute|hour|day|week|month)s?$", low)
            if rel:
                n = int(rel.group(1) or rel.group(3))
                unit = rel.group(2) or rel.group(4)
                dt = now - timedelta(**{{"minute": "minutes", "hour": "hours", "day": "days", "week": "weeks", "month": "days"}[unit]: n * (30 if unit == "month" else 1)})
        if dt is None:
            try:
                dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
            except ValueError:
                try:
                    dt = parsedate_to_datetime(text)
                except (TypeError, ValueError):
                    dt = None
        if dt is None:
            for fmt in ("%B %d, %Y", "%b %d, %Y", "%d %B %Y", "%Y/%m/%d", "%m/%d/%Y"):
                try:
                    dt = datetime.strptime(text, fmt)
                    break
                except ValueError:
                    continue
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    if dt > now:
        dt = now                     # clocks and time zones disagree: never report the future
    if dt < _EARLIEST:
        return None
    return dt.isoformat()
