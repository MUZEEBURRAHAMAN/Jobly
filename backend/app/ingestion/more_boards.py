"""Readers for eight more hiring systems that employers publish public job feeds on.

    SmartRecruiters  api.smartrecruiters.com/v1/companies/{id}/postings        (JSON, paged)
    Workable         apply.workable.com/api/v1/widget/accounts/{slug}           (JSON)
    Recruitee        {slug}.recruitee.com/api/offers/                           (JSON)
    Teamtailor       {slug}.teamtailor.com/jobs.rss                             (RSS)
    Personio         {slug}.jobs.personio.de/xml                                (XML)
    Keka             {slug}.keka.com/careers/api/jobs/default/active            (JSON; used by many Indian employers)
    Darwinbox        {slug}.darwinbox.in/ms/candidateapi/job/alljobs            (JSON, POST; the careers page's own job list)
    Oracle           {host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions (JSON; Oracle Recruiting Cloud career sites)

Every reader keeps the posting's own date, the apply link on the employer's page, and the board's own company name
(raw_data["board_name"]) so that a company slug that belongs to somebody else can be caught. They never raise for a missing
board: they return no jobs, like the Greenhouse, Ashby and Lever readers.
"""
from __future__ import annotations

import asyncio
import html
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any

import httpx

from .base import NormalizedJob, clean_text

logger = logging.getLogger(__name__)
HEADERS = {"User-Agent": "HiringRadar/1.0 (job discovery; +https://jobly-88t.pages.dev)", "Accept": "application/json"}
SMARTRECRUITERS_PAGE = 100
SMARTRECRUITERS_MAX = 600   # a few huge employers list thousands of jobs; the newest are returned first
MAX_BYTES = 12_000_000


RETRY_PAUSES = (2.0, 6.0)   # seconds before the 2nd and 3rd try when a server says "slow down"


async def _get(client: httpx.AsyncClient | None, url: str, method: str = "GET", **kw) -> httpx.Response | None:
    """GET (or POST) with polite retries: a 429 or a short outage waits (the server's Retry-After, up to 20 s) and tries again."""
    owns = client is None
    client = client or httpx.AsyncClient(timeout=25.0)
    headers = kw.pop("headers", HEADERS)
    try:
        for attempt in range(len(RETRY_PAUSES) + 1):
            try:
                resp = await client.request(method, url, headers=headers, **kw)
            except httpx.HTTPError as exc:
                logger.warning("Fetch failed for %s: %s", url, type(exc).__name__)
                resp = None
            if resp is not None and resp.status_code not in (429, 502, 503, 504):
                break
            if attempt < len(RETRY_PAUSES):
                retry_after = resp.headers.get("retry-after", "") if resp is not None else ""
                await asyncio.sleep(min(float(retry_after), 20.0) if retry_after.isdigit() else RETRY_PAUSES[attempt])
    finally:
        if owns:
            await client.aclose()
    if resp is None or resp.status_code != 200 or len(resp.content) > MAX_BYTES:
        return None
    return resp


def _place(*parts: str | None) -> str | None:
    seen: list[str] = []
    for part in parts:
        text = clean_text(part)
        if text and text.lower() not in (s.lower() for s in seen):
            seen.append(text)
    return ", ".join(seen) or None


def _mode(remote: Any = None, hybrid: Any = None, text: str = "") -> str | None:
    text = (text or "").lower()
    if remote in (True, "true", "True") or text == "remote":
        return "remote"
    if hybrid in (True, "true", "True") or text == "hybrid":
        return "hybrid"
    return None


# ---------------------------------------------------------------- SmartRecruiters
async def fetch_smartrecruiters_jobs(company_id: str, company_name: str, client: httpx.AsyncClient | None = None) -> list[NormalizedJob]:
    jobs: list[NormalizedJob] = []
    offset = 0
    while offset < SMARTRECRUITERS_MAX:
        resp = await _get(client, f"https://api.smartrecruiters.com/v1/companies/{company_id}/postings",
                          params={"limit": SMARTRECRUITERS_PAGE, "offset": offset})
        if resp is None:
            break
        data = resp.json()
        page = data.get("content") or []
        for item in page:
            title = clean_text(item.get("name"))
            ident = item.get("id")
            if not title or not ident:
                continue
            loc = item.get("location") or {}
            owner = (item.get("company") or {}).get("identifier") or company_id
            jobs.append(NormalizedJob(
                company_name=company_name, source_type="smartrecruiters", external_id=str(ident), title=title,
                application_url=f"https://jobs.smartrecruiters.com/{owner}/{ident}",
                location=clean_text(loc.get("fullLocation")) or _place(loc.get("city"), loc.get("region"), (loc.get("country") or "").upper()) or None,
                work_mode=_mode(loc.get("remote"), loc.get("hybrid")),
                source_updated_at=item.get("releasedDate"),
                raw_data={"board_name": (item.get("company") or {}).get("name"), "department": (item.get("function") or {}).get("label"),
                          "employment_type": (item.get("typeOfEmployment") or {}).get("label")},
            ))
        offset += SMARTRECRUITERS_PAGE
        if not page or offset >= int(data.get("totalFound") or 0):
            break
    return jobs


