import { bulletList, fullName, Profile, skillList } from './profile';
import { analyzeJob, coverage, mentions, relevantBullets } from './tailor';

/**
 * Cover letters written in the browser from the profile and, when pasted, the job description. No AI, so nothing is
 * made up: every claim is one of the user's own lines. Seven structures, three tones, three lengths. A value the
 * profile doesn't have shows as [field] so it's easy to spot and fill in.
 *
 * Shape of every letter: greeting → opening (the role and a hook) → proof (the user's own results, matched to the job
 * when there's a description) → fit (why this company, skills) → close with a next step → sign-off.
 */
export const LETTER_TEMPLATES = [
  { id: 'matched', label: 'Answers the job description', hint: 'Takes what the posting asks for and answers each with a line from your experience.', needsJd: true },
  { id: 'achievement', label: 'Lead with a result', hint: 'Opens with your strongest result, then shows how it carries over.', needsJd: false },
  { id: 'company', label: 'Why this company', hint: 'Opens with why you want this company (write a line below), then your proof.', needsJd: false },
  { id: 'switch', label: 'Career change', hint: 'Shows how your experience carries over to a new kind of role.', needsJd: false },
  { id: 'referral', label: 'Referred by someone', hint: 'Names who referred you in the first line, where it counts most.', needsJd: false },
  { id: 'graduate', label: 'Graduate or internship', hint: 'Leads with your studies and projects when your experience is short.', needsJd: false },
  { id: 'email', label: 'Short email or message', hint: 'Four or five lines to paste into an email or LinkedIn message.', needsJd: false },
] as const;
export type LetterTemplateId = (typeof LETTER_TEMPLATES)[number]['id'];
export const TONES = [{ id: 'confident', label: 'Confident' }, { id: 'warm', label: 'Warm' }, { id: 'formal', label: 'Formal' }] as const;
export type Tone = (typeof TONES)[number]['id'];
export const LENGTHS = [{ id: 'short', label: 'Short' }, { id: 'standard', label: 'Standard' }, { id: 'detailed', label: 'Detailed' }] as const;
export type Length = (typeof LENGTHS)[number]['id'];

export interface LetterInput {
  profile: Profile | null; role: string; company: string; description?: string;
  template: LetterTemplateId; tone?: Tone; length?: Length;
  manager?: string; motivation?: string; referrer?: string;
}

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : '');
const trimEnd = (s: string) => s.trim().replace(/[.;,]+$/, '');
const PAST = /^(\w+ed|built|ran|led|cut|grew|made|won|wrote|drove|set|took|began|brought|taught|kept|sold|spent|held|met|shipped|rebuilt|redesigned|launched|owned|saved|raised|hired|mentored|cut)\b/i;
const NUMBER = /\d|%/;
/** "a Product Designer", "an Engineer": the title as the user wrote it. */
const an = (title: string) => `${/^[aeiou]/i.test(title) && !/^(uni|use|eu)/i.test(title) ? 'an' : 'a'} ${title}`;
const join = (list: string[]) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0] ?? '');

/** A bullet as a sentence in the letter: "At Acme, I led…" or "At Acme: 40% faster checkout." */
function sentence(text: string, company: string, current: boolean, first: boolean): string {
  const at = current || first ? `At ${company || 'my current company'}` : `Before that, at ${company || 'my last company'}`;
  if (PAST.test(text)) return `${at}, I ${lowerFirst(trimEnd(text))}.`;
  if (/^(responsible for|in charge of|part of)\b/i.test(text)) return `${at}, I was ${lowerFirst(trimEnd(text))}.`;
  return `${at}: ${trimEnd(text)}.`;
}

/** "Expert in Figma and prototyping" → "Figma and prototyping"; "5+ years of …" is left to the years line. */
function need(req: string, names: Set<string>): string | null {
  if (/\d+\s*\+?\s*years?/i.test(req)) return null;
  const t = trimEnd(req)
    .replace(/^(you (have|bring|are)|must have|a|an)\s+/i, '')
    .replace(/^(expert|proficient|skilled|experienced|fluent|comfortable|familiar)\s+(in|with|at)\s+/i, '')
    .replace(/^(strong|excellent|solid|proven|deep|good|great|demonstrated)\s+/i, '')
    .replace(/^(hands-on\s+)?experience\s+(in|with|of)?\s*/i, '')
    .replace(/^(knowledge|understanding)\s+of\s+/i, '');
  const first = t.split(/[\s,]+/)[0] ?? '';
  // Tool and product names keep their capitals ("Figma and prototyping"); plain words start lower case
  return (names.has(first.toLowerCase()) || /^[A-Z0-9]{2,}/.test(first) ? t : lowerFirst(t)) || null;
}

