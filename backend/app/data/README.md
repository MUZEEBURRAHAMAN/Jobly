# Employer list

`companies.json` lists the employers Jobly reads: name, slug, careers page, hiring system (`source_type`) and the board name
(`source_identifier`). The `region` field is a note for people; the server ignores it.

- Add employers with `scripts/verify_employers.py` (candidates live in `scripts/employer_candidates.csv`). It tests each name on
  Greenhouse, Ashby, Lever, SmartRecruiters, Workable, Recruitee, Teamtailor and Personio and adds only boards with real role jobs.
- Workday employers are added by hand: `source_identifier` is `{tenant}.{wdN}/{site}` (see `ingestion/workday.py`).
- Boards that close are reported by `scripts/verify_employers.py --recheck`. Remove them here and add the slug to
  `RETIRED_COMPANY_SLUGS` in `backend/app/seed.py` so their old jobs are deleted too.
- Heavy sources (Workday) are read only by the scheduled snapshot job (`CRAWL_PROFILE=full`); the server restores its snapshot.

- `yc_batch` (for example `W21`) marks employers listed in Y Combinator's public directory. The server stores it, `/api/jobs?yc=true`
  filters by it, and the website's /jobs/yc page uses that. Candidates come from the public directory (names and websites only); a
  second look at each match (does the company's own website or name appear in its jobs?) removes boards that belong to a different
  company with the same name.

Last employer-list update: 2026-10-23
