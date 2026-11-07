# Chrome Web Store: Jobly 1.2.0

Everything to paste into the Chrome Web Store developer dashboard, tab by tab. Version 1.2.0 replaces the 1.1.0 packet (`store-listing-1.1.md`), which was never uploaded. It is the first public version after 0.1.0.

## What changed from 1.1

- The Tracker board, Interviews and Tasks are switched off. Applied jobs are a list under **Saved › Applied**.
- Settings, alerts, theme and refresh are icons at the top right of the dashboard. Backup and import are in **Settings › Your data**.
- Companies can be filtered by country and sorted by A–Z, Z–A, number of open jobs or newest job.
- Search matches titles, companies and places. "Design engineer" jobs in chips, RF and mechanical work no longer appear under product design.
- No reminder alarm while the tracker is off. Notifications are now only for job alerts and right-click saves.

## Package

Upload `store-assets/jobly-extension-1.2.0.zip`. To build it, run `npm run build` in `extension/`, then zip `extension/dist`.

| Field | Text |
| --- | --- |
| Name | `Jobly — Find jobs. Apply smarter` |
| Summary (121 of 132 characters) | `Fresh jobs with real posting dates from company career pages, a resume builder and autofill you review. Free, no account.` |

## Store listing tab

**Description**
```
Jobly finds fresh jobs on company career pages, with the date each one was really posted, and helps you apply. Free, no account, and everything stays in your browser.

FIND JOBS
• Real posting dates from the employer's own hiring system; nothing older than 60 days
• Jobs from 2,000+ companies, including Y Combinator startups and 300+ companies hiring in India
• Product design, frontend, product management, AI/ML and fullstack, plus backend, mobile, DevOps, QA, security, data, sales, marketing and more
• Filters for location, experience, salary, job type and date posted
• Dealbreakers: a salary floor and the job types you want
• Alerts for new matches, and for every new job at companies you follow
• Companies by country, sorted by name, open jobs or newest job

APPLY FASTER
• Save jobs, mark the ones you applied to, and keep both lists in one place
• A "Did you apply?" prompt after you open a job, and a warning when you already applied at that company
• Resume profiles with a one-click copy kit for application forms
• A resume builder with four templates, saved as PDF or Word
• Cover letter templates filled from your profile and the job
• Save any job from its page, from the popup or by right-clicking
• A fit check that compares a posting with your skills
• Autofill: Jobly fills the form on the tab you're on after you review every answer, and never presses Submit
• Find recruiters with your own Hunter key and draft outreach messages

PRIVATE BY DESIGN
• No account, no server, no tracking, no ads
• Your searches, saved and applied jobs, profiles and contacts stay in your browser; optional sync uses your own Chrome account
• Back up everything to one file, restore it, or import a spreadsheet of applications
• Reporting a listing or suggesting a company opens your email app; nothing is sent without you
• Jobly reads a page only when you click Save, Fit check or Autofill, and only that tab

GOOD TO KNOW
• Apply opens the original listing, usually the employer's own careers page
• Jobly isn't affiliated with the employers it lists

Free. Learn more at https://jobly-88t.pages.dev
```

**Category:** Productivity.

**Language:** English.

### Graphic assets

| Asset | Size | File |
| --- | --- | --- |
| Store icon | 128×128 | `store-assets/screenshots/ready/store-icon-128x128.png` |
| Screenshots (up to 5) | 1280×800 | `store-assets/screenshots/v1.2/` (demo data) |
| Small promo tile | 440×280 | `store-assets/screenshots/ready/promo-tile-1-440x280.png` |
| Marquee promo tile (optional) | 1400×560 | not made; text below |

### Screenshot content

All people and data shown are made up. Ananya Rao is a demo profile.

| # | File | Headline | Line under it | What it shows |
| --- | --- | --- | --- | --- |
| 1 | `1-jobs.png` | Fresh jobs, real posting dates | Every job comes from the employer's own hiring system, with the date it was posted. Nothing older than 60 days. | The job list "For you", role chips, match badges, Save, Mark applied and Apply |
| 2 | `2-companies.png` | 2,000+ companies, by country | Filter by where they hire, sort by name, open jobs or newest job, and follow the ones you like. | Companies filtered to India, sorted by open jobs |
| 3 | `3-saved.png` | Saved and applied, in one place | Mark a job as applied, or answer "Did you apply?" after you open it. | Saved › Applied with dates |
| 4 | `4-resume.png` | A resume in minutes | Four templates from one profile. Save it as PDF or Word. | The resume builder with the Modern template |
| 5 | `5-profile.png` | Fill applications faster | Keep your answers in a profile, copy any field in one click, or let autofill fill the form after you review it. | A profile with contact details, common questions and skills |

