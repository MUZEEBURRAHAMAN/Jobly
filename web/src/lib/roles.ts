// The five role families Jobly covers. `id` matches the server's normalized_role.
export type Role = { slug: string; id: string; name: string; plural: string; figure: string; guide?: string; titles: string[]; lead: string };
export const ROLES: Role[] = [
  { slug: 'product-design', id: 'product_design', name: 'Product design', plural: 'product design jobs', figure: 'laptop', guide: 'find-remote-product-design-jobs',
    titles: ['Product designer', 'UX designer', 'UI/UX designer', 'Interaction designer', 'Design systems', 'Design engineer', 'Design technologist', 'Visual designer', 'Brand designer'],
    lead: 'New product, UX and UI design roles from company career pages and remote job boards, newest first, each with the date the employer posted it.' },
  { slug: 'frontend', id: 'frontend_engineering', name: 'Frontend engineering', plural: 'frontend jobs', figure: 'terminal', guide: 'find-frontend-developer-jobs-at-startups',
    titles: ['Frontend engineer', 'Front-end developer', 'UI engineer', 'Web engineer', 'React engineer', 'Software engineer, frontend', 'Client engineer', 'JavaScript / TypeScript'],
    lead: 'New frontend, web and UI engineering roles from company career pages and remote job boards, newest first, each with its real posting date.' },
  { slug: 'product-management', id: 'product_management', name: 'Product management', plural: 'product manager jobs', figure: 'rail', guide: 'find-product-manager-jobs',
    titles: ['Product manager', 'Technical product manager', 'Associate product manager', 'Group product manager', 'Principal product manager', 'Product lead', 'Head of product', 'Director of product'],
    lead: 'New product manager roles at every level, from company career pages and remote job boards, newest first, each with its real posting date.' },
  { slug: 'ai-ml', id: 'ai_ml', name: 'AI & machine learning', plural: 'AI and ML jobs', figure: 'exploded', guide: 'find-ai-ml-engineer-jobs',
    titles: ['Machine learning engineer', 'AI engineer', 'ML scientist', 'Applied scientist', 'Research scientist', 'LLM', 'Deep learning', 'NLP', 'Computer vision'],
    lead: 'New AI, machine learning and research roles from company career pages and remote job boards, newest first, each with its real posting date.' },
  { slug: 'fullstack', id: 'fullstack_engineering', name: 'Fullstack engineering', plural: 'fullstack jobs', figure: 'stack',
    titles: ['Fullstack engineer', 'Software engineer', 'Software developer', 'Product engineer', 'Software development engineer (SDE)'],
    lead: 'New fullstack and software engineering roles from company career pages and remote job boards, newest first, each with its real posting date.' },
];
