import type { APIRoute } from 'astro';
import { listPages } from '../lib/pages';
import { SITE } from '../lib/site';

// A plain-text map of the site for AI assistants (llmstxt.org format).
export const GET: APIRoute = async () => {
  const pages = await listPages();
  const sections = [...new Set(pages.map((p) => p.section))];
  const body = [
    '# Jobly',
    '',
    '> Jobly is a free Chrome extension that lists tech jobs (product design, frontend, product management, AI/ML and fullstack) from more than 170 company career pages and four remote job boards (about 400 employers), with each job’s real posting date. It hides jobs older than 60 days, shows no promoted listings, alerts you to new matches, and needs no account. Preferences, saved jobs and alerts stay in the browser.',
    '',
    ...sections.flatMap((s) => [`## ${s}`, '', ...pages.filter((p) => p.section === s).map((p) => `- [${p.eyebrow}: ${p.title}](${new URL(p.path, SITE.url).href}): ${p.summary}`), '']),
    '## Contact',
    '',
    `- Email: ${SITE.email}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
