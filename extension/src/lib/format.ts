export function timeAgo(iso: string | number | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const minutes = Math.floor((Date.now() - t) / 60000);
  if (minutes < 60) return 'Just now';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export const ROLES = [
  { id: 'product_design', label: 'Product design', hint: 'UI/UX, design systems, UX research', short: 'Design' },
  { id: 'frontend_engineering', label: 'Frontend engineering', hint: 'React, TypeScript, web platform', short: 'Frontend' },
  { id: 'product_management', label: 'Product management', hint: 'Product manager, technical PM', short: 'Product' },
  { id: 'ai_ml', label: 'AI & machine learning', hint: 'ML engineer, researcher, applied scientist', short: 'AI / ML' },
  { id: 'fullstack_engineering', label: 'Fullstack engineering', hint: 'Fullstack, software engineer, cloud', short: 'Fullstack' },
] as const;

/** Every other kind of job, for "More roles" and Preferences (ids match backend/app/categories.py), by group. */
export const CATEGORIES = [
  { id: 'backend', label: 'Backend development', hint: 'Java, Python, Go, Node, .NET', group: 'Development & IT' },
  { id: 'mobile', label: 'Mobile development', hint: 'iOS, Android, Flutter, React Native', group: 'Development & IT' },
  { id: 'devops', label: 'DevOps, cloud & SRE', hint: 'Platform, infrastructure, AWS, Kubernetes', group: 'Development & IT' },
  { id: 'qa', label: 'QA & testing', hint: 'Test automation, SDET, quality engineering', group: 'Development & IT' },
  { id: 'security', label: 'Cybersecurity', hint: 'Security engineering, SOC, pen testing', group: 'Development & IT' },
  { id: 'it', label: 'IT, support & networks', hint: 'IT support, sysadmin, networks, databases', group: 'Development & IT' },
  { id: 'enterprise', label: 'ERP, CRM & enterprise apps', hint: 'Salesforce, SAP, ServiceNow, Oracle', group: 'Development & IT' },
  { id: 'data', label: 'Data & analytics', hint: 'Data engineering, analytics, BI', group: 'Development & IT' },
  { id: 'engineering', label: 'Other engineering', hint: 'Embedded, firmware, game, architects', group: 'Development & IT' },
  { id: 'design', label: 'Graphic, brand & creative design', hint: 'Graphic, motion, illustration, art direction', group: 'Design' },
  { id: 'marketing', label: 'Marketing', hint: '', group: 'Business & other' },
  { id: 'sales', label: 'Sales & business development', hint: '', group: 'Business & other' },
  { id: 'customer', label: 'Customer success & support', hint: '', group: 'Business & other' },
  { id: 'people', label: 'People & recruiting', hint: '', group: 'Business & other' },
  { id: 'finance', label: 'Finance & accounting', hint: '', group: 'Business & other' },
  { id: 'legal', label: 'Legal & compliance', hint: '', group: 'Business & other' },
  { id: 'operations', label: 'Operations', hint: '', group: 'Business & other' },
  { id: 'healthcare', label: 'Healthcare & science', hint: '', group: 'Business & other' },
  { id: 'other', label: 'Other', hint: '', group: 'Business & other' },
] as const;
export const CATEGORY_IDS: string[] = CATEGORIES.map((c) => c.id);
export const CATEGORY_GROUPS = ['Development & IT', 'Design', 'Business & other'] as const;
/** The "Design & IT" chip: the five tech roles and every development, IT and design category. */
export const DESIGN_IT_IDS: string[] = [...ROLES.map((r) => r.id as string), ...CATEGORIES.filter((c) => c.group !== 'Business & other').map((c) => c.id)];

export const SENIORITIES = [
  { id: 'intern', label: 'Intern' },
  { id: 'junior', label: 'Junior · 0–2 yrs' },
  { id: 'mid', label: 'Mid · 2–5 yrs' },
  { id: 'senior', label: 'Senior · 5–8 yrs' },
  { id: 'lead', label: 'Lead / Staff · 8+ yrs' },
] as const;

export const EXPERIENCE_LABELS: Record<string, string> = { '0-2': '0–2 yrs', '2-5': '2–5 yrs', '5-8': '5–8 yrs', '8+': '8+ yrs' };
export const HUB_LABELS: Record<string, string> = { us: 'US & Canada', india: 'India', europe: 'Europe', apac: 'Asia-Pacific', global: 'Global' };

export const DEFAULT_ROLE_IDS: string[] = ROLES.map((r) => r.id);

/** Remote job boards whose listings Jobly passes on: the card says where the job was found (their terms ask for that). */
export const BOARD_NAMES: Record<string, string> = { weworkremotely: 'We Work Remotely', himalayas: 'Himalayas', arbeitnow: 'Arbeitnow' };

export const EMPLOYMENT_LABELS: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship' };
