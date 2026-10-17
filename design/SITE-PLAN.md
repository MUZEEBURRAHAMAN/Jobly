# Jobly website: build plan (for your review)

Goal: a full product website for Jobly with the look and interactions of wrangle.ai, the page set of the GoFully site,
and @lucasmarkes/hairline illustrations. Zero cost to run. Nothing gets built until you approve this plan.

---

## 1. What I studied

**GoFully site** (`MUZEEBURRAHAMAN/gofully-extension`, Next.js, 26 routes):

| Type | GoFully pages |
|---|---|
| Core | Home, FAQ, Privacy, Terms, Security, Support, Roadmap, Uninstall feedback, 404 |
| Alternatives | Index + 4 competitor pages (Awesome Screenshot, FireShot, GoFullPage, Nimbus) |
| Guides | Index + 11 how-to guides |
| Shared parts | Nav, footer, breadcrumbs (+ JSON-LD), related guides, support form, framed cards |
| SEO files | sitemap.xml (21 URLs), robots.txt, llms.txt, web manifest |

Two things I will **not** copy from GoFully:
- Its support form and uninstall form only show "Thanks" and send nothing. Jobly's forms will really deliver (Netlify Forms, free).
- Its home page has a reviews section. Jobly has no users yet, so no reviews until real ones exist.

**wrangle.ai: look and interactions to reproduce**

| # | Interaction on Wrangle | Jobly version |
|---|---|---|
| 1 | Thin announcement bar above the nav | "New: jobs older than 2 months never show up" → How dates work |
| 2 | Sticky nav; hover/click mega menus with an icon list on the left and a product preview on the right | Product menu (Jobs feed, Alerts, Saved, Filters) and Resources menu (Guides, Alternatives, Roadmap, FAQ); keyboard and touch friendly |
| 3 | Hero: soft gradient fades in, headline rises, search box types example queries by itself | Same, with job searches ("Senior product designer, remote, past week"). Clicking a role chip fills the box. Pressing Search shows the **real** number of matching jobs from the live API |
| 4 | Logo strip | Names of the job boards Jobly reads (Greenhouse, Ashby, Lever...) |
| 5 | Quote cards: one wide, the others collapsed with a "+"; clicking expands one | The three product facts (dates, privacy, direct apply) as expanding cards |
| 6 | Benchmark numbers and bars | Live job counts by age: numbers count up and bars grow when scrolled into view |
| 7 | Feature cards with small moving product mocks | Alerts card: a notification slides in. Saved card: a Save button toggles. Filters card: "Date posted" cycles |
| 8 | 3×2 capability grid with mini mocks | Same grid, each tile a hairline illustration that reacts to the pointer |
| 9 | Big screenshot with tabs | Jobs / Companies / Saved / Alerts tabs that advance on their own until you click |
| 10 | FAQ accordion on a gradient panel | Same |
| 11 | Closing call-to-action panel | Same |
| 12 | Footer with a giant faded wordmark and a status dot | Same; the dot shows the real "Jobs updated N minutes ago" |
| 13 | Gentle fade-up of sections on scroll | Same; everything holds still for people who turn on "reduce motion" |

**hairline**: 33 illustrations that react to the pointer, with an optional self-playing loop and built-in reduce-motion support. They also work without React, which keeps the site light.

---

## 2. The pages (27 core + 5 optional)

```
/                                   Home
/how-it-works                       Install → choose roles → get alerts (with screenshots)
/how-dates-work                     How Jobly reads posting dates, the 60-day rule, closed jobs, live freshness chart
/companies                          Live, searchable list of every employer and job board Jobly reads
/faq                                All questions, grouped (getting started, jobs, alerts, privacy, browsers)
/privacy                            Existing policy, restyled (same wording, already accurate)
/security                           Permissions explained, what runs where, what the server keeps (nothing personal)
/terms                              New terms of use (plain language; you should still have them checked)
/support                            Contact form (Netlify Forms) + email + GitHub issues
/roadmap                            What's next + changelog of every release so far
/uninstall                          "Sorry to see you go" form; the extension opens it on uninstall
/404                                Not-found page with links to the main sections

/alternatives                       Index: how Jobly compares, honestly
/alternatives/linkedin-jobs
/alternatives/indeed
/alternatives/simplify              (job-seeker Chrome extension)
/alternatives/hiring-cafe           (also lists jobs from company career pages)

/guides                             Index with categories
/guides/find-jobs-posted-in-the-last-24-hours
/guides/how-to-spot-ghost-jobs
/guides/apply-directly-on-company-career-pages
/guides/job-alerts-that-are-not-spam
/guides/best-chrome-extensions-for-job-seekers
/guides/find-remote-product-design-jobs
/guides/find-frontend-developer-jobs-at-startups
/guides/find-product-manager-jobs
/guides/find-ai-ml-engineer-jobs
/guides/job-search-privacy

Optional (phase 7): role pages with the latest live jobs, good for search traffic
/jobs/product-design  /jobs/frontend  /jobs/product-management  /jobs/ai-ml  /jobs/fullstack
```

Each page gets: its own title and description, breadcrumbs, structured data (JSON-LD), a share image, a related-links block, and the closing call-to-action.

### Page-by-page outline

