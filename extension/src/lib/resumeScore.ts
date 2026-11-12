import { bulletList, Profile, skillList } from './profile';
import { Coverage } from './tailor';

/**
 * A resume score out of 100, worked out in the browser, in five categories with the checks behind each:
 *   Content                what the resume says: summary, roles, results, education
 *   Format                 how it reads to people and applicant tracking systems: layout, dates, length
 *   Optimization           how well it fits a job (needs a pasted job description) and the skills list
 *   Best practices         wording: action verbs, no filler, no buzzwords, no "I", short points
 *   Application readiness  contact details and a headline a recruiter can act on
 * Every check that fails carries a fix and an impact (high, medium, low), so the biggest fixes come first.
 */
export type Impact = 'high' | 'medium' | 'low';
export const CATEGORIES = ['Content', 'Format', 'Optimization', 'Best practices', 'Application readiness'] as const;
export type Category = (typeof CATEGORIES)[number];
export interface ScoreCheck { id: string; category: Category; label: string; ok: boolean; got: number; max: number; tip: string; impact: Impact }
export interface CategoryScore { name: Category; percent: number; failed: number }
export interface ResumeScore { score: number; grade: 'Excellent' | 'Good' | 'Needs work' | 'Weak'; checks: ScoreCheck[]; categories: CategoryScore[]; fixes: ScoreCheck[] }
export interface ScoreOptions { coverage?: Coverage | null; singleColumn?: boolean; overflows?: boolean }

const VERBS = new Set(('accelerated achieved added analysed analyzed architected automated built championed coached collaborated conceived consolidated created cut defined delivered designed developed directed drove earned enabled engineered established expanded facilitated founded generated grew guided hired implemented improved increased influenced initiated introduced launched led lowered managed mentored migrated modernised modernized negotiated optimised optimized orchestrated organised organized owned partnered pioneered planned produced prototyped raised redesigned reduced refactored resolved restructured revamped saved scaled secured shipped simplified spearheaded standardised standardized streamlined strengthened tested trained transformed tripled doubled unified upgraded validated won wrote ran conducted researched mapped crafted illustrated animated sold closed onboarded audited authored coordinated curated evaluated forecasted integrated maintained measured presented published recruited reviewed taught translated').split(' '));
const WEAK = /\b(responsible for|duties included|helped( to)?|worked on|assisted (with|in)|tasked with|involved in|participated in)\b/i;
const BUZZ = /\b(hard[- ]working|team player|results[- ]driven|go[- ]getter|self[- ]starter|detail[- ]oriented|synergy|think outside the box|dynamic|passionate|motivated|best[- ]of[- ]breed|rockstar|ninja|guru)\b/i;
const FIRST_PERSON = /(^|\s)(i|me|my|myself)\b/i;
const NUMBER = /\d|%|\b(one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand|million)\b/i;
const firstWord = (b: string) => b.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');

