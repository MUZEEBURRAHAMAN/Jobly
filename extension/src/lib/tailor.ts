import { asksFor, KEYWORDS } from './fit';
import { bulletList, Profile, skillList, skillsText } from './profile';

/**
 * Resume tailoring without AI, in the browser:
 *   analyzeJob   the requirements a job description lists (must-have or nice-to-have) and its skill keywords
 *   coverage     which requirements the profile shows, with the line that shows each, and keyword coverage
 *   suggestions  changes the user accepts one by one: skills and bullets reordered for the job, skills to add
 *                only if they really have them. Nothing is reworded here, so nothing can be made up.
 */

export interface Requirement { id: string; text: string; must: boolean; keywords: string[] }
export interface JobAnalysis { requirements: Requirement[]; keywords: string[]; yearsAsked: number | null }
export interface Evidence { where: string; text: string }
export interface RequirementMatch { requirement: Requirement; status: 'covered' | 'partial' | 'missing'; evidence: Evidence | null }
export interface Coverage { matches: RequirementMatch[]; covered: number; keywordsFound: string[]; keywordsMissing: string[]; percent: number }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const mentions = (text: string, term: string) => new RegExp(`(^|[^a-z0-9+#])${esc(term.toLowerCase())}($|[^a-z0-9+#])`).test(text.toLowerCase());

const STOP = new Set('about above after again also and any are around as at be been being both but by can could did do does doing during each few for from further had has have having how if in into is it its just more most must need needs nice not of on once only or other our out over own plus same should so some strong such than that the their them then there these they this those through to too under until up using very want was we were what when where which while who will with within work working would you your years year experience ability able skills skill knowledge understanding team teams role including etc well good great excellent proven solid deep'.split(' '));
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, ' ').split(/\s+/).map((w) => w.replace(/^[.-]+|[.-]+$/g, '')).filter((w) => w.length > 2 && !STOP.has(w));

