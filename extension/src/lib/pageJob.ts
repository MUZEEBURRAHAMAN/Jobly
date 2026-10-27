/**
 * Reading the job on the page the user is looking at. `extractJobFromPage` runs inside that page (chrome.scripting,
 * allowed only for the tab the user opened Jobly on), so it must be self-contained: no imports, no outside variables.
 * Most hiring systems publish a schema.org JobPosting in the page; the page title is the fallback.
 */
export interface PageJob {
  found: boolean;
  title: string;
  company: string;
  location: string;
  datePosted: string;
  employmentType: string;
  salary: string;
  url: string;
  /** The posting's text (for the fit check), at most 20,000 characters. */
  description: string;
}

export function extractJobFromPage(): PageJob {
  const text = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) ? v.map(text).filter(Boolean).join(', ') : v && typeof v === 'object' && 'name' in (v as Record<string, unknown>) ? text((v as Record<string, unknown>).name) : '').replace(/\s+/g, ' ').trim();
  // DOMParser never runs scripts or loads images, unlike innerHTML on a live element.
  const strip = (html: string) => (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim();
  const postings: Record<string, unknown>[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const o = node as Record<string, unknown>;
    const type = o['@type'];
    if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) postings.push(o);
    if (o['@graph']) visit(o['@graph']);
  };
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => { try { visit(JSON.parse(s.textContent ?? '')); } catch { /* not JSON */ } });
  const url = location.href;
  const job = postings[0];
  if (job) {
    const place = (job.jobLocation as unknown) ?? [];
    const places = (Array.isArray(place) ? place : [place]).map((p) => {
      const a = (p as Record<string, unknown>)?.address as Record<string, unknown> | undefined;
      return a ? [text(a.addressLocality), text(a.addressRegion), text(a.addressCountry)].filter(Boolean).join(', ') : text(p);
    }).filter(Boolean);
    const remote = String(job.jobLocationType ?? '').toUpperCase().includes('TELECOMMUTE');
    const pay = job.baseSalary as Record<string, unknown> | undefined;
    const value = pay?.value as Record<string, unknown> | undefined;
    const salary = value ? [value.minValue, value.maxValue].filter((x) => x !== undefined).join(' – ') + (pay?.currency ? ` ${pay.currency}` : '') + (value.unitText ? ` per ${String(value.unitText).toLowerCase()}` : '') : '';
    return {
      found: true, title: strip(text(job.title)).slice(0, 200), company: text(job.hiringOrganization).slice(0, 120),
      location: (places.join(' · ') || (remote ? 'Remote' : '')).slice(0, 160), datePosted: text(job.datePosted).slice(0, 40),
      employmentType: text(job.employmentType).slice(0, 40), salary: salary.slice(0, 80), url,
      description: (strip(text(job.description)) || (document.querySelector('main')?.textContent ?? document.body.innerText ?? '')).replace(/\s+/g, ' ').slice(0, 20000),
    };
  }
  // No structured data: use the heading and the title ("Senior Designer - Acme | Greenhouse").
  const h1 = (document.querySelector('h1')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const site = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? '';
  const parts = document.title.split(/\s[-|–@]\s|\sat\s/).map((s) => s.trim()).filter(Boolean);
  return { found: false, title: (h1 || parts[0] || document.title).slice(0, 200), company: (site || parts[1] || location.hostname.replace(/^www\./, '')).slice(0, 120), location: '', datePosted: '', employmentType: '', salary: '', url,
    description: (document.querySelector('main')?.textContent ?? document.body.innerText ?? '').replace(/\s+/g, ' ').slice(0, 20000) };
}

const EMPLOYMENT: Record<string, string> = { FULL_TIME: 'full_time', PART_TIME: 'part_time', CONTRACTOR: 'contract', TEMPORARY: 'contract', INTERN: 'internship' };
export const employmentFromSchema = (v: string) => EMPLOYMENT[v.toUpperCase().split(',')[0].trim()] ?? null;

/** Reads the job in a tab. Resolves null for pages Chrome won't let extensions read (chrome://, the Web Store). */
export async function readJobInTab(tabId: number): Promise<PageJob | null> {
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: extractJobFromPage });
    return (res?.result as PageJob | undefined) ?? null;
  } catch {
    return null;
  }
}

/** A tracker entry for a job read from a page. The page address is its key, so saving twice updates one entry. */
export function appFromPageJob(j: PageJob): Partial<import('./tracker').Application> {
  return {
    key: j.url.split('#')[0], title: j.title, company_name: j.company, location: j.location || null, application_url: j.url,
    posted_at: j.datePosted || null, salary_summary: j.salary || null, status: 'saved', source: 'page',
  };
}
