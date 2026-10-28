// The steps of an application, as plain functions over data. The UI calls these with either a model's answer
// (runTask) or JSON the user pasted back from Claude; both go through the same normalising and the fact guard.
import { profileFacts } from './facts';
import { guardLetter, guardResume, type GuardIssue } from './guard';
import { uid, now } from './ids';
import type {
  Application, CoverLetter, DocVersion, MatchLevel, Posting, Profile, Requirement, RequirementMatch, Status, TailoredResume, Tone,
} from './types';

// ---------- Posting analysis ----------

export interface AnalyzeAnswer {
  title: string; company: string; location: string; contact: string; language: string;
  requirements: { id: string; text: string; must: boolean }[];
  matches: { requirementId: string; level: string; sources: string[]; note: string }[];
}

export function readAnalysis(answer: AnalyzeAnswer, postingText: string, url: string, profile: Profile): { posting: Posting; matches: RequirementMatch[] } {
  const factIds = new Set(profileFacts(profile).map((f) => f.id));
  const requirements: Requirement[] = (answer.requirements ?? [])
    .filter((r) => r && String(r.text ?? '').trim())
    .slice(0, 15)
    .map((r, i) => ({ id: String(r.id || `r${i + 1}`), text: String(r.text).trim(), must: r.must !== false }));
  const reqIds = new Set(requirements.map((r) => r.id));
  const matches: RequirementMatch[] = requirements.map((r) => {
    const m = (answer.matches ?? []).find((x) => x?.requirementId === r.id);
    const sources = (m?.sources ?? []).filter((s) => factIds.has(s));
    let level: MatchLevel = m && ['met', 'partial', 'gap'].includes(m.level) ? (m.level as MatchLevel) : 'gap';
    // A match with no real evidence behind it is a gap, whatever the model said.
    const unsupported = level !== 'gap' && !sources.length;
    if (unsupported) level = 'gap';
    return { requirementId: r.id, level, sources, note: unsupported ? 'Nothing in your profile shows this yet.' : String(m?.note ?? '').trim() };
  }).filter((m) => reqIds.has(m.requirementId));
  return {
    posting: {
      title: String(answer.title ?? '').trim(),
      company: String(answer.company ?? '').trim(),
      location: String(answer.location ?? '').trim(),
      contact: String(answer.contact ?? '').trim(),
      language: String(answer.language ?? '').trim() || 'English',
      url,
      text: postingText,
      requirements,
    },
    matches,
  };
}

/** 0–100: required items count double, partial counts half. */
export function matchScore(posting: Posting, matches: RequirementMatch[]): number | null {
  if (!posting.requirements.length) return null;
  let got = 0, total = 0;
  for (const r of posting.requirements) {
    const w = r.must ? 2 : 1;
    const m = matches.find((x) => x.requirementId === r.id);
    total += w;
    got += m?.level === 'met' ? w : m?.level === 'partial' ? w / 2 : 0;
  }
  return Math.round((got / total) * 100);
}

// ---------- Documents ----------

const version = <T>(doc: T, label: string, issues?: GuardIssue[]): DocVersion<T> => ({ id: uid('v'), at: now(), label, doc, ...(issues ? { issues } : {}) });

/** The base resume: the whole profile, every bullet citing itself. Used before any AI draft, or without AI at all. */
export function baseResume(profile: Profile): TailoredResume {
  return {
    headline: profile.basics.headline,
    summary: { text: profile.basics.summary, sources: profile.basics.summary ? ['summary'] : [] },
    experience: profile.experience.map((e) => ({ id: e.id, bullets: e.bullets.filter((b) => b.text.trim()).map((b) => ({ text: b.text, sources: [b.id] })) })),
    projects: profile.projects.map((p) => ({ id: p.id, bullets: p.bullets.filter((b) => b.text.trim()).map((b) => ({ text: b.text, sources: [b.id] })) })),
    skills: profile.skills.map((s) => s.id),
    education: profile.education.map((e) => e.id),
  };
}

export function blankLetter(posting: Posting): CoverLetter {
  return {
    recipient: posting.company ? `${posting.company} hiring team` : '',
    greeting: 'Dear Hiring Team,',
    paragraphs: [{ text: '', sources: [] }],
    closing: 'Kind regards,',
  };
}

export function newApplication(posting: Posting, matches: RequirementMatch[], tone: Tone, profile: Profile, source: Application['source'] = 'pasted'): Application {
  const at = now();
  return {
    id: uid('app'),
    createdAt: at,
    updatedAt: at,
    status: 'draft',
    statusHistory: [{ status: 'draft', at }],
    posting,
    matches,
    tone,
    resume: [version(baseResume(profile), 'Base resume')],
    letter: [version(blankLetter(posting), 'Blank')],
    chat: [],
    notes: '',
    interviews: [],
    followUp: '',
    source,
  };
}

export interface DraftAnswer { resume: TailoredResume; letter: CoverLetter }

export function applyDraft(app: Application, answer: DraftAnswer, profile: Profile, label = 'AI draft'): { app: Application; issues: GuardIssue[] } {
  const facts = profileFacts(profile);
  const r = guardResume(answer.resume ?? ({} as TailoredResume), profile, facts);
  const l = guardLetter(answer.letter ?? ({} as CoverLetter), facts);
  return {
    app: { ...app, updatedAt: now(), resume: [...app.resume, version(r.doc, label, r.issues)], letter: [...app.letter, version(l.doc, label, l.issues)] },
    issues: [...r.issues, ...l.issues],
  };
}

