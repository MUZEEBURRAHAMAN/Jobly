import { EduItem, newProfileId, Profile, ProjectItem, WorkItem } from './profile';

/**
 * Reads a LinkedIn "Save to PDF" export or a resume PDF in the browser and turns it into profile fields.
 * Nothing is uploaded: pdf.js runs inside the extension. The result is a best guess that the user reviews step by
 * step before anything is saved.
 */

export interface PdfLine { text: string; size: number; x: number; y: number; page: number; side: boolean }
export interface ImportResult {
  source: 'linkedin' | 'resume';
  profile: Partial<Profile>;
  /** What was found, for the review screen: "Name", "Email", "4 roles"... */
  found: string[];
}

const MAX_PAGES = 8;
export const MAX_IMPORT_BYTES = 5_000_000;

/** A piece of text from pdf.js: its string, position, width and font size. */
export interface PdfItem { str: string; x: number; y: number; w: number; size: number; page: number; pageWidth: number }

/** Text lines of a PDF with their font size and position. LinkedIn's left column ("Contact", "Top Skills") is marked `side`. */
export async function pdfLines(data: ArrayBuffer): Promise<PdfLine[]> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
  const items: PdfItem[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
    const page = await doc.getPage(n);
    const width = page.getViewport({ scale: 1 }).width;
    const content = await page.getTextContent();
    for (const raw of content.items) {
      if (!('str' in raw) || !raw.str.trim()) continue;
      const [, , c, d, e, f] = raw.transform as number[];
      items.push({ str: raw.str, x: e, y: f, w: raw.width, size: Math.round(Math.hypot(c, d) * 10) / 10, page: n, pageWidth: width });
    }
  }
  await doc.destroy();
  return linesFromItems(items);
}

