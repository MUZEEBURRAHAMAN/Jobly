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
