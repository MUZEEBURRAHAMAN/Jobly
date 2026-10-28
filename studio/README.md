# Jobly Studio

A tailored resume and cover letter for every job, from one profile, and every application tracked from draft to offer. It runs entirely in the browser: no server, no account, no database to pay for.

Inspired by [Dossier](https://github.com/AienTech/dossier), a self-hosted Next.js and PostgreSQL app. Studio is written from scratch (no Dossier code) to work as a free static site.

## What it does

- **Profile**: basics, experience with bullets, projects, education, skills, languages, section order and a readiness meter. Start from a resume: a PDF (read in the browser with pdf.js) or pasted text.
- **New application**: paste a posting (or pick one in Find jobs). Studio pulls out the requirements, shows how the profile matches each one (met, partly, gap, with the facts that show it) and a match score.
- **Tailored resume and cover letter** in the tone you pick, then refine them in a chat, edit by hand, and go back to any version.
- **Fact check**: every line a model writes must cite profile fact ids. `src/lib/guard.ts` checks them in code. It removes a bullet that cites nothing, or that uses facts from a different job. It flags any number that isn't in the facts it cites. A match with no evidence becomes a gap.
- **Download PDF** through the browser's print-to-PDF: exact A4 or Letter pages with selectable text. Four themes and six accent colours. You can also copy plain text for application forms.
- **Email it**: opens your mail app with the letter and the posting's address.
- **Board and table** of applications (drag between stages), notes, follow-up dates and interviews.
- **Dashboard**: a funnel (30 days, 90 days or all time), applications per week, and what's worth doing next.
- **Find jobs**: fresh tech jobs from Jobly's server, with real posting dates, then "Tailor for this".
- **Your data**: one IndexedDB record in this browser. Export and import it as one file, or delete everything. Works offline (service worker).

## The AI

You choose it in Settings:

| Option | Cost | Where the profile goes |
| --- | --- | --- |
| Claude, by hand (default) | Your Claude plan | Each step gives a prompt to paste into claude.ai, and you paste the JSON answer back |
| Anthropic API | Your API key | Straight from the browser to Anthropic (Opus 5.5 by default, or Sonnet 5.5 or Haiku 5.5) |
| OpenAI-compatible | Your key, or free locally | OpenAI or OpenRouter, or Ollama or LM Studio on your own computer |

Answers use structured output (JSON schemas in `src/lib/ai/schemas.ts`). Every path goes through the same fact check.

## Develop

```bash
cd studio
npm install
npm run dev      # http://localhost:5173
npm test         # fact check and analysis tests
npm run build    # type-check and build to dist/
```

## Deploy on Cloudflare Pages

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick this repository.
2. Build settings: framework preset **None**, root directory **`studio`**, build command **`npm run build`**, output directory **`dist`**. Add the environment variable `NODE_VERSION` = `22`.
3. Deploy. The site gets a `*.pages.dev` address. Security headers come from `public/_headers`.
4. For Find jobs, add the Studio address to the job server's `SITE_ORIGINS` on Render (comma-separated, next to the website's), so the server allows the requests.

Each push to the production branch redeploys. The free plan allows 500 builds a month.