/** Groups pdf.js text pieces into lines in reading order. */
export function linesFromItems(items: PdfItem[]): PdfLine[] {
  // LinkedIn's export has a narrow left column; a resume is read as one column
  const narrow = (it: PdfItem) => it.x < it.pageWidth * 0.34;
  const linkedin = items.some((it) => it.str.trim() === 'Contact' && narrow(it)) && items.some((it) => /^(Experience|Summary|Education)$/.test(it.str.trim()) && !narrow(it));
  const groups = new Map<string, PdfItem[]>();
  for (const it of items) {
    const side = linkedin && narrow(it);
    const key = `${it.page}|${side ? 1 : 0}|${Math.round(it.y / 2)}`;
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  const lines: PdfLine[] = [];
  for (const [key, group] of groups) {
    group.sort((a, b) => a.x - b.x);
    let text = '';
    let end = -Infinity;
    for (const it of group) {
      if (text && it.x - end > it.size * 0.2 && !text.endsWith(' ') && !it.str.startsWith(' ')) text += ' ';
      text += it.str; end = it.x + it.w;
    }
    const [page, side] = key.split('|');
    lines.push({ text: text.replace(/\s+/g, ' ').trim(), size: Math.max(...group.map((g) => g.size)), x: group[0].x, y: group[0].y, page: Number(page), side: side === '1' });
  }
  // Reading order: page, then top to bottom (PDF y grows upwards)
  return lines.filter((l) => l.text).sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
}

// ---------- parsing ----------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
const POINT = String.raw`(?:${MONTH}\s+\d{4}|\d{1,2}/\d{4}|\d{4})`;
const RANGE = new RegExp(String.raw`(${POINT})\s*(?:-|–|—|to)\s*(present|current|now|${POINT})`, 'i');
const TENURE = /^(?:\d+\s+years?)?\s*(?:\d+\s+months?)?$/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/;

/** "Jan 2022" → "2022-01"; "2019" → "2019-01"; "03/2021" → "2021-03". */
export function monthOf(v: string): string {
  const s = v.trim().toLowerCase();
  const slash = /^(\d{1,2})\/(\d{4})$/.exec(s);
  if (slash) return `${slash[2]}-${slash[1].padStart(2, '0')}`;
  const named = /^([a-z]+)\.?\s+(\d{4})$/.exec(s);
  if (named) { const m = MONTHS.indexOf(named[1].slice(0, 3)); if (m >= 0) return `${named[2]}-${String(m + 1).padStart(2, '0')}`; }
  const year = /^(\d{4})$/.exec(s);
  return year ? `${year[1]}-01` : '';
}

function range(text: string): { start: string; end: string; current: boolean } | null {
  const m = RANGE.exec(text);
  if (!m) return null;
  const current = /present|current|now/i.test(m[2]);
  return { start: monthOf(m[1]), end: current ? '' : monthOf(m[2]), current };
}

/** Countries and regions that end a "City, Country" place. */
const COUNTRY = 'India|USA|US|U\\.S\\.|United States|UK|United Kingdom|Canada|Germany|France|Netherlands|Spain|Ireland|Australia|Singapore|UAE|Japan|Israel|Poland|Portugal|Sweden|Brazil|Mexico|Remote';
/** Words that make a phrase a job title, to tell "Company | Title" from "Title | Company". */
const TITLE_WORDS = /\b(engineer|developer|designer|manager|lead|head|director|intern|analyst|scientist|architect|consultant|specialist|officer|associate|coordinator|founder|ceo|cto|vp|president|researcher|administrator|writer|editor|marketer|recruiter|executive|assistant|technician|programmer|strategist|product owner)\b/i;
/** A skills line split on commas, but not inside brackets ("AWS (EC2, S3)" stays one skill). */
export function splitSkills(line: string): string[] {
  const out: string[] = []; let depth = 0; let cur = '';
  for (const ch of line) {
    if (ch === '(') depth++; if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,•|;·]/.test(ch)) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const isRangeLine = (t: string) => { const m = RANGE.exec(t); return !!m && t.replace(m[0], '').replace(/\(.*?\)/g, '').trim().length < 4; };
const looksLikePlace = (t: string) => t.length < 80 && !RANGE.test(t) && (/,/.test(t) || /\b(remote|hybrid|on-?site|india|united states|united kingdom|area)\b/i.test(t)) && !/[.!?]$/.test(t);
const yearsSince = (start: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(start);
  if (!m) return '';
  const months = (new Date().getFullYear() - Number(m[1])) * 12 + new Date().getMonth() + 1 - Number(m[2]);
  return months >= 12 ? String(Math.floor(months / 12)) : '';
};

/** Splits lines into sections by their heading ("Experience", "EDUCATION", "Technical skills"...). */
function sections(lines: PdfLine[], headings: Record<string, RegExp>): { head: PdfLine[]; parts: Record<string, PdfLine[]> } {
  const parts: Record<string, PdfLine[]> = {};
  const head: PdfLine[] = [];
  let current: string | null = null;
  for (const l of lines) {
    const t = l.text.replace(/[:\s]+$/, '');
    const hit = t.length < 40 ? Object.entries(headings).find(([, rx]) => rx.test(t)) : undefined;
    if (hit) { current = hit[0]; parts[current] = parts[current] ?? []; continue; }
    if (/^Page \d+ of \d+$/i.test(l.text)) continue;
    (current ? parts[current] : head).push(l);
  }
  return { head, parts };
}

function contactFrom(text: string, into: Partial<Profile>, found: string[]) {
  const email = EMAIL.exec(text)?.[0];
  if (email) { into.email = email; found.push('Email'); }
  const phone = PHONE.exec(text.replace(EMAIL, ' ').replace(/https?:\/\/\S+|www\.\S+/g, ' '))?.[0].trim();
  if (phone && phone.replace(/\D/g, '').length >= 8 && phone.replace(/\D/g, '').length <= 15) { into.phone = phone; found.push('Phone'); }
  const compact = text.replace(/-\s+/g, '-').replace(/\s+/g, ' ');
  const linkedin = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]+/i.exec(compact.replace(/(linkedin\.com\/in\/[A-Za-z0-9_%-]+)\s+([A-Za-z0-9_%-]+)(?=\s*\(LinkedIn\))/i, '$1$2'))?.[0];
  if (linkedin) { into.linkedin = linkedin.replace(/^https?:\/\//, ''); found.push('LinkedIn'); }
  const github = /(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_-]+/i.exec(compact)?.[0];
  if (github) into.github = github.replace(/^https?:\/\//, '');
  // LinkedIn labels other links "(Portfolio)", "(Personal)", "(Company)"
  const portfolio = /((?:https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(?:\/\S*)?)\s*\((?:Portfolio|Personal)\)/i.exec(compact)?.[1]
    ?? /\b((?:https?:\/\/)?(?:www\.)?(?:behance\.net|dribbble\.com)\/[A-Za-z0-9_-]+)/i.exec(compact)?.[1];
  if (portfolio) into.portfolio = portfolio.replace(/^https?:\/\//, '');
}

/** LinkedIn's export: name, headline and place on top; Summary, Experience and Education below; contact and skills on the left. */
export function parseLinkedIn(lines: PdfLine[]): ImportResult {
  const found: string[] = [];
  const p: Partial<Profile> = {};
  const side = lines.filter((l) => l.side);
  const main = lines.filter((l) => !l.side);

  const left = sections(side, { contact: /^Contact$/i, skills: /^Top Skills$/i, languages: /^Languages$/i, certifications: /^(Licenses & )?Certifications$/i, honors: /^Honors-Awards$/i, publications: /^Publications$/i });
  contactFrom((left.parts.contact ?? []).map((l) => l.text).join(' '), p, found);
  const skills = (left.parts.skills ?? []).map((l) => l.text).filter((t) => t.length < 60);
  if (skills.length) { p.skills = skills.join(', '); found.push(`${skills.length} skills`); }

  const body = sections(main, { summary: /^(Summary|About)$/i, experience: /^Experience$/i, education: /^Education$/i, volunteer: /^Volunteer Experience$/i, projects: /^Projects$/i });
  // Top: the name is the biggest text, then the headline (it can wrap), and the place on the last line
  const top = body.head;
  const nameIdx = top.reduce((best, l, i) => (l.size > (top[best]?.size ?? 0) ? i : best), 0);
  const name = top[nameIdx]?.text ?? '';
  if (name) {
    const parts = name.split(' ');
    p.first_name = parts.slice(0, -1).join(' ') || parts[0];
    p.last_name = parts.length > 1 ? parts[parts.length - 1] : '';
    found.push('Name');
  }
  const rest = top.slice(nameIdx + 1).map((l) => l.text);
  if (rest.length) {
    const placeLast = rest.length > 1 && looksLikePlace(rest[rest.length - 1]);
    if (placeLast) { p.location = rest[rest.length - 1]; found.push('Location'); }
    const headline = (placeLast ? rest.slice(0, -1) : rest).join(' ').trim();
    if (headline) { p.headline = headline.slice(0, 160); found.push('Headline'); }
  }
  const summary = (body.parts.summary ?? []).map((l) => l.text).join(' ').trim();
  if (summary) { p.summary = summary; found.push('Summary'); }

  const work = experienceFrom(body.parts.experience ?? []);
  if (work.length) {
    p.work = work; found.push(`${work.length} role${work.length === 1 ? '' : 's'}`);
    const earliest = work.map((w) => w.start).filter(Boolean).sort()[0];
    if (earliest) p.years_experience = yearsSince(earliest);
  }
  const education = educationFrom(body.parts.education ?? []);
  if (education.length) { p.education = education; found.push(`${education.length} school${education.length === 1 ? '' : 's'}`); }
  return { source: 'linkedin', profile: p, found };
}

/**
 * Roles from LinkedIn's Experience list. Each role is a title line followed by a date line; the company is the line
 * before the title (larger type), except under one company with several roles, where a "3 years 2 months" line
 * follows the company and later roles reuse it.
 */
function experienceFrom(lines: PdfLine[]): WorkItem[] {
  const dates = lines.map((l, i) => (isRangeLine(l.text) ? i : -1)).filter((i) => i > 0);
  type Head = { dateIdx: number; titleIdx: number; companyIdx: number; company: string };
  const heads: Head[] = [];
  let lastCompany = '';
  let prevDate = -1;
  for (const i of dates) {
    const titleIdx = i - 1;
    const title = lines[titleIdx];
    let companyIdx = -1;
    const before = lines[i - 2];
    if (before && i - 2 > prevDate) {
      if (TENURE.test(before.text) && before.text.trim() && lines[i - 3] && i - 3 > prevDate) companyIdx = i - 3;
      else if (before.size > title.size + 0.2 || i - 2 === 0 || (heads.length === 0)) companyIdx = i - 2;
    }
    if (companyIdx >= 0) lastCompany = lines[companyIdx].text;
    heads.push({ dateIdx: i, titleIdx, companyIdx, company: lastCompany });
    prevDate = i;
  }
  return heads.slice(0, 15).map((h, k) => {
    const next = heads[k + 1];
    // this role's text runs until the next role's company line (or its title, under the same company)
    const stop = next ? (next.companyIdx > h.dateIdx ? next.companyIdx : next.titleIdx) : lines.length;
    let from = h.dateIdx + 1;
    let location = '';
    if (lines[from] && from < stop && looksLikePlace(lines[from].text)) { location = lines[from].text; from++; }
    const body = lines.slice(from, stop).map((l) => l.text).filter((t) => !TENURE.test(t) || !t.trim());
    const r = range(lines[h.dateIdx].text)!;
    return {
      id: newProfileId(), company: h.company, title: lines[h.titleIdx].text, location, start: r.start, end: r.end, current: r.current,
      bullets: joinBullets(body),
    };
  });
}

/** Wrapped lines back into one point per line: a new point starts after a full stop or at a bullet sign. */
function joinBullets(lines: string[]): string {
  const out: string[] = [];
  let fresh = false;  // a bullet sign on a line of its own: the next line starts a point
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    if (/^[-•*▪◦●∙·]$/.test(t)) { fresh = true; continue; }
    const bullet = fresh || /^[-•*▪◦●∙]\s*/.test(t);
    fresh = false;
    const clean = t.replace(/^[-•*▪◦●∙]\s*/, '');
    if (!out.length || bullet || /[.!?:]$/.test(out[out.length - 1])) out.push(clean);
    else out[out.length - 1] += ` ${clean}`;
  }
  return out.join('\n').slice(0, 2500);
}

/** LinkedIn education: the school, then "Degree, Field · (2015 - 2019)" (which can wrap onto a second line). */
function educationFrom(lines: PdfLine[]): EduItem[] {
  const out: EduItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const school = lines[i].text;
    let detail = '';
    let j = i + 1;
    // the detail line is smaller than the school and runs until its closing date bracket
    while (j < lines.length && lines[j].size < lines[i].size - 0.2 && detail.length < 300) { detail += `${detail ? ' ' : ''}${lines[j].text}`; j++; if (/\)\s*$/.test(detail)) break; }
    if (!detail && !(/(university|college|institute|school|academy|iit|nit)/i.test(school))) continue;
    const [what, when = ''] = detail.split(/\s+·\s+/);
    const r = range(when.replace(/[()]/g, '')) ?? range(detail);
    const yearOnly = /\((\d{4})\)/.exec(detail)?.[1];
    const [degree, ...fieldParts] = (when ? what : detail.replace(/\(.*?\)/g, '')).split(',');
    out.push({ id: newProfileId(), school, degree: (degree ?? '').trim(), field: fieldParts.join(',').trim(), start: r?.start ?? '', end: r ? r.end : yearOnly ? `${yearOnly}-01` : '' });
    i = j - 1;
  }
  return out.slice(0, 8);
}

/** Any other resume: contact details anywhere, sections by their usual headings, roles from lines with a date range. */
export function parseResume(lines: PdfLine[]): ImportResult {
  const found: string[] = [];
  const p: Partial<Profile> = {};
  contactFrom(lines.map((l) => l.text).join(' '), p, found);
  const s = sections(lines, {
    summary: /^(summary|profile|about( me)?|professional summary|objective)$/i,
    experience: /^(experience|work experience|professional experience|employment( history)?|work history|career history)$/i,
    education: /^(education|education & training|academic background)$/i,
    skills: /^(skills|technical skills|core skills|key skills|core competencies|tools|skills & tools)$/i,
    projects: /^((selected|personal|key|academic) )?projects$/i,
    achievements: /^(achievements|awards|honou?rs( (&|and) awards)?|achievements (&|and) (leadership|awards)|leadership|accomplishments)$/i,
    other: /^(certifications|languages|interests|publications|volunteering|references)$/i,
  });
  // The name: the biggest text near the top that isn't contact details
  const candidates = s.head.slice(0, 6).filter((l) => !EMAIL.test(l.text) && !/\d{3}/.test(l.text) && l.text.split(' ').length <= 5);
  const nameLine = candidates.sort((a, b) => b.size - a.size)[0];
  if (nameLine) {
    const parts = nameLine.text.replace(/\s+/g, ' ').split(' ');
    p.first_name = parts.slice(0, -1).join(' ') || parts[0]; p.last_name = parts.length > 1 ? parts[parts.length - 1] : '';
    found.push('Name');
    const after = s.head[s.head.indexOf(nameLine) + 1]?.text;
    if (after && !EMAIL.test(after) && !PHONE.test(after) && after.length < 120) { p.headline = after; found.push('Headline'); }
  }
  // A bare web address in the contact lines ("yourname.com") is the portfolio
  if (!p.portfolio) {
    const site = s.head.slice(0, 8).flatMap((l) => l.text.split(/\s*[|·•,]\s*|\s{2,}/)).map((t) => t.trim())
      .find((t) => /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(t) && !EMAIL.test(t) && !/linkedin\.com|github\.com/i.test(t));
    if (site) { p.portfolio = site.replace(/^https?:\/\//, ''); found.push('Website'); }
  }
  // The place usually sits in the contact line: "email · phone · Pune, India"
  const place = s.head.slice(0, 8).flatMap((l) => l.text.split(/\s*[·|•]\s*/)).find((t) => looksLikePlace(t) && !EMAIL.test(t) && !/\d{4}|https?:|www\.|\.com/.test(t));
  if (place) { p.location = place; found.push('Location'); }
  const summary = (s.parts.summary ?? []).map((l) => l.text).join(' ').trim();
  if (summary) { p.summary = summary.slice(0, 3000); found.push('Summary'); }
  // Skills: grouped lines ("Backend: Node.js, Express") stay grouped; a wrapped line joins the group above it
  const skillLines = (s.parts.skills ?? []).map((l) => l.text.trim()).filter(Boolean);
  const LABEL = /^([^:,]{2,40}):\s*(.+)$/;
  if (skillLines.filter((l) => LABEL.test(l)).length >= 2) {
    const groups: string[] = [];
    for (const l of skillLines) { if (LABEL.test(l) || !groups.length) groups.push(l.replace(/\s*[•|;·]\s*/g, ', ')); else groups[groups.length - 1] += `, ${l}`; }
    p.skills = groups.slice(0, 12).join('\n').slice(0, 3000);
    found.push(`${groups.length} skill groups`);
  } else {
    const skills = skillLines.flatMap((l) => splitSkills(l.replace(/^[^:]{1,30}:\s*/, ''))).filter((t) => t && t.length < 40);
    if (skills.length) { p.skills = [...new Set(skills)].slice(0, 40).join(', '); found.push(`${Math.min(skills.length, 40)} skills`); }
  }

  // Roles: each line with a date range starts one. "Title, Company  Jan 2020 – Present", or the title and company on the line before.
  const exp = s.parts.experience ?? [];
  const work: WorkItem[] = [];
  for (let i = 0; i < exp.length && work.length < 15; i++) {
    const r = range(exp[i].text);
    if (!r) continue;
    let rest = exp[i].text.replace(RANGE, '').replace(/\((?![^)]*\b(intern|internship|contract|part[- ]time|freelance)\b).*?\)/gi, '').trim().replace(/[|–—,·•-]\s*$/, '').trim();
    // "Company | Title   Remote · Sep 2025 – Present": the place sits just before the dates
    let location = '';
    // a work mode always; a "City, Country" only when a separator ties it to the dates ("Delhi, India · Jan 2020 –")
    const mode = /\s+(remote|hybrid|on-?site)$/i.exec(rest);
    const city = new RegExp(`\\s+([A-Z][a-zA-Z.]+(?: [A-Z][a-zA-Z.]+)?, (?:${COUNTRY}|[A-Z]{2}))$`).exec(rest);
    const place = mode ?? city;
    if (place && rest.length - place[0].length > 2) { location = place[1]; rest = rest.slice(0, place.index).replace(/[|–—,·•-]\s*$/, '').trim(); }
    let title = ''; let company = '';
    const split = (t: string) => t.split(/\s+(?:at|@|\||—|–|-)\s+|,\s+/).map((x) => x.trim()).filter(Boolean);
    if (rest.length > 2) [title, company = ''] = split(rest);
    else if (exp[i - 1] && !range(exp[i - 1].text)) [title, company = ''] = split(exp[i - 1].text);
    // "Company | Title" (company first): the part that reads like a job title is the title
    if (company && TITLE_WORDS.test(company) && !TITLE_WORDS.test(title)) [title, company] = [company, title];
    let j = i + 1; const body: string[] = [];
    while (j < exp.length && !range(exp[j].text) && !(exp[j + 1] && isRangeLine(exp[j + 1].text))) { body.push(exp[j].text); j++; }
    work.push({ id: newProfileId(), title, company, location, start: r.start, end: r.end, current: r.current, bullets: joinBullets(body) });
  }
  if (work.length) {
    p.work = work; found.push(`${work.length} role${work.length === 1 ? '' : 's'}`);
    const earliest = work.map((w) => w.start).filter(Boolean).sort()[0];
    if (earliest) p.years_experience = yearsSince(earliest);
  }
  const edu: EduItem[] = [];
  const eduLines = s.parts.education ?? [];
  for (let i = 0; i < eduLines.length && edu.length < 8; i++) {
    const t = eduLines[i].text;
    if (!/(university|college|institute|school|academy|polytechnic)/i.test(t)) continue;
    const near = [t, eduLines[i + 1]?.text ?? ''].join(' ');
    const degreeLine = [eduLines[i + 1]?.text, eduLines[i - 1]?.text].find((x) => x && /\b(bachelor|master|b\.?\s?(sc|tech|des|a|e|com)|m\.?\s?(sc|tech|des|a|ba|s)|phd|diploma|mba|bs|ba|ms|ma)\b/i.test(x)) ?? '';
    const r = range(near);
    const [degree, ...field] = degreeLine.replace(RANGE, '').replace(/[|·]/g, ',').split(/,| in /);
    let school = t.replace(RANGE, '').replace(/[|,–—-]\s*$/, '').trim();
    const where = new RegExp(`\\s+([A-Z][a-zA-Z.]+(?: [A-Z][a-zA-Z.]+)?, (?:${COUNTRY}|[A-Z]{2}))$`).exec(school);
    if (where && /(university|college|institute|school|academy|polytechnic|\))/i.test(school.slice(0, where.index))) school = school.slice(0, where.index).trim();
    const grade = eduLines.slice(i + 1, i + 4).map((l) => l.text).find((x) => /\b(c?gpa|grade|percentage|score)\b\s*[:\-]?\s*\d/i.test(x)) ?? '';
    edu.push({ id: newProfileId(), school, degree: (degree ?? '').trim(), field: field.join(' ').trim().replace(/^,\s*/, ''), start: r?.start ?? '', end: r ? r.end : '', location: where?.[1] ?? '', grade: grade.slice(0, 60) });
  }
  if (edu.length) { p.education = edu; found.push(`${edu.length} school${edu.length === 1 ? '' : 's'}`); }

  // Projects: a heading line "Name | Built with   GitHub | Live Demo" followed by its points
  const proj = (s.parts.projects ?? []).map((l) => l.text.trim()).filter(Boolean);
  const projects: ProjectItem[] = [];
  const isBullet = (t: string | undefined) => !!t && /^[-•*▪◦●∙]/.test(t);
  for (let i = 0; i < proj.length && projects.length < 10; i++) {
    const t = proj[i];
    if (isBullet(t) || !(/\s\|\s/.test(t) && (isBullet(proj[i + 1]) || i === 0))) continue;
    const head = t.replace(/(\s+(github|live demo|demo|npm|website|link|code|repo|app store|play store)(\s*\|\s*|\s*$))+$/i, '').trim();
    const [name, ...tech] = head.split(/\s+\|\s+/);
    let j = i + 1; const body: string[] = [];
    while (j < proj.length && !(/\s\|\s/.test(proj[j]) && !isBullet(proj[j]) && isBullet(proj[j + 1]))) { body.push(proj[j]); j++; }
    projects.push({ id: newProfileId(), name: name.slice(0, 120), tech: tech.join(', ').slice(0, 200), link: '', bullets: joinBullets(body) });
    i = j - 1;
  }
  if (projects.length) { p.projects = projects; found.push(`${projects.length} project${projects.length === 1 ? '' : 's'}`); }
  const ach = joinBullets((s.parts.achievements ?? []).map((l) => l.text));
  if (ach) { p.achievements = ach; found.push('Achievements'); }
  return { source: 'resume', profile: p, found };
}

/** Reads a PDF file and returns what it could find. Throws a message for the user when the file can't be read. */
export async function importPdf(file: File): Promise<ImportResult> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('That file is over 5 MB. Use the PDF LinkedIn makes, or a smaller resume.');
  if (!/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)) throw new Error('Use a PDF file.');
  let lines: PdfLine[];
  try { lines = await pdfLines(await file.arrayBuffer()); } catch { throw new Error("Couldn't read that PDF. Try saving it again, or fill in the steps by hand."); }
  if (lines.length < 3) throw new Error('That PDF has no text Jobly can read (it may be a scan). Fill in the steps by hand.');
  return lines.some((l) => l.side) ? parseLinkedIn(lines) : parseResume(lines);
}