| Page | Sections | Illustration |
|---|---|---|
| Home | The 12 sections in `design/landing/CONTENT.md` | Capability grid: Loupe, Sieve, Plug, Hub, Lockers, Query |
| How it works | 3 steps with real screenshots, what happens in the background, how alerts are timed | Laptop, Settle, Router |
| How dates work | Where dates come from, sources without a date, the 60-day cutoff, how closed jobs are removed, live chart | Plot |
| Companies | Live search box, filters by source, count per company, "Suggest a company" link to Support | Cabinet |
| FAQ | 5 groups, ~20 questions, FAQ structured data | Query |
| Privacy | Existing text, table of contents, "last updated" | Padlock |
| Security | Permission-by-permission table, data flow diagram, what we log, how to report a problem | Vault |
| Terms | Plain-language terms | Format |
| Support | Form (name optional, email, topic, message), other channels, response time promise | Dish |
| Roadmap | Next / later / shipped columns + dated changelog from the git history | Branches |
| Uninstall | Reasons (checkboxes), optional note, reinstall link | Drawer |
| 404 | Message + 4 link cards | Plug |
| Alternatives index | Comparison table, one card per competitor, "when to use the other tool" | Turntable |
| Each alternative | Who it suits, feature table, where Jobly is weaker, where it is better, sources and the date checked | none (table-led) |
| Guides index | Category filter, cards with reading time | Riffle (interactive tray) |
| Each guide | Steps with screenshots, tips, related guides | one per category, reused |

### Rules for content
- No made-up numbers, quotes or reviews. Every number is live from the API or dated.
- Competitor pages: every claim researched at writing time, with sources and a "checked on" date, and an honest "choose them if..." section. Overclaiming here is a legal and trust risk.
- Copy follows the same plain style as the extension: short sentences, active voice, no hype.

---

## 3. How I will build it

**Recommended stack: Astro (static), in the existing `site/` folder, still on Netlify for free.**

| Option | Why / why not |
|---|---|
| **Astro (recommended)** | Pages ship as plain HTML with almost no JavaScript, so it is fast and search-friendly. Markdown for guides and comparisons. Built-in sitemap. hairline works without React here. |
| Next.js (what GoFully uses) | Familiar if you want both sites alike, but more JavaScript on every page for a mostly static site. |
| Plain HTML (what Jobly has now) | Fine for 2 pages; with 27 pages the shared nav and footer get copied 27 times. |

**Building blocks** (made once, used everywhere): page layout, announcement bar, nav with mega menus, mobile menu, footer,
panels, buttons, cards, expanding cards, tabs, accordion, count-up numbers, bar chart, illustration slot, breadcrumbs,
related links, call-to-action panel, comparison table, guide layout, form layout.

**Design tokens** (from Wrangle, adjusted for Jobly):
- Light page with content in panels with 28px corners, set 16px in from the window edge. Cards 12px corners. Buttons 8px.
- Headline 58px/500 with tight spacing, section titles 44px, body 17px on 28px lines.
- Archivo font (already self-hosted), Jobly orange `#b83a0a` with soft peach gradients instead of Wrangle's green.
- Dark mode: see decisions.

**Live data on the site** (hero search count, freshness chart, companies list, footer status): needs two small backend changes:
1. Allow the website's address in CORS (today only the extension may call the API).
2. One cached `GET /api/freshness` endpoint so the chart costs one request instead of six.
Pages always render with a dated fallback if the server is asleep or busy.

**Forms**: Netlify Forms (free tier, about 100 submissions a month) with a spam trap. The privacy policy gets a short addition about what the support form collects.

**Extension changes**: open `/uninstall` when someone removes Jobly, and add "Help and guides" links in Preferences. These ship in the next extension release.

**Quality bar for "perfect"** (checked automatically before each deploy):
- Accessibility: WCAG AA, axe on every page, full keyboard use of menus, tabs, accordions and cards.
- Speed: Lighthouse 95+ on mobile; under 30 KB of JavaScript per page (home up to 60 KB).
- Reduce motion respected everywhere; no auto-playing video.
- Screenshots of every page at phone, tablet and desktop widths, compared before each release.
- No broken links; sitemap, robots.txt, llms.txt and redirects (`/privacy.html` → `/privacy`) in place.
- Strict security headers kept (scripts only from the site itself).

---

## 4. Order of work, with a review stop after each phase

| Phase | What you get | You review |
|---|---|---|
| 0 | This plan | Pages, stack, decisions below |
| 1 | Foundation: Astro setup, tokens, nav with mega menus, footer, every building block on one "kitchen sink" page | Look and feel, menus, motion |
| 2 | Home page, built from the approved copy deck, with all 13 interactions | The whole home page, desktop and phone |
| 3 | Core pages: How it works, How dates work, Companies, FAQ, Privacy, Security, Terms, Support, Roadmap, Uninstall, 404 (+ the two backend changes) | Copy and layout of each page |
| 4 | Alternatives: index + 4 pages, with sources | Every competitor claim |
| 5 | Guides: index + 10 guides, written in batches of 3 to 4 | Each batch |
| 6 | SEO and QA: metadata, share images, structured data, sitemap, llms.txt, redirects, full test run; then switch Netlify to the new build | Final check before it goes live |
| 7 (optional) | Role pages with live jobs | Go / no go |

The current two pages stay live until phase 6, so nothing breaks while the new site is built.

---

## 5. Decisions I need from you

1. **Stack**: Astro (my recommendation) or Next.js like GoFully?
2. **Dark mode**: light only like Wrangle, or light + dark following the system setting (about 10% more work)?
3. **Live data on the website**: OK to allow the site to call the Jobly API (two small backend changes)?
4. **Competitors**: LinkedIn Jobs, Indeed, Simplify, HiringCafe. Keep, swap or drop any?
5. **Guide topics**: the 10 above. Add or remove any?
6. **Role pages** (phase 7): yes, no, or later?
7. **Contact email** for the support page and footer.
8. **Still open from the copy deck**: headline A/B/C, live or fixed numbers, skip the blog row on Home, orange instead of green.
9. **Domain**: stay on `joblyextension.netlify.app` (free) or a custom domain (about $10–15 a year)?