export function applyRefine(
  app: Application, target: 'resume' | 'letter', instruction: string,
  answer: { reply: string; resume?: TailoredResume; letter?: CoverLetter }, profile: Profile,
): { app: Application; issues: GuardIssue[] } {
  const facts = profileFacts(profile);
  const label = instruction.length > 48 ? `${instruction.slice(0, 45)}…` : instruction;
  const turns = [
    { id: uid('t'), at: now(), role: 'user' as const, text: instruction, target },
    { id: uid('t'), at: now(), role: 'assistant' as const, text: String(answer.reply ?? 'Done.'), target },
  ];
  if (target === 'resume') {
    const r = guardResume(answer.resume ?? ({} as TailoredResume), profile, facts);
    return { app: { ...app, updatedAt: now(), resume: [...app.resume, version(r.doc, label, r.issues)], chat: [...app.chat, ...turns] }, issues: r.issues };
  }
  const l = guardLetter(answer.letter ?? ({} as CoverLetter), facts);
  return { app: { ...app, updatedAt: now(), letter: [...app.letter, version(l.doc, label, l.issues)], chat: [...app.chat, ...turns] }, issues: l.issues };
}

/** Save a hand edit as a new version, so it can be undone like an AI change. */
export function saveEdit<K extends 'resume' | 'letter'>(app: Application, target: K, doc: K extends 'resume' ? TailoredResume : CoverLetter, label = 'Your edit'): Application {
  const list = app[target] as DocVersion<unknown>[];
  const last = list[list.length - 1];
  // Typing makes many edits: fold consecutive hand edits into one version.
  const next = last && last.label === label && Date.now() - Date.parse(last.at) < 60_000
    ? [...list.slice(0, -1), { ...last, at: now(), doc }]
    : [...list, version(doc, label)];
  return { ...app, updatedAt: now(), [target]: next };
}

export function restoreVersion(app: Application, target: 'resume' | 'letter', versionId: string): Application {
  const list = app[target] as DocVersion<unknown>[];
  const v = list.find((x) => x.id === versionId);
  if (!v) return app;
  return { ...app, updatedAt: now(), [target]: [...list, { ...version(structuredClone(v.doc), `Restored: ${v.label}`) }] };
}

export function setStatus(app: Application, status: Status): Application {
  if (app.status === status) return app;
  const at = now();
  return { ...app, status, updatedAt: at, statusHistory: [...app.statusHistory, { status, at }] };
}

// ---------- Profile import ----------

export interface ProfileAnswer {
  basics: { name: string; headline: string; email: string; phone: string; location: string; summary: string; links: { label: string; url: string }[] };
  experience: { title: string; company: string; location: string; start: string; end: string; bullets: string[] }[];
  projects: { name: string; role: string; url: string; start: string; end: string; bullets: string[] }[];
  education: { school: string; degree: string; start: string; end: string; details: string }[];
  skills: { name: string; group: string }[];
  languages: { name: string; level: string }[];
}

const s = (v: unknown) => String(v ?? '').trim();
const bullets = (list: unknown) => (Array.isArray(list) ? list : []).map(s).filter(Boolean).map((text) => ({ id: uid('b'), text }));

/** Merge an imported resume into the profile: fills empty basics, adds entries (never deletes what's there). */
export function mergeImportedProfile(current: Profile, a: ProfileAnswer): Profile {
  const b = a.basics ?? ({} as ProfileAnswer['basics']);
  const keep = (mine: string, theirs: unknown) => mine.trim() || s(theirs);
  const haveSkill = new Set(current.skills.map((x) => x.name.toLowerCase()));
  return {
    ...current,
    basics: {
      ...current.basics,
      name: keep(current.basics.name, b.name),
      headline: keep(current.basics.headline, b.headline),
      email: keep(current.basics.email, b.email),
      phone: keep(current.basics.phone, b.phone),
      location: keep(current.basics.location, b.location),
      summary: keep(current.basics.summary, b.summary),
      links: current.basics.links.length ? current.basics.links
        : (b.links ?? []).filter((l) => s(l?.url)).map((l) => ({ id: uid('ln'), label: s(l.label) || s(l.url), url: s(l.url) })),
    },
    experience: [...current.experience, ...(a.experience ?? []).filter((e) => s(e?.title) || s(e?.company)).map((e) => ({
      id: uid('exp'), title: s(e.title), company: s(e.company), location: s(e.location), start: s(e.start), end: s(e.end), bullets: bullets(e.bullets),
    }))],
    projects: [...current.projects, ...(a.projects ?? []).filter((p) => s(p?.name)).map((p) => ({
      id: uid('prj'), name: s(p.name), role: s(p.role), url: s(p.url), start: s(p.start), end: s(p.end), bullets: bullets(p.bullets),
    }))],
    education: [...current.education, ...(a.education ?? []).filter((e) => s(e?.school) || s(e?.degree)).map((e) => ({
      id: uid('edu'), school: s(e.school), degree: s(e.degree), start: s(e.start), end: s(e.end), details: s(e.details),
    }))],
    skills: [...current.skills, ...(a.skills ?? []).filter((k) => s(k?.name) && !haveSkill.has(s(k.name).toLowerCase())).map((k) => ({
      id: uid('sk'), name: s(k.name), group: s(k.group),
    }))],
    languages: [...current.languages, ...(a.languages ?? []).filter((l) => s(l?.name)).map((l) => ({ id: uid('lang'), name: s(l.name), level: s(l.level) }))],
  };
}
