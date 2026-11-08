# Chrome Web Store: Jobly 1.4.0

Everything to paste into the Chrome Web Store developer dashboard, tab by tab. Version 1.4.0 replaces the 1.3.0 packet. If 1.3.0 is still in review, upload 1.4.0 as the next version; if it was never submitted, submit 1.4.0 instead.

## What changed from 1.3

- **Tailor for a job:** paste a job description to see what it asks for, which requirements the resume covers (with the line that shows each) and a coverage score. Accept suggested changes one by one and save a tailored resume for that job.
- **Cover letters from the job description**, quoting what the posting asks for with the user's own experience.
- **Optional AI:** Chrome's built-in model on the device, or Claude with the user's own API key. Every reworded line is checked against the profile.

## What changed from 1.1

- **Profile setup:** import the PDF LinkedIn makes of a profile, or a resume PDF, read in the browser. Six short steps follow, plus a completeness score.
- **Apply assist:** a panel on the application page fills each step from the profile after the user approves. Each answer shows its source, and questions only the user can answer are marked. Typed answers are remembered. It never presses Submit.

- The Tracker board, Interviews and Tasks are switched off. Applied jobs are a list under **Saved › Applied**.
- Settings, alerts, theme and refresh are icons at the top right of the dashboard. Backup and import are in **Settings › Your data**.
- Companies can be filtered by country and sorted by A–Z, Z–A, number of open jobs or newest job.
- Search matches titles, companies and places. "Design engineer" jobs in chips, RF and mechanical work no longer appear under product design.
- No reminder alarm while the tracker is off. Notifications are now only for job alerts and right-click saves.

## Package

Upload `store-assets/jobly-extension-1.4.0.zip`. To build it, run `npm run build` in `extension/`, then zip `extension/dist`.

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
• Set up your profile in a minute: import the PDF LinkedIn makes of your profile, or your resume, then check each step
• Tailor your resume to a job: see which requirements you cover, accept changes one by one, and save a version for that job
• Cover letters that answer what the job description asks for, with your own experience
• Apply assist: a Jobly panel on the application page fills each step from your profile after you approve the answers
• Every answer shows where it came from, questions only you can answer are marked, and answers you type once are remembered
• You always press Submit yourself; Jobly never does
• Save jobs, mark the ones you applied to, and keep both lists in one place
• A "Did you apply?" prompt after you open a job, and a warning when you already applied at that company
• Resume profiles with a one-click copy kit for application forms
• A resume builder with four templates, saved as PDF or Word
• Optional AI rewording with Chrome's built-in AI, or Claude with your own key; every line is checked against your profile
• Cover letter templates filled from your profile and the job
• Save any job from its page, from the popup or by right-clicking
• A fit check that compares a posting with your skills
• Find recruiters with your own Hunter key and draft outreach messages

PRIVATE BY DESIGN
• No account, no server, no tracking, no ads
• Your searches, saved and applied jobs, profiles and contacts stay in your browser; optional sync uses your own Chrome account
• Back up everything to one file, restore it, or import a spreadsheet of applications
• Reporting a listing or suggesting a company opens your email app; nothing is sent without you
• Jobly reads a page only when you click Save, Fit check or Start apply assist, and only that tab
• Imported PDFs are read in your browser and never uploaded

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
| Screenshots (up to 5) | 1280×800 | `store-assets/screenshots/v1.4/` (demo data) |
| Small promo tile | 440×280 | `store-assets/screenshots/ready/promo-tile-1-440x280.png` |
| Marquee promo tile (optional) | 1400×560 | not made; text below |

### Screenshot content

All people and data shown are made up. Ananya Rao is a demo profile.

| # | File | Headline | Line under it | What it shows |
| --- | --- | --- | --- | --- |
| 1 | `1-jobs.png` | Fresh jobs, real posting dates | Every job comes from the employer's own hiring system, with the date it was posted. Nothing older than 60 days. | The job list "For you", role chips, match badges, Save, Mark applied and Apply |
| 2 | `2-apply-assist.png` | Apply assist fills it with you | Each answer shows where it came from. You approve, Jobly fills, you press Submit. | The panel on a demo application form, answers from the profile ready for approval |
| 3 | `3-tailor.png` | A resume for each job | See what the job asks for, what your resume covers and with which line, then tailor it in a few clicks. | Tailor for a job: coverage score and each requirement with its evidence |
| 4 | `4-profile-setup.png` | Your profile in a minute | Import the PDF LinkedIn makes of your profile, or your resume. Read in your browser, never uploaded. | Profile setup after importing a LinkedIn PDF |
| 5 | `5-companies.png` | 2,000+ companies, by country | Filter by where they hire, sort by name, open jobs or newest job, and follow the ones you like. | Companies filtered to India, sorted by open jobs |

