# Jobly: packet for a lawyer's review

Prepared 2026-10-20 from the code and the live site. This is a fact sheet, not legal advice. Everything marked **verified** was checked in the code or on the live service on that date; anything marked **not verified** is exactly that.

## 1. What is being reviewed

- **Product:** Jobly, a free Chrome extension that lists tech jobs from company career pages and remote job boards, with a website (https://joblyextension.netlify.app) and a small server (https://jobly-yd6l.onrender.com).
- **Documents to review** (live, and as Markdown in the repository):
  - Privacy policy: https://joblyextension.netlify.app/privacy (`web/src/content/docs/privacy.md`)
  - Terms of use: https://joblyextension.netlify.app/terms (`web/src/content/docs/terms.md`)
  - Security page: https://joblyextension.netlify.app/security (`web/src/content/docs/security.md`)
  - Chrome Web Store listing and data-use answers: `store-assets/LISTING.md`
- **Operator** (fill in before sending): name or company: ______  country of residence: ______  postal address: ______  contact email: rahamanmuzeeb1108@gmail.com
- **Where users are:** worldwide in principle; the extension will be public on the Chrome Web Store. Most employers listed are in the US, UK and EU.
- **Money:** none. No ads, no paid tier, no affiliate links, no sale of data.

## 2. Questions for the lawyer

1. **Who is the controller, and what must the policy say about it?** Today the policies name no person, company or postal address, only an email. What is the minimum for GDPR / UK GDPR, and for the operator's own country?
2. **Is there personal data at all?** The extension has no accounts. The server briefly sees IP addresses and search words, and the hosts keep short-lived logs. Does the policy describe this correctly, and is a legal basis (legitimate interest) stated where needed?
3. **International transfers.** The server runs on Render (US), the site on Netlify (US), with Cloudflare in front of Render. What wording or safeguards (standard contractual clauses, the EU-US Data Privacy Framework) are needed?
4. **Forms.** The support form collects an email address and a message, and the uninstall form collects a reason and a note, all stored by Netlify Forms. Is the stated 12-month deletion period reasonable, and do we need a data-subject request process (access, deletion)?
5. **Terms of use.** Is the "as is" and liability wording enforceable for a free service in the operator's country and for EU/UK consumers? Do we need governing law, a venue, and an operator identity clause?
6. **Third-party listings.** Jobs and company names belong to employers. Is the disclaimer ("not affiliated, may be wrong") enough, and do we need a takedown contact for an employer that wants a listing removed?
7. **Source terms (section 6).** Are we allowed to aggregate from these job-board interfaces the way we do?
8. **Children.** The policy says Jobly is not directed at under-13s. Is that the right age for the main markets (16 in parts of the EU)?
9. **Chrome Web Store User Data Policy.** Is the data-use declaration in `store-assets/LISTING.md` right?
10. **Name.** "Jobly" is a common name; several `jobly.*` domains are registered. Is a trademark check needed before wider promotion?

## 3. What the product does with data (verified)

| Where | What | Kept for | Source |
| --- | --- | --- | --- |
| **On the user's device** (Chrome extension storage) | Preferences (roles, experience, remote-only, keywords, alert setting), saved jobs, alerts, muted companies, welcome-tour flag, a cache of recent results | Until uninstall | `extension/src/lib/*` |
| Device, **Chrome sync storage** | The theme (light or dark) only; Chrome may sync it through the user's Google account | Until uninstall | `extension/src/lib/theme.ts` |
| **Sent to the Jobly server** with job requests | Search text, filters, and the user's roles, experience levels, remote setting and keywords (as a query parameter) | **Not stored.** Identical requests are cached in memory for 120 seconds, then dropped | `backend/app/api/routes.py`, `backend/app/cache.py` |
| **Sent when the user reports a listing** | The job, a reason and a note (up to 500 characters); no identity | Until deleted; stored in the server database with a timestamp | `reports` table |
| Server memory | The caller's IP address, to count requests per minute (rate limit) | About a minute, in memory only | `backend/app/security.py` |
| Server logs | The server keeps no access log (verified in Render's start command on 2026-10-20: `--no-access-log`). Application errors and crawl results are logged | Render's retention | Render dashboard |
| Hosting providers | Render, Cloudflare (network) and Netlify keep their own short-lived technical logs (IP, time, address requested; search words are part of the address) | Providers' own periods; **not verified** | Provider policies |
| **Website** | No cookies, no analytics, no third-party scripts, fonts served from the site. The theme choice is saved in the browser's local storage | Until the visitor clears it | `web/` |
| **Forms** (Netlify Forms) | Support: email, message, optional name. Uninstall: reason and note, no email, no identifier | Promised: deleted once handled, at most 12 months. **No automatic deletion exists; it is done by hand** | Netlify dashboard |
| **Google favicon service** (`t2.gstatic.com`) | The extension asks it for company logos, so Google sees the company domains requested and the user's IP | Google's own policy | `extension/public/manifest.json` (img-src) |

Extension permissions: `storage`, `notifications`, `alarms`, and one host (`https://jobly-yd6l.onrender.com/*`). No content scripts, no `tabs`, no `history`, no remote code.

## 4. Commitments the site makes today (please confirm each is wise)

- Support replies within **2 working days**; security reports within **3 working days**.
- Form messages deleted **within 12 months** at the latest. (Needs a manual routine; a reminder is advisable.)
- "No analytics, no tracking, no selling or sharing of data."
- "The server keeps no access log."
- Roadmap items are described as plans, not promises ("planned and exploring items can change").
- Jobs older than 60 days are hidden and closed jobs removed "at the next refresh, within about two hours".

## 5. Gaps already visible (my observations, to be confirmed)

1. No named operator or postal address in the privacy policy or terms (see question 1).
2. No governing-law or venue clause in the terms.
3. No statement about transfers to the US (Render, Netlify), or about the legal basis for processing IP addresses.
4. No process for access or deletion requests beyond "write to us".
5. The 12-month form retention has no automated enforcement.
6. No takedown or correction procedure for employers named in listings.

## 6. Where the job data comes from, and the sources' own terms

| Source | How we read it | What its published terms say | Status |
| --- | --- | --- | --- |
| Greenhouse, Ashby, Lever | Public job-board interfaces that employers publish for their own careers pages; read-only, no key | Not reviewed | **Not verified.** Ask the lawyer whether aggregating them is acceptable |
| Workday, Amazon Jobs | Public careers-site interfaces | Not reviewed | **Not verified** |
| ~~Remotive~~ | **Removed 2026-10-20.** Its published terms require attribution and at most about 4 calls a day, which Jobly could not meet for 4 jobs of about 2,600 | Verified | Retired: its stored jobs are deleted at start and after every crawl |
| SmartRecruiters, Workable, Recruitee, Teamtailor, Personio | Public job feeds employers publish for their own careers pages; read-only, no key, one request per employer per crawl (SmartRecruiters is paged, capped at 600 jobs) | Not reviewed | **Not verified.** Same question as Greenhouse/Ashby/Lever |
| Himalayas | Public API | Use of the public API, job feeds and MCP server "in line with their published documentation and rate limits" is expressly allowed; bulk republication is not | Verified; within limits |
| Arbeitnow | Free public API, no key | No attribution or rate rule found on its documentation page | Partly verified |
| We Work Remotely | Public RSS feeds | Terms page could not be read (the site blocks automated requests) | **Not verified** |

**Remotive:** removed. The server asked it for 10 categories on every crawl (well over 100 requests a day against its stated limit of 4 a day) without showing its name to users, so the source was dropped.
