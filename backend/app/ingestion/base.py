from __future__ import annotations
import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import datetime
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
