# Chrome Web Store: Jobly 1.1.0

Everything to paste into the Chrome Web Store developer dashboard, tab by tab.

## Package

Upload `store-assets/jobly-extension-1.1.0.zip`. It's built by `npm run build` in `extension/`, then zipping `extension/dist`. It is version 1.1.0, above the 0.1.0 already used.

The name and summary come from the manifest:

| Field | Text |
| --- | --- |
| Name | `Jobly — Find jobs. Apply smarter` |
| Summary (113 of 132 characters) | `Fresh jobs with real posting dates, plus a job tracker, resume builder and autofill you review. Free, no account.` |

## Store listing tab

**Description**
```
Jobly finds fresh jobs on company career pages, with the date each one was really posted, and helps you all the way to the interview. Free, no account, and everything stays in your browser.

FIND JOBS
• Real posting dates from the employer's own hiring system; nothing older than 60 days
• Jobs from 2,000+ companies, including Y Combinator startups and 300+ companies hiring in India
• Product design, frontend, product management, AI/ML and fullstack, plus backend, mobile, DevOps, QA, security, data, sales, marketing and more
• Filters for location, experience, salary, job type and date posted
• Dealbreakers: a salary floor and the job types you want
• Alerts for new matches, and for every new job at companies you follow

TRACK EVERY APPLICATION
• A board for Saved, Applied, Interviewing, Offer and Closed
• Notes, follow-up reminders and a weekly goal
• A "Did you apply?" prompt after you open a job, so the tracker fills itself
• Interviews with prep checklists, ratings and a reminder an hour before
• Tasks with due dates
• Import a spreadsheet, export to CSV, back up everything to a file

APPLY FASTER
• Resume profiles with a one-click copy kit for application forms
• A resume builder with four templates, saved as PDF or Word
• Cover letter templates filled from your profile and the job
• Save any job from its page, from the popup or by right-clicking
• A fit check that compares a posting with your skills
• Autofill: Jobly fills the form on the tab you're on after you review every answer, and never presses Submit
• Find recruiters with your own Hunter key and draft outreach messages

PRIVATE BY DESIGN
• No account, no server, no tracking, no ads
• Your searches, tracker, profiles and contacts stay in your browser; optional sync uses your own Chrome account
• Reporting a listing or suggesting a company opens your email app; nothing is sent without you
• Jobly reads a page only when you click Save, Fit check or Autofill, and only that tab

GOOD TO KNOW
• Apply opens the original listing, usually the employer's own careers page
• Jobly isn't affiliated with the employers it lists

Free. Learn more at https://jobly-88t.pages.dev
```

**Category:** Productivity (or Tools if the dashboard offers that and not Productivity).

**Language:** English.

### Graphic assets

| Asset | Size | File |
| --- | --- | --- |
| Store icon | 128×128 | `store-assets/screenshots/ready/store-icon-128x128.png` |
| Screenshots (up to 5) | 1280×800 | `store-assets/screenshots/v1.1/` (version 1.1 screens, demo data); see below |
| Small promo tile | 440×280 | `store-assets/screenshots/ready/promo-tile-1-440x280.png` or `promo-tile-2-440x280.png` |
| Marquee promo tile (optional) | 1400×560 | not made yet; text suggestion below |

**Replace the old screenshots in `ready/`.** They show version 0.1.0 (only the job list). Screenshot 1 uses LinkedIn, Indeed and Glassdoor logos, which store review can object to. Screenshot 3 shows the old Netlify address, and screenshot 1 says "100+ jobs".

### Screenshot content

The raw 1.1 screens are in `store-assets/screenshots/v1.1/`. Upload them as they are, or place them in your Figma template with the headline and line below, in this order. All people and data shown are made up (Ananya Rao is a demo profile).

| # | File | Headline | Line under it | What it shows |
| --- | --- | --- | --- | --- |
| 1 | `1-jobs.png` | Fresh jobs, real posting dates | Every job comes from the employer's own hiring system, with the date it was posted. Nothing older than 60 days. | The job list "For you", role chips including Design & IT and More roles, match badges, Save, Track and Apply |
| 2 | `2-tracker.png` | Track every application | A board from Saved to Offer, follow-up reminders and a weekly goal, all in your browser. | The tracker board, weekly goal, response rate, follow-up and interview badges |
| 3 | `4-resume.png` | A resume in minutes | Four templates from one profile. Save it as PDF or Word. | The resume builder with the Modern template |
| 4 | `5-profile.png` | Fill applications faster | Keep your answers in a profile, copy any field in one click, or let autofill fill the form after you review it. | A profile with contact details, common questions and skills |
| 5 | `6-cover-letter.png` | Cover letters that start written | Templates filled from your profile and the job, ready to edit and copy. | The cover letter editor with a filled letter |

