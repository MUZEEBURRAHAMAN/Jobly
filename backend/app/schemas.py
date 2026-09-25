from pydantic import BaseModel, Field
from typing import Any

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
    min_salary: int | None = None
    max_salary: int | None = None
    geo_hub: str | None = None
    experience_tier: str | None = None

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

class CompanyCreate(BaseModel):
    name: str
    careers_url: str | None = None
    source_type: str = Field(..., description="greenhouse, lever, or ashby")
    source_identifier: str = Field(..., description="Board token or slug")
    industry: str | None = None
    logo_url: str | None = None

class PreferencesSchema(BaseModel):
    roles: list[str] = ["product_design", "frontend_engineering"]
    seniorities: list[str] = ["mid", "senior", "lead"]
    locations: list[str] = []
    remote_only: bool = False
    custom_keywords: str = ""
    excluded_keywords: str = ""
    notify_enabled: bool = True
    sync_interval_mins: int = 30

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

class StatsOut(BaseModel):
    total_jobs: int
    active_companies: int
    matched_jobs: int
    saved_jobs: int
    new_jobs_today: int
    last_sync_time: str | None = None
