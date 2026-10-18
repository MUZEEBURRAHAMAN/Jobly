---
title: Security
eyebrow: Security
description: The permissions Jobly asks for, the one server it talks to, how data moves, and how to report a security problem.
updated: 2026-10-18
figure: vault
---

> **The short version.** The extension asks for three permissions, talks to exactly one server, and can't see your tabs or the pages you visit. Everything personal stays in your browser.

## Permissions

These are all the permissions in Jobly's manifest. Chrome shows them when you install.

| Permission | Why Jobly needs it | What it can't do |
| --- | --- | --- |
| `storage` | Keep your preferences, saved jobs and alerts in your browser | Read anything outside Jobly's own storage |
| `notifications` | Show a desktop alert for a new match, only if you turn alerts on | Show anything without your setting |
| `alarms` | Check for new jobs every 60 to 90 minutes | Run code on websites |
| `https://jobly-yd6l.onrender.com/*` | Fetch job listings from Jobly's server | Reach any other website |

Jobly does **not** ask for `tabs`, `history`, `cookies`, `webRequest`, `scripting` or access to "all sites". It has no content scripts, so it never runs on the pages you browse.

## How data moves

1. You open Jobly or the background check runs.
2. The extension sends a request to Jobly's server with your search and filters.
3. The server picks matching jobs from its database of public listings and sends them back.
4. The extension stores what it needs in your browser and shows the list.

The server keeps no record of who asked for what. Identical requests are cached in memory for about two minutes, then dropped.

## Built-in protections

- **Content Security Policy.** The extension only runs its own scripts and only connects to Jobly's server: `default-src 'self'; script-src 'self'; connect-src https://jobly-yd6l.onrender.com`.
- **Links that don't leak.** Apply links open the employer's page in a new tab with `noopener noreferrer`, so the employer's site can't see or control where you came from.
- **Limits on the server.** Request rate limits, size limits on every input, a cap on how many heavy queries run at once, and a guard that stops the crawler from being pointed at private network addresses.
- **No secrets in the extension.** There are no API keys or tokens in the extension to steal. Changing the list of companies needs an admin key that only the server holds.
- **This website** uses a strict policy too: no inline scripts, no third-party scripts, self-hosted fonts.

## Logs

Jobly's own server keeps no access log. It logs only errors and crawl results, never your search words or preferences.

The hosting providers (Render, Cloudflare and Netlify) keep short-lived technical logs such as IP address, time and the address requested, like any website. Because a search request carries your search words in its address, those can appear in the provider's logs for a short time.

## Open source

All of Jobly's code is public on [GitHub](https://github.com/MUZEEBURRAHAMAN/Jobly), so you can check every claim on this page.

## Report a security problem

Found a vulnerability? Please email [rahamanmuzeeb1108@gmail.com](mailto:rahamanmuzeeb1108@gmail.com) with "Security" in the subject and the steps to reproduce it. Please don't open a public issue for it first.

We'll reply within 3 working days, keep you updated while we fix it, and credit you if you'd like.
