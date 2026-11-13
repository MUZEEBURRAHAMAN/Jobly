---
title: Security
eyebrow: Security
description: The permissions Jobly asks for, when it reads a page, the services it talks to, how data moves, and how to report a security problem.
updated: 2026-11-12
figure: vault
---

> **The short version.** Jobly has no server: it downloads public job files and filters them in your browser. It reads the page you're on only when you click Save, Fit check or Autofill, and only that tab. The optional Brave Search, Apollo and Hunter searches are each asked for the first time you use them, and the apply queue asks for just the job sites in it when you press Start. Everything personal stays in your browser.

## Permissions

These are all the permissions in Jobly's manifest. Chrome shows them when you install.

| Permission | Why Jobly needs it | What it can't do |
| --- | --- | --- |
| `storage` | Keep your preferences, saved and applied jobs, profiles and contacts in your browser (and Chrome sync if you turn it on) | Read anything outside Jobly's own storage |
| `notifications` | Show job alerts, and confirm a job saved with the right-click menu | Show anything you turned off |
| `alarms` | Check for new jobs every 60 to 90 minutes and due reminders every 15 minutes | Run code on websites |
| `activeTab` + `scripting` | Read or fill the tab you're on when you click Save, Fit check or Autofill | Touch any other tab, or any page you didn't click on |
| `contextMenus` | Add "Save this job to Jobly" to the right-click menu | Do anything until you choose it |
| `https://jobly-data.pages.dev/*` | Download Jobly's public job files | Reach any other website |
| Optional: `https://*/*` (per site) | The apply queue: open and fill the job pages in your queue, asked for only those sites when you press Start | Any site you didn't queue, pressing Submit, signing in |
| Optional: `https://api.search.brave.com/*` | Profile search, asked for the first time you use it | Anything before you allow it |
| Optional: `https://api.apollo.io/*` | Who works at a company, asked for the first time you use it | Anything before you allow it |
| Optional: `https://api.hunter.io/*` | Contact search, asked for the first time you use it | Anything before you allow it |

Jobly does **not** ask for `tabs`, `history`, `cookies`, `webRequest` or access to "all sites", and it has no content scripts that run on pages by themselves. Autofill never presses Submit and never touches password fields.

## How data moves

1. You open Jobly or the background check runs.
2. The extension downloads the public job files it needs from `jobly-data.pages.dev`. They are the same for everyone and carry nothing about you.
3. It searches, filters and matches them to your preferences in your browser.
4. It stores what it needs in your browser and shows the list.

There is no Jobly server, so there is nothing that receives your searches, preferences or reports. A report or a company suggestion opens your email app; you decide whether to send it.

## Built-in protections

- **Content Security Policy.** The extension only runs its own scripts and only connects to Jobly's job files and the optional services you turn on: `default-src 'self'; script-src 'self'; connect-src https://jobly-data.pages.dev https://api.hunter.io https://api.search.brave.com https://api.apollo.io https://api.anthropic.com`.
- **Links that don't leak.** Apply links open the job's original page in a new tab with `noopener noreferrer`, so that site can't see or control the page you came from.
- **Nothing to attack on our side.** With no server, there is no database of users, no login and no API that accepts input. The job files are read-only.
- **No secrets in the extension.** The extension ships with no API keys or tokens. If you add your own Brave Search, Apollo or Hunter key, it stays in your browser and is left out of backups.
- **This website** uses a strict policy too: no inline scripts, no third-party scripts, self-hosted fonts.

## Logs

Jobly keeps no logs: it has no server. Cloudflare, which hosts the job files and this website, keeps short-lived technical logs such as IP address, time and the file requested, like any website. Your search words and preferences never appear there, because they never leave your browser.

## Report a security problem

Found a vulnerability? Please email [rahamanmuzeeb1108@gmail.com](mailto:rahamanmuzeeb1108@gmail.com) with "Security" in the subject and the steps to reproduce it. Please don't open a public issue for it first.

We'll reply within 3 working days, keep you updated while we fix it, and credit you if you'd like.