export function resumeScore(p: Profile, opts: ScoreOptions = {}): ResumeScore {
  const checks: ScoreCheck[] = [];
  const add = (id: string, category: Category, label: string, got: number, max: number, impact: Impact, tip: string) =>
    checks.push({ id, category, label, ok: got >= max - 0.01, got: Math.max(0, Math.min(max, Math.round(got * 10) / 10)), max, tip, impact });

  const roles = p.work.filter((w) => w.title.trim() || w.company.trim());
  const bullets = roles.flatMap((w) => bulletList(w.bullets));
  const share = (f: (b: string) => boolean) => (bullets.length ? bullets.filter(f).length / bullets.length : 0);
  const skills = skillList(p);

  // Content
  const sum = p.summary.trim().length;
  add('summary', 'Content', 'A short summary (2 to 4 sentences)', sum >= 80 && sum <= 650 ? 6 : sum > 0 ? 3 : 0, 6, sum ? 'low' : 'medium',
    sum > 650 ? 'Shorten the summary to 2 to 4 sentences.' : 'Add 2 to 4 sentences on what you do and the roles you want.');
  add('roles', 'Content', 'Experience with title and company', roles.some((w) => w.title.trim() && w.company.trim()) ? 8 : 0, 8, 'high', 'Add your experience, newest first.');
  const perRole = roles.length ? roles.map((w) => bulletList(w.bullets).length) : [0];
  add('bullet-count', 'Content', '2 to 7 points per role', (perRole.filter((n) => n >= 2 && n <= 7).length / perRole.length) * 6, 6, 'medium', 'Aim for 3 to 5 points for each recent role, fewer for older ones.');
  add('numbers', 'Content', 'At least a third of points show a result in numbers', Math.min(1, share((b) => NUMBER.test(b)) / 0.34) * 8, 8, 'high',
    'Show results: by how much, how many, how fast. Only numbers you can stand behind.');
  add('education', 'Content', 'Education listed', p.education.some((e) => e.school.trim()) ? 5 : 0, 5, 'medium', 'Add your highest qualification.');

  // Format
  if (opts.singleColumn !== undefined) add('layout', 'Format', 'Single-column layout', opts.singleColumn ? 5 : 2, 5, 'medium', 'Some older applicant tracking systems misread two columns. Pick a single-column template for online applications.');
  const dated = roles.length ? roles.filter((w) => w.start && (w.current || w.end)).length / roles.length : 0;
  add('dates', 'Format', 'Every role has start and end dates', dated * 6, 6, 'high', 'Add the missing dates; roles without dates raise questions.');
  const words = [p.summary, ...bullets].join(' ').split(/\s+/).filter(Boolean).length;
  add('length', 'Format', 'Length suits one or two pages (200 to 750 words)', words >= 200 && words <= 750 ? 5 : words > 0 ? 2 : 0, 5, 'medium',
    words > 750 ? 'Cut older or less relevant points; one page is best under ten years of experience.' : 'Add more detail on your recent roles.');
  if (opts.overflows !== undefined) add('one-page', 'Format', 'Fits the pages it needs', opts.overflows ? 2 : 4, 4, 'low', 'Turn on Fit to one page, try Compact, or remove older points.');

  // Optimization
  add('skills', 'Optimization', 'At least 6 skills', skills.length >= 6 ? 8 : skills.length >= 3 ? 5 : skills.length ? 2 : 0, 8, 'high', 'List the tools and skills jobs ask for, if you have them.');
  if (opts.coverage) {
    const c = opts.coverage;
    add('job', 'Optimization', 'Covers what the job asks for', (c.percent / 100) * 16, 16, 'high', 'Add the missing keywords you really have, and put the matching points first.');
    const kw = c.keywordsFound.length + c.keywordsMissing.length;
    if (kw) add('keywords', 'Optimization', 'Uses the job’s own keywords', (c.keywordsFound.length / kw) * 8, 8, 'high', `Missing: ${c.keywordsMissing.slice(0, 5).join(', ')}. Add the ones you have.`);
  }

  // Best practices
  add('verbs', 'Best practices', 'Points start with an action verb', Math.min(1, share((b) => VERBS.has(firstWord(b))) / 0.7) * 8, 8, 'high', 'Start each point with a verb: Led, Built, Cut, Launched, Designed…');
  const weak = bullets.filter((b) => WEAK.test(b)).length;
  add('weak', 'Best practices', 'No filler like "responsible for" or "helped"', bullets.length ? (1 - Math.min(1, weak / Math.max(1, bullets.length / 4))) * 5 : 0, 5, 'medium', 'Replace "responsible for" and "helped" with what you did and what changed.');
  const buzz = [p.summary, p.headline, ...bullets].filter((t) => BUZZ.test(t)).length;
  add('buzz', 'Best practices', 'No buzzwords like "team player" or "results-driven"', buzz ? Math.max(0, 4 - buzz * 2) : 4, 4, 'low', 'Show it with a result instead of saying it.');
  const starts = bullets.map(firstWord).filter(Boolean);
  const repeated = starts.length - new Set(starts).size;
  add('repeat', 'Best practices', 'Varied verbs (few repeats)', starts.length ? Math.max(0, 3 - Math.max(0, repeated - Math.floor(starts.length / 5))) : 0, 3, 'low', 'Vary the opening verbs so each point stands out.');
  add('first-person', 'Best practices', 'No "I" or "my" in points', bullets.length && !bullets.some((b) => FIRST_PERSON.test(b)) ? 3 : bullets.length ? 1 : 0, 3, 'low', 'Drop "I" and "my": start with the verb.');
  add('length-bullets', 'Best practices', 'Points under 32 words', bullets.length && !bullets.some((b) => b.split(/\s+/).length > 32) ? 3 : bullets.length ? 1 : 0, 3, 'low', 'Split or tighten long points so each fits on one or two lines.');

  // Application readiness
  const contact = [!!p.first_name && !!p.last_name, /\S+@\S+\.\S+/.test(p.email), p.phone.replace(/\D/g, '').length >= 7, !!p.location.trim()];
  add('contact', 'Application readiness', 'Name, email, phone and city', contact.filter(Boolean).length * 2.5, 10, 'high', 'Recruiters look for all four at the top. Add what is missing in your profile.');
  add('linkedin', 'Application readiness', 'LinkedIn or portfolio link', /linkedin\.com\//i.test(p.linkedin) || !!(p.portfolio || p.website || p.github).trim() ? 4 : 0, 4, 'medium', 'Add your LinkedIn, and a portfolio if your field uses one.');
  add('headline', 'Application readiness', 'A headline with the role you want', p.headline.trim() ? 3 : 0, 3, 'low', 'Add a headline such as "Senior Product Designer".');

  const total = (list: ScoreCheck[]) => list.reduce((s, c) => s + c.max, 0);
  const got = (list: ScoreCheck[]) => list.reduce((s, c) => s + c.got, 0);
  const score = Math.round((got(checks) / total(checks)) * 100);
  const categories = CATEGORIES.map((name) => { const l = checks.filter((c) => c.category === name); return { name, percent: l.length ? Math.round((got(l) / total(l)) * 100) : 100, failed: l.filter((c) => !c.ok).length }; });
  const rank: Record<Impact, number> = { high: 0, medium: 1, low: 2 };
  const fixes = checks.filter((c) => !c.ok).sort((a, b) => rank[a.impact] - rank[b.impact] || (b.max - b.got) - (a.max - a.got));
  // With a job description the grade is "for this job": a well-written resume that shows under half of what the
  // job asks for can't be called excellent for it, whatever its total.
  const match = opts.coverage?.percent ?? 100;
  const cap = match < 40 ? 69 : match < 60 ? 84 : 100;
  const g = Math.min(score, cap);
  return { score, grade: g >= 85 ? 'Excellent' : g >= 70 ? 'Good' : g >= 50 ? 'Needs work' : 'Weak', checks, categories, fixes };
}
