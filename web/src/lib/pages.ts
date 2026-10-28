// Every public page, in one list: used for the sitemap, llms.txt and the social images.
import { getCollection } from 'astro:content';
import { getGuides } from './guides';
import { ALTERNATIVES } from './alternatives';
import { ROLES } from './roles';
import { isoDate } from './text';

export type PageInfo = { path: string; title: string; eyebrow: string; summary: string; lastmod?: string; section: string };
type Draft = Omit<PageInfo, 'lastmod'> & { lastmod?: string };

const BUILT = isoDate(new Date());

export async function listPages(): Promise<PageInfo[]> {
  const docs = await getCollection('docs');
  const doc = (id: string) => docs.find((d) => d.id === id)!;
  const guides = await getGuides();
  const core: PageInfo[] = [
    { path: '/', title: 'Find jobs posted this week, not last year.', eyebrow: 'Free Chrome extension', summary: 'Fresh jobs from 1,600+ company career pages, design, development and IT sorted by area, with real posting dates and alerts. No account.', section: 'Main' },
    { path: '/how-it-works', title: 'From the careers page to your toolbar.', eyebrow: 'How it works', summary: 'How Jobly finds, matches and alerts you to new jobs, and how to install it.', section: 'Main' },
    { path: '/how-dates-work', title: 'Every date, straight from the source.', eyebrow: 'How dates work', summary: 'Where each posting date comes from, the 60-day rule, and the limits.', section: 'Main' },
    { path: '/jobs', title: 'Every design, development and IT job, by role.', eyebrow: 'Jobs', summary: 'Live lists of the newest jobs for every design, development and IT area.', section: 'Jobs' },
    { path: '/jobs/yc', title: 'Jobs at Y Combinator startups.', eyebrow: 'Y Combinator startups', summary: 'Open design, development and IT jobs at Y Combinator startups, from each company’s own career page, with the real posting date.', section: 'Jobs' },
    { path: '/companies', title: 'Every company Jobly reads.', eyebrow: 'Companies', summary: 'The full list of career pages and job boards Jobly reads, with open jobs.', section: 'Main' },
    { path: '/guides', title: 'Search smarter, apply sooner.', eyebrow: 'Guides', summary: 'Practical guides for a faster job search.', section: 'Guides' },
    { path: '/alternatives', title: 'Jobly and the tools you already use.', eyebrow: 'Alternatives', summary: 'Honest comparisons with LinkedIn Jobs, Indeed, Simplify and HiringCafe.', section: 'Alternatives' },
    { path: '/faq', title: 'Questions, answered.', eyebrow: 'FAQ', summary: 'Answers about coverage, dates, alerts, privacy and troubleshooting.', section: 'Main' },
    { path: '/roadmap', title: 'What’s next, and what shipped.', eyebrow: 'Roadmap', summary: 'Work in progress, plans and a dated changelog.', section: 'Main' },
    { path: '/support', title: 'How can we help?', eyebrow: 'Support', summary: 'Contact the Jobly team.', section: 'Company' },
    ...['privacy', 'terms', 'security'].map((id) => ({ path: `/${id}`, title: doc(id).data.title, eyebrow: doc(id).data.eyebrow, summary: doc(id).data.description, lastmod: isoDate(doc(id).data.updated), section: 'Company' })),
  ];
  const drafts: Draft[] = [
    ...core,
    ...ROLES.map((r) => ({ path: `/jobs/${r.slug}`, title: `${r.name} jobs, straight from the source.`, eyebrow: `${r.name} jobs`, summary: r.lead, section: 'Jobs' })),
    ...guides.map((g) => ({ path: g.href, title: g.data.title, eyebrow: g.data.category, summary: g.data.description, lastmod: isoDate(g.data.updated ?? g.data.date), section: 'Guides' })),
    ...ALTERNATIVES.map((a) => ({ path: `/alternatives/${a.slug}`, title: a.title, eyebrow: `${a.name} alternative`, summary: a.description, section: 'Alternatives' })),
  ];
  return drafts.map((p) => ({ ...p, lastmod: p.lastmod ?? BUILT }));
}

/** The social image for a path: one per page when it exists, else the default. */
export const ogKey = (path: string) => (path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '--'));
