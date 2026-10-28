import { Profile, skillList } from './profile';

/**
 * Fit check without AI: compares the posting's own text with the profile, in the browser. It reports what it found
 * (skills mentioned, years asked for) rather than pretending to judge the person.
 */

// Common skills and tools in Jobly's five roles. Only words that appear in the posting and aren't in the profile are
// suggested, as "worth adding if you have them".
const KEYWORDS = [
  'Figma', 'Sketch', 'Adobe XD', 'Framer', 'Prototyping', 'Wireframing', 'User research', 'Usability testing', 'Design systems', 'Interaction design',
  'Visual design', 'Accessibility', 'WCAG', 'Information architecture', 'Motion design', 'Illustrator', 'Photoshop',
  'JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue', 'Angular', 'Svelte', 'HTML', 'CSS', 'Tailwind', 'Redux', 'GraphQL', 'REST', 'Webpack', 'Vite',
  'Jest', 'Cypress', 'Playwright', 'Storybook', 'Node.js', 'Express', 'Python', 'Django', 'FastAPI', 'Flask', 'Go', 'Golang', 'Java', 'Kotlin', 'Swift',
  'Ruby', 'Rails', 'PHP', 'C#', '.NET', 'Rust', 'C++', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Kafka', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure',
  'Terraform', 'CI/CD', 'Microservices', 'PyTorch', 'TensorFlow', 'JAX', 'scikit-learn', 'Pandas', 'NumPy', 'LLM', 'NLP', 'Computer vision', 'MLOps',
  'Machine learning', 'Deep learning', 'Transformers', 'RAG', 'Spark', 'Airflow', 'dbt', 'Snowflake', 'BigQuery', 'Statistics',
  'Product strategy', 'Roadmapping', 'A/B testing', 'Experimentation', 'Analytics', 'SQL', 'Jira', 'Agile', 'Scrum', 'Stakeholder management', 'OKRs',
  'Go-to-market', 'Pricing', 'B2B', 'SaaS', 'Mobile', 'iOS', 'Android', 'React Native', 'Flutter',
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentions = (text: string, term: string) => new RegExp(`(^|[^a-z0-9])${esc(term.toLowerCase())}($|[^a-z0-9])`).test(text);

export interface FitResult {
  level: 'strong' | 'good' | 'low' | 'unknown';
  found: string[];
  missing: string[];
  suggestions: string[];
  yearsAsked: number | null;
  yearsHave: number | null;
}

export function fitCheck(profile: Profile | null, postingText: string): FitResult {
  const text = postingText.toLowerCase();
  const skills = profile ? skillList(profile) : [];
  const found = skills.filter((s) => mentions(text, s));
  const missing = skills.filter((s) => !mentions(text, s));
  const have = new Set(skills.map((s) => s.toLowerCase()));
  const suggestions = [...new Set(KEYWORDS.filter((k) => !have.has(k.toLowerCase()) && mentions(text, k)))].slice(0, 12);
  const m = /(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*\+?\s*years?/i.exec(postingText);
  const yearsAsked = m ? Number(m[1]) : null;
  const yearsHave = profile?.years_experience ? Number.parseFloat(profile.years_experience) : null;
  if (!skills.length || text.length < 80) return { level: 'unknown', found, missing, suggestions, yearsAsked, yearsHave };
  const share = found.length / Math.min(skills.length, 8);
  const yearsOk = yearsAsked === null || yearsHave === null || yearsHave >= yearsAsked;
  const level = share >= 0.5 && yearsOk ? 'strong' : share >= 0.25 ? 'good' : 'low';
  return { level, found, missing, suggestions, yearsAsked, yearsHave };
}
