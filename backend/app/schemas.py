from typing import Annotated

from pydantic import BaseModel, Field, field_validator

from .security import UnsafeURL, check_url_syntax, sanitize_http_url

Token = Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_\- ]+$")]


class JobOut(BaseModel):
    id: int
    company_id: int
    company_name: str
    source_type: str
    external_id: str
    title: str
    normalized_role: str | None = None
    seniority: str | None = None
    work_mode: str | None = None
    location: str | None = None
    description: str | None = None
    application_url: str
    first_seen_at: str
    last_seen_at: str
    status: str
    is_saved: bool = False
    is_match: bool = False
    salary_summary: str | None = None
    # Hourly rates (e.g. 60.58) exist in the data; `int` made the whole endpoint 500.
    min_salary: float | None = None
    max_salary: float | None = None
    geo_hub: str | None = None
    experience_tier: str | None = None

    @field_validator("application_url", mode="before")
    @classmethod
    def _only_http_urls(cls, v):
        # Stored rows may predate ingestion validation; never emit javascript:/data:/file: links.
        return sanitize_http_url(v) or ""


class JobsResponse(BaseModel):
    items: list[JobOut]
    total: int
    limit: int
    offset: int


class CompanyOut(BaseModel):
    id: int
    name: str
    slug: str
    careers_url: str | None = None
    source_type: str
    source_identifier: str
    industry: str | None = None
    logo_url: str | None = None
    is_active: bool
    job_count: int = 0
    created_at: str
    updated_at: str

    @field_validator("careers_url", "logo_url", mode="before")
    @classmethod
    def _only_http_urls(cls, v):
        return sanitize_http_url(v)


ALLOWED_SOURCE_TYPES = {"greenhouse", "lever", "ashby", "workday", "amazon", "custom"}


class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    careers_url: str | None = Field(default=None, max_length=2048)
    source_type: str = Field(..., description="greenhouse, lever, ashby, workday, amazon or custom")
    source_identifier: str = Field(..., min_length=1, max_length=120, pattern=r"^[A-Za-z0-9._/\-]+$")
    industry: str | None = Field(default=None, max_length=80)
    logo_url: str | None = Field(default=None, max_length=2048)

    @field_validator("source_type")
    @classmethod
    def _known_source(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ALLOWED_SOURCE_TYPES:
            raise ValueError(f"source_type must be one of: {', '.join(sorted(ALLOWED_SOURCE_TYPES))}")
        return v

    @field_validator("careers_url", "logo_url")
    @classmethod
    def _public_http_url(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        try:
            return check_url_syntax(v)
        except UnsafeURL as exc:
            raise ValueError(str(exc)) from exc


class PreferencesSchema(BaseModel):
    roles: Annotated[list[Token], Field(max_length=20)] = ["product_design", "frontend_engineering"]
    seniorities: Annotated[list[Token], Field(max_length=10)] = ["mid", "senior", "lead"]
    locations: Annotated[list[Annotated[str, Field(max_length=80)]], Field(max_length=30)] = []
    remote_only: bool = False
    custom_keywords: str = Field(default="", max_length=500)
    excluded_keywords: str = Field(default="", max_length=500)
    notify_enabled: bool = True
    sync_interval_mins: int = Field(default=30, ge=5, le=1440)


class NotificationOut(BaseModel):
    id: int
    job_id: int
    title: str
    company_name: str
    role: str
    location: str | None = None
    application_url: str
    sent_at: str
    is_read: bool = False

    @field_validator("application_url", mode="before")
    @classmethod
    def _only_http_urls(cls, v):
        return sanitize_http_url(v) or ""


class StatsOut(BaseModel):
    total_jobs: int
    active_companies: int
    matched_jobs: int
    saved_jobs: int
    new_jobs_today: int
    last_sync_time: str | None = None
