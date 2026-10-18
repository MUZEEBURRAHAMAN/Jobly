// Comparison pages. Every claim about another product is backed by a source below and dated with `checked`.
// Keep it fair: say where the other product is better.
export type Mark = 'yes' | 'no' | 'part';
export type Row = { label: string; jobly: [Mark, string]; them: [Mark, string] };
export type Alternative = {
  slug: string; name: string; kind: string; figure: string; checked: string;
  title: string; description: string; summary: string;
  chooseThem: string[]; chooseJobly: string[];
  rows: Row[];
  better: { title: string; text: string }[];
  together: string;
  sources: { label: string; href: string }[];
};

const CHECKED = 'October 2026';

export const ALTERNATIVES: Alternative[] = [
  {
    slug: 'linkedin-jobs', name: 'LinkedIn Jobs', kind: 'Job site and professional network', figure: 'hub', checked: CHECKED,
    title: 'Jobly vs LinkedIn Jobs',
    description: 'How Jobly compares with LinkedIn Jobs for finding new tech jobs: posting dates, promoted jobs, alerts without an account, and where LinkedIn is better.',
    summary: 'LinkedIn has far more jobs and the network to go with them. Jobly is narrower: new tech jobs from company career pages with their original date, no promoted listings and no account.',
    chooseThem: ['You want jobs in every industry and country', 'Your network and recruiters are a big part of your search', 'You like applying with Easy Apply'],
    chooseJobly: ['You want to see new tech jobs within hours, sorted by real date', 'You’re tired of promoted and reposted listings', 'You want alerts without an account or email'],
    rows: [
      { label: 'Posting date', jobly: ['yes', 'The employer’s original date'], them: ['part', 'Can show the date a job was reposted'] },
      { label: 'Old listings', jobly: ['yes', 'Hidden after 60 days'], them: ['no', 'Filter by date yourself'] },
      { label: 'Date filter', jobly: ['yes', 'Past 24 hours to past month'], them: ['yes', 'Past 24 hours, week or month'] },
      { label: 'Paid placement', jobly: ['yes', 'None'], them: ['no', 'Promoted jobs'] },
      { label: 'Alerts', jobly: ['yes', 'No account needed'], them: ['part', 'Account needed'] },
      { label: 'Applying', jobly: ['yes', 'On the employer’s site'], them: ['part', 'Easy Apply or the employer’s site'] },
      { label: 'Coverage', jobly: ['part', 'Five tech role families'], them: ['yes', 'Every industry'] },
      { label: 'Networking', jobly: ['no', 'None'], them: ['yes', 'Profiles, messages, referrals'] },
      { label: 'Price', jobly: ['yes', 'Free'], them: ['yes', 'Free; Premium is paid'] },
    ],
    better: [
      { title: 'Where LinkedIn is better', text: 'Breadth and people. LinkedIn lists jobs in every field, and you can see who works at a company, ask for referrals and hear from recruiters. Jobly has none of that.' },
      { title: 'Where Jobly is better', text: 'Freshness and focus. Jobly reads career pages directly, shows when each job was first posted, never shows paid placements, and drops anything older than 60 days.' },
    ],
    together: 'Use LinkedIn for networking and research on people and teams. Use Jobly to catch new tech jobs early, then look up the team on LinkedIn before you apply on the employer’s site.',
    sources: [
      { label: 'LinkedIn Help: job search filters', href: 'https://www.linkedin.com/help/linkedin/answer/154' },
      { label: 'LinkedIn Help: reposting a job', href: 'https://www.linkedin.com/help/learning/answer/a522249' },
      { label: 'LinkedIn: promoted job posts', href: 'https://business.linkedin.com/talent-solutions/jobs-101/pricing' },
    ],
  },
  {
    slug: 'indeed', name: 'Indeed', kind: 'Job search engine', figure: 'sieve', checked: CHECKED,
    title: 'Jobly vs Indeed',
    description: 'How Jobly compares with Indeed for tech job searches: real posting dates vs "30+ days", sponsored jobs, alerts without an account, and where Indeed is better.',
    summary: 'Indeed covers nearly every job and industry. Jobly covers far fewer: tech roles from company career pages, each with its original posting date, no sponsored jobs and no account.',
    chooseThem: ['You’re searching outside tech, or in many fields at once', 'You want company reviews and salary data in the same place', 'You like applying with your Indeed résumé'],
    chooseJobly: ['You want the exact age of every tech job, not “30+ days”', 'You don’t want sponsored jobs above newer ones', 'You want alerts without an account'],
    rows: [
      { label: 'Posting date', jobly: ['yes', 'The employer’s original date'], them: ['part', 'Older jobs say “30+ days”'] },
      { label: 'Old listings', jobly: ['yes', 'Hidden after 60 days'], them: ['no', 'Filter by date yourself'] },
      { label: 'Date filter', jobly: ['yes', 'Past 24 hours to past month'], them: ['yes', '24 hours, 3, 7 or 14 days'] },
      { label: 'Paid placement', jobly: ['yes', 'None'], them: ['no', 'Sponsored jobs'] },
      { label: 'Alerts', jobly: ['yes', 'No account needed'], them: ['part', 'Account needed'] },
      { label: 'Applying', jobly: ['yes', 'On the employer’s site'], them: ['part', 'Indeed Apply or the employer’s site'] },
      { label: 'Coverage', jobly: ['part', 'Five tech role families'], them: ['yes', 'Every industry'] },
      { label: 'Price', jobly: ['yes', 'Free'], them: ['yes', 'Free'] },
    ],
    better: [
      { title: 'Where Indeed is better', text: 'Coverage. Indeed lists jobs of every kind, in many countries, with company reviews and salary information alongside.' },
      { title: 'Where Jobly is better', text: 'Precision for tech roles. Every job shows its exact age from the employer’s own system, nothing is sponsored, and nothing older than 60 days appears.' },
    ],
    together: 'Use Indeed’s date filter set to the last 24 hours or 3 days for broad searches, and Jobly for tech roles straight from career pages. When you find a job on Indeed, check the employer’s careers page for the original listing.',
    sources: [
      { label: 'Indeed Help: job search tips and filters', href: 'https://support.indeed.com/hc/en-ca/articles/204488950-Improving-Your-Job-Searches-Tips-and-Help' },
      { label: 'Indeed: free vs sponsored jobs', href: 'https://www.indeed.com/hire/resources/howtohub/free-vs-sponsored-jobs-on-indeed' },
      { label: 'Indeed Help: job alerts', href: 'https://www.indeed.com/help/job-seekers/articles/204488890-starting-stopping-and-managing-job-alerts' },
    ],
  },
  {
    slug: 'simplify', name: 'Simplify', kind: 'Application autofill and tracker', figure: 'format', checked: CHECKED,
    title: 'Jobly vs Simplify',
    description: 'Jobly and Simplify Copilot do different jobs: Jobly finds new tech jobs early, Simplify fills in applications. How they compare, what each costs, and how to use both.',
    summary: 'These two do different jobs. Simplify Copilot fills in application forms and tracks where you applied. Jobly finds new tech jobs on career pages early. Many people would use both.',
    chooseThem: ['Filling in the same details on every application takes you hours', 'You want a tracker of every application in one place', 'You’re happy to create an account'],
    chooseJobly: ['Your problem is finding good jobs early, not filling forms', 'You don’t want an extension that reads the pages you visit', 'You want no account at all'],
    rows: [
      { label: 'Main job', jobly: ['yes', 'Finds new tech jobs'], them: ['yes', 'Fills in applications'] },
      { label: 'Autofill', jobly: ['no', 'None, you apply yourself'], them: ['yes', 'Greenhouse, Lever, Ashby, Workday and more'] },
      { label: 'Application tracker', jobly: ['part', 'Saved jobs only'], them: ['yes', 'Tracks your applications'] },
      { label: 'Job alerts from career pages', jobly: ['yes', 'Every 60 to 90 minutes'], them: ['part', 'Job matches, not its focus'] },
      { label: 'Account', jobly: ['yes', 'None needed'], them: ['part', 'Account needed'] },
      { label: 'Page access', jobly: ['yes', 'Can’t read the pages you visit'], them: ['part', 'Reads application pages to fill them'] },
      { label: 'Price', jobly: ['yes', 'Free'], them: ['part', 'Free autofill; Simplify+ $39.99 a month'] },
    ],
    better: [
      { title: 'Where Simplify is better', text: 'Applying. Its autofill saves real time across the big hiring systems, and its tracker keeps your applications organised. Jobly does neither.' },
      { title: 'Where Jobly is better', text: 'Finding. Jobly watches hundreds of career pages and tells you when a new tech job matches, with its real posting date, without an account or access to your pages.' },
    ],
    together: 'Let Jobly tell you about a new job, open it on the employer’s site, and let Simplify fill in the form. One finds, the other fills.',
    sources: [
      { label: 'Simplify Copilot', href: 'https://simplify.jobs/copilot' },
      { label: 'Jobright: Simplify Copilot review 2026', href: 'https://jobright.ai/blog/simplify-copilot-review-2026-features-pricing-and-top-alternatives/' },
      { label: 'LoopCV: Simplify review', href: 'https://blog.loopcv.pro/simplify-review/' },
    ],
  },
  {
    slug: 'hiring-cafe', name: 'HiringCafe', kind: 'Job search website', figure: 'dish', checked: CHECKED,
    title: 'Jobly vs HiringCafe',
    description: 'Jobly and HiringCafe both collect jobs from company career pages. How they differ: website vs Chrome extension, every industry vs tech, and how each makes money.',
    summary: 'HiringCafe and Jobly share an idea: jobs straight from company career pages. HiringCafe is a website covering many industries. Jobly is a Chrome extension for tech roles that alerts you to new matches.',
    chooseThem: ['You’re searching outside tech', 'You want very detailed search filters', 'You prefer a website to an extension'],
    chooseJobly: ['You want new tech jobs to come to you as alerts', 'You want your preferences kept only in your browser', 'You want a short list of tech roles, not every job'],
    rows: [
      { label: 'Where jobs come from', jobly: ['yes', 'Company career pages and job boards'], them: ['yes', 'Company career pages'] },
      { label: 'How often it refreshes', jobly: ['yes', 'Every 2 hours'], them: ['yes', 'Several times a day'] },
      { label: 'Format', jobly: ['yes', 'Chrome extension'], them: ['yes', 'Website'] },
      { label: 'Alerts in your browser', jobly: ['yes', 'Badge and desktop alert'], them: ['part', 'Not its format'] },
      { label: 'Coverage', jobly: ['part', 'Five tech role families'], them: ['yes', 'Many industries'] },
      { label: 'Applying', jobly: ['yes', 'On the employer’s site'], them: ['yes', 'On the employer’s site'] },
      { label: 'How it makes money', jobly: ['yes', 'It doesn’t'], them: ['part', 'From employers'] },
      { label: 'Price for job seekers', jobly: ['yes', 'Free'], them: ['yes', 'Free'] },
    ],
    better: [
      { title: 'Where HiringCafe is better', text: 'Breadth and search. It covers many industries and offers detailed filters, all in a website you can use anywhere.' },
      { title: 'Where Jobly is better', text: 'Alerts and privacy for tech roles. Jobly sits in your toolbar, checks for new matches every 60 to 90 minutes, and keeps your preferences only in your browser.' },
    ],
    together: 'Use HiringCafe for wide searches and research. Keep Jobly running for alerts on the tech roles you care about most.',
    sources: [
      { label: 'Scoutify: HiringCafe review', href: 'https://scoutify.com/blog/hiringcafe-review' },
      { label: 'University of Miami: HiringCafe', href: 'https://customcareer.miami.edu/resources/hiring-cafe/' },
      { label: 'Pulse 2.0: HiringCafe funding news', href: 'https://pulse2.com/hiringcafe-raises-6-8-million-pre-seed-and-launches-free-ai-talent-agent-for-job-seekers/' },
    ],
  },
];
