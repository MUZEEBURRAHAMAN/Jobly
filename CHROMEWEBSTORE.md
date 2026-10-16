# Chrome Web Store — Jobly listing & compliance notes

Text below is ready to paste into the Developer Dashboard. It describes what the extension **actually does today**
(the previous version described a local-only "Hiring Radar" and was inaccurate).

## Before you submit (blockers)

- [ ] **Per-user state.** The backend still keeps ONE shared set of preferences / saved jobs / alerts for everyone
      (see `AUDIT_REPORT.md` SEC-04). Move those into `chrome.storage` (or add per-install identity) first, otherwise
      installers overwrite each other and the privacy text below would be untrue.
- [ ] **Domain / backend.** `api.getcatchly.com` stopped resolving (nameservers moved to GoDaddy). Restore it or
      remove it from `public/manifest.json`. Point the keep-alive cron at the Render URL.
- [ ] **Pin CORS** to your published extension ID: set `EXTENSION_IDS=<id>` on the server after the first upload.
- [ ] **Set `ADMIN_TOKEN`** on the server only if you want to manage companies through the API (it is disabled by default).
- [ ] **Hosted privacy policy URL** (required). Free options: GitHub Pages, or a `/privacy` page on the backend. Use the text under "Privacy".
- [ ] **Assets:** at least 1 screenshot (1280×800 or 640×400), a 440×280 small promo tile. 128px icon is done.
- [ ] Build the store zip from the production build only: `cd extension && npm ci && npm run build`, then zip the
      **contents** of `dist/`. (`npm run build:dev` adds localhost access and must never be uploaded.)

## Store metadata

- **Name:** Jobly — Find jobs. Apply smarter
- **Summary (≤132 chars):** Track hundreds of verified tech employers and get notified when roles matching your preferences are posted.
- **Category:** Productivity
- **Version:** see `extension/public/manifest.json`

## Detailed description

Stop checking dozens of career pages every day. Jobly watches the public job boards (Greenhouse, Lever, Ashby,
Workday and curated remote feeds) of hundreds of tech employers and tells you when a role that fits you appears.

- **Role-based radar:** Product Design, Frontend, Product Management, AI/ML, Fullstack.
- **Direct apply links:** every listing links to the employer's own application page.
- **Filters:** seniority, work mode, location hub, salary, freshness, include/exclude keywords.
- **Employer watchlist:** see which companies are tracked and how many roles are open.
- **Shortlist:** save roles with one click.
- **Optional desktop alerts:** one grouped notification instead of spam. Turn them off any time in Rules.

(Do not quote employer/job counts in the listing unless you verified them the same day.)

## Permissions justification

| Permission | Justification |
| :--- | :--- |
| `storage` | Saves your settings and a cached copy of the job list so the popup opens instantly and works offline. |
| `notifications` | Shows an optional desktop alert when new roles match your preferences. |
| `alarms` | Schedules the periodic background check without keeping a background page alive. |
| Host access: `https://jobly-yd6l.onrender.com/*`, `https://api.getcatchly.com/*` | The Jobly service that provides the job listings. These are the only sites the extension talks to (plus company logos, below). |

No content scripts, no `tabs`, no `<all_urls>`, no cookies, no remote code (Manifest V3, `script-src 'self'`; fonts are bundled).

## Single purpose

Help people discover and track relevant job openings at tech employers and apply on the employer's own site.

## Privacy (use for the policy and the dashboard's data-usage form)

**What the extension sends to the Jobly service:** your search text and filters, your role/seniority/keyword
preferences, which jobs you save or report, and which companies you track — only to show you relevant jobs.
Like any web request, the hosting provider sees your IP address and browser type.

**What it does not do:** no account, no name/email, no resume, no browsing history, no tracking or analytics scripts,
no ads, no selling or sharing of data.

**Third parties:** company logos are loaded from Google's favicon service (`t2.gstatic.com`), so Google can see which
company logos your browser requests. Fonts are bundled and are not loaded from Google.

**Stored on your device:** settings and a cache of recent jobs in `chrome.storage` (cleared by uninstalling).

**Dashboard disclosures to tick:** "Web history" — no; "User activity"/"Website content" — the search and filter text
you type is sent to the service to return results; not sold, not used for unrelated purposes, not used for creditworthiness.
Re-check these against the final implementation (especially after moving preferences on-device).

## Policy checklist

| Requirement | Status |
| :--- | :--- |
| Single purpose | Job discovery and alerts only |
| Minimal permissions | 3 permissions + 2 service hosts; localhost removed from the production build |
| No remote code | All JS bundled; strict CSP |
| No scraping of third-party pages | Jobs come from the service's server-side ATS integrations |
| Accurate listing | Update the counts/claims from verified data |
| Privacy policy URL | **Missing — required** |
