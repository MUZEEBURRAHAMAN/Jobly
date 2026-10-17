# Jobly landing page: copy deck (draft 1, for your review)

Structure and look follow wrangle.ai (rounded inset panels, soft gradient, big calm headlines, feature cards with product mockups, tabbed screenshot, FAQ on a gradient panel, closing CTA panel, giant faded wordmark in the footer). The "How it works" steps and the plain "your data" section borrow from rea.tools.
All copy below is original. Every number is real and was read from the live API on 17 Oct 2026.

## Decisions I need from you

1. **Headline.** Pick one (or write your own):
   - A. Find jobs posted this week, not last year. *(my pick)*
   - B. Fresh jobs from hundreds of employers, in your toolbar.
   - C. Stop applying to jobs that closed in June.
2. **Testimonials.** Wrangle shows customer quotes. Jobly has no users yet, so section 3 uses three facts about the product instead. I will not invent quotes. Add real ones after launch.
3. **Live numbers.** Section 5 can fetch the counts live (always current, needs one line added to the site's security policy) or show fixed numbers with an "as of" date (simpler). Which?
4. **Blog/guides row.** Wrangle has three article cards. I left it out because there are no articles yet. Good for search traffic later.
5. **Name check.** "Jobly" is generic and probably used by others. Check trademark and the Web Store before you spend on branding.
6. **Browsers.** The FAQ says Edge and Brave can install it. Test that before publishing, or delete that sentence.

---

## 0. Announcement bar
New: jobs older than 2 months never show up. See how we check dates →

## 0. Navigation
Logo **Jobly** · How it works · Features · Privacy · FAQ · **[Add to Chrome]**

## 1. Hero
**Headline:** Find jobs posted this week, not last year.

**Subhead:** Jobly lists openings from company career pages with their real posting date, hides anything older than two months, and tells you when a new one matches. No account. Your preferences stay in your browser.

**Demo box (looks like a search field, with role chips under it):**
Label: Tell Jobly what you're looking for
Example text: Product designer · Remote · Past week
Chips: Product designer · Frontend engineer · Product manager · AI / ML · Fullstack

**Buttons:** [Add to Chrome, it's free] [See how it works]
**Small print:** Free · No account · Works in Chrome

**Visual:** the real dashboard screenshot rising out of the bottom of the gradient panel.

## 2. Sources strip
Label: Reads public job boards on
Names: Greenhouse · Ashby · Lever · Workday · Amazon Jobs · We Work Remotely · Remotive · Himalayas · Arbeitnow

## 3. Three facts (replaces testimonials)
**Large card:** Every job shows when it was posted.
Jobly reads the date from the employer's own listing. If a source gives no date, the job appears without one, and the Date posted filter leaves it out.
Link: How we handle dates →

**Card 2:** Your data stays in your browser.
Preferences, saved jobs and alerts live on your device. Nothing goes in an account because there is no account.

**Card 3:** You apply on the employer's site.
Every Apply button opens the company's own application page.

## 4. How it works
Title: Set up in a minute.
1. **Add Jobly to Chrome.** One click from the Chrome Web Store.
2. **Choose your roles.** Product design, frontend, product management, AI/ML or fullstack. Add experience level, location and keywords if you want.
3. **Open the toolbar icon.** See the freshest matches first. Jobly sends a notification when a new one appears.

## 5. Numbers
**Title:** A feed that stays fresh.
**Subhead:** Live counts from Jobly's database, refreshed every two hours.
**Four stats:** 560 posted in the last 24 hours · 1,409 in the last 3 days · 2,053 in the last week · 11,355 in the last 2 months, the oldest we show
**Bar chart ("Open jobs by posting date"):** Past 24 hours 560 · Past 3 days 1,409 · Past week 2,053 · Past 2 weeks 3,762 · Past month 7,065 · Past 2 months 11,355
Note under the chart: Jobs older than 60 days are removed.

## 6. Features (two cards, then one wide card)
**Title:** Set it once. Jobly keeps watching.
**Subhead:** Pick your roles one time. Jobly checks for new matches in the background and tells you when one shows up.

**Card A · ALERTS**
Title: A heads-up when a match appears
Text: Jobly checks every hour or so and sends one grouped notification, not a flood. Turn alerts off any time in Preferences.
Visual: desktop notification "3 new matches: Northwind, Copperfield and 1 other" above a short list.

**Card B · SAVED**
Title: A shortlist that stays on your device
Text: Save a job with one click. Jobly keeps a copy in your browser, so it stays on your list after the company takes the posting down.
Visual: two job cards, one with "Saved" toggled.

**Card C (wide) · FILTERS**
Title: Filter the way you do on LinkedIn
Text: Date posted, experience, salary, location and remote only. Add words to include or leave out.
Visual: the filter panel with "Date posted: Past week".

## 7. Capabilities grid (six items)
**Title:** What you get
**Subhead:** Each part works alone. Together they replace a dozen career-page tabs.
1. **Real posting dates.** The date comes from the employer's listing, shown on every card.
2. **A two-month limit.** Nothing older than 60 days appears, so ghost listings stay out.
3. **Direct apply links.** Apply opens the company's own page. Jobly never sits between you and the application.
4. **Matched to you.** Your roles, level, location and keywords fill the "For you" tab and the "Matches you" badge.
5. **Hide companies.** Turn off employers you don't want to see. The choice stays on your device.
6. **Report a bad listing.** Flag a fake, expired or spammy job in two clicks.

## 8. Product tabs
**Title:** Jobly does the checking. You do the applying.
Tabs, each with one screenshot and one sentence:
- **Jobs.** The freshest matches first, with the date on every card.
- **Companies.** See which employers Jobly watches and how many roles each has open. Hide the ones you don't want.
- **Saved.** Your shortlist, searchable, stored on your device.
- **Alerts.** Every new match since your last visit, newest first.

## 9. Privacy block
**Title:** Your job search stays yours.
**Subhead:** No account, no email, no analytics.
Four cards:
- **On your device.** Preferences, saved jobs, alerts and hidden companies.
- **What the server sees.** Your search words and filters, only to answer that request. They are not saved in a database.
- **Other services.** Company logos come from Google's favicon service. Render and Cloudflare keep ordinary request logs.
- **Permissions.** Storage, notifications and alarms. No tabs, no browsing history.
Link: Read the full privacy policy →

## 10. FAQ
1. **How is Jobly different from LinkedIn or Indeed?**
   Jobly reads postings from company career pages and shows the real posting date. It hides anything older than two months. It has no promoted jobs, no account and no messaging. LinkedIn and Indeed list far more jobs across every industry and offer things Jobly does not, such as Easy Apply and recruiter messages.
2. **How much does Jobly cost?**
   Nothing. Jobly is free and has no premium tier today.
3. **How do I get started?**
   Add Jobly to Chrome, choose your roles, and open the toolbar icon. It takes about a minute.
4. **Which jobs does it cover?**
   Product design, frontend, product management, AI/ML and fullstack roles. Jobly reads more than 170 company career pages on Greenhouse, Ashby, Lever, Workday and Amazon, plus remote boards such as We Work Remotely, Remotive, Himalayas and Arbeitnow.
5. **How often does it update?**
   The server refreshes its list every two hours. Your browser checks for new matches every 60 to 90 minutes.
6. **Why do some jobs have no date?**
   Some sources do not publish one. Jobly shows those jobs without a date, and the Date posted filter hides them.
7. **What do you store about me?**
   Nothing in a database. Your preferences, saved jobs and alerts stay in your browser. Read the privacy policy for the details.
8. **Does it work outside Chrome?**
   Chromium browsers such as Edge and Brave can install extensions from the Chrome Web Store. Firefox and Safari are not supported.

## 11. Closing panel
**Title:** Ready to see what's new?
**Text:** Add Jobly to Chrome, pick your roles, and open the icon. It takes a minute.
Buttons: [Add to Chrome] [Read the privacy policy]
Two small cards:
- **Start with your roles.** Product design, frontend, product management, AI/ML, fullstack. → Choose roles
- **Want a look first?** See how many jobs went up today. → See today's numbers

## 12. Footer
Columns: **Product** (How it works, Features, FAQ) · **Roles** (Product design, Frontend, Product management, AI / ML, Fullstack) · **Legal** (Privacy policy, Terms, Contact) · **Get it** (Chrome Web Store)
Bottom line: © 2026 Jobly · status dot with "Jobs updated 2 hours ago" (live, from the server)
Giant faded wordmark: Jobly

---

## Look and feel (taken from the reference)
- Page background light gray. Content sits in white or tinted panels with 28 px rounded corners, inset 16 px from the window edge.
- Hero and closing panels use a soft blurred gradient. Wrangle uses green; Jobly uses its orange brand colour with a pale peach.
- Headline 58 px, weight 500, tight letter spacing. Section titles 44 px. Body 17 px on a 28 px line. Cards 12 px radius on #f6f6f6. Buttons 8 px radius.
- One sans-serif family (Archivo, already bundled). No stock photos. Real product screenshots only.
- Motion: gentle fade-up on scroll, respects "reduce motion". No auto-playing video.
