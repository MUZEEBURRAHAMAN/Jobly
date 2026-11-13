# Chrome Web Store: Jobly 1.5.0

Everything to paste into the Chrome Web Store developer dashboard, tab by tab. Version 1.5.0 replaces the 1.4.0 packet. If 1.4.0 is still in review, upload 1.5.0 as the next version; if 1.4.0 was never submitted, submit 1.5.0 instead.

## What changed from 1.4

- **Apply queue (new Applications page).** Add jobs to a queue. Press Start and Jobly opens each one in a background tab. It presses the page's own Apply link if the form is behind it, then fills the form from the profile, the resume file and saved answers. It lists the questions it couldn't answer under "Needs your input" and stops. The user checks the form and presses Submit, and the job moves to Applied. Jobly never presses Submit or Next, never signs in, and never creates accounts on hiring sites.
- **Site access only when asked.** The queue needs to open the job sites in it. Chrome asks for access to just those sites when the user presses Start. This is the new optional `https://*/*` host permission; nothing is granted at install.
- **New Jobs page.** Filter pills, cleaner job cards with "Add to queue", and the chosen job open in a panel beside the list, with fit, details and the full description.
- **Resume.**
  - 8 templates, all one column, so every one reads cleanly in an applicant tracking system. The new Engineer template is a classic tech resume.
  - Projects, achievements, grouped skills and **bold** words in points.
  - A score in five parts with the top fixes, and an ATS check of what a hiring system reads. Rules only, no AI.
  - Tailor to a pasted job description on the same page.
  - A clean one-page PDF with no browser header or footer.
  - The page is now in three tabs: Design, Tailor to a job, and Score and ATS.
- **Cover letters.** Seven structures, three tones, three lengths, optional personal details, a letter check and a clean PDF.
- **People.** Find public profiles with the user's own Brave Search key, and see who works at a company with the user's own Apollo key, as well as Hunter. These are official APIs; nothing is scraped.
- **Look.** Black, white and greys across the extension.
- **Jobs.** "Best match first" sorting, and better country detection for job locations.

## Package

Upload `store-assets/jobly-extension-1.5.0.zip` (30 files, 1.5.0). To rebuild it, run `npm run build` in `extension/`, then zip the contents of `extension/dist` without `.map` files.

| Field | Text |
| --- | --- |
| Name | `Jobly — Find jobs. Apply smarter` |
| Summary (121 of 132 characters) | `Fresh jobs from company career pages, an apply queue that fills forms for you to check and submit, and ATS-ready resumes.` |

## Store listing tab

**Description**
```
Jobly finds fresh jobs on company career pages, with the date each one was really posted, and helps you apply. Free, no account, and everything stays in your browser.

FIND JOBS
• Real posting dates from the employer's own hiring system; nothing older than 60 days
• Jobs from 2,000+ companies, including Y Combinator startups and 300+ companies hiring in India
• Product design, frontend, product management, AI/ML and fullstack, plus backend, mobile, DevOps, QA, security, data, sales, marketing and more
• Filters for date posted, location, level, job type and salary, and best match first
• Open any job beside the list: how it fits you, pay, level and the full description
• Alerts for new matches, and for every new job at companies you follow

APPLY QUEUE
• Add jobs to your queue and press Start
• Jobly opens each job in a background tab, finds the application form and fills it from your profile, your resume file and answers you saved
• Questions it can't answer are collected in one place; what you type there is saved for the next form
• It stops before Submit: you check each form and press Submit yourself
• Jobly never signs in for you, never creates accounts on hiring sites and never solves CAPTCHAs
• Chrome asks you for access to just the sites in your queue, when you press Start

APPLY ASSIST
• On any application page, a Jobly panel fills each step from your profile after you approve the answers
• Every answer shows where it came from, and questions only you can answer are marked

RESUMES AND COVER LETTERS
• Set up your profile in a minute: import the PDF LinkedIn makes of your profile, or your resume
• 8 one-column templates that read cleanly in applicant tracking systems, with projects, achievements and grouped skills
• A resume score in five parts with the fixes that matter most, and an ATS check of what a hiring system reads
• Tailor your resume to a pasted job description: the skills and points the job asks for come first; nothing is made up
• A clean one-page PDF, or a Word file
• Cover letters in seven structures, three tones and three lengths, with a check before you send
• Optional AI rewording with Chrome's built-in AI, or Claude with your own key; every line is checked against your profile

PEOPLE
• Find recruiters and hiring managers with your own Hunter, Brave Search or Apollo key, and draft outreach messages
• Keep references and contacts with the jobs they belong to

PRIVATE BY DESIGN
• No account, no server, no tracking, no ads
• Your searches, saved and applied jobs, profiles, resumes and contacts stay in your browser; optional sync uses your own Chrome account
• Back up everything to one file, restore it, or import a spreadsheet of applications
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
| Screenshots (5) | 1280×800 | `store-assets/screenshots/v1.5/` |
| Small promo tile | 440×280 | `store-assets/screenshots/ready/promo-tile-1-440x280.png` |

### Screenshot content

The jobs in shot 1 are real listings from Jobly's job data. Everything else is made up: Ananya Rao is a demo profile, and the queued companies (Globex, Initech, Hooli, Acme, Northwind Labs, Umbrella) and the application form in shot 3 are demo pages.

| # | File | Headline | What it shows |
| --- | --- | --- | --- |
| 1 | `1-jobs.png` | Fresh jobs, real posting dates. | The Jobs page: filter pills, job cards with Add to queue, the chosen job open beside the list |
| 2 | `2-apply-queue.png` | Queue the jobs. Jobly fills them. | Applications: Needs your input and the board from Queue to Submitted |
| 3 | `3-apply-assist.png` | You approve. Jobly fills. You submit. | The apply assist panel on a demo application form |
| 4 | `4-resume.png` | A resume that reads cleanly. | Resume: the ATS check, the score and the page |
| 5 | `5-people.png` | Reach the people who hire. | People: who to look for at a company, and saved people |

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
Jobly helps people find and apply for jobs: it lists recent jobs from company career pages with their real posting dates, alerts the user to new matches, and helps them complete applications (profile import, an apply queue and apply assist that fill forms for the user to check and submit, saved and applied lists, resumes and cover letters tailored to a job description).
```

