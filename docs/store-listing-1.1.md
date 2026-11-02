# Chrome Web Store: Jobly 1.1.0

Upload `store-assets/jobly-extension-1.1.0.zip` (built by `npm run build` in `extension/`, then zipping `extension/dist`). The name and summary come from the manifest.

**Summary (from the manifest, 118 of 132 characters)**
Fresh tech jobs with real posting dates, plus a job tracker, resume builder and autofill you review. Free, no account.

## Description

```
Jobly finds fresh tech jobs on company career pages, with the date each one was really posted, and helps you all the way to the interview. Free, no account, and everything stays in your browser.

FIND JOBS
• Real posting dates from the employer's own hiring system; nothing older than 60 days
• Product design, frontend, product management, AI/ML and fullstack roles from 2,000+ companies, including Y Combinator startups
• More roles: QA, security, data, DevOps, sales, marketing, operations and more
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
• No account, no tracking, no ads
• Your tracker, profiles and contacts stay in your browser; optional sync uses your own Chrome account
• Jobly reads a page only when you click Save, Fit check or Autofill, and only that tab

GOOD TO KNOW
• Apply opens the original listing, usually the employer's own careers page
• Jobly isn't affiliated with the employers it lists

Free. Learn more at https://jobly-88t.pages.dev
```

## Privacy practices tab

**Single purpose**
```
Jobly helps people find and apply for tech jobs: it lists recent jobs from company career pages with their real posting dates, alerts the user to new matches, and helps them track and complete applications (tracker, interviews, resume and cover letter tools, and autofill that the user reviews).
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
| Host `https://jobly-yd6l.onrender.com/*` | Jobly's own server: a fallback for the job list if the static files can't be reached. |
| Optional host `https://api.hunter.io/*` | Requested only when the user searches for contacts with their own Hunter API key. |

If a later build includes Google Calendar import, it also asks for `identity` (sign in to Google to read upcoming events, read-only) and the optional host `https://www.googleapis.com/*`. The 1.1.0 package doesn't include them.

**Remote code:** No.

**Data usage** (read Google's current wording before ticking)
- **Personally identifiable information:** yes. The user types their name, email, phone and work history into a profile, stored on their device and used to fill forms when they ask.
- **Authentication information:** yes. The user may store their own Hunter API key on their device to search contacts.
- **Website content:** yes. When the user clicks, Jobly reads the job page in the active tab (title, company, description) to save it, check fit or fill its form.
- **User activity:** yes. Jobs are filtered in the browser from the static job files; only if those can't be reached are search words and filters sent to Jobly's server to return jobs.
- Everything else: no.
- Usage: app functionality only. Not sold, not used for anything unrelated, not for credit.
- Tick all three certifications.

**Privacy policy URL:** https://jobly-88t.pages.dev/privacy (live; replace the old Netlify address in the dashboard)

## Notes for the reviewer
```
No sign-in is needed. To test:
1. Open the popup, finish the welcome tour, and jobs appear. Use Track on a job card to add it to the tracker.
2. Open the dashboard (popup header icon): Tracker, Interviews, Tasks, Profile, Resume, Cover letters, Contacts.
3. Fill in a Profile, then open any job application page (for example a Greenhouse or Lever posting), open the popup, Apply tab: Save to tracker, see the fit check, press "Autofill this page", review the answers and press Fill. Jobly never submits.
4. Right-click any job page: "Save this job to Jobly".
Contact search needs the reviewer's own Hunter API key and is optional. 
```

## Before submitting
1. In the dashboard, set the privacy policy URL and the homepage to the Cloudflare address above.
2. Store images are ready in `store-assets/screenshots/ready/` (five 1280x800 screenshots, two 440x280 promo tiles, the 128x128 store icon).
3. Upload the zip, update the description, the permission justifications (including the new `jobly-data.pages.dev` host) and the data-usage answers above.
