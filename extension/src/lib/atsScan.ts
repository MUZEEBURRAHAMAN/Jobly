/**
 * Reads the resume the way an applicant tracking system does: from its plain text, top to bottom, finding each
 * field by position, headings and patterns (the only thing it is told is how many roles to expect). Rules only, in the browser, no AI.
 *
 * The text is what the finished page says (the preview's own text, in reading order), so a field that this scan
 * can't find is a field a parser is likely to miss too: a name that isn't the first line, a role with no dates,
 * a skills list with no heading.
 */
export type FieldStatus = 'ok' | 'warn' | 'fail';
export interface ParsedField { id: 'name' | 'contact' | 'experience' | 'education' | 'skills' | 'layout'; label: string; status: FieldStatus; detail: string; fix?: string }
export interface AtsScan { fields: ParsedField[]; problems: number; name: string; email: string; phone: string; positions: number; skills: string[] }

const HEADS: Record<string, RegExp> = {
  summary: /^(summary|profile|professional summary|about( me)?|objective)$/i,
  experience: /^((work|professional|relevant) )?(experience|employment|work history)$/i,
  education: /^(education|education and training|academic background)$/i,
  skills: /^((technical|core|key|expert-level) )?(skills|competencies|skills and tools|skills (&|and) tools)$/i,
  contact: /^(contact|contact details|contact information)$/i,
  projects: /^((selected|personal|key) )?projects$/i,
  achievements: /^(achievements|awards|honou?rs|achievements (&|and) leadership|leadership|certifications?|publications|volunteering)$/i,
};
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE = /(?:\+?\d[\s().-]{0,2}){7,15}/;
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const YEAR = '(?:19|20)\\d{2}';
const DATE_RANGE = new RegExp(`(?:${MONTH}\\s+)?${YEAR}\\s*(?:[–—-]|to)\\s*(?:present|current|now|(?:${MONTH}\\s+)?${YEAR})`, 'i');
const headOf = (line: string) => Object.keys(HEADS).find((k) => HEADS[k].test(line.replace(/[:\s]+$/, '').trim())) ?? null;

export function atsScan(text: string, opts: { singleColumn?: boolean; roles?: number } = {}): AtsScan {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  // Split into sections by the headings a parser knows
  const sections: Record<string, string[]> = { top: [] };
  let current = 'top';
  for (const l of lines) {
    const h = l.length <= 40 ? headOf(l) : null;
    if (h) { current = h; sections[h] ??= []; continue; }
    (sections[current] ??= []).push(l);
  }

  const first = lines[0] ?? '';
  const nameOk = !!first && !headOf(first) && !/[\d@]|https?:/.test(first) && first.split(' ').length >= 2 && first.split(' ').length <= 5 && first.toLowerCase() !== 'your name';
  const email = EMAIL.exec(text)?.[0] ?? '';
  // A phone number, not a year range or a postcode: read it from the lines above the first long section
  const contactText = [...sections.top, ...(sections.contact ?? [])].join('\n').replace(EMAIL, ' ').replace(DATE_RANGE, ' ');
  const phone = (PHONE.exec(contactText)?.[0] ?? '').trim();

  const exp = sections.experience ?? [];
  // A role's dates end its line ("CEO, Acme  Aug 2015 – Present"); a range inside a sentence is not a role
  const ROLE_DATES = new RegExp(`${DATE_RANGE.source}\\s*$`, 'i');
  const positions = exp.filter((l) => l.length <= 110 && ROLE_DATES.test(l)).length;
  const edu = sections.education ?? [];
  const skills = (sections.skills ?? []).flatMap((l) => l.replace(/^[^:,]{2,40}:\s*/, '').split(/\s*[·•|,;]\s*(?![^()]*\))/)).map((s) => s.trim()).filter((s) => s.length > 1 && s.length <= 40);

  const fields: ParsedField[] = [];
  fields.push(nameOk
    ? { id: 'name', label: 'Name', status: 'ok', detail: 'Detected' }
    : { id: 'name', label: 'Name', status: 'fail', detail: 'Not found on the first line', fix: 'Add your first and last name in your profile.' });
  fields.push(email && phone
    ? { id: 'contact', label: 'Contact info', status: 'ok', detail: 'Email and phone detected' }
    : email || phone
      ? { id: 'contact', label: 'Contact info', status: 'warn', detail: email ? 'Email detected, no phone number' : 'Phone detected, no email', fix: email ? 'Add a phone number in your profile.' : 'Add an email address in your profile.' }
      : { id: 'contact', label: 'Contact info', status: 'fail', detail: 'No email or phone found', fix: 'Add your email and phone number in your profile.' });
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (!sections.experience) fields.push({ id: 'experience', label: 'Experience', status: 'fail', detail: 'No experience section', fix: 'Add your roles in your profile.' });
  else if (!positions) fields.push({ id: 'experience', label: 'Experience', status: 'warn', detail: 'Section found, no dated positions', fix: 'Give each role a start and end date.' });
  else {
    const missing = Math.max(0, (opts.roles ?? 0) - positions);
    fields.push(missing > 0
      ? { id: 'experience', label: 'Experience', status: 'warn', detail: `${plural(positions, 'position')} detected, ${missing} without dates`, fix: 'Give each role a start and end date; a parser finds roles by their dates.' }
      : { id: 'experience', label: 'Experience', status: 'ok', detail: `${plural(positions, 'position')} detected` });
  }
  fields.push(edu.length
    ? { id: 'education', label: 'Education', status: 'ok', detail: 'Detected' }
    : { id: 'education', label: 'Education', status: 'fail', detail: 'No education section', fix: 'Add your education in your profile.' });
  fields.push(skills.length >= 5
    ? { id: 'skills', label: 'Skills', status: 'ok', detail: `${skills.length} skills detected` }
    : skills.length
      ? { id: 'skills', label: 'Skills', status: 'warn', detail: `Only ${plural(skills.length, 'skill')} detected`, fix: 'List at least 5 skills; job matching leans on them.' }
      : { id: 'skills', label: 'Skills', status: 'fail', detail: 'No skills section', fix: 'Add your skills in your profile.' });
  fields.push(opts.singleColumn === false
    ? { id: 'layout', label: 'Layout', status: 'warn', detail: 'Two columns', fix: 'Some older systems read two columns out of order. Pick a single-column template to be safe.' }
    : { id: 'layout', label: 'Layout', status: 'ok', detail: 'Single column, standard headings' });

  return { fields, problems: fields.filter((f) => f.status !== 'ok').length, name: nameOk ? first : '', email, phone, positions, skills };
}
