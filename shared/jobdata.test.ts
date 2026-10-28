import { describe, expect, it } from 'vitest';
import { bucketsFor, JobData, matchesPreferences, type DataJob, type Meta } from './jobdata';

const NOW = Date.now();
const ago = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const COLUMNS = ['id', 'company_id', 'company_name', 'title', 'normalized_role', 'seniority', 'work_mode', 'location', 'geo_hub',
  'experience_tier', 'employment_type', 'min_salary', 'max_salary', 'salary_summary', 'posted_at', 'first_seen_at', 'application_url',
  'source_type', 'yc_batch'];
const row = (id: number, title: string, role: string | null, posted: string | null, extra: Partial<Record<string, unknown>> = {}) => {
  const j: Record<string, unknown> = { id, company_id: 1, company_name: 'Acme', title, normalized_role: role, seniority: 'senior', work_mode: 'remote',
    location: 'Remote, India', geo_hub: 'india', experience_tier: null, employment_type: null, min_salary: null, max_salary: null, salary_summary: null,
    posted_at: posted, first_seen_at: ago(0), application_url: `https://example.com/${id}`, source_type: 'greenhouse', yc_batch: null, ...extra };
  return COLUMNS.map((c) => j[c]);
};

const files: Record<string, unknown[][]> = {
  'product_design/1': [row(1, 'Senior Product Designer', 'product_design', ago(0.5)), row(2, 'Product Designer', 'product_design', ago(0.2), { work_mode: 'on-site', location: 'Berlin' })],
  'product_design/7': [row(3, 'Lead Product Designer', 'product_design', ago(5), { company_id: 2, company_name: 'Globex', yc_batch: 'W21' })],
  'sales/3': [row(4, 'Account Executive', null, ago(2))],
  'sales/u': [row(5, 'Sales Manager', null, null)],
};
const meta: Meta = {
  version: 1, generated_at: ago(0), max_age_days: 60, total: 5, companies: 2, columns: COLUMNS, age_buckets: [1, 3, 7, 14, 30, 60], desc_shards: 4,
  categories: [{ id: 'product_design', label: 'Product Design', tech: true, jobs: 3 }, { id: 'sales', label: 'Sales', tech: false, jobs: 2 }],
  files: { product_design: { 1: { jobs: 2, bytes: 1 }, 7: { jobs: 1, bytes: 1 } }, sales: { 3: { jobs: 1, bytes: 1 }, u: { jobs: 1, bytes: 1 } } },
};

function fakeFetch(log: string[]) {
  return (async (url: string) => {
    const path = String(url).replace('https://data.test/v1/', '');
    log.push(path);
    if (path === 'meta.json') return new Response(JSON.stringify(meta));
    if (path === 'desc/1.json') return new Response(JSON.stringify({ 5: 'Sell things' }));
    const m = path.match(/^jobs\/(.+)\.json$/);
    if (m && files[m[1]]) return new Response(JSON.stringify({ rows: files[m[1]] }));
    return new Response('nope', { status: 404 });
  }) as unknown as typeof fetch;
}

describe('bucketsFor', () => {
  it('reads one bucket past the date filter, for data a few hours old', () => {
    expect(bucketsFor(meta, 1)).toEqual(['1', '3']);
    expect(bucketsFor(meta, 7)).toEqual(['1', '3', '7', '14']);
    expect(bucketsFor(meta)).toEqual(['1', '3', '7', '14', '30', '60', 'u']);
  });
});

describe('JobData.query', () => {
  it('orders newest first across categories, unknown dates last', async () => {
    const data = new JobData('https://data.test/v1', fakeFetch([]));
    const page = await data.query({ limit: 10 });
    expect(page.items.map((j) => j.id)).toEqual([2, 1, 4, 3, 5]);
    expect(page.items[3].category).toBe('product_design');
    expect(page.total).toBe(5);
    expect(page.estimated).toBe(false);
  });

  it('reads only the files it needs and stops once the page is full', async () => {
    const log: string[] = [];
    const data = new JobData('https://data.test/v1', fakeFetch(log));
    const page = await data.query({ role: 'tech', limit: 1 });
    expect(page.items.map((j) => j.id)).toEqual([2]);
    expect(page.estimated).toBe(true);
    expect(log).toEqual(['meta.json', 'jobs/product_design/1.json']);
  });

  it('filters like the API: date, search aliases, remote, YC, preferences', async () => {
    const data = new JobData('https://data.test/v1', fakeFetch([]));
    expect((await data.query({ freshness_days: 1 })).items.map((j) => j.id)).toEqual([2, 1]);
    expect((await data.query({ search: 'bangalore designer' })).items).toHaveLength(0);
    expect((await data.query({ search: 'india lead' })).items.map((j) => j.id)).toEqual([3]);
    expect((await data.query({ work_mode: 'remote', role: 'product_design' })).items.map((j) => j.id)).toEqual([1, 3]);
    expect((await data.query({ yc: true })).items.map((j) => j.id)).toEqual([3]);
    const prefs = { roles: ['product_design'], remote_only: true };
    const m = await data.query({ only_matching: true, prefs });
    expect(m.items.map((j) => [j.id, j.is_match])).toEqual([[1, true], [3, true]]);
    const plain = await data.query({ role: 'product_design' });
    expect(plain.items.every((j) => !j.is_match)).toBe(true);
  });

  it('counts from file sizes and finds descriptions by shard', async () => {
    const data = new JobData('https://data.test/v1', fakeFetch([]));
    expect(await data.count({ role: 'tech', freshness_days: 1 })).toBe(2);
    expect(await data.count({})).toBe(5);
    expect(await data.description(5)).toBe('Sell things');
    expect(await data.description(9)).toBeNull();
  });
});

describe('matchesPreferences', () => {
  const job = { title: 'Senior Designer', location: 'Berlin', normalized_role: 'product_design', seniority: null, work_mode: 'on-site',
    max_salary: 50_000, employment_type: null } as unknown as DataJob;
  it('mirrors the server rules', () => {
    expect(matchesPreferences(job, { seniorities: ['mid'] })).toBe(true);            // unknown seniority counts as mid
    expect(matchesPreferences(job, { locations: ['london'] })).toBe(false);
    expect(matchesPreferences(job, { min_salary: 60_000 })).toBe(false);
    expect(matchesPreferences(job, { employment_types: ['full_time'] })).toBe(true);  // unknown counts as full time
    expect(matchesPreferences(job, { excluded_keywords: 'senior, lead' })).toBe(false);
  });
});