Spare shots: `6-saved.png`, `7-resume.png`, `8-profile.png`, `9-cover-letter.png` and `popup-400x600.png`. The application form in shot 2 and the posting in shot 3 are demo pages for made-up companies. Ananya Rao is a demo profile.

### Promo tile text
- **Small tile (440×280):** "Find jobs. Apply smarter" with the Jobly logo, unchanged.
- **Marquee (1400×560), if you make one:** headline "Find jobs posted this week. Apply in minutes." Line under it: "Fresh jobs from 2,000+ company career pages, LinkedIn import and apply assist. Free, no account." No third-party logos.

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
Jobly helps people find and apply for jobs: it lists recent jobs from company career pages with their real posting dates, alerts the user to new matches, and helps them complete applications (profile import from a LinkedIn or resume PDF, apply assist that fills forms after the user approves each answer, saved and applied lists, resumes and cover letters tailored to a job description).
```

**Permission justifications**

| Permission | Justification |
| --- | --- |
| `storage` | Keeps the user's preferences, saved and applied jobs, alerts, resume profiles, tailored resumes, saved form answers, contacts and optional API keys on their device. They go to Chrome sync only if the user turns sync on. |
| `notifications` | Shows a desktop notification for new matching jobs, and confirms when the user saves a job with the right-click menu. Job alerts can be switched off. |
| `alarms` | Schedules the background check for new jobs, every 60 to 90 minutes. |
| `activeTab` | When the user clicks Save, Fit check or Start apply assist in the popup, or the right-click menu item, Jobly reads the job page in that one tab, or opens its apply assist panel there to fill the answers the user approves. No other tab or page is accessed. |
| `scripting` | Runs Jobly's packaged page-reading code and its packaged apply assist panel (assist.js) in the active tab after the user clicks, using the activeTab grant. Jobly has no content scripts that run on their own. |
| `contextMenus` | Adds "Save this job to Jobly" to the page's right-click menu. |
| Host `https://jobly-data.pages.dev/*` | Reads Jobly's public job list, published as static files. Nothing is sent to it except the request for those files. |
| Optional host `https://api.hunter.io/*` | Requested only when the user searches for contacts with their own Hunter API key. |

**Remote code:** No, I am not using remote code. (Optional AI calls to api.anthropic.com send text and receive text; no code is downloaded or run.)

**Data usage** (read Google's current wording before ticking)
- **Personally identifiable information:** yes. The user types or imports (from their own LinkedIn or resume PDF, read on the device) their name, email, phone and work history into a profile. It is stored on their device and used to fill forms when they approve. Answers they type into forms are saved on the device, except sensitive questions.
- **Authentication information:** yes. The user may store their own Hunter API key (contact search) and Anthropic API key (optional AI rewording) on their device. Each is used only to call that service from the browser, and never leaves the device otherwise.
- **Website content:** yes. When the user clicks, Jobly reads the job page in the active tab (title, company, description, form questions) to save it, check fit or fill its form.
- **User activity:** no. Searches and filters run in the browser on the downloaded job files. Jobly has no server and sends them nowhere.
- **Personal communications / other:** no.
- Note for the form: when the user turns on Claude, the profile text needed for a rewrite and the pasted job description go to Anthropic with the user's own key, at their request. Disclose this as data shared with a third party for app functionality, chosen by the user.
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
1. Open the popup, finish the welcome tour, and jobs appear. Press "Mark applied" on a job card (a check icon in the popup), then open Saved › Applied.
2. Open the dashboard (popup header icon) and go to Profile, then "Set up your profile". Import any PDF resume, or fill in the steps by hand. The completeness score updates as you go.
3. Open any job application page (for example a Greenhouse or Lever posting). Open the popup, go to Apply and press "Start apply assist". A Jobly panel opens on the page: review the answers, press Fill, and answer the questions marked "Action required". Jobly never presses Next or Submit.
4. Companies: choose a country and a sort order.
5. Right-click any job page and choose "Save this job to Jobly". It appears under Saved.
6. Tailor for a job: paste any job description and press "Check my resume" (it works without AI). Optional AI needs your own Anthropic key or Chrome's built-in AI; Settings › AI.
Contact search needs the reviewer's own Hunter API key and is optional. Report this listing and Suggest a company open the reviewer's email app; nothing is sent automatically.
```

## Checklist
1. Upload the 1.4.0 zip.
2. Store listing: paste the description and upload the five screenshots from `v1.4/`. Keep the icon and the promo tile.
3. Additional fields: the homepage and support URLs above.
4. Privacy practices: single purpose, permission justifications (activeTab, scripting, notifications and alarms changed), remote code "No" (assist.js is packaged in the zip), data usage, privacy policy URL.
5. Distribution: free, public, all regions.
6. Paste the test instructions, then submit for review.
