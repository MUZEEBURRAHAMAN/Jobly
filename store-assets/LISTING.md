# Chrome Web Store listing: Jobly

Paste these into the Chrome Web Store Developer Dashboard. The upload file is `jobly-extension-0.1.0.zip` (built from `extension/dist`).
Screenshots (1280×800) and the small promo tile (440×280) are in this folder. Rebuild the zip after any change:
`cd extension && npm run build && cd dist && zip -qr -X ../../store-assets/jobly-extension-0.1.0.zip . -x "*.DS_Store"`

## Store listing tab

**Name** (from the manifest, 32 characters): Jobly — Find jobs. Apply smarter

**Summary** (from the manifest, 112 of 132 characters):
Fresh tech jobs from company career pages, with real posting dates and alerts for new matches. Free, no account.

**Category:** Productivity (or "Workflow & Planning" if offered)
**Language:** English

**Description:**

Jobly shows tech jobs from company career pages and remote job boards, each with the date the employer actually posted it.

Most job sites bury the date, mix in promoted listings and keep jobs up long after they're filled. Jobly reads the employer's own listings, shows how old each one is, and hides anything older than 60 days.

WHAT YOU GET
• Real posting dates, taken from the employer's own hiring system
• Nothing older than 60 days, and closed jobs are removed at the next refresh
• No promoted or sponsored listings
• Alerts when a new job matches your roles, experience level, remote setting and keywords
• Filters for location, experience, minimum salary and date posted
• Saved jobs and a clear list of what's new since your last visit
• Light and dark themes

ROLES COVERED
Product design, frontend engineering, product management, AI and machine learning, and fullstack engineering.

PRIVATE BY DESIGN
• No account, no email, no tracking, no ads
• Your preferences, saved jobs and alerts stay in your browser
• Jobly can't see your tabs or the pages you visit

GOOD TO KNOW
• Jobly lists tech roles only, and most of the employers it reads are US companies, plus remote job boards
• Apply opens the original listing, usually the employer's own careers page
• Jobly's server runs on a free plan, so the first load after a quiet period can take up to a minute
• Jobly isn't affiliated with the employers it lists

Free. Learn more at https://joblyextension.netlify.app

## Privacy practices tab

**Single purpose:**
Jobly helps people find and track recent tech jobs: it lists jobs from company career pages with their posting dates, matches them to the user's preferences, and alerts the user to new matches.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `storage` | Keeps the user's preferences, saved jobs, alerts and a cached copy of recent results on their device, so the extension opens instantly and works offline. |
| `notifications` | Shows an optional desktop notification when new jobs match the user's preferences. It is off until the user turns it on. |
| `alarms` | Schedules the background check for new matching jobs every 60 to 90 minutes. |
| Host permission `https://jobly-yd6l.onrender.com/*` | Fetches job listings from Jobly's server. This is the only website the extension talks to. |

**Remote code:** No. All code is packaged in the extension, and the content security policy allows only the extension's own scripts.

**Data usage:** answer carefully, and review Google's current wording on the form.
What the extension actually does: when the user browses, searches or filters, it sends their search words and chosen filters (roles, experience levels, remote-only, keywords) to Jobly's server to get matching jobs. The server answers the request and does not store them. Nothing is sent that identifies the user; there are no accounts. Everything else stays on the device.
My suggestion: declare no categories of *stored* personal data, and make sure the privacy policy URL below is entered. If the form asks about transmitted data, the closest category is "User activity" (search terms typed by the user); say it is used only to return results. If unsure, ask Google's reviewers via the dashboard rather than under-declaring.

**Certifications (tick all three):**
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes unrelated to the item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://joblyextension.netlify.app/privacy

## Other fields

- **Homepage URL:** https://joblyextension.netlify.app
- **Support URL:** https://joblyextension.netlify.app/support
- **Contact email** (shown to users, must be verified): the address you register with; decide whether to use your personal Gmail or a dedicated one first
- **Pricing:** free, no in-app purchases
- **Distribution:** public, all regions
- **Trader status (EU):** answer honestly. A free, non-commercial extension from an individual is normally "non-trader"; if you plan to earn money from it, choose "trader"
- **Test instructions for the reviewer:** No sign-in is needed. Open the extension, pick one or more roles in the welcome tour, and jobs appear. The server runs on a free plan; if the list says it is gathering jobs, wait up to a minute and refresh.

## Before you press Submit

1. Developer account registered ($5 one-time fee) with 2-step verification on.
2. Netlify Forms turned on, so the support and uninstall forms the privacy policy mentions actually work.
3. `SNAPSHOT_TOKEN` set on Render, so the server has jobs the moment it restarts (a reviewer who installs during a restart would otherwise see an empty list).
4. Optional but wise: Render's paid plan for launch week, so nobody waits on a cold start.

## After approval

1. Put the store URL in `SITE.storeUrl` in `web/src/lib/site.ts` and push: every "Add to Chrome" button and the install section switch over.
2. Optionally pin the server to the published extension ID: set `EXTENSION_IDS` on Render to the ID shown in the dashboard.
3. Update the roadmap ("Chrome Web Store listing") and the changelog.