Spare shots: `3-interviews.png` (interviews with prep steps), `7-tasks.png` (to-dos and weekly goal) and `popup-400x600.png` (the toolbar popup, for a framed composition).

### Promo tile text
- **Small tile (440×280), existing:** "Find jobs. Apply smarter" with the Jobly logo. No changes needed.
- **Marquee (1400×560), if you make one:** headline "Find jobs posted this week. Apply in minutes." Line: "Fresh jobs from 2,000+ company career pages, a tracker, resume builder and autofill. Free, no account." No third-party logos.

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
Jobly helps people find and apply for jobs: it lists recent jobs from company career pages with their real posting dates, alerts the user to new matches, and helps them track and complete applications (tracker, interviews, resume and cover letter tools, and autofill that the user reviews).
```

**Permission justifications**

| Permission | Justification |
| --- | --- |
| `storage` | Keeps the user's preferences, saved jobs, alerts, application tracker, interviews, tasks, resume profiles and contacts on their device, and in Chrome sync only if the user turns sync on. |
| `notifications` | Shows a desktop notification for new matching jobs and for reminders the user sets (follow-ups, tasks due, interviews starting soon). Both can be switched off. |
| `alarms` | Schedules the background check for new jobs (every 60 to 90 minutes) and the check for due reminders (every 15 minutes, on-device only). |
| `activeTab` | When the user clicks Save, Fit check or Autofill in the popup, or the right-click menu item, Jobly reads (or fills) the job page in that one tab. No other tab or page is accessed. |
| `scripting` | Runs Jobly's packaged page-reading and form-filling functions in the active tab after the user clicks, using the activeTab grant. Jobly has no content scripts that run on their own. |
| `contextMenus` | Adds "Save this job to Jobly" to the page's right-click menu. |
| Host `https://jobly-data.pages.dev/*` | Reads Jobly's public job list, published as static files. Nothing is sent to it except the request for those files. |
| Optional host `https://api.hunter.io/*` | Requested only when the user searches for contacts with their own Hunter API key. |

The 1.1.0 package has no `identity` permission and no Google API access. A later build with Google Calendar import would add both.

**Remote code:** No, I am not using remote code.

**Data usage** (read Google's current wording before ticking)
- **Personally identifiable information:** yes. The user types their name, email, phone and work history into a profile, stored on their device and used to fill forms when they ask.
- **Authentication information:** yes. The user may store their own Hunter API key on their device to search contacts.
- **Website content:** yes. When the user clicks, Jobly reads the job page in the active tab (title, company, description) to save it, check fit or fill its form.
- **User activity:** no. Searches and filters are applied in the browser to the downloaded job files; Jobly has no server and sends them nowhere.
- Everything else: no.
- Usage: app functionality only. Not sold, not used for anything unrelated, not for credit.
- Tick all three certifications.

**Privacy policy URL:** `https://jobly-88t.pages.dev/privacy` (replace the old Netlify address)

## Distribution tab

| Field | Value |
| --- | --- |
| Payments | Free of charge |
| Visibility | Public |
| Regions | All regions |

## Test instructions (for the reviewer)
```
No sign-in is needed. To test:
1. Open the popup, finish the welcome tour, and jobs appear. Use Track on a job card to add it to the tracker.
2. Open the dashboard (popup header icon): Tracker, Interviews, Tasks, Profile, Resume, Cover letters, Contacts.
3. Fill in a Profile, then open any job application page (for example a Greenhouse or Lever posting), open the popup, Apply tab: Save to tracker, see the fit check, press "Autofill this page", review the answers and press Fill. Jobly never submits.
4. Right-click any job page: "Save this job to Jobly".
Contact search needs the reviewer's own Hunter API key and is optional. Report this listing and Suggest a company open the reviewer's email app; nothing is sent automatically.
```

## Checklist
1. Upload the zip.
2. Store listing: paste the description, then replace the screenshots with the five above and keep the icon and promo tile.
3. Additional fields: homepage `https://jobly-88t.pages.dev`, support `https://jobly-88t.pages.dev/support`.
4. Privacy practices: single purpose, permission justifications, remote code "No", data usage, privacy policy URL.
5. Distribution: free, public, all regions.
6. Paste the test instructions, then submit for review.
7. After approval: delete the old Netlify site and the Render service in those accounts.
