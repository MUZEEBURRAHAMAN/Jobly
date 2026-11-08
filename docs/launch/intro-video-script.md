# Jobly intro video: script and shot list

A 75-second screen recording with a voiceover, for the Chrome Web Store listing (YouTube link), the website, Product Hunt and social posts. Record it in the dashboard at 1440×900 in light mode, with the demo profile (Ananya Rao) and live job data. The scripts in `extension/e2e/store-screenshots.mjs` and `site-screenshots.mjs` set up the same demo state.

Keep the cursor slow. Cut between scenes; don't zoom more than 120%. Captions burned in, because most people watch without sound.

| # | Time | On screen | Voiceover | Caption |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:06 | The Jobs page loading: "Posted in 24 hours" counter, fresh cards with "1 day ago" | Most job sites show you jobs that closed weeks ago. Jobly doesn't. | Fresh jobs, real posting dates |
| 2 | 0:06–0:16 | Type "product designer" in search; cards show "100% match"; hover the badge to show its reasons | Jobly reads 2,000 company career pages every few hours, with the date each job was really posted, and shows how well each one fits you. | 2,000+ companies · match % on every job |
| 3 | 0:16–0:24 | Companies: pick India, sort by most open jobs; click View jobs | Filter companies by where they hire, follow the ones you like, and see every job they have open. | Companies by country |
| 4 | 0:24–0:34 | Profile › Import a file › choose a LinkedIn PDF; the "LinkedIn profile read" card; step through Contact | Set up your profile in a minute: import the PDF LinkedIn makes of your profile. It's read in your browser, never uploaded. | Your profile in a minute |
| 5 | 0:34–0:46 | Tailor for a job: paste a description, Check my resume, the 68% score, requirements Covered / Partly / Missing; tick a suggestion, score shows 82% | Paste a job description. Jobly shows what it asks for, which line of your resume covers each point, and how to close the gap. | A resume for each job |
| 6 | 0:46–0:54 | Write a cover letter for this job: the letter quoting the posting | Then a cover letter that answers exactly what the job asks for, with your own experience. | Cover letters that answer the job |
| 7 | 0:54–1:08 | A demo application page; open the popup, Start apply assist; the panel; press Fill; fields fill; "Earliest start date" marked; the cursor presses the site's Submit; "Did you submit?" → Yes | On the application, apply assist fills each step after you approve the answers, shows where each one came from, and marks what only you can answer. You always press Submit. | You approve. Jobly fills. You submit. |
| 8 | 1:08–1:15 | The Jobly logo, "Add to Chrome" button, the website address | Free, no account, and everything stays in your browser. Jobly. | Free · No account · jobly-88t.pages.dev |

## Rules for the recording

- Only demo data: the made-up profile (Ananya Rao), made-up companies on demo application pages (Northwind Labs, Acme). Real company names appear only in the live job list.
- No third-party logos as the subject of a shot (LinkedIn, Google). The LinkedIn PDF appears as a file name, not the LinkedIn site.
- Don't show the Anthropic key field with a key in it.
- Say "Free" only while it is free; don't say "open source", "AI applies for you" or "guaranteed".

## Shorter cuts

- **30 seconds (social):** scenes 1, 2, 5 and 7, voiceover lines trimmed to the captions.
- **15 seconds (Product Hunt gallery loop, no sound):** scene 7 only, captions on.