# ---------------------------------------------------------------- Workable
async def fetch_workable_jobs(slug: str, company_name: str, client: httpx.AsyncClient | None = None) -> list[NormalizedJob]:
    resp = await _get(client, f"https://apply.workable.com/api/v1/widget/accounts/{slug}")
    if resp is None:
        return []
    data = resp.json()
    jobs = []
    for item in data.get("jobs") or []:
        title, url = clean_text(item.get("title")), item.get("url") or item.get("shortlink")
        if not title or not url:
            continue
        jobs.append(NormalizedJob(
            company_name=company_name, source_type="workable", external_id=str(item.get("shortcode") or url), title=title, application_url=url,
            location=_place(item.get("city"), item.get("state"), item.get("country")),
            work_mode="remote" if item.get("telecommuting") else None,
            source_updated_at=item.get("published_on") or item.get("created_at"),
            raw_data={"board_name": data.get("name"), "department": item.get("department"), "employment_type": item.get("employment_type")},
        ))
    return jobs


# ---------------------------------------------------------------- Recruitee
def _recruitee_date(text: str | None) -> str | None:
    """'2026-10-15 09:31:36 UTC' -> ISO 8601."""
    if not text:
        return None
    return text.replace(" UTC", "+00:00").replace(" ", "T", 1)


async def fetch_recruitee_jobs(slug: str, company_name: str, client: httpx.AsyncClient | None = None) -> list[NormalizedJob]:
    resp = await _get(client, f"https://{slug}.recruitee.com/api/offers/")
    if resp is None:
        return []
    jobs = []
    for item in resp.json().get("offers") or []:
        title, url = clean_text(item.get("title")), item.get("careers_url")
        if not title or not url or item.get("status") not in (None, "published"):
            continue
        jobs.append(NormalizedJob(
            company_name=company_name, source_type="recruitee", external_id=str(item.get("id") or url), title=title, application_url=url,
            location=clean_text(item.get("location")) or _place(item.get("city"), item.get("country")),
            work_mode=_mode(item.get("remote"), item.get("hybrid")),
            source_updated_at=_recruitee_date(item.get("published_at") or item.get("created_at")),
            raw_data={"board_name": item.get("company_name"), "department": item.get("department"), "employment_type": item.get("employment_type_code")},
        ))
    return jobs


# ---------------------------------------------------------------- Teamtailor
def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag.rsplit(":", 1)[-1]


async def fetch_teamtailor_jobs(slug: str, company_name: str, client: httpx.AsyncClient | None = None) -> list[NormalizedJob]:
    resp = await _get(client, f"https://{slug}.teamtailor.com/jobs.rss", headers={**HEADERS, "Accept": "application/rss+xml, text/xml"})
    if resp is None:
        return []
    try:
        root = ET.fromstring(resp.content)
    except ET.ParseError:
        return []
    channel = next((el for el in root if _local(el.tag) == "channel"), root)
    board = next((clean_text(el.text) for el in channel if _local(el.tag) == "title"), None)
    jobs = []
    for item in (el for el in channel if _local(el.tag) == "item"):
        fields = {_local(el.tag): el for el in item}
        title, link = clean_text(getattr(fields.get("title"), "text", "")), clean_text(getattr(fields.get("link"), "text", ""))
        if not title or not link:
            continue
        place: list[str | None] = []
        for loc in (el for el in item.iter() if _local(el.tag) == "location"):
            sub = {_local(el.tag): clean_text(el.text) for el in loc}
            place += [sub.get("city"), sub.get("country")]
            break
        status = clean_text(getattr(fields.get("remoteStatus"), "text", ""))
        jobs.append(NormalizedJob(
            company_name=company_name, source_type="teamtailor", external_id=clean_text(getattr(fields.get("guid"), "text", "")) or link, title=title,
            application_url=link, location=_place(*place), work_mode=_mode(text=status),
            source_updated_at=clean_text(getattr(fields.get("pubDate"), "text", "")) or None,
            raw_data={"board_name": board, "department": clean_text(getattr(fields.get("department"), "text", ""))},
        ))
    return jobs


