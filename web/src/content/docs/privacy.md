---
title: Privacy policy
eyebrow: Privacy
description: What Jobly keeps on your device, what it downloads, and what it never collects. No account, no server, no analytics, no tracking.
updated: 2026-11-12
figure: padlock
---

> **The short version.** Jobly has no accounts and no analytics. Your preferences, saved and applied jobs, profiles and contacts stay in your browser. To show you jobs, the extension downloads Jobly's public job files and filters them in your browser. It reads a web page only when you click to save that job, check your fit or autofill its form. Optional connections (Chrome sync, Claude with your own key, Brave Search, Apollo, Hunter) are off until you turn them on, and talk to those services directly. Jobly has no server of its own, so nothing passes through it. We don't build a profile of you, and we don't sell or share data.

## What Jobly is

Jobly is a Chrome extension, plus this website, that lists public job postings collected from company career pages and job boards. The extension has one purpose: helping you find relevant jobs and apply on the original listing.

## What stays on your device

The extension keeps these in your browser's extension storage. Jobly never uploads them anywhere:

- **Your preferences:** roles, experience levels, remote only, keywords to include or exclude, and whether desktop alerts are on.
- **Your lists:** jobs you save, new-match alerts found by the background check, companies you mute or follow, and a cached copy of recent results so the extension opens instantly.
- **Your applications:** jobs you saved from a careers page or marked as applied, with the date and any notes. (Earlier versions also kept interviews, tasks and follow-up reminders; those features are switched off for now, and anything already kept stays on your device.)
- **Your profiles:** the details you enter for applications (name, contact details, links, experience, education, skills, answers to common questions), an optional resume file, and the resume template you chose.
- **Your saved answers:** what you typed into application questions your profile doesn't cover, so apply assist can fill them next time. Questions about gender, ethnicity, disability, veteran status, date of birth or ID numbers are never saved. You can delete each one on the Profile page.
- **Imported PDFs:** when you import your LinkedIn PDF or resume, it is read inside the extension and the details go into your profile. The file is kept only if you choose to attach it as your resume.
- **Your contacts:** recruiters and hiring managers you save, and whether you contacted them.
- **Keys you add:** your own Brave Search, Apollo, Hunter and Anthropic API keys, if you add them. They are never included in backups.
- **Tailored resumes:** the versions you save for a job, with the job description you pasted.
- **Small settings:** your theme and whether you have seen the welcome tour. The theme uses Chrome's sync storage, so Chrome may copy it to your other devices through your Google account.

You can export all of this as a file from Settings (Download a backup) and import it again; the file is created on your computer and goes nowhere else.

Uninstalling the extension removes all of this from your device.

## How the extension gets jobs

Jobly has no server of its own. The job list is published as public files on Cloudflare Pages: the same files for everyone, refreshed every few hours. The extension downloads the files it needs and does every search, filter and preference match in your browser.

Your search words, filters and preferences are never sent anywhere. Cloudflare's short-lived request logs show which files were downloaded (for example, the file for one role category and posting age), as described under [Services involved](#services-involved).

