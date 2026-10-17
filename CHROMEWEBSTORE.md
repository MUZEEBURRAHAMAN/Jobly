# Chrome Web Store — Jobly listing & compliance notes

Text below is ready to paste into the Developer Dashboard. It describes what the extension **actually does today**
(the previous version described a local-only "Hiring Radar" and was inaccurate).

## Before you submit (blockers)

- [x] **Per-user state.** Preferences, saved jobs and alerts now live in `chrome.storage.local` on each device; the
      server is stateless (preferences are sent with each request only to pick matching jobs; see `AUDIT_REPORT.md` SEC-04).
- [x] **Backend host.** The extension only talks to `https://jobly-yd6l.onrender.com` (`api.getcatchly.com` belongs to
      another project and was removed from the manifest). Point the keep-alive cron at `https://jobly-yd6l.onrender.com/health` (GET).
- [ ] **Pin CORS** to your published extension ID: set `EXTENSION_IDS=<id>` on the server after the first upload.
- [ ] **Set `ADMIN_TOKEN`** on the server only if you want to manage companies through the API (it is disabled by default).
- [ ] **Hosted privacy policy URL** (required). Deploy `site/` free on Netlify or Vercel (see `site/README.md`) and use
      `https://<your-site>/privacy`. Then set `storeUrl` and `contactEmail` in `site/config.js`.
- [x] **Assets** are generated in `store-assets/` (six 1280×800 screenshots + 440×280 promo tile; regenerate with
      `cd extension && npm run e2e:screens`). 128px icon is done.
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
- **Filters:** seniority, work mode, location, salary, date posted (like LinkedIn), include/exclude keywords.
- **Always fresh:** jobs older than 2 months are never shown, and closed postings are removed.
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
| Host access: `https://jobly-yd6l.onrender.com/*` | The Jobly service that provides the job listings. These are the only sites the extension talks to (plus company logos, below). |

No content scripts, no `tabs`, no `<all_urls>`, no cookies, no remote code (Manifest V3, `script-src 'self'`; fonts are bundled).

## Single purpose

Help people discover and track relevant job openings at tech employers and apply on the employer's own site.

## Privacy (use for the policy and the dashboard's data-usage form)

**What the extension sends to the Jobly service:** your search text and filters, and your role/seniority/keyword
preferences with each job request (the server does not store them), plus the job and reason when you report a listing.
Like any web request, the hosting provider sees your IP address and browser type.

**What it does not do:** no account, no name/email, no resume, no browsing history, no tracking or analytics scripts,
no ads, no selling or sharing of data.

**Third parties:** company logos are loaded from Google's favicon service (`t2.gstatic.com`), so Google can see which
company logos your browser requests. Fonts are bundled and are not loaded from Google.

**Stored on your device:** preferences, saved jobs, alerts, hidden companies and a cache of recent jobs in `chrome.storage` (cleared by uninstalling).

**Dashboard disclosures to tick:** "Web history" — no; "User activity"/"Website content" — the search and filter text
you type is sent to the service to return results; not sold, not used for unrelated purposes, not used for creditworthiness.
Re-check these against the final implementation before submitting.

## Policy checklist

| Requirement | Status |
| :--- | :--- |
| Single purpose | Job discovery and alerts only |
| Minimal permissions | 3 permissions + 1 service host; localhost removed from the production build |
| No remote code | All JS bundled; strict CSP |
| No scraping of third-party pages | Jobs come from the service's server-side ATS integrations |
| Accurate listing | Update the counts/claims from verified data |
| Privacy policy URL | Page ready in `site/privacy.html`; deploy it, then paste the URL |