Spare shots: `6-cover-letter.png` and `popup-400x600.png`.

### Promo tile text
- **Small tile (440×280):** "Find jobs. Apply smarter" with the Jobly logo, unchanged.
- **Marquee (1400×560), if you make one:** headline "Find jobs posted this week. Apply in minutes." Line under it: "Fresh jobs from 2,000+ company career pages, a resume builder and autofill. Free, no account." No third-party logos.

### Additional fields

| Field | Value |
| --- | --- |
| Official URL | Leave empty (it needs a verified domain you own) |
| Homepage URL | `https://jobly-88t.pages.dev` |
| Support URL | `https://jobly-88t.pages.dev/support` |
| Mature content | No |

## Privacy practices tab

**Single purpose**
```
Jobly helps people find and apply for jobs: it lists recent jobs from company career pages with their real posting dates, alerts the user to new matches, and helps them complete applications (saved and applied lists, resume and cover letter tools, and autofill that the user reviews).
```

**Permission justifications**

| Permission | Justification |
| --- | --- |
| `storage` | Keeps the user's preferences, saved and applied jobs, alerts, resume profiles and contacts on their device. They go to Chrome sync only if the user turns sync on. |
| `notifications` | Shows a desktop notification for new matching jobs, and confirms when the user saves a job with the right-click menu. Job alerts can be switched off. |
| `alarms` | Schedules the background check for new jobs, every 60 to 90 minutes. |
| `activeTab` | When the user clicks Save, Fit check or Autofill in the popup, or the right-click menu item, Jobly reads (or fills) the job page in that one tab. No other tab or page is accessed. |
| `scripting` | Runs Jobly's packaged page-reading and form-filling functions in the active tab after the user clicks, using the activeTab grant. Jobly has no content scripts that run on their own. |
| `contextMenus` | Adds "Save this job to Jobly" to the page's right-click menu. |
| Host `https://jobly-data.pages.dev/*` | Reads Jobly's public job list, published as static files. Nothing is sent to it except the request for those files. |
| Optional host `https://api.hunter.io/*` | Requested only when the user searches for contacts with their own Hunter API key. |

**Remote code:** No, I am not using remote code.

**Data usage** (read Google's current wording before ticking)
- **Personally identifiable information:** yes. The user types their name, email, phone and work history into a profile. It is stored on their device and used to fill forms when they ask.
- **Authentication information:** yes. The user may store their own Hunter API key on their device to search contacts.
- **Website content:** yes. When the user clicks, Jobly reads the job page in the active tab (title, company, description) to save it, check fit or fill its form.
- **User activity:** no. Searches and filters run in the browser on the downloaded job files. Jobly has no server and sends them nowhere.
- Everything else: no.
- Usage: app functionality only. Not sold, not used for anything unrelated, not for credit.
- Tick all three certifications.

**Privacy policy URL:** `https://jobly-88t.pages.dev/privacy`

## Distribution tab

| Field | Value |
| --- | --- |
| Payments | Free of charge |
| Visibility | Public |
| Regions | All regions |

## Test instructions (for the reviewer)
```
No sign-in is needed. To test:
1. Open the popup, finish the welcome tour, and jobs appear. Press "Mark applied" on a job card (a check icon in the popup), then open Saved › Applied to see it.
2. Open the dashboard (popup header icon). The sidebar has Jobs, Companies, Saved, Profile, Resume, Cover letters and Contacts. The top-right icons are Alerts, theme, Refresh and Settings.
3. Companies: choose a country and a sort order.
4. Fill in a Profile, then open any job application page (for example a Greenhouse or Lever posting) and open the popup's Apply tab. Save the job, see the fit check, press "Autofill this page", review the answers and press Fill. Jobly never submits.
5. Right-click any job page and choose "Save this job to Jobly". It appears under Saved.
Contact search needs the reviewer's own Hunter API key and is optional. Report this listing and Suggest a company open the reviewer's email app; nothing is sent automatically.
```

## Checklist
1. Build and zip 1.2.0, then upload it.
2. Store listing: paste the description and upload the five screenshots from `v1.2/`. Keep the icon and the promo tile.
3. Additional fields: the homepage and support URLs above.
4. Privacy practices: single purpose, permission justifications (notifications and alarms changed), remote code "No", data usage, privacy policy URL.
5. Distribution: free, public, all regions.
6. Paste the test instructions, then submit for review.
