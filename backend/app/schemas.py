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
    # Real posting date from the source (None when the source doesn't say). first_seen_at is just our crawl time.
    posted_at: str | None = None
    status: str
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


class StatsOut(BaseModel):
    total_jobs: int
    active_companies: int
    matched_jobs: int
    new_jobs_today: int
    # The same counts for Jobly's five tech roles only (the website quotes these; the totals above include every job stored)
    tech_jobs: int = 0
    tech_jobs_today: int = 0
    tech_jobs_week: int = 0
    last_sync_time: str | None = None
    # True while a crawl is running (the client shows "gathering jobs" instead of an empty list)
    is_syncing: bool = False


class GeoPlace(BaseModel):
    name: str
    kind: str                      # "hub" (a city or metro) or "country" (jobs in a country outside any hub)
    country: str
    lat: float
    lng: float
    jobs: int
    employers: int
    roles: dict[str, int]


class GeoCountry(BaseModel):
    country: str
    jobs: int
    employers: int
    roles: dict[str, int]


class GeoOut(BaseModel):
    """Jobs in Jobly's five roles by place. `unplaced` are jobs whose location names no country (plain "Remote")."""
    total: int
    countries: int
    employers: int
    unplaced: int
    roles: dict[str, int]
    places: list[GeoPlace]
    by_country: list[GeoCountry]