const MUST_HEAD = /^(requirements?|qualifications?|minimum qualifications|basic qualifications|required|what you('|’)?ll (need|bring)|what we('|’)?re looking for|who you are|about you|you have|you bring|must[- ]haves?|skills( and| &) experience|your profile|what you need)\b/i;
const NICE_HEAD = /^(nice[- ]to[- ]haves?|preferred( qualifications)?|bonus( points)?|pluses|it('|’)?s a plus|would be (great|nice)|extra credit|good to have|desired)\b/i;
const OTHER_HEAD = /^(responsibilities|what you('|’)?ll do|the role|about (the role|us|the team|the company)|benefits|perks|why (join|us)|our (offer|benefits)|compensation|how to apply|what we offer|day to day|in this role)\b/i;
const BULLET = /^\s*(?:[-•*▪◦●·]|\d+[.)])\s+/;

/** Requirements and keywords from a pasted job description. */
export function analyzeJob(text: string, profileSkills: string[] = []): JobAnalysis {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  let mode: 'must' | 'nice' | 'other' | null = null;
  const picked: { text: string; must: boolean }[] = [];
  const loose: string[] = [];
  for (const raw of lines) {
    const head = raw.replace(/[:*#]+/g, '').trim();
    if (head.length < 60 && !BULLET.test(raw)) {
      if (NICE_HEAD.test(head)) { mode = 'nice'; continue; }
      if (MUST_HEAD.test(head)) { mode = 'must'; continue; }
      if (OTHER_HEAD.test(head)) { mode = 'other'; continue; }
    }
    const line = raw.replace(BULLET, '').trim();
    if (line.length < 12 || line.length > 300) continue;
    if (mode === 'must' || mode === 'nice') picked.push({ text: line, must: mode === 'must' && !/\b(nice|bonus|plus|preferred|ideally)\b/i.test(line) });
    else if (BULLET.test(raw) && mode !== 'other') loose.push(line);
  }
  // No headings Jobly knows: use bullet lines that name a skill or ask for experience
  const source = picked.length ? picked : loose.filter((l) => /experience|proficien|familiar|knowledge|degree|skill|years?/i.test(l) || KEYWORDS.some((k) => asksFor(l, k))).map((t) => ({ text: t, must: true }));
  const vocab = [...new Set([...KEYWORDS, ...profileSkills])];
  // Jobly's own keyword list is checked strictly ("go-to-market" is not Go); the user's own skills as written
  const own = new Set(profileSkills.map((k) => k.toLowerCase()));
  const named = (t: string, k: string) => (own.has(k.toLowerCase()) ? mentions(t, k) : asksFor(t, k));
  const uniq = (list: string[]) => [...new Map(list.map((k) => [k.toLowerCase(), k])).values()];
  const requirements = source.slice(0, 14).map((r, i) => ({ id: `r${i + 1}`, text: r.text, must: r.must, keywords: uniq(vocab.filter((k) => named(r.text, k))) }));
  const keywords = [...new Map(vocab.filter((k) => named(text, k)).map((k) => [k.toLowerCase(), k])).values()];
  const m = /(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*\+?\s*years?/i.exec(text);
  return { requirements, keywords, yearsAsked: m ? Number(m[1]) : null };
}

/** Every line of the resume that can show a requirement, with where it sits. */
function resumeLines(p: Profile): Evidence[] {
  const out: Evidence[] = [];
  if (p.headline) out.push({ where: 'Headline', text: p.headline });
  for (const s of p.summary.split(/(?<=[.!?])\s+/)) if (s.trim()) out.push({ where: 'Summary', text: s.trim() });
  for (const w of p.work) {
    const where = [w.title, w.company].filter(Boolean).join(', ') || 'Experience';
    for (const b of bulletList(w.bullets)) out.push({ where, text: b });
    if (w.title) out.push({ where, text: w.title });
  }
  for (const e of p.education) out.push({ where: 'Education', text: [e.degree, e.field, e.school].filter(Boolean).join(', ') });
  const skills = skillList(p);
  if (skills.length) out.push({ where: 'Skills', text: skills.join(', ') });
  return out;
}

export function coverage(p: Profile, job: JobAnalysis): Coverage {
  const lines = resumeLines(p);
  const all = lines.map((l) => l.text).join('\n');
  const yearsHave = Number.parseFloat(p.years_experience) || null;
  const matches: RequirementMatch[] = job.requirements.map((r) => {
    // "5+ years of experience": the profile's years answer it
    const asked = /(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*\+?\s*years?/i.exec(r.text);
    if (asked && yearsHave !== null && !r.keywords.length) {
      const ok = yearsHave >= Number(asked[1]);
      return { requirement: r, status: ok ? 'covered' : 'partial', evidence: { where: 'Profile', text: `${p.years_experience} years of experience` } };
    }
    // A named skill in the requirement found in the resume, else enough of the requirement's own words in one line
    const hit = r.keywords.length ? lines.find((l) => r.keywords.some((k) => mentions(l.text, k))) : undefined;
    const allKeys = r.keywords.length > 0 && r.keywords.every((k) => mentions(all, k));
    const want = words(r.text);
    let best: Evidence | null = null; let score = 0;
    for (const l of lines) {
      const have = new Set(words(l.text));
      const s = want.length ? want.filter((w) => have.has(w)).length / want.length : 0;
      if (s > score) { score = s; best = l; }
    }
    if (hit && allKeys) return { requirement: r, status: 'covered', evidence: hit };
    if (hit) return { requirement: r, status: 'partial', evidence: hit };
    if (score >= 0.5) return { requirement: r, status: 'covered', evidence: best };
    if (score >= 0.25) return { requirement: r, status: 'partial', evidence: best };
    return { requirement: r, status: 'missing', evidence: null };
  });
  const keywordsFound = job.keywords.filter((k) => mentions(all, k));
  const keywordsMissing = job.keywords.filter((k) => !mentions(all, k));
  const reqScore = matches.length ? matches.reduce((s, m) => s + (m.status === 'covered' ? 1 : m.status === 'partial' ? 0.5 : 0), 0) / matches.length : 0;
  const keyScore = job.keywords.length ? keywordsFound.length / job.keywords.length : reqScore;
  return {
    matches, covered: matches.filter((m) => m.status === 'covered').length, keywordsFound, keywordsMissing,
    percent: Math.round((matches.length ? (reqScore + keyScore) / 2 : keyScore) * 100),
  };
}

// ---------- suggestions ----------

export type Suggestion =
  | { id: string; kind: 'skills-order'; title: string; before: string[]; after: string[] }
  | { id: string; kind: 'bullets-order'; title: string; workId: string; before: string[]; after: string[] }
  | { id: string; kind: 'add-skill'; title: string; skill: string }
  | { id: string; kind: 'rewrite'; title: string; target: 'summary' | { workId: string }; before: string; after: string; note?: string };

const relevance = (text: string, job: JobAnalysis) => job.keywords.filter((k) => mentions(text, k)).length * 3
  + job.requirements.reduce((s, r) => s + words(r.text).filter((w) => words(text).includes(w)).length, 0);

/** The profile's bullets most relevant to the job, best first. */
export function relevantBullets(p: Profile, job: JobAnalysis, n = 3): { work: Profile['work'][number]; text: string }[] {
  return p.work.flatMap((w) => bulletList(w.bullets).map((text) => ({ work: w, text, s: relevance(text, job) })))
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map(({ work, text }) => ({ work, text }));
}

export function suggestions(p: Profile, job: JobAnalysis): Suggestion[] {
  const out: Suggestion[] = [];
  const skills = skillList(p);
  if (skills.length > 1) {
    const after = [...skills].sort((a, b) => Number(job.keywords.some((k) => k.toLowerCase() === b.toLowerCase()) || mentions(job.requirements.map((r) => r.text).join(' '), b))
      - Number(job.keywords.some((k) => k.toLowerCase() === a.toLowerCase()) || mentions(job.requirements.map((r) => r.text).join(' '), a)));
    if (after.join() !== skills.join()) out.push({ id: 'skills', kind: 'skills-order', title: 'Put the skills this job asks for first', before: skills, after });
  }
  for (const w of p.work) {
    const bullets = bulletList(w.bullets);
    if (bullets.length < 2) continue;
    const after = bullets.map((b, i) => ({ b, i, s: relevance(b, job) })).sort((x, y) => y.s - x.s || x.i - y.i).map((x) => x.b);
    if (after.join('\n') !== bullets.join('\n')) out.push({ id: `bullets-${w.id}`, kind: 'bullets-order', title: `Lead with the most relevant points at ${w.company || w.title}`, workId: w.id, before: bullets, after });
  }
  const all = resumeLines(p).map((l) => l.text).join('\n');
  for (const k of job.keywords.filter((x) => !mentions(all, x)).slice(0, 8)) {
    out.push({ id: `add-${k.toLowerCase()}`, kind: 'add-skill', title: `Add “${k}” to your skills`, skill: k });
  }
  return out;
}

/** Suggestions that are safe to turn on for the user: reordering. Adding a skill is their call. */
export const defaultAccepted = (list: Suggestion[]) => new Set(list.filter((s) => s.kind === 'skills-order' || s.kind === 'bullets-order').map((s) => s.id));

export function applySuggestions(p: Profile, list: Suggestion[], accepted: Set<string>): Profile {
  let out: Profile = { ...p, work: p.work.map((w) => ({ ...w })) };
  const added: string[] = [];
  for (const s of list) {
    if (!accepted.has(s.id)) continue;
    if (s.kind === 'skills-order') out.skills = skillsText(out, s.after);
    if (s.kind === 'add-skill') added.push(s.skill);
    if (s.kind === 'bullets-order') out.work = out.work.map((w) => (w.id === s.workId ? { ...w, bullets: s.after.join('\n') } : w));
    if (s.kind === 'rewrite') {
      if (s.target === 'summary') out.summary = s.after;
      else {
        const t = s.target;
        out.work = out.work.map((w) => {
          if (w.id !== t.workId) return w;
          // by text, not position: the bullets may have been reordered by another suggestion
          return { ...w, bullets: bulletList(w.bullets).map((b) => (b === s.before ? s.after : b)).join('\n') };
        });
      }
    }
  }
  if (added.length) out = { ...out, skills: skillsText(out, [...added, ...skillList(out)].filter((v, i, a) => a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)) };
  return out;
}
