// The five core tech roles. `id` matches the server's normalized_role.
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

// Every other design, development and IT area (ids match backend/app/categories.py). Each gets a live page like the
// five above; together with them they make up "Design & IT".
export const AREAS: Role[] = [
  { slug: 'backend', id: 'backend', name: 'Backend development', plural: 'backend jobs', figure: 'router',
    titles: ['Backend engineer', 'Java developer', 'Python developer', 'Go engineer', 'Node.js developer', '.NET developer', 'PHP developer', 'Ruby on Rails', 'API engineer'],
    lead: 'New backend and server-side roles, Java, Python, Go, Node, .NET and more, from company career pages, newest first, each with its real posting date.' },
  { slug: 'mobile', id: 'mobile', name: 'Mobile development', plural: 'mobile developer jobs', figure: 'format',
    titles: ['iOS engineer', 'Android developer', 'Mobile engineer', 'Flutter developer', 'React Native developer', 'Swift', 'Kotlin'],
    lead: 'New iOS, Android and cross-platform mobile roles from company career pages, newest first, each with its real posting date.' },
  { slug: 'devops-cloud', id: 'devops', name: 'DevOps, cloud & SRE', plural: 'DevOps and cloud jobs', figure: 'hub',
    titles: ['DevOps engineer', 'Site reliability engineer', 'Platform engineer', 'Cloud engineer', 'Cloud architect', 'Infrastructure engineer', 'AWS / Azure / GCP', 'Kubernetes'],
    lead: 'New DevOps, SRE, platform and cloud roles from company career pages, newest first, each with its real posting date.' },
  { slug: 'qa-testing', id: 'qa', name: 'QA & testing', plural: 'QA and testing jobs', figure: 'sieve',
    titles: ['QA engineer', 'SDET', 'Test automation engineer', 'Quality engineer', 'QA analyst', 'Software tester'],
    lead: 'New QA, test automation and quality engineering roles from company career pages, newest first, each with its real posting date.' },
  { slug: 'cybersecurity', id: 'security', name: 'Cybersecurity', plural: 'cybersecurity jobs', figure: 'cabinet',
    titles: ['Security engineer', 'Security analyst', 'SOC analyst', 'Penetration tester', 'AppSec engineer', 'Cloud security', 'Incident response', 'GRC analyst'],
    lead: 'New security engineering, SOC, AppSec and pen-testing roles from company career pages, newest first, each with its real posting date.' },
  { slug: 'it-support', id: 'it', name: 'IT, support & networks', plural: 'IT jobs', figure: 'relay',
    titles: ['IT support specialist', 'Help desk', 'Systems administrator', 'Network engineer', 'Database administrator', 'IT manager', 'Technical support engineer'],
    lead: 'New IT support, systems, network and database roles from company career pages, newest first, each with its real posting date.' },
  { slug: 'enterprise-apps', id: 'enterprise', name: 'ERP, CRM & enterprise apps', plural: 'Salesforce, SAP and ERP jobs', figure: 'drawer',
    titles: ['Salesforce developer', 'Salesforce administrator', 'SAP consultant', 'ServiceNow developer', 'Oracle developer', 'Dynamics 365', 'ERP consultant'],
    lead: 'New Salesforce, SAP, ServiceNow, Oracle and other enterprise-app roles from company career pages, newest first, each with its real posting date.' },
  { slug: 'data-analytics', id: 'data', name: 'Data & analytics', plural: 'data jobs', figure: 'query',
    titles: ['Data engineer', 'Data scientist', 'Data analyst', 'Analytics engineer', 'BI developer', 'Data architect'],
    lead: 'New data engineering, analytics and data science roles from company career pages, newest first, each with its real posting date.' },
  { slug: 'creative-design', id: 'design', name: 'Graphic, brand & creative design', plural: 'creative design jobs', figure: 'turntable',
    titles: ['Graphic designer', 'Brand designer', 'Motion designer', 'Illustrator', '3D artist', 'Art director', 'Creative director', 'Game designer'],
    lead: 'New graphic, brand, motion and creative roles from company career pages, newest first, each with its real posting date.' },
  { slug: 'other-engineering', id: 'engineering', name: 'Other engineering', plural: 'engineering jobs', figure: 'exploded',
    titles: ['Embedded engineer', 'Firmware engineer', 'Game developer', 'Solutions architect', 'Engineering manager', 'Technical writer', 'Blockchain developer'],
    lead: 'Engineering roles outside the areas above, embedded, firmware, games, architecture and leadership, from company career pages, newest first.' },
];

/** Every role and area with its own page. */
export const ALL_ROLES: Role[] = [...ROLES, ...AREAS];

/** The all-in-one "Design & IT" list (role id understood by shared/jobdata.ts). */
export const DESIGN_IT: Role = {
  slug: 'design-it', id: 'design_it', name: 'Design & IT', plural: 'design, development and IT jobs', figure: 'stack',
  titles: [...ROLES, ...AREAS].map((r) => r.name),
  lead: 'Every design, development and IT job in one list: product and creative design, frontend, backend, mobile, DevOps, data, QA, security, IT and more. From company career pages, newest first, each with its real posting date.',
};
