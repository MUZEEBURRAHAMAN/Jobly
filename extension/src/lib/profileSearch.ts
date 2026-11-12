/**
 * People search through official APIs with the user's own keys, called straight from this browser:
 *   Brave Search API  public profile pages (LinkedIn, Behance, Dribbble, GitHub) for a company and role, from the
 *                     search engine's own index. Jobly never opens or reads those sites.
 *   Apollo            who works at a company in which role (first name and title; Apollo hides the rest on search).
 * Chrome asks for access to each service the first time it's used. Nothing passes through Jobly.
 */
import { readKey, writeKey } from './userData';
import { ensureAccess } from './integrations';
import { isDesignRole, isEngineeringRole, WhoOption } from './peopleSearch';

export const BRAVE_API = 'https://api.search.brave.com/*';
export const APOLLO_API = 'https://api.apollo.io/*';
export const BRAVE_KEY = 'braveApiKey';
export const APOLLO_KEY = 'apolloApiKey';
export const loadKey = async (k: string) => (await readKey<string>(k)) ?? '';
export const saveKey = (k: string, v: string) => writeKey(k, v.trim().slice(0, 200));

export type Site = 'LinkedIn' | 'Behance' | 'Dribbble' | 'GitHub';
export interface ProfileHit { site: Site; name: string; headline: string; url: string; snippet: string }