/** Puts imported fields into a profile: empty fields are filled; experience and education only when asked (or empty). */
export function mergeImport(base: Profile, imported: Partial<Profile>, replaceLists: { work: boolean; education: boolean }): Profile {
  const out: Profile = { ...base };
  const scalar: (keyof Profile)[] = ['first_name', 'last_name', 'email', 'phone', 'location', 'headline', 'summary', 'linkedin', 'github', 'portfolio', 'website', 'years_experience', 'skills'];
  for (const k of scalar) {
    const v = imported[k];
    if (typeof v === 'string' && v.trim() && !String(out[k] ?? '').trim()) (out[k] as string) = v.trim();
  }
  if (imported.work?.length && (replaceLists.work || !out.work.length)) out.work = imported.work;
  if (imported.education?.length && (replaceLists.education || !out.education.length)) out.education = imported.education;
  return out;
}

// ---------- Word (.docx) ----------

/** Paragraphs of a Word file as lines, with a size so headings and the name stand out (read in the browser). */
export async function docxLines(data: ArrayBuffer): Promise<PdfLine[]> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const files = unzipSync(new Uint8Array(data), { filter: (f) => f.name === 'word/document.xml' });
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('not a docx');
  const doc = new DOMParser().parseFromString(strFromU8(xml), 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const lines: PdfLine[] = [];
  let y = 100000;
  for (const p of Array.from(doc.getElementsByTagNameNS(W, 'p'))) {
    const runs = Array.from(p.getElementsByTagNameNS(W, 'r'));
    let text = '';
    let size = 0;
    for (const r of runs) {
      for (const node of Array.from(r.childNodes)) {
        const el = node as Element;
        if (el.localName === 't') text += el.textContent ?? '';
        else if (el.localName === 'tab') text += ' ';
        else if (el.localName === 'br') text += ' ';
      }
      const sz = r.getElementsByTagNameNS(W, 'sz')[0]?.getAttributeNS(W, 'val');
      if (sz) size = Math.max(size, Number(sz) / 2);
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    // Styles without a run size: titles and headings count as bigger text
    const style = p.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') ?? '';
    if (!size) size = /^title$/i.test(style) ? 24 : /heading1/i.test(style) ? 16 : /heading/i.test(style) ? 13 : 11;
    const bullet = p.getElementsByTagNameNS(W, 'numPr').length > 0;
    lines.push({ text: bullet ? `• ${text}` : text, size, x: 0, y: y--, page: 1, side: false });
  }
  return lines;
}

// ---------- JSON Resume (jsonresume.org) ----------

interface JsonResume {
  basics?: { name?: string; label?: string; email?: string; phone?: string; url?: string; summary?: string; location?: { city?: string; region?: string; countryCode?: string };
    profiles?: { network?: string; url?: string; username?: string }[] };
  work?: { name?: string; company?: string; position?: string; location?: string; startDate?: string; endDate?: string; summary?: string; highlights?: string[] }[];
  education?: { institution?: string; area?: string; studyType?: string; startDate?: string; endDate?: string }[];
  skills?: { name?: string; keywords?: string[] }[];
}

const ym = (d?: string) => (d && /^\d{4}(-\d{2})?/.test(d) ? (d.length >= 7 ? d.slice(0, 7) : `${d.slice(0, 4)}-01`) : '');

export function fromJsonResume(j: JsonResume): ImportResult {
  const b = j.basics ?? {};
  const found: string[] = [];
  const p: Partial<Profile> = {};
  if (b.name) { const parts = b.name.trim().split(/\s+/); p.first_name = parts.slice(0, -1).join(' ') || parts[0]; p.last_name = parts.length > 1 ? parts[parts.length - 1] : ''; found.push('Name'); }
  if (b.label) { p.headline = b.label; found.push('Headline'); }
  if (b.email) { p.email = b.email; found.push('Email'); }
  if (b.phone) { p.phone = b.phone; found.push('Phone'); }
  if (b.summary) { p.summary = b.summary; found.push('Summary'); }
  const loc = [b.location?.city, b.location?.region, b.location?.countryCode].filter(Boolean).join(', ');
  if (loc) { p.location = loc; found.push('Location'); }
  for (const prof of b.profiles ?? []) {
    const url = (prof.url ?? '').replace(/^https?:\/\//, '');
    if (/linkedin/i.test(prof.network ?? url)) p.linkedin = url;
    else if (/github/i.test(prof.network ?? url)) p.github = url;
    else if (/behance|dribbble/i.test(prof.network ?? url)) p.portfolio = url;
  }
  if (b.url) p.website = b.url.replace(/^https?:\/\//, '');
  const work: WorkItem[] = (j.work ?? []).slice(0, 15).map((w) => ({
    id: newProfileId(), company: w.name ?? w.company ?? '', title: w.position ?? '', location: w.location ?? '', start: ym(w.startDate), end: ym(w.endDate), current: !w.endDate,
    bullets: [w.summary, ...(w.highlights ?? [])].filter(Boolean).join('\n').slice(0, 2500),
  }));
  if (work.length) { p.work = work; found.push(`${work.length} role${work.length === 1 ? '' : 's'}`); }
  const education: EduItem[] = (j.education ?? []).slice(0, 8).map((e) => ({ id: newProfileId(), school: e.institution ?? '', degree: e.studyType ?? '', field: e.area ?? '', start: ym(e.startDate), end: ym(e.endDate) }));
  if (education.length) { p.education = education; found.push(`${education.length} school${education.length === 1 ? '' : 's'}`); }
  const skills = (j.skills ?? []).flatMap((s) => [s.name, ...(s.keywords ?? [])]).filter((s): s is string => !!s && s.length < 60);
  if (skills.length) { p.skills = [...new Set(skills)].slice(0, 40).join(', '); found.push(`${Math.min(skills.length, 40)} skills`); }
  return { source: 'resume', profile: p, found };
}

/** The profile as a JSON Resume file (jsonresume.org), which other resume tools can read. */
export function toJsonResume(p: Profile): JsonResume & { $schema: string } {
  const profiles = [['LinkedIn', p.linkedin], ['GitHub', p.github], ['Portfolio', p.portfolio]].filter(([, u]) => u)
    .map(([network, u]) => ({ network, url: /^https?:/.test(u) ? u : `https://${u}` }));
  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: { name: [p.first_name, p.last_name].filter(Boolean).join(' '), label: p.headline, email: p.email, phone: p.phone, summary: p.summary,
      url: p.website ? (/^https?:/.test(p.website) ? p.website : `https://${p.website}`) : undefined, location: p.location ? { city: p.location } : undefined, profiles },
    work: p.work.map((w) => ({ name: w.company, position: w.title, location: w.location, startDate: w.start, endDate: w.current ? undefined : w.end || undefined,
      highlights: w.bullets.split('\n').map((x) => x.replace(/^[-•*]\s*/, '').trim()).filter(Boolean) })),
    education: p.education.map((e) => ({ institution: e.school, area: e.field, studyType: e.degree, startDate: e.start, endDate: e.end })),
    skills: p.skills ? [{ name: 'Skills', keywords: p.skills.split(',').map((x) => x.trim()).filter(Boolean) }] : [],
  };
}

/** Reads a PDF, Word or JSON Resume file. Throws a message for the user when it can't be read. */
export async function importFile(file: File): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (file.size > MAX_IMPORT_BYTES) throw new Error('That file is over 5 MB. Use the PDF LinkedIn makes, or a smaller resume.');
  if (name.endsWith('.json') || file.type === 'application/json') {
    let data: unknown;
    try { data = JSON.parse(await file.text()); } catch { throw new Error("That JSON file couldn't be read."); }
    if (!data || typeof data !== 'object' || !('basics' in data || 'work' in data)) throw new Error("That JSON file isn't a JSON Resume (it needs basics or work).");
    return fromJsonResume(data as JsonResume);
  }
  if (name.endsWith('.docx') || /officedocument\.wordprocessingml/.test(file.type)) {
    let lines: PdfLine[];
    try { lines = await docxLines(await file.arrayBuffer()); } catch { throw new Error("Couldn't read that Word file. Save it again as .docx, or use a PDF."); }
    if (lines.length < 3) throw new Error('That Word file has almost no text. Fill in the steps by hand.');
    return parseResume(lines);
  }
  if (name.endsWith('.doc')) throw new Error('Old .doc files can’t be read. Save it as .docx or PDF and try again.');
  return importPdf(file);
}
