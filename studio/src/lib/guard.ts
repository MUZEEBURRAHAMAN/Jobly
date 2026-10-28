// The fact guard: checks a model's draft against the profile before it is shown or saved.
// - A bullet must cite at least one real fact, and at least one from the job or project it sits under,
//   so an achievement can't move from one employer to another. Otherwise it is removed.
// - Every number in a line must appear in the facts that line cites. Otherwise the line is flagged.
// - Entries, skills and education that aren't in the profile are dropped.
import type { Fact } from './facts';
import type { CitedText, CoverLetter, Profile, TailoredResume } from './types';

export interface GuardIssue {
  severity: 'removed' | 'warning';
  where: string;
  text: string;
  reason: string;
}

export interface Guarded<T> { doc: T; issues: GuardIssue[] }

const NUMBER = /\d[\d,.]*\s?(?:%|k\b|m\b|x\b)?/gi;

/** Numbers as written ("1,200", "40%", "3x"), normalised so "1200" matches "1,200". */
export function numbersIn(text: string): string[] {
  return (text.match(NUMBER) ?? [])
    .map((n) => n.toLowerCase().replace(/[,\s]/g, '').replace(/\.$/, ''))
    .filter((n) => n.length > 0);
}

/** Numbers in `text` that none of the cited facts contain. */
export function unsupportedNumbers(text: string, cited: Fact[]): string[] {
  const allowed = new Set(cited.flatMap((f) => numbersIn(f.text)));
  // A bare number matches its forms with a unit too ("40" is fine when a fact says "40%").
  for (const n of [...allowed]) allowed.add(n.replace(/[%kmx]$/, ''));
  return numbersIn(text).filter((n) => !allowed.has(n) && !allowed.has(n.replace(/[%kmx]$/, '')));
}

function index(facts: Fact[]) { return new Map(facts.map((f) => [f.id, f])); }

function cleanSources(line: CitedText, byId: Map<string, Fact>): Fact[] {
  return [...new Set(Array.isArray(line.sources) ? line.sources : [])].map((id) => byId.get(id)).filter((f): f is Fact => !!f);
}

function checkBullets(
  owner: string, ownerName: string, bullets: CitedText[], byId: Map<string, Fact>, issues: GuardIssue[],
): CitedText[] {
  const out: CitedText[] = [];
  for (const b of bullets) {
    const text = String(b?.text ?? '').trim();
    if (!text) continue;
    const cited = cleanSources(b, byId);
    if (!cited.length) {
      issues.push({ severity: 'removed', where: ownerName, text, reason: 'It cites nothing from your profile.' });
      continue;
    }
    if (!cited.some((f) => f.owner === owner || f.id === owner)) {
      issues.push({ severity: 'removed', where: ownerName, text, reason: 'It uses facts from a different job or project.' });
      continue;
    }
    const extra = unsupportedNumbers(text, cited);
    if (extra.length) {
      issues.push({ severity: 'warning', where: ownerName, text, reason: `${extra.join(', ')} isn’t in the facts it cites. Check it or edit the line.` });
    }
    out.push({ text, sources: cited.map((f) => f.id) });
  }
  return out;
}

export function guardResume(draft: TailoredResume, profile: Profile, facts: Fact[]): Guarded<TailoredResume> {
  const byId = index(facts);
  const issues: GuardIssue[] = [];

  const experience: TailoredResume['experience'] = [];
  for (const e of Array.isArray(draft.experience) ? draft.experience : []) {
    const real = profile.experience.find((x) => x.id === e?.id);
    if (!real) { issues.push({ severity: 'removed', where: 'Experience', text: String(e?.id), reason: 'That job isn’t in your profile.' }); continue; }
    if (experience.some((x) => x.id === real.id)) continue;
    experience.push({ id: real.id, bullets: checkBullets(real.id, `${real.title}, ${real.company}`, e.bullets ?? [], byId, issues) });
  }

  const projects: TailoredResume['projects'] = [];
  for (const pr of Array.isArray(draft.projects) ? draft.projects : []) {
    const real = profile.projects.find((x) => x.id === pr?.id);
    if (!real || projects.some((x) => x.id === real.id)) continue;
    projects.push({ id: real.id, bullets: checkBullets(real.id, real.name, pr.bullets ?? [], byId, issues) });
  }

  const skillIds = new Set(profile.skills.map((s) => s.id));
  const skills = [...new Set((draft.skills ?? []).filter((id) => skillIds.has(id)))];
  const eduIds = new Set(profile.education.map((e) => e.id));
  const education = [...new Set((draft.education ?? []).filter((id) => eduIds.has(id)))];

  let summary: CitedText = { text: String(draft.summary?.text ?? '').trim(), sources: [] };
  const summaryFacts = cleanSources(draft.summary ?? { text: '', sources: [] }, byId);
  if (summary.text && !summaryFacts.length) {
    issues.push({ severity: 'removed', where: 'Summary', text: summary.text, reason: 'It cites nothing from your profile, so your own summary is used.' });
    summary = { text: profile.basics.summary, sources: profile.basics.summary ? ['summary'] : [] };
  } else if (summary.text) {
    summary.sources = summaryFacts.map((f) => f.id);
    const extra = unsupportedNumbers(summary.text, summaryFacts);
    if (extra.length) issues.push({ severity: 'warning', where: 'Summary', text: summary.text, reason: `${extra.join(', ')} isn’t in the facts it cites.` });
  }

  return {
    doc: { headline: String(draft.headline ?? profile.basics.headline).trim() || profile.basics.headline, summary, experience, projects, skills, education },
    issues,
  };
}

export function guardLetter(draft: CoverLetter, facts: Fact[]): Guarded<CoverLetter> {
  const byId = index(facts);
  const issues: GuardIssue[] = [];
  const paragraphs: CitedText[] = [];
  for (const p of Array.isArray(draft.paragraphs) ? draft.paragraphs : []) {
    const text = String(p?.text ?? '').trim();
    if (!text) continue;
    const cited = cleanSources(p, byId);
    // A letter has connecting prose (why this company, sign-off), so a paragraph may cite nothing,
    // but any number it states still has to come from a cited fact.
    const extra = unsupportedNumbers(text, cited);
    if (extra.length) {
      issues.push({ severity: 'warning', where: 'Cover letter', text, reason: `${extra.join(', ')} isn’t in your profile’s cited facts. Check it or edit the paragraph.` });
    }
    paragraphs.push({ text, sources: cited.map((f) => f.id) });
  }
  return {
    doc: {
      recipient: String(draft.recipient ?? '').trim(),
      greeting: String(draft.greeting ?? '').trim() || 'Dear Hiring Team,',
      paragraphs,
      closing: String(draft.closing ?? '').trim() || 'Kind regards,',
    },
    issues,
  };
}
