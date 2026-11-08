import { Profile } from './profile';

/**
 * The safe people finder: Jobly builds searches on public sites and opens them in a new tab. It never reads those
 * pages, logs in anywhere or collects anything; the user looks, and saves the people they choose.
 */
export type Who = 'recruiters' | 'hiring' | 'team' | 'alumni' | 'colleagues';
export interface WhoOption { id: Who; label: string; terms: string; hint: string }
export interface SearchLink { site: string; url: string }

const SENIORITY = /\b(senior|sr\.?|junior|jr\.?|lead|staff|principal|head of|associate|intern|ii|iii|iv)\b/gi;
const core = (role: string) => role.replace(/\(.*?\)/g, ' ').split(/[,|–—-]/)[0].replace(SENIORITY, ' ').replace(/\s+/g, ' ').trim();

export const isDesignRole = (role: string) => /design|ux|ui\b|research|creative|brand|visual/i.test(role);
export const isEngineeringRole = (role: string) => /engineer|developer|devops|sre|data scien|machine learning|ml\b|programmer/i.test(role);

/** Who to look for at a company for this role, from the profile where it helps (schools, past employers). */
export function whoOptions(role: string, profile: Profile | null): WhoOption[] {
  const r = core(role) || 'team';
  const manager = isDesignRole(role) ? '"design manager" OR "head of design"' : isEngineeringRole(role) ? '"engineering manager" OR "head of engineering"'
    : /product manager|product owner/i.test(role) ? '"group product manager" OR "head of product"' : `"${r} manager"`;
  const out: WhoOption[] = [
    { id: 'recruiters', label: 'Recruiters', terms: 'recruiter OR "talent acquisition" OR "talent partner"', hint: 'The people who screen applications.' },
    { id: 'hiring', label: 'Hiring manager', terms: manager, hint: 'Who this role likely reports to.' },
    { id: 'team', label: 'The team', terms: `"${r}"`, hint: 'People doing this job there now: ask what it is like.' },
  ];
  const school = profile?.education.find((e) => e.school.trim())?.school.trim();
  if (school) out.push({ id: 'alumni', label: `Alumni of ${school}`, terms: `"${school}"`, hint: 'People who studied where you did.' });
  const past = profile?.work.filter((w) => !w.current && w.company.trim()).map((w) => w.company.trim())[0] ?? profile?.work.find((w) => w.company.trim())?.company.trim();
  if (past) out.push({ id: 'colleagues', label: `Worked at ${past}`, terms: `"${past}"`, hint: 'Former colleagues who may refer you.' });
  return out;
}

/** Searches for one kind of person at a company, on the sites where people list where they work. */
export function searchLinks(company: string, role: string, who: WhoOption): SearchLink[] {
  const co = company.trim();
  if (!co) return [];
  const g = (site: string, extra = who.terms) => `https://www.google.com/search?q=${encodeURIComponent(`site:${site} "${co}" ${extra}`)}`;
  const plain = who.terms.replace(/"/g, '').split(' OR ')[0];
  const links: SearchLink[] = [
    { site: 'LinkedIn', url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${co} ${plain}`)}` },
    { site: 'Google (LinkedIn profiles)', url: g('linkedin.com/in') },
  ];
  if (isDesignRole(role)) {
    links.push({ site: 'Behance', url: g('behance.net', who.id === 'team' || who.id === 'hiring' ? who.terms : 'designer') });
    links.push({ site: 'Dribbble', url: g('dribbble.com', who.id === 'team' || who.id === 'hiring' ? who.terms : 'designer') });
  }
  if (isEngineeringRole(role)) links.push({ site: 'GitHub', url: `https://github.com/search?type=users&q=${encodeURIComponent(co)}` });
  links.push({ site: 'X', url: `https://x.com/search?f=user&q=${encodeURIComponent(`${co} ${plain}`)}` });
  return links;
}