**Permission justifications**

| Permission | Justification |
| --- | --- |
| `storage` | Keeps the user's preferences, saved and applied jobs, alerts, apply queue, resume profiles, saved form answers, contacts and optional API keys on their device. They go to Chrome sync only if the user turns sync on. |
| `notifications` | Shows a desktop notification for new matching jobs, and confirms when the user saves a job with the right-click menu. Job alerts can be switched off. |
| `alarms` | Schedules the background check for new jobs (every 60 to 90 minutes), and checks every 30 seconds whether an apply-queue tab has stopped responding, but only while the queue is running. |
| `activeTab` | When the user clicks Save, Fit check or Start apply assist, or uses the right-click menu, Jobly reads the job page in that one tab or opens its apply assist panel there. |
| `scripting` | Runs Jobly's packaged page-reading code and its packaged apply assist panel (assist.js). It runs in the active tab after the user clicks, and in apply-queue tabs on sites the user granted when pressing Start. Jobly has no content scripts that run on their own. |
| `contextMenus` | Adds "Save this job to Jobly" to the page's right-click menu. |
| Host `https://jobly-data.pages.dev/*` | Reads Jobly's public job list, published as static files. Nothing is sent to it except the request for those files. |
| Optional host `https://*/*` | Requested only when the user presses Start on the apply queue, and only for the sites of the jobs in their queue (for example `https://boards.greenhouse.io/*`). Jobly opens those job pages in background tabs and fills the application form with the user's profile for them to check and submit. Nothing is granted at install, and no other site is accessed. |
| Optional host `https://api.hunter.io/*` | Requested only when the user searches for contacts with their own Hunter API key. |
| Optional host `https://api.search.brave.com/*` | Requested only when the user searches for public profiles with their own Brave Search API key. |
| Optional host `https://api.apollo.io/*` | Requested only when the user looks up who works at a company with their own Apollo API key. |

**Remote code:** No, I am not using remote code. assist.js is packaged in the zip. Optional AI calls to api.anthropic.com send text and receive text; no code is downloaded or run.

**Data usage** (read Google's current wording before ticking)
- **Personally identifiable information:** yes. The user types or imports a profile from their own LinkedIn or resume PDF, read on the device: name, email, phone and work history. It is stored on their device and used to fill application forms. In the apply queue, forms are filled automatically on sites the user granted; the user checks every form and presses Submit themselves. Answers the user types are saved on the device, except sensitive questions.
- **Authentication information:** yes. The user may store their own Hunter, Brave Search, Apollo and Anthropic API keys on their device. Each key is used only to call that service from the browser. Jobly never stores passwords for hiring sites.
- **Website content:** yes. Jobly reads the job page in the active tab when the user clicks, and the application pages in apply-queue tabs on sites the user granted (title, company, form questions), to save the job, check fit or fill its form.
- **User activity:** no. Searches and filters run in the browser on the downloaded job files. Jobly has no server and sends them nowhere.
- **Personal communications / other:** no.
- Note for the form: some data goes to third parties at the user's request, with the user's own keys. These are app functionality, chosen by the user.
  - With Claude turned on, the profile text needed for a rewrite and the pasted job description go to Anthropic.
  - A people search sends the company name and the role searched for to Brave Search or Apollo.
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
No sign-in is needed.
1. Open the popup, finish the welcome tour, and jobs appear. Open the dashboard (popup header icon). On Jobs, click a job card: it opens in the panel on the right.
2. Profile: press "Set up your profile" and import any PDF resume, or fill in the steps by hand.
3. Apply queue: on a few job cards press "Add to queue", then open Applications and press Start. Chrome asks for access to just those job sites; allow it. Jobly opens each job in a background tab, fills what it knows and stops. Unanswered questions appear under "Needs your input". Open a tab with "Review and submit" to check the form. Jobly never presses Submit; you may close the tab instead of submitting.
4. Apply assist: on any application page (for example a Greenhouse or Lever posting), open the popup, go to Apply and press "Start apply assist".
5. Resume: pick a template on Design, paste any job description on "Tailor to a job" and press "Apply to my resume", then see "Score and ATS". Download PDF saves a clean one-page PDF.
6. Cover letters, People and Companies work without keys; Hunter, Brave Search, Apollo and Claude are optional and need the reviewer's own keys.
```

## Checklist
1. Upload `store-assets/jobly-extension-1.5.0.zip`.
2. Store listing: paste the summary and description, and upload the five screenshots from `v1.5/`. Keep the icon and the promo tile.
3. Privacy practices:
   - Update the single purpose.
   - Add the justifications for the new optional hosts: `https://*/*`, Brave Search and Apollo.
   - Update the alarms and scripting justifications.
   - Remote code stays "No".
   - Update data usage.
4. Distribution: free, public, all regions.
5. Paste the test instructions, then submit for review. The optional `https://*/*` access may mean a longer review.
