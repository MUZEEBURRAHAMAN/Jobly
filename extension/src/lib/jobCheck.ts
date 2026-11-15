import { Job, Preferences } from '../types';
import { Profile, skillList } from './profile';
import { analyzeJob, coverage } from './tailor';

/**
 * Job check: should you apply? A score from 1 to 5 with a verdict, worked out in the browser with rules (no AI).
 * The idea of a weighted quick score with hard rules that override it comes from the open-source career-ops project
 * (MIT); this is Jobly's own implementation on Jobly's data.
 *
 *   Role fit 35%   one of your roles, your level, your skills in the title
 *   Pay 25%        against your salary floor, only when the job states pay (unknown pay is left out, not guessed)
 *   Place 25%      remote or one of your places, only when you set a place or "remote only"
 *   Resume 15%     how much of the job description your resume shows (needs the description)
 *   Red flags      -0.5 each: an old posting, agency wording, commission-only pay, far more years than you have
 *   Hard rules     your own dealbreakers cap the score at 2.5, each quoted with the reason
 */
export type Verdict = 'apply' | 'maybe' | 'skip';
export interface Dimension { name: string; weight: number; score: number; note: string }
export interface JobCheck { score: number; verdict: Verdict; dimensions: Dimension[]; flags: string[]; dealbreakers: string[]; left: string[] }

export const VERDICT_LABEL: Record<Verdict, string> = { apply: 'Apply', maybe: 'Worth a look', skip: 'Skip' };
const DAY = 86_400_000;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (text: string, term: string) => new RegExp(`(^|[^a-z0-9+#])${esc(term.toLowerCase())}($|[^a-z0-9+#])`).test(text.toLowerCase());
const LEVEL: Record<string, string> = { intern: 'Intern', junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead' };
const money = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));