# ---------------------------------------------------------------- Personio
async def fetch_personio_jobs(slug: str, company_name: str, client: httpx.AsyncClient | None = None) -> list[NormalizedJob]:
    resp = await _get(client, f"https://{slug}.jobs.personio.de/xml", headers={**HEADERS, "Accept": "application/xml, text/xml"})
    if resp is None:
        return []
    try:
        root = ET.fromstring(resp.content)
    except ET.ParseError:
        return []
    jobs = []
    for pos in root.iter("position"):
        field = lambda name: clean_text((pos.findtext(name) or ""))  # noqa: E731
        title, ident = field("name"), field("id")
        if not title or not ident:
            continue
        offices = [field("office")] + [clean_text(o.text) for o in pos.iter("additionalOffices") for o in o]
        jobs.append(NormalizedJob(
            company_name=company_name, source_type="personio", external_id=ident, title=title,
            application_url=f"https://{slug}.jobs.personio.de/job/{ident}", location=_place(*offices[:2]),
            source_updated_at=field("createdAt") or None,
            # employmentType: permanent / intern / trainee / freelance; schedule: full-time / part-time
            raw_data={"board_name": None, "department": field("department"),
                      "employment_type": ("intern" if field("employmentType") in ("intern", "trainee") else field("employmentType") if field("employmentType") == "freelance" else field("schedule")) or None},
        ))
    return jobs


# ---------------------------------------------------------------- Keka
KEKA_JOB_TYPES = {1: "part_time", 2: "full_time"}


def _keka_location(locations: list[dict[str, Any]]) -> tuple[str | None, bool]:
    """'Bengaluru, India / Delhi, India' from a Keka posting's locations, and whether one of them is "Remote"."""
    places, remote = [], False
    for loc in locations[:4]:
        if clean_text(loc.get("name")).lower() == "remote":
            remote = True
        country = clean_text(loc.get("countryName")) or ("India" if loc.get("countryCode") == "IN" else "")
        place = _place(loc.get("city"), country)
        if place and place not in places:
            places.append(place)
    return " / ".join(places) or None, remote


async def fetch_keka_jobs(slug: str, company_name: str, client: httpx.AsyncClient | None = None) -> list[NormalizedJob]:
    """A Keka careers portal ({slug}.keka.com/careers, which robots.txt allows): its active openings and its company name."""
    resp = await _get(client, f"https://{slug}.keka.com/careers/api/jobs/default/active")
    if resp is None:
        return []
    items = resp.json()
    if not isinstance(items, list):
        return []
    info = await _get(client, f"https://{slug}.keka.com/careers/api/organization/default/careerportalinfo")
    board_name = (info.json() or {}).get("name") if info is not None else None
    jobs = []
    for item in items:
        title, ident = clean_text(item.get("title")), item.get("id")
        if not title or not ident:
            continue
        location, remote = _keka_location(item.get("jobLocations") or [])
        jobs.append(NormalizedJob(
            company_name=company_name, source_type="keka", external_id=str(ident), title=title,
            application_url=f"https://{slug}.keka.com/careers/jobdetails/{ident}", location=location,
            description=item.get("description"), work_mode="remote" if remote else None,
            source_updated_at=item.get("publishedOn"),
            raw_data={"board_name": board_name, "department": item.get("departmentName"),
                      "employment_type": KEKA_JOB_TYPES.get(item.get("jobType"))},
        ))
    return jobs


# ---------------------------------------------------------------- Darwinbox
DARWINBOX_PAGE = 100
DARWINBOX_MAX_PAGES = 10


def _darwinbox_type(name: str | None) -> str | None:
    kind = (name or "").lower()
    if "intern" in kind or "trainee" in kind:
        return "internship"
    if any(w in kind for w in ("contract", "consult", "temporary", "temp", "fixed term", "freelance")):
        return "contract"
    if "part" in kind:
        return "part_time"
    if any(w in kind for w in ("permanent", "full", "fte", "regular")):
        return "full_time"
    return None


def _darwinbox_posted(item: dict[str, Any]) -> str | None:
    """When the job was opened on the careers page (Unix seconds), else when it was posted at all."""
    careers = ((item.get("job_posting") or {}).get("careers") or {}).get("from")
    stamp = careers or item.get("posted_on")
    try:
        return datetime.fromtimestamp(int(stamp), tz=timezone.utc).isoformat() if stamp else item.get("created_on")
    except (TypeError, ValueError, OSError):
        return item.get("created_on")


