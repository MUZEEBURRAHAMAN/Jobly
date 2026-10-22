# Jobly: legal review packet

Prepared 2026-10-22 from the code, the live service and the providers' own published pages. It is a fact sheet with questions and draft wording, **not legal advice**. Everything is marked **verified** (checked in the code, on the live service or on the provider's page on that date, with the source) or **not verified** (say so, don't assume).

## 0. Before you send this

Fill in these three things, nothing else is needed:

| Field | Value |
| --- | --- |
| Operator (your legal name, or the company that will run Jobly) | ______ |
| Country of residence or incorporation | ______ |
| Postal address (needed for GDPR and many consumer rules) | ______ |

Contact email already published on the site: rahamanmuzeeb1108@gmail.com. Form messages are emailed there (Netlify notification set 2026-10-22).

**What to ask for:** a review of the privacy policy, terms of use and security page (live at the addresses below), answers to the ten questions in section 2, and a view on the risks in section 7. A flat-fee privacy lawyer with GDPR/UK GDPR and platform-terms experience is the right fit; expect one to two weeks. The listing can go live before the review ends, because the policy URL does not change.

**The documents** (live, and as Markdown in the repository):
- Privacy policy: https://joblyextension.netlify.app/privacy (`web/src/content/docs/privacy.md`)
- Terms of use: https://joblyextension.netlify.app/terms (`web/src/content/docs/terms.md`)
- Security page: https://joblyextension.netlify.app/security (`web/src/content/docs/security.md`)
- Chrome Web Store listing and data-use answers: `store-assets/LISTING.md`

## 1. The product in six sentences

Jobly is a free Chrome extension, a website and a small server. It lists tech jobs (product design, frontend, product management, AI/ML, fullstack) that employers publish on their own public job boards and a few remote job boards, with each job's real posting date. There are no accounts, no ads, no payments and no analytics. The user's preferences, saved jobs and alerts stay in their browser; the extension sends search words and filters to the server to get matching jobs, and the server does not keep them. About 600 employers are read (about 400 through their own career pages on Greenhouse, Ashby, Lever, Workday, SmartRecruiters, Workable, Recruitee, Teamtailor, Personio and Amazon, and the rest found through three remote job boards). Users are worldwide; most jobs are US, then India, UK, Canada and Europe.

## 2. Questions for the lawyer (most important first)

1. **Who is the controller, and what must the policies say about them?** Today they name no person, company or postal address, only an email. What is the minimum for GDPR / UK GDPR and for the operator's own country, and should the operator be a company?
2. **Is there personal data at all?** The server briefly holds IP addresses (rate limiting, in memory) and sees search words; hosts keep logs; Netlify stores form messages with the sender's IP. Is the policy's description correct, and is a legal basis (legitimate interest) needed in the text?
3. **Can we aggregate job data from these sources?** See section 6: most publish a public feed and state no third-party terms; two (Remotive, Himalayas) state terms; one (SmartRecruiters) documents only key-based access. Do we need permission, a different approach, or nothing more than we do?
4. **International transfers.** Server on Render (US) behind Cloudflare, site on Netlify (US). Netlify states it relies on the EU-U.S. Data Privacy Framework and standard contractual clauses (verified, section 5). Render's mechanism is **not verified**. What do we need to say or sign?
5. **Forms.** The support form stores an email and message; the uninstall form stores a reason and note; Netlify adds the sender's IP and cannot switch that off (section 5). Is a 12-month manual deletion promise reasonable, and do we need a recorded process for access and deletion requests?
6. **Terms of use.** Are the "as is" and liability wording enforceable for a free service in the operator's country and for EU/UK consumers? Governing law, venue and operator identity clauses are missing (draft wording in section 8).
7. **Employers named in listings.** The terms now say employers can ask for a correction or removal, and that removing a job from their board removes it from Jobly at the next refresh. Enough?
8. **Children.** The policy says Jobly is not directed at under-13s. Is that the right age for the main markets (16 in parts of the EU)?
9. **Chrome Web Store User Data Policy.** Is the data-use declaration in `store-assets/LISTING.md` correct and complete?
10. **Name.** "Jobly" is a common name and several `jobly.*` domains are registered by others. Is a trademark check needed before promotion?

## 3. What the product does with data (verified in code, 2026-10-22)

| Where | What | Kept for | Source |
| --- | --- | --- | --- |
| **User's device** (Chrome extension storage) | Preferences (roles, experience, remote-only, keywords, alert setting), saved jobs, alerts, muted companies, welcome flag, cache of recent results | Until uninstall | `extension/src/lib/*` |
| Device, Chrome **sync storage** | Theme (light or dark) only; Chrome may sync it via the user's Google account | Until uninstall | `extension/src/lib/theme.ts` |
| **Sent to the Jobly server** with job requests | Search text, filters, and the user's roles, experience levels, remote setting and keywords (as a query parameter) | **Not stored.** Identical requests are cached in memory for 120 s | `backend/app/api/routes.py`, `cache.py` |
| **Report this listing** | The job, a reason, a note (up to 500 characters); no identity | In the server database until the server restarts and restores a snapshot (reports are removed from snapshots) | `reports` table, `snapshot.py` |
| Server memory | Caller IP address, to count requests per minute | About a minute, memory only | `backend/app/security.py` |
| Server logs | No access log (`--no-access-log` in the Render start command, seen in the deploy log 2026-10-20). Application errors and crawl results only | Render's retention | Render dashboard |
| **Website** | No cookies, analytics or third-party scripts; fonts served from the site. Theme choice in the browser's local storage | Until cleared | `web/` |
| **Forms** (Netlify Forms) | Support: email, message, optional name. Uninstall: reason and note. **Netlify also stores the sender's IP** | Promised: removed once handled, at most 12 months. **No automatic deletion exists; it is done by hand** | Netlify dashboard |
| Google favicon service (`t2.gstatic.com`) | The extension asks it for company logos: Google sees the company domains and the user's IP | Google's policy | extension manifest (`img-src`) |
| Place names | The server matches job locations to countries using a bundled GeoNames table; no user data involved | n/a | `backend/app/data/world.json` |

Extension permissions: `storage`, `notifications`, `alarms`, one host (`https://jobly-yd6l.onrender.com/*`). No content scripts, no `tabs`, no `history`, no remote code.

## 4. Changes already made since the first draft (so you review the current text)

- Privacy policy: IP stored by Netlify with form messages; where data goes (US hosts, Netlify's DPF and SCC statement); a rights section with a 30-day answer promise; IP held in server memory for rate limiting.
- Terms: employer correction and removal paragraph; GeoNames credit (CC BY 4.0).
- Remotive removed as a source (its terms need attribution and at most about 4 calls a day).
- Job cards from We Work Remotely, Himalayas and Arbeitnow say "via <board>".
- Never claimed anywhere: "open source" (the repository is private).

## 5. Provider facts (what each host says about logs, retention and transfers)

| Provider | Role | What we found | Status |
| --- | --- | --- | --- |
| Netlify | Website and forms | Collects IP addresses and device data automatically; retention "consistent with the original purpose" with no fixed period; processes outside the country of collection; relies on the EU-U.S. DPF (and UK and Swiss extensions) and the Commission's standard contractual clauses 2021/914 ([netlify.com/privacy](https://www.netlify.com/privacy/)). Community answers from Netlify staff: form submissions store the IP, it cannot be hidden, and there is no auto-delete ([forum](https://answers.netlify.com/t/forms-are-collecting-ip-address-can-we-turn-off/11690), [forum](https://answers.netlify.com/t/data-in-netlify-forms-auto-delete-after-30-days-gdpr-compliance/30713)) | Verified; staff answers are informal |
| Render | Server host | Log retention depends on the plan (Hobby 7 days, Professional 14, Organization 30 days; [render.com/docs/logging](https://render.com/docs/logging)). HTTP request logs in its explorer need a paid workspace. Privacy-policy page text could not be read automatically | Partly verified; **transfer mechanism not verified** |
| Cloudflare | Network in front of Render | Seen in response headers (`server: cloudflare`); retention and role (processor) **not verified** | Not verified |
| Google | Favicons, Chrome Web Store, theme sync | Governed by Google's own policies | Not reviewed |

## 6. Where the job data comes from, and what each source says

| Source | How read | What it publishes about third-party use | Status |
| --- | --- | --- | --- |
| Greenhouse | Public job-board API, GET, no key | "Job Board data is publicly available, so authentication is not required for any GET endpoints" ([docs.greenhouse.io/job-board.html](https://docs.greenhouse.io/job-board.html)); no usage terms or limits stated | Verified |
| Lever | Public postings API, GET | "All job postings in the published state are publicly viewable" and "These jobs may be scraped by third parties" ([github.com/lever/postings-api](https://github.com/lever/postings-api)); no GET rate limit or terms stated | Verified |
| Ashby | Public job-posting API, GET | Example request has no key; no terms, limits or attribution stated ([docs](https://developers.ashbyhq.com/docs/public-job-posting-api)); says unlisted jobs "should only be available via direct link"; the reader skips any job marked `isListed: false` (code and test added 2026-10-22) | Verified |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{id}/postings`, no key | Its docs say the Public Posting API "supports both API Key and OAuth 2.0" and describe no terms ([docs](https://developers.smartrecruiters.com/docs/posting-api)); our unauthenticated calls work, but permission for third-party use is **not stated either way** | **Ask the lawyer** |
| Workable, Recruitee, Teamtailor, Personio | Public widget, offers, RSS and XML feeds that employers embed on their own careers pages | No third-party terms found; Workable's and Recruitee's documentation pages could not be read | Not verified |
| Workday | Public careers-site search interface (the same one the employers' own pages use) | Not reviewed | Not verified |
| Amazon Jobs | Public search interface | Not reviewed | Not verified |
| We Work Remotely | Public RSS feeds | Terms page blocks automated requests | Not verified |
| Himalayas | Public API | "Please link back to the URL found on Himalayas AND mention Himalayas as the original source. Please do not submit Himalayas jobs to other job boards or aggregators" ([himalayas.app/api](https://himalayas.app/api)); its terms also allow use of the public API "in line with their published documentation and rate limits". We link to their listing and now show "via Himalayas", and read only its RSS feed (about 20 jobs) | Verified; **the "aggregators" sentence is the open question** |
| Arbeitnow | Free public API | "Please do not abuse"; "I would appreciate linking back"; "by using the API, you agree to the terms of service on Arbeitnow.com" (terms not read). We read 6 pages (2 on the server) once per crawl; apply links go to their listing; "via Arbeitnow" shown | Partly verified |
| ~~Remotive~~ | **Removed 2026-10-20** | Required attribution and at most about 4 calls a day; we exceeded both | Retired; its stored jobs are deleted |

Practical safeguards in place: one request (or a few pages) per employer per crawl; identification as `HiringRadar/1.0` with a contact link; polite retries on rate limits; apply links go to the original listing; jobs older than 60 days and closed jobs are removed.

## 7. Risks, ranked (my own view, for the lawyer to confirm or correct)

**High**
1. **No named operator or postal address** in the policies, terms or store listing (question 1).
2. **SmartRecruiters** feed use without any stated permission (question 3). It supplies about 1,500 jobs from 7 employers; easy to switch off.
3. **Himalayas** asks aggregators not to republish; we show 20 jobs and credit them. Easy to switch off.

**Medium**
4. No governing-law or venue clause; no named contact for legal notices.
5. The 12-month form retention is manual with no automation; Netlify cannot auto-delete and stores IPs (question 5).
6. Render and Cloudflare transfer mechanisms and retention not verified (question 4).
7. Several sources' terms not reviewed (Workday, Amazon, We Work Remotely, Arbeitnow's terms of service, Workable, Recruitee).

**Low**
8. "Jobly" name collisions (question 10).
9. The privacy policy and listing promise a 30-day answer to rights requests and a 2-working-day support reply: fine if one person can keep them, a risk if not.

## 8. Draft wording for the lawyer to improve (placeholders in brackets)

**Operator and contact (privacy policy and terms):** "Jobly is run by [OPERATOR NAME], [POSTAL ADDRESS], [COUNTRY]. For privacy or legal questions, write to rahamanmuzeeb1108@gmail.com."

**Governing law (terms):** "These terms are governed by the laws of [COUNTRY]. If you are a consumer, you also keep any rights the law of the country you live in gives you that cannot be waived. Disputes go to the courts of [VENUE], unless the law of your country says otherwise."

**Legal basis (privacy policy):** "We handle the small amount of technical data our server and website receive (IP address, request time) because it is needed to keep the service running and secure (our legitimate interest). We handle messages you send through our forms because you ask us to reply (your consent)."

**Retention of form messages (privacy policy):** replace "at the latest after 12 months" with whatever period the lawyer recommends and add the date of the last clean-up.

**Source terms (internal, not for publication):** keep a dated list of each source's published terms in this file, review it every quarter, and switch a source off the same day its terms stop allowing our use.

## 9. Open items only the operator can do

1. Fill in the three fields in section 0.
2. Choose and instruct the lawyer; share section 0 to 8, the live links and `store-assets/LISTING.md`.
3. Decide on SmartRecruiters and Himalayas (keep with the lawyer's approval, or switch off).
4. Put a quarterly reminder in a calendar to renew the GitHub snapshot token (expires 2027-10-20), delete old form messages, and re-read the source terms.
