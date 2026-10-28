// Everything Studio keeps lives in the browser (IndexedDB). These are the shapes it stores.

export interface Link { id: string; label: string; url: string }

export interface Basics {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  links: Link[];
}

/** One line of evidence: a bullet under a job or project. Its id is what drafts cite. */
export interface Bullet { id: string; text: string }

export interface Experience {
  id: string;
  title: string;
  company: string;
  location: string;
  start: string;   // free text, e.g. "Mar 2022"
  end: string;     // empty = present
  bullets: Bullet[];
}

export interface Project {
  id: string;
  name: string;
  role: string;
  url: string;
  start: string;
  end: string;
  bullets: Bullet[];
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  start: string;
  end: string;
  details: string;
}

export interface Skill { id: string; name: string; group: string }
export interface Language { id: string; name: string; level: string }

export interface Profile {
  basics: Basics;
  experience: Experience[];
  projects: Project[];
  education: Education[];
  skills: Skill[];
  languages: Language[];
  /** Section order on resumes. */
  order: SectionKey[];
}

export type SectionKey = 'summary' | 'experience' | 'projects' | 'education' | 'skills' | 'languages';

export type ThemeId = 'classic' | 'modern' | 'compact' | 'serif';

export interface ResumeStyle { theme: ThemeId; accent: string; paper: 'a4' | 'letter' }

/** A tailored resume: which profile entries to show, in which order, with bullets rewritten from cited facts. */
export interface TailoredResume {
  headline: string;
  summary: CitedText;
  experience: { id: string; bullets: CitedText[] }[];
  projects: { id: string; bullets: CitedText[] }[];
  skills: string[];     // skill ids, most relevant first
  education: string[];  // education ids
}

export interface CitedText { text: string; sources: string[] }

export interface CoverLetter {
  recipient: string;
  greeting: string;
  paragraphs: CitedText[];
  closing: string;
}

export type Status = 'draft' | 'applied' | 'interviewing' | 'offer' | 'closed';
export const STATUSES: { id: Status; label: string }[] = [
  { id: 'draft', label: 'Draft' },
  { id: 'applied', label: 'Applied' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'offer', label: 'Offer' },
  { id: 'closed', label: 'Closed' },
];

export interface Requirement { id: string; text: string; must: boolean }

export type MatchLevel = 'met' | 'partial' | 'gap';
export interface RequirementMatch { requirementId: string; level: MatchLevel; sources: string[]; note: string }

export interface Posting {
  title: string;
  company: string;
  location: string;
  url: string;
  contact: string;      // where the posting says to apply, if anywhere
  language: string;     // language the posting is written in
  text: string;         // the pasted posting, as is
  requirements: Requirement[];
}

export interface VersionIssue { severity: 'removed' | 'warning'; where: string; text: string; reason: string }

/** One saved state of a document. `issues` is what the fact check found when a model wrote it. */
export interface DocVersion<T> { id: string; at: string; label: string; doc: T; issues?: VersionIssue[] }

export interface ChatTurn { id: string; at: string; role: 'user' | 'assistant'; text: string; target: 'resume' | 'letter' }

export interface Interview { id: string; at: string; kind: string; notes: string }

export interface Application {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: Status;
  statusHistory: { status: Status; at: string }[];
  posting: Posting;
  matches: RequirementMatch[];
  tone: Tone;
  resume: DocVersion<TailoredResume>[];   // newest last
  letter: DocVersion<CoverLetter>[];      // newest last
  chat: ChatTurn[];
  notes: string;
  interviews: Interview[];
  followUp: string;    // ISO date, empty = none
  source: 'pasted' | 'jobly';
}

export type Tone = 'warm' | 'direct' | 'formal' | 'enthusiastic';
export const TONES: { id: Tone; label: string; hint: string }[] = [
  { id: 'direct', label: 'Direct', hint: 'Short sentences, results first' },
  { id: 'warm', label: 'Warm', hint: 'Friendly and personal' },
  { id: 'formal', label: 'Formal', hint: 'Traditional and polished' },
  { id: 'enthusiastic', label: 'Enthusiastic', hint: 'Energetic, shows interest' },
];

export type ProviderKind = 'anthropic' | 'openai' | 'none';

export interface AiSettings {
  provider: ProviderKind;
  apiKey: string;
  model: string;
  /** OpenAI-compatible only: base URL, e.g. http://localhost:11434/v1 for Ollama. */
  baseUrl: string;
}

export interface Settings {
  ai: AiSettings;
  resumeStyle: ResumeStyle;
  theme: 'system' | 'light' | 'dark';
  onboarded: boolean;
}

export interface StudioData {
  version: 1;
  profile: Profile;
  applications: Application[];
  settings: Settings;
}