const SITES: Record<Site, { q: string; profile: RegExp }> = {
  LinkedIn: { q: 'linkedin.com/in', profile: /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#]+\/?$/i },
  Behance: { q: 'behance.net', profile: /^https:\/\/(www\.)?behance\.net\/(?!gallery|search|galleries|joblist|assets)[^/?#]+\/?$/i },
  Dribbble: { q: 'dribbble.com', profile: /^https:\/\/(www\.)?dribbble\.com\/(?!shots|jobs|tags|search|stories|designers|pro|signup|session|following)[^/?#]+\/?$/i },
  GitHub: { q: 'github.com', profile: /^https:\/\/(www\.)?github\.com\/(?!orgs|topics|search|features|about|pricing|collections|trending|sponsors|marketplace|login|join)[^/?#]+\/?$/i },
};

/** Which sites suit the role: LinkedIn always, portfolio sites for design, GitHub for engineering. */
export const sitesFor = (role: string): Site[] => ['LinkedIn', ...(isDesignRole(role) ? ['Behance', 'Dribbble'] as Site[] : []), ...(isEngineeringRole(role) ? ['GitHub'] as Site[] : [])];

const clean = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

/** "Priya Shah - Design Manager - Acme | LinkedIn" → name and headline. */
export function parseTitle(title: string, site: Site): { name: string; headline: string } {
  const t = clean(title).replace(/\s*[|·–-]\s*(LinkedIn|Behance|Dribbble|GitHub)\s*$/i, '').replace(/\s*on (Behance|Dribbble)\s*$/i, '');
  const gh = site === 'GitHub' ? /^(\S+)\s*\(([^)]+)\)/.exec(t) : null;   // "priya (Priya Shah)"
  if (gh) return { name: gh[2].trim(), headline: '' };
  const [name, ...rest] = t.split(/\s+[-–|·]\s+/);
  return { name: name.trim().slice(0, 80), headline: rest.join(' · ').trim().slice(0, 160) };
}

/** One Brave search per site, in parallel. Throws a readable message on failure. */
export async function searchProfiles(company: string, who: WhoOption, sites: Site[]): Promise<ProfileHit[]> {
  const key = await loadKey(BRAVE_KEY);
  if (!key) throw new Error('Add your Brave Search API key in Settings first.');
  if (!(await ensureAccess(BRAVE_API))) throw new Error('Chrome needs your OK to contact Brave Search.');
  const co = company.trim();
  const runs = sites.map(async (site) => {
    // Portfolio sites: the role's own words for the team and hiring manager, else designers (Behance, Dribbble) or anyone (GitHub)
    const terms = site === 'LinkedIn' || who.id === 'team' || who.id === 'hiring' ? who.terms : site === 'GitHub' ? '' : 'designer';
    const params = new URLSearchParams({ q: `site:${SITES[site].q} "${co}" ${terms}`, count: '20', safesearch: 'moderate' });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, { headers: { Accept: 'application/json', 'X-Subscription-Token': key } });
    if (res.status === 401 || res.status === 403) throw new Error('Brave Search refused the key. Check it in Settings.');
    if (res.status === 429) throw new Error('Brave Search limit reached for now. Try again later, or check your plan.');
    if (!res.ok) throw new Error(`Brave Search answered ${res.status}.`);
    const data = await res.json() as { web?: { results?: { title?: string; url?: string; description?: string }[] } };
    return (data.web?.results ?? [])
      .filter((r) => r.url && SITES[site].profile.test(r.url.split('?')[0]))
      .map((r) => ({ site, ...parseTitle(r.title ?? '', site), url: r.url!.split('?')[0], snippet: clean(r.description ?? '').slice(0, 220) }))
      .filter((h) => h.name && h.name.length > 1);
  });
  const settled = await Promise.allSettled(runs);
  const ok = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
  const failed = settled.find((s) => s.status === 'rejected') as PromiseRejectedResult | undefined;
  if (!ok.length && failed) throw failed.reason instanceof Error ? failed.reason : new Error("Couldn't search right now.");
  // The company named in the result first; one card per profile
  const seen = new Set<string>();
  const named = (h: ProfileHit) => `${h.headline} ${h.snippet}`.toLowerCase().includes(co.toLowerCase());
  return ok.filter((h) => !seen.has(h.url.toLowerCase()) && seen.add(h.url.toLowerCase())).sort((a, b) => Number(named(b)) - Number(named(a)));
}

// ------------------------------------------------------------------ Apollo
export interface ApolloPerson { name: string; title: string; company: string; hasEmail: boolean }

const TITLES: Record<string, string[]> = {
  recruiters: ['recruiter', 'talent acquisition', 'talent partner', 'technical recruiter'],
};

/** People at a company's domain for one kind of person. Apollo's search shows the first name and a hidden last name. */
export async function apolloPeople(domain: string, who: WhoOption, role: string): Promise<ApolloPerson[]> {
  const key = await loadKey(APOLLO_KEY);
  if (!key) throw new Error('Add your Apollo API key in Settings first.');
  if (!(await ensureAccess(APOLLO_API))) throw new Error('Chrome needs your OK to contact Apollo.');
  const params = new URLSearchParams({ per_page: '25', page: '1' });
  params.append('q_organization_domains_list[]', domain);
  const titles = TITLES[who.id] ?? who.terms.replace(/"/g, '').split(/\s+OR\s+/i).map((t) => t.trim()).filter(Boolean);
  if (who.id === 'alumni' || who.id === 'colleagues') { if (role.trim()) params.append('person_titles[]', role.trim()); }
  else titles.forEach((t) => params.append('person_titles[]', t));
  if (who.id === 'hiring') ['manager', 'head', 'director'].forEach((s) => params.append('person_seniorities[]', s));
  const res = await fetch(`https://api.apollo.io/api/v1/mixed_people/api_search?${params}`, { method: 'POST', headers: { 'x-api-key': key, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
  if (res.status === 401 || res.status === 403) throw new Error('Apollo refused the key. People search needs an API key with search access (Apollo: Settings, Integrations, API).');
  if (res.status === 429) throw new Error('Apollo limit reached for now. Try again later.');
  if (!res.ok) throw new Error(`Apollo answered ${res.status}.`);
  const data = await res.json() as { people?: { first_name?: string; last_name?: string; last_name_obfuscated?: string; name?: string; title?: string | null; has_email?: boolean; organization?: { name?: string } }[] };
  return (data.people ?? []).map((x) => ({
    name: x.name || [x.first_name, x.last_name || x.last_name_obfuscated].filter(Boolean).join(' ') || 'Unknown',
    title: x.title ?? '', company: x.organization?.name ?? '', hasEmail: !!x.has_email,
  }));
}

/** A LinkedIn people search for someone Apollo found (their full name stays hidden on Apollo's search). */
export const linkedinFor = (p: ApolloPerson, company: string) =>
  `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${p.name.split(' ')[0]} ${p.title} ${company}`.trim())}`;