async def fetch_darwinbox_jobs(slug: str, company_name: str, client: httpx.AsyncClient | None = None) -> list[NormalizedJob]:
    """A Darwinbox careers portal ({slug}.darwinbox.in, or a full host such as acme.darwinbox.com): the job list its own
    careers page loads, and the portal's company name."""
    host = slug if "." in slug else f"{slug}.darwinbox.in"
    base = f"https://{host}/ms/candidateapi"
    now = datetime.now(timezone.utc).timestamp()
    items: list[dict[str, Any]] = []
    for page in range(1, DARWINBOX_MAX_PAGES + 1):
        resp = await _get(client, f"{base}/job/alljobs?companyId=main", method="POST", json={"limit": DARWINBOX_PAGE, "page": page})
        data = resp.json() if resp is not None else None
        batch = data.get("data") if isinstance(data, dict) else None
        if not isinstance(batch, list):
            break
        items += batch
        if len(batch) < DARWINBOX_PAGE or len(items) >= int(data.get("job_counts") or 0):
            break
    if not items:
        return []
    config = await _get(client, f"{base}/getCompanyConfig?is_preview=false&companyId=main")
    message = (config.json() or {}).get("message") if config is not None else None
    company = message.get("company") if isinstance(message, dict) else None
    board_name = company.get("company_name") if isinstance(company, dict) else None
    jobs = []
    for item in items:
        title, ident = clean_text(item.get("title") or item.get("designation_name")), item.get("id")
        careers_until = ((item.get("job_posting") or {}).get("careers") or {}).get("to")
        if not title or not ident or (careers_until and careers_until < now):
            continue
        places = item.get("tool_tip_locations") or item.get("officelocation_show_arr_list") or []
        description = html.unescape(item.get("jd") or "")
        jobs.append(NormalizedJob(
            company_name=company_name, source_type="darwinbox", external_id=str(ident), title=title,
            application_url=f"https://{host}/ms/candidatev2/main/careers/jobDetails/{ident}",
            location=" / ".join(dict.fromkeys(clean_text(p) for p in places[:4] if clean_text(p))) or clean_text(item.get("country")) or None,
            description=None if clean_text(description) in ("", "Please enter job description") else description,
            work_mode="remote" if item.get("is_remote") in (1, "1", True) else None,
            source_updated_at=_darwinbox_posted(item),
            raw_data={"board_name": board_name, "department": item.get("department_name_only"),
                      "employment_type": _darwinbox_type(item.get("emp_type_name"))},
        ))
    return jobs


# ---------------------------------------------------------------- Oracle Recruiting Cloud
ORACLE_PAGE = 200
ORACLE_MAX = 1000   # newest first; a bank can list 10,000+ branch jobs


async def fetch_oracle_jobs(ident: str, company_name: str, client: httpx.AsyncClient | None = None) -> list[NormalizedJob]:
    """An Oracle Recruiting Cloud career site, identified as "{host}/{site number}" (for example
    hcbt.fa.em2.oraclecloud.com/CX): the same public job search its career site runs."""
    host, _, site = ident.partition("/")
    if not host or not site:
        return []
    jobs: list[NormalizedJob] = []
    offset = 0
    while offset < ORACLE_MAX:
        finder = f"findReqs;siteNumber={site},limit={ORACLE_PAGE},offset={offset},sortBy=POSTING_DATES_DESC"
        resp = await _get(client, f"https://{host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions",
                          params={"onlyData": "true", "expand": "requisitionList.secondaryLocations", "finder": finder})
        if resp is None:
            break
        found = (resp.json().get("items") or [{}])[0]
        batch = found.get("requisitionList") or []
        for item in batch:
            title, ident_ = clean_text(item.get("Title")), item.get("Id")
            if not title or not ident_:
                continue
            others = [clean_text(loc.get("Name")) for loc in item.get("secondaryLocations") or []]
            mode = clean_text(item.get("WorkplaceType")).lower()
            jobs.append(NormalizedJob(
                company_name=company_name, source_type="oracle", external_id=str(ident_), title=title,
                application_url=f"https://{host}/hcmUI/CandidateExperience/en/sites/{site}/job/{ident_}",
                location=" / ".join(dict.fromkeys(p for p in [clean_text(item.get("PrimaryLocation")), *others[:3]] if p)) or None,
                work_mode="remote" if "remote" in mode else "hybrid" if "hybrid" in mode else None,
                source_updated_at=item.get("PostedDate"),
                raw_data={"board_name": None, "department": clean_text(item.get("Organization")) or None,
                          "employment_type": clean_text(item.get("ContractType") or item.get("JobSchedule")) or None},
            ))
        offset += ORACLE_PAGE
        if len(batch) < ORACLE_PAGE or offset >= int(found.get("TotalJobsCount") or 0):
            break
    return jobs

