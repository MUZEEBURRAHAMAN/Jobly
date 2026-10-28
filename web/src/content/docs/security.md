---
title: Security
eyebrow: Security
description: The permissions Jobly asks for, when it reads a page, the services it talks to, how data moves, and how to report a security problem.
updated: 2026-10-27
figure: vault
---

> **The short version.** Jobly talks to its own server for job listings. It reads the page you're on only when you click Save, Fit check or Autofill, and only that tab. Optional services (Google Calendar, Hunter) are asked for the first time you use them. Everything personal stays in your browser.

## Permissions

These are all the permissions in Jobly's manifest. Chrome shows them when you install.

| Permission | Why Jobly needs it | What it can't do |
| --- | --- | --- |
| `storage` | Keep your preferences, saved jobs, tracker, profiles and contacts in your browser (and Chrome sync if you turn it on) | Read anything outside Jobly's own storage |
| `notifications` | Show job alerts and your follow-up, task and interview reminders | Show anything you turned off |
| `alarms` | Check for new jobs every 60 to 90 minutes and due reminders every 15 minutes | Run code on websites |
| `activeTab` + `scripting` | Read or fill the tab you're on when you click Save, Fit check or Autofill | Touch any other tab, or any page you didn't click on |
| `contextMenus` | Add "Save this job to Jobly" to the right-click menu | Do anything until you choose it |
| `identity` (versions with calendar import) | Sign in to Google Calendar when you import interviews | Read any Google data without that sign-in |
| `https://jobly-yd6l.onrender.com/*` | Fetch job listings from Jobly's server | Reach any other website |
| Optional: `https://api.hunter.io/*` (and `https://www.googleapis.com/*` with calendar import) | Contact search and calendar import, asked for the first time you use them | Anything before you allow it |

Jobly does **not** ask for `tabs`, `history`, `cookies`, `webRequest` or access to "all sites", and it has no content scripts that run on pages by themselves. Autofill never presses Submit and never touches password fields.

## How data moves

1. You open Jobly or the background check runs.
2. The extension sends a request to Jobly's server with your search and filters.
3. The server picks matching jobs from its database of public listings and sends them back.
4. The extension stores what it needs in your browser and shows the list.

The server keeps no record of who asked for what. Identical requests are cached in memory for about two minutes, then dropped.

## Built-in protections

- **Content Security Policy.** The extension only runs its own scripts and only connects to Jobly's server and the optional services you turn on: `default-src 'self'; script-src 'self'; connect-src https://jobly-yd6l.onrender.com https://api.hunter.io` (plus Google's API addresses in versions with calendar import).
- **Links that don't leak.** Apply links open the job's original page in a new tab with `noopener noreferrer`, so that site can't see or control the page you came from.
- **Limits on the server.** Request rate limits, size limits on every input, a cap on how many heavy queries run at once, and a guard that stops the crawler from being pointed at private network addresses.
- **No secrets in the extension.** The extension ships with no API keys or tokens. If you add your own Hunter key, it stays in your browser and is left out of backups. Changing the list of companies needs an admin key that only the server holds.
- **This website** uses a strict policy too: no inline scripts, no third-party scripts, self-hosted fonts.

## Logs

Jobly's own server keeps no access log. It logs only errors and crawl results, never your search words or preferences.

The hosting providers (Render and Cloudflare) keep short-lived technical logs such as IP address, time and the address requested, like any website. Because a search request carries your search words in its address, those can appear in the provider's logs for a short time.

## Report a security problem

Found a vulnerability? Please email [rahamanmuzeeb1108@gmail.com](mailto:rahamanmuzeeb1108@gmail.com) with "Security" in the subject and the steps to reproduce it. Please don't open a public issue for it first.

We'll reply within 3 working days, keep you updated while we fix it, and credit you if you'd like.