export function jobCheck(job: Job, prefs: Preferences | null, profile: Profile | null, description = '', now = Date.now()): JobCheck {
  const dims: Dimension[] = [];
  const flags: string[] = [];
  const deal: string[] = [];
  const left: string[] = [];
  const skills = profile ? skillList(profile) : [];
  const title = job.title;

  // Role fit
  if (prefs) {
    let s = 3; const notes: string[] = [];
    const role = prefs.roles.length ? (prefs.roles.includes(job.normalized_role ?? '') || prefs.roles.includes(job.category ?? '')) : null;
    const skill = [...skills, ...prefs.custom_keywords.split(',').map((x) => x.trim())].filter((x) => x.length > 1).find((t) => has(title, t));
    if (role === true) { s = 5; notes.push('one of your roles'); } else if (role === false) { s = skill ? 3 : 1.5; notes.push('not one of your roles'); }
    if (skill) { notes.push(`title mentions ${skill}`); if (role === null) s = 4; }
    const level = job.seniority || null;
    if (level && prefs.seniorities.length) {
      if (prefs.seniorities.includes(level)) notes.push(`${LEVEL[level] ?? level} level`);
      else { s = Math.max(1, s - 1.5); notes.push(`${LEVEL[level] ?? level} level, not one you picked`); }
    }
    dims.push({ name: 'Role fit', weight: 35, score: s, note: notes.join(', ') || 'set your roles in Settings to score this' });
  }

  // Pay: only against a floor the user set, and only when the job states pay
  const floor = prefs?.min_salary ?? 0;
  const max = job.max_salary && job.max_salary >= 1000 ? job.max_salary : null;
  const min = job.min_salary && job.min_salary >= 1000 ? job.min_salary : null;
  if (floor > 0 && max) {
    if (max < floor) { dims.push({ name: 'Pay', weight: 25, score: 1, note: `up to ${money(max)}, under your ${money(floor)} floor` }); deal.push(`Pays up to ${money(max)}; your floor is ${money(floor)}`); }
    else dims.push({ name: 'Pay', weight: 25, score: min && min >= floor ? 5 : 4, note: min && min >= floor ? `${money(min)} or more, at or over your floor` : `range reaches your ${money(floor)} floor` });
  } else left.push(floor > 0 ? 'Pay (not stated)' : 'Pay (no salary floor set)');

  // Place
  if (prefs?.remote_only) {
    if (job.work_mode === 'remote') dims.push({ name: 'Place', weight: 25, score: 5, note: 'remote' });
    else if (job.work_mode) { dims.push({ name: 'Place', weight: 25, score: 1, note: `${job.work_mode === 'hybrid' ? 'hybrid' : 'on-site'}, you want remote only` }); deal.push(`It's ${job.work_mode === 'hybrid' ? 'hybrid' : 'on-site'}; you chose remote only`); }
    else left.push('Place (work mode not stated)');
  } else if (prefs?.locations.length) {
    const loc = (job.location ?? '').toLowerCase();
    const ok = job.work_mode === 'remote' || prefs.locations.some((l) => loc.includes(l.toLowerCase()));
    dims.push({ name: 'Place', weight: 25, score: ok ? 5 : 2, note: ok ? (job.work_mode === 'remote' ? 'remote' : 'in one of your places') : `${job.location || 'place not stated'}, outside your places` });
  } else left.push('Place (no places set)');

  // Resume match against the description
  let yearsAsked: number | null = null;
  if (profile && description.trim().length > 200) {
    const job2 = analyzeJob(description, skills);
    yearsAsked = job2.yearsAsked;
    const c = coverage(profile, job2);
    if (job2.requirements.length || job2.keywords.length) dims.push({ name: 'Resume match', weight: 15, score: Math.round((1 + 4 * c.percent / 100) * 10) / 10, note: `your resume shows ${c.percent}% of what it asks for` });
    else left.push('Resume match (no requirements found)');
  } else left.push(profile ? 'Resume match (no description)' : 'Resume match (no profile)');

  // Hard rules
  if (prefs?.employment_types?.length && job.employment_type && !prefs.employment_types.includes(job.employment_type)) deal.push(`It's ${job.employment_type.replace('_', '-')}; not a job type you want`);
  const excluded = (prefs?.excluded_keywords ?? '').split(',').map((x) => x.trim()).filter(Boolean).find((k) => has(title, k));
  if (excluded) deal.push(`The title has "${excluded}", a word you left out`);

  // Red flags
  const posted = job.posted_at ? Date.parse(job.posted_at) : NaN;
  if (!Number.isNaN(posted) && now - posted > 30 * DAY) flags.push(`Posted ${Math.floor((now - posted) / DAY)} days ago; it may already be filled`);
  const d = description.toLowerCase();
  if (/\bour client\b|\bon behalf of (our|a) client\b|\brecruitment agency\b/.test(d)) flags.push('Posted by an agency for an unnamed employer');
  if (/\bcommission[- ]only\b|\bunpaid\b|\bno base salary\b/.test(d)) flags.push('Unpaid or commission-only pay');
  const have = profile ? Number.parseFloat(profile.years_experience) : NaN;
  if (yearsAsked !== null && !Number.isNaN(have) && yearsAsked >= have + 3) flags.push(`Asks for ${yearsAsked}+ years; you have ${have}`);

  // Weighted score over what is known, then flags and hard rules
  const w = dims.reduce((n, x) => n + x.weight, 0);
  let score = w ? dims.reduce((n, x) => n + x.score * x.weight, 0) / w : 3;
  score -= 0.5 * flags.length;
  if (deal.length) score = Math.min(score, 2.5);
  score = Math.round(Math.max(1, Math.min(5, score)) * 10) / 10;
  let verdict: Verdict = deal.length ? 'skip' : score >= 4 ? 'apply' : score >= 3 ? 'maybe' : 'skip';
  // One known part is not enough to say "Apply": the rest of the job is unknown
  if (verdict === 'apply' && dims.length < 2) { verdict = 'maybe'; score = Math.min(score, 3.9); left.unshift('Only one part could be scored, so Jobly won’t say Apply yet'); }
  return { score, verdict, dimensions: dims, flags, dealbreakers: deal, left };
}