If you use **Report this listing**, the extension opens your email app with the job, its link, the reason you chose and any note you typed. Nothing is sent unless you send that email, and we then receive it like any other email (see [Forms you can send us](#forms-you-can-send-us)). **Suggest a company** works the same way.

## Reading the page you're on

The extension can read a web page only when you ask, and only the tab you're on:

- **Save this job** (from the popup or by right-clicking a page) reads the job's title, company, location, date, salary and the page address.
- **Fit check** reads the job description to compare it with the skills in your profile.
- **Autofill** lists the form's questions, shows you its proposed answers from your profile, and fills only the ones you approve. It never presses Submit, and never touches password fields.

This happens in your browser. Nothing read from the page leaves it. Chrome grants this access for that one tab when you click (the "activeTab" permission), so Jobly can't read pages in the background.

## Optional connections

Each is off until you turn it on, and each talks to that service straight from your browser:

- **Chrome sync:** copies your preferences, saved and applied jobs and profiles to Chrome on your other computers through your Google account. Google stores it under Chrome's sync terms; Jobly never sees it.
- **Chrome's built-in AI:** if you choose it in Settings › AI, rewording your resume and drafting letters runs on Chrome's own model on your computer. Nothing is sent anywhere.
- **Claude (Anthropic), with your own API key:** if you choose it, the text needed for a rewrite (your profile's headline, summary, skills and experience, and the job description you pasted) is sent from your browser to Anthropic with your key, only when you press Reword with AI or Write with AI. Anthropic's own terms and privacy policy apply, and Anthropic charges your account. Your key stays on this device and is never in backups or sync.
- **Brave Search (profiles):** when you press Find profiles, Jobly sends a search made of the company name, the kind of person (for example "design manager") and a site (for example linkedin.com/in) to the Brave Search API with your own key. Brave returns public pages from its search index; Jobly shows them and doesn't open or read those pages. Brave's own privacy policy applies.
- **Apollo (who works there):** when you press Who works there, Jobly sends the company's web domain and job titles to Apollo with your own key. Apollo returns first names and job titles. Apollo's own privacy policy applies.
- **Hunter (contacts):** when you search a company's domain, Jobly sends that domain and your own Hunter API key to Hunter, which returns publicly listed work contacts. Hunter's own privacy policy applies to that search.

## This website

- No cookies, no analytics, no advertising or tracking scripts. Fonts are served from this site, not from a font service.
- Your theme choice is saved in your browser's local storage so the page doesn't flash the wrong colours.
- Some pages show live numbers, the list of companies and the latest jobs for a role. Your browser downloads them from Jobly's public job files, the same way the extension does; nothing about you is sent.

## Forms you can send us

Two forms on this site help you write to us. Both are optional. Neither sends anything by itself: they open your own email app with the message filled in, and you send it like any other email.

- **Support form:** your email address and your message, plus your name if you give it. We use them only to reply.
- **Uninstall feedback:** after you uninstall the extension, Chrome opens a short page asking why. The reason you pick and any note you type are sent. It asks for no email and the page has no identifier linking it to you.

Because the message is an ordinary email, we see the address you send it from and whatever your email provider adds. Nothing goes through this website's servers.

We delete form messages once we have dealt with them, and at the latest after 12 months. Deleting is done by hand, so if you'd like your message removed sooner, write to us and we will.

## What we never do

- Ask for your name, email or account details to use Jobly.
- Use analytics, advertising or tracking scripts, in the extension or on this site.
- Sell or rent data, or use it for credit, lending or anything unrelated to finding jobs.
- Read the pages you browse in the background. The extension reads a page only when you click to save, check or autofill it, and it has no access to your browsing history.

## Services involved

| Service | Why | What it can see |
| --- | --- | --- |
| Cloudflare Pages | Hosts this website, Jobly Studio and Jobly's public job files | Short-lived technical logs such as IP address, time and the file requested |
| Google favicon service (t2.gstatic.com) | Shows company logos in the extension | The company domains your browser asks logos for, and your IP address |
| Chrome Web Store and your Google account | Installing and updating the extension, Chrome sync if you turn it on | Covered by Google's own policies |
| Brave Search (only if you add your own key) | Finding public profile pages | The company name, kind of person and site you search, and your API key |
| Apollo (only if you add your own key) | Who works at a company | The company domain and job titles you search, and your API key |
| Hunter (only if you add your own key) | Finding contacts at a company | The company domain you search and your API key |

## Where your data goes

This website, Jobly Studio and the job files are served from Cloudflare's network, so requests from other countries can cross borders. Cloudflare says it relies on the EU-U.S. Data Privacy Framework and the European Commission's standard contractual clauses for such transfers. Almost nothing that identifies you is stored: your preferences stay in your browser, and the only things we keep are messages you choose to send us.

## Your rights

You can ask us what we hold about you, to correct it, or to delete it. Because we keep so little (only the emails you send us: reports, suggestions and form messages), this usually means finding and removing a message. Write to the address below and we will answer within 30 days. If you are in the EU or UK you can also complain to your data protection authority.

## Permissions the extension asks for

- **storage:** keep the items above on your device (and in Chrome sync, if you turn it on).
- **notifications:** show job alerts, and confirm when you save a job with the right-click menu.
- **alarms:** check for new jobs every so often in the background.
- **activeTab and scripting:** read the page you're on when you click Save or Fit check, and open the apply assist panel on it when you click Start apply assist. The panel fills only the answers you approve and never presses Submit.
- **contextMenus:** the right-click "Save this job to Jobly" item.
- **Access to jobly-data.pages.dev:** download Jobly's public job files.
- **Optional access to Brave Search, Apollo and Hunter:** each requested the first time you use it; nothing is requested otherwise.

The [security page](/security) has the full permission list and how data moves.

## Your choices

- Turn desktop alerts and reminders off, and remove saved jobs, applications, profiles, contacts or muted companies in the app.
- Turn Chrome sync off in Settings, or remove your Brave Search, Apollo or Hunter key in Settings.
- Uninstall the extension to remove everything it stored on your device.
- Ask us to see or delete a report or form message you sent: write to the address below.

## Chrome Web Store User Data Policy

Jobly's use of information adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Children

Jobly is not directed at children under 13 and does not knowingly collect their information.

## Changes

If this policy changes we update the date at the top. For important changes we also say so in the extension's release notes and on the [roadmap](/roadmap).

## Contact

Questions or requests: [rahamanmuzeeb1108@gmail.com](mailto:rahamanmuzeeb1108@gmail.com), or use the [support form](/support).