const PHRASES: Record<Tone, { open: (role: string, company: string) => string; close: string; sign: string; thanks: string }> = {
  confident: { open: (r, c) => `I'm applying for the ${r} role at ${c}, and I can make an impact from the start.`, close: `I'd like to show you how I'd approach the work. Could we talk this week or next?`, sign: 'Best regards,', thanks: 'Thank you for your time.' },
  warm: { open: (r, c) => `I was excited to see the ${r} opening at ${c}, and I'd love to be considered.`, close: `I'd really enjoy talking about the role and your team's plans.`, sign: 'Warm regards,', thanks: 'Thank you for reading, and I hope to hear from you.' },
  formal: { open: (r, c) => `I am writing to apply for the position of ${r} at ${c}.`, close: `I would welcome the opportunity to discuss my application with you.`, sign: 'Yours sincerely,', thanks: 'Thank you for your consideration.' },
};

export function writeLetter(x: LetterInput): string {
  const p = x.profile;
  const tone = x.tone ?? 'confident';
  const length = x.length ?? 'standard';
  const role = x.role.trim() || '[role]';
  const company = x.company.trim() || '[company]';
  const ph = PHRASES[tone];
  const name = p ? fullName(p) || '[name]' : '[name]';
  const contact = p ? [p.email, p.phone].filter(Boolean).join(' · ') : '';
  const greeting = x.manager?.trim() ? `Dear ${x.manager.trim()},` : `Dear ${company} hiring team,`;
  const years = p?.years_experience ? `${p.years_experience} years` : '[years] years';
  const headline = (p?.headline || p?.work[0]?.title || '[your role]').trim();
  const skills = p ? skillList(p) : [];
  const motivation = x.motivation?.trim() ? trimEnd(x.motivation) : '';
  const proofCount = length === 'short' ? 1 : length === 'standard' ? 2 : 3;

  // The user's own lines, best for the job first (or results with numbers first when there's no description)
  const jd = (x.description ?? '').trim().length > 80 && p ? analyzeJob(x.description!, skills) : null;
  const cov = jd && p ? coverage(p, jd) : null;
  const all = p ? p.work.flatMap((w, wi) => bulletList(w.bullets).map((text) => ({ text, w, wi }))) : [];
  const WEAK_LINE = /^(responsible for|duties|helped|worked on|assisted|involved in|participated in|tasked with)\b/i;
  const names = new Set([...skills, ...(jd?.keywords ?? [])].map((k) => k.toLowerCase().split(/\s+/)[0]));
  let lines = all;
  if (jd && p) {
    const relevant = relevantBullets(p, jd, 8).map((r) => r.text);
    const rank = (l: typeof all[number]) => (relevant.indexOf(l.text) + 1 || 99) + (WEAK_LINE.test(l.text) ? 4 : 0);
    lines = [...all].sort((a, b) => rank(a) - rank(b));
  } else {
    lines = [...all].sort((a, b) => Number(WEAK_LINE.test(a.text)) - Number(WEAK_LINE.test(b.text)) || Number(NUMBER.test(b.text)) - Number(NUMBER.test(a.text)) || a.wi - b.wi);
  }
  // One sentence per line; a second line from the same company starts "There, I…" instead of repeating the name
  let lastCompany: string | null = null;
  const say = (l: typeof all[number]) => {
    const out = l.w.company && l.w.company === lastCompany ? sentence(l.text, '', true, true).replace(/^At my current company/, 'There') : sentence(l.text, l.w.company, l.w.current, l.wi === 0);
    lastCompany = l.w.company; return out;
  };
  const proof = lines.slice(0, proofCount).map(say);
  lastCompany = null;
  const best = lines[0];
  const jobSkills = cov ? cov.keywordsFound.slice(0, 4) : skills.slice(0, 4);
  const skillLine = jobSkills.length ? `I work every day with ${join(jobSkills)}${length === 'detailed' ? ', and I keep learning what the work needs next' : ''}.` : '';
  const proofPara = proof.length ? proof.join(' ') : `In my current work I [an achievement you're proud of].`;
  const out: string[] = [greeting, ''];
  const para = (...s: (string | false | undefined)[]) => { const t = s.filter(Boolean).join(' ').trim(); if (t) out.push(t, ''); };

  switch (x.template) {
    case 'matched': {
      const reqs = cov ? cov.matches.filter((m) => m.status !== 'missing').map((m) => ({ m, n: need(m.requirement.text, names) })).filter((x) => x.n) : [];
      const asked = reqs.slice(0, 3).map((x) => x.n!);
      para(ph.open(role, company), asked.length ? `Your posting asks for ${join(asked)}. That is the work I've been doing as ${an(headline)} for ${years}.` : '');
      if (cov && length !== 'short') {
        // Requirement by requirement, each answered with the user's own work line that best shows it
        lastCompany = null;
        const used = new Set<string>();
        const answered: string[] = [];
        for (const { m, n } of reqs) {
          if (answered.length >= proofCount) break;
          const keys = m.requirement.keywords;
          const hit = lines.find((l) => !used.has(l.text) && (m.evidence?.text === l.text || keys.some((k) => mentions(l.text, k))));
          if (!hit) continue;
          used.add(hit.text);
          answered.push(`You ask for ${n}. ${say(hit)}`);
        }
        // Not every requirement has a work line: add the user's most relevant lines
        for (const l of lines) { if (answered.length >= Math.min(2, proofCount)) break; if (!used.has(l.text)) { used.add(l.text); answered.push(say(l)); } }
        if (answered.length) answered.forEach((a) => para(a)); else para(proofPara);
      } else para(proofPara);
      para(skillLine, motivation && `I'm drawn to ${company} because ${lowerFirst(motivation)}.`);
      break;
    }
    case 'achievement': {
      const lead = best ? `${trimEnd(best.text)}${best.w.company ? `: that was my work at ${best.w.company}` : ''}.` : '[Your strongest result, with a number].';
      para(lead, `I'd like to bring the same results to ${company} as your ${role}.`);
      para(proof.slice(best ? 1 : 0).join(' ') || false, length !== 'short' && `I'm ${an(headline)} with ${years} of experience.`, skillLine);
      para(motivation && `What draws me to ${company} is that ${lowerFirst(motivation)}.`);
      break;
    }
    case 'company': {
      para(motivation ? `${company} ${/^(is|has|makes|builds|helps)\b/i.test(motivation) ? motivation : `stands out to me because ${lowerFirst(motivation)}`}.` : `${company} stands out to me because [why you want to work there: a product, a mission, something they did].`,
        `That's why I'm applying for the ${role} role.`);
      para(`As ${an(headline)} with ${years} of experience, I've done work that fits what you're building.`, proofPara);
      para(skillLine);
      break;
    }
    case 'switch': {
      para(ph.open(role, company), `My background is as ${an(headline)}, and this move builds directly on what I already do well.`);
      out.push('What carries over:');
      const carry = lines.slice(0, Math.max(2, proofCount)).map((l) => `- ${trimEnd(l.text)}`);
      out.push(...(carry.length ? carry : ['- [a result that carries over]', '- [a skill that carries over]']), '');
      para(jobSkills.length ? `I also bring hands-on skill with ${join(jobSkills)}.` : '', `I learn fast, and I'd bring a fresh view to ${company}.`);
      break;
    }
    case 'referral': {
      const ref = x.referrer?.trim() || '[who referred you]';
      para(`${ref} suggested I get in touch about the ${role} role at ${company}.`, `I'm ${an(headline)} with ${years} of experience, and I think I'd be a strong fit.`);
      para(proofPara, skillLine);
      para(motivation && `I'm drawn to ${company} because ${lowerFirst(motivation)}.`);
      break;
    }
    case 'graduate': {
      const edu = p?.education[0];
      const study = edu ? `${[edu.degree, edu.field].filter(Boolean).join(' in ') || 'my degree'} at ${edu.school || '[school]'}` : '[your degree] at [school]';
      para(ph.open(role, company), `I ${edu?.end && Date.parse(edu.end) > Date.now() ? 'am finishing' : 'recently finished'} ${study}.`);
      para(proof.length ? `During my studies and early work: ${proof.join(' ')}` : `During my studies I [a project, internship or result you're proud of].`);
      para(skills.length ? `I've built hands-on skill with ${join(skills.slice(0, 4))}, and I'm keen to learn from an experienced team.` : `I'm keen to learn from an experienced team.`);
      break;
    }
    case 'email': {
      out.splice(0, 2, x.manager?.trim() ? `Hi ${x.manager.trim().split(/\s+/)[0]},` : 'Hi,', '');
      para(`I'm interested in the ${role} role at ${company}${x.referrer?.trim() ? ` (${x.referrer.trim()} suggested I reach out)` : ''}.`, `I'm ${an(headline)} with ${years} of experience; ${best ? lowerFirst(trimEnd(best.text)) : '[a recent result]'}.`);
      para(`Would you be open to a short call? My resume is attached.`);
      out.push('Thanks,', name, contact);
      return out.join('\n').trim();
    }
  }
  para(length === 'detailed' && x.template !== 'company' ? `I've attached my resume with more detail on each role.` : '', ph.close, ph.thanks);
  out.push(ph.sign, name);
  if (contact) out.push(contact);
  return out.join('\n').trim();
}

/** Quick checks before sending. */
export interface LetterCheck { label: string; ok: boolean }
export function letterChecks(text: string, company: string, role: string): LetterCheck[] {
  const words = text.split(/\s+/).filter(Boolean).length;
  return [
    { label: 'No [gaps] left to fill', ok: !/\[[a-z ,:'’-]+\]/i.test(text) },
    { label: 'Names the company', ok: !!company.trim() && text.toLowerCase().includes(company.trim().toLowerCase()) },
    { label: 'Names the role', ok: !!role.trim() && text.toLowerCase().includes(role.trim().toLowerCase()) },
    { label: 'Shows a result with a number', ok: /\d/.test(text.replace(/[+\d][\d\s().-]{6,}\d/g, '').replace(/\S+@\S+/g, '')) },
    { label: words < 120 ? `Short (${words} words)` : `Under 400 words (${words})`, ok: words <= 400 },
  ];
}
