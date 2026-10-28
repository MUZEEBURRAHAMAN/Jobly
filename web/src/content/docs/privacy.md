---
title: Privacy policy
eyebrow: Privacy
description: What Jobly keeps on your device, what it sends to its server, and what it never collects. No account, no analytics, no tracking.
updated: 2026-10-28
figure: padlock
---

> **The short version.** Jobly has no accounts and no analytics. Your preferences, saved jobs, tracker, profiles and contacts stay in your browser. To show you jobs, the extension downloads Jobly's public job files and filters them in your browser. It reads a web page only when you click to save that job, check your fit or autofill its form. Optional connections (Chrome sync, Google Calendar, Hunter) are off until you turn them on, and talk to those services directly, never through Jobly's server. We don't build a profile of you, and we don't sell or share data.

## What Jobly is

Jobly is a Chrome extension, plus this website, that lists public job postings collected from company career pages and job boards. The extension has one purpose: helping you find relevant jobs and apply on the original listing.

## What stays on your device

The extension keeps these in your browser's extension storage. They are never uploaded to Jobly's server:

- **Your preferences:** roles, experience levels, remote only, keywords to include or exclude, and whether desktop alerts are on.
- **Your lists:** jobs you save, new-match alerts found by the background check, companies you mute or follow, and a cached copy of recent results so the extension opens instantly.
- **Your tracker:** applications and their status, notes, dates and follow-up reminders; interviews with their checklists and ratings; tasks and your weekly goal.
- **Your profiles:** the details you enter for applications (name, contact details, links, experience, education, skills, answers to common questions), an optional resume file, and the resume template you chose.
- **Your contacts:** recruiters and hiring managers you save, and whether you contacted them.
- **Keys you add:** your own Hunter API key, if you add one. It is never included in backups.
- **Small settings:** your theme and whether you have seen the welcome tour. The theme uses Chrome's sync storage, so Chrome may copy it to your other devices through your Google account.

You can export all of this as a file from the Tracker (Backup) and import it again; the file is created on your computer and goes nowhere else.

Uninstalling the extension removes all of this from your device.

## What the extension sends to Jobly's server

When you browse, search or filter, the extension asks Jobly's server for jobs. Each request can include your search words, the filters you picked, and, so the server can pick jobs that fit you, your roles, experience levels, remote-only setting and keywords.

The server uses this only to answer that request. To stay fast, it keeps identical requests in memory for about two minutes. It does not write them to a database, keep an access log of them, or link them to you. The hosting provider's short-lived request logs can include them, as described under [Services involved](#services-involved).

To stop abuse, the server also counts requests per IP address. It holds the address in memory for up to a minute for that count; it is never written to a database or a file.

If you use **Report this listing**, we store the job, the reason you chose and any note you typed (up to 500 characters). Reports are not linked to you.

## Reading the page you're on

The extension can read a web page only when you ask, and only the tab you're on:

- **Save this job** (from the popup or by right-clicking a page) reads the job's title, company, location, date, salary and the page address.
- **Fit check** reads the job description to compare it with the skills in your profile.
- **Autofill** lists the form's questions, shows you its proposed answers from your profile, and fills only the ones you approve. It never presses Submit, and never touches password fields.

This happens in your browser. Nothing read from the page is sent to Jobly's server. Chrome grants this access for that one tab when you click (the "activeTab" permission), so Jobly can't read pages in the background.

## Optional connections

Each is off until you turn it on, and each talks to that service straight from your browser:

- **Chrome sync:** copies your preferences, tracker, interviews, tasks and profiles to Chrome on your other computers through your Google account. Google stores it under Chrome's sync terms; Jobly's server never sees it.
- **Google Calendar:** when you click Import, Jobly reads your upcoming calendar events (read-only) to find interviews, and saves the ones you choose. Calendar data is not sent anywhere else and Jobly cannot change your calendar.
- **Hunter (contacts):** when you search a company's domain, Jobly sends that domain and your own Hunter API key to Hunter, which returns publicly listed work contacts. Hunter's own privacy policy applies to that search.

## This website

- No cookies, no analytics, no advertising or tracking scripts. Fonts are served from this site, not from a font service.
- Your theme choice is saved in your browser's local storage so the page doesn't flash the wrong colours.
- Some pages show live numbers, the list of companies and the latest jobs for a role. Your browser fetches them from Jobly's server, the same way the extension does, without sending any preferences.

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
| Render (hosting) and Cloudflare (network) | Runs Jobly's server | Short-lived technical logs such as IP address, time and the address requested (which can include your search words) |
| Cloudflare Pages | Hosts this website, Jobly Studio and Jobly's public job files | Short-lived technical logs such as IP address, time and the address requested |
| Google favicon service (t2.gstatic.com) | Shows company logos in the extension | The company domains your browser asks logos for, and your IP address |
| Chrome Web Store and your Google account | Installing and updating the extension, Chrome sync if you turn it on, Google Calendar if you connect it | Covered by Google's own policies |
| Hunter (only if you add your own key) | Finding contacts at a company | The company domain you search and your API key |

## Where your data goes

Jobly's server (Render, with Cloudflare in front) run in the United States, and this website and the job files are served from Cloudflare's network, so requests from other countries can cross borders. Cloudflare says it relies on the EU-U.S. Data Privacy Framework and the European Commission's standard contractual clauses for such transfers. Almost nothing that identifies you is stored: your preferences stay in your browser, and the only things we keep are messages you choose to send us.

## Your rights

You can ask us what we hold about you, to correct it, or to delete it. Because we keep so little (only the messages you send through the forms), this usually means finding and removing a message. Write to the address below and we will answer within 30 days. If you are in the EU or UK you can also complain to your data protection authority.

## Permissions the extension asks for

- **storage:** keep the items above on your device (and in Chrome sync, if you turn it on).
- **notifications:** show job alerts and your reminders for follow-ups, tasks and interviews.
- **alarms:** check for new jobs and due reminders every so often in the background.
- **activeTab and scripting:** read or fill the page you're on, only when you click Save, Fit check or Autofill.
- **contextMenus:** the right-click "Save this job to Jobly" item.
- **identity:** sign in to Google Calendar when you choose to import interviews (only in versions where calendar import is available).
- **Access to Jobly's server:** fetch job listings.
- **Optional access to Hunter (and Google's API where calendar import is available):** requested the first time you use contact search or calendar import; nothing is requested otherwise.

The [security page](/security) has the full permission list and how data moves.

## Your choices

- Turn desktop alerts and reminders off, and remove saved jobs, applications, profiles, contacts or muted companies in the app.
- Turn Chrome sync off in Preferences, disconnect Google Calendar, or remove your Hunter key in Preferences.
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
