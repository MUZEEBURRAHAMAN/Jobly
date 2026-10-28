// JSON schemas for structured output. Strict-mode rules: every object lists all its properties as required
// and sets additionalProperties: false.
type Schema = Record<string, unknown>;

const obj = (properties: Record<string, Schema>): Schema => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
});
const str: Schema = { type: 'string' };
const bool: Schema = { type: 'boolean' };
const strs: Schema = { type: 'array', items: str };
const cited: Schema = obj({ text: str, sources: strs });

export const analyzeSchema = obj({
  title: str,
  company: str,
  location: str,
  contact: str,
  language: str,
  requirements: { type: 'array', items: obj({ id: str, text: str, must: bool }) },
  matches: {
    type: 'array',
    items: obj({ requirementId: str, level: { type: 'string', enum: ['met', 'partial', 'gap'] }, sources: strs, note: str }),
  },
});

export const resumeSchema = obj({
  headline: str,
  summary: cited,
  experience: { type: 'array', items: obj({ id: str, bullets: { type: 'array', items: cited } }) },
  projects: { type: 'array', items: obj({ id: str, bullets: { type: 'array', items: cited } }) },
  skills: strs,
  education: strs,
});

export const letterSchema = obj({
  recipient: str,
  greeting: str,
  paragraphs: { type: 'array', items: cited },
  closing: str,
});

export const draftSchema = obj({ resume: resumeSchema, letter: letterSchema });

export const refineResumeSchema = obj({ reply: str, resume: resumeSchema });
export const refineLetterSchema = obj({ reply: str, letter: letterSchema });

const entryDates = { start: str, end: str };
export const profileImportSchema = obj({
  basics: obj({ name: str, headline: str, email: str, phone: str, location: str, summary: str, links: { type: 'array', items: obj({ label: str, url: str }) } }),
  experience: { type: 'array', items: obj({ title: str, company: str, location: str, ...entryDates, bullets: strs }) },
  projects: { type: 'array', items: obj({ name: str, role: str, url: str, ...entryDates, bullets: strs }) },
  education: { type: 'array', items: obj({ school: str, degree: str, ...entryDates, details: str }) },
  skills: { type: 'array', items: obj({ name: str, group: str }) },
  languages: { type: 'array', items: obj({ name: str, level: str }) },
});
