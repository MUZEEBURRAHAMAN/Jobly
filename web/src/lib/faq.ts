// Questions shown on /faq (all) and on the landing page (the ones marked `top`). Answers are plain text.
export type Faq = { q: string; a: string; top?: boolean };
export const FAQ_GROUPS: { id: string; title: string; items: Faq[] }[] = [
  {
    id: 'basics', title: 'The basics', items: [
      { top: true, q: 'How is Jobly different from LinkedIn or Indeed?', a: 'Jobly reads postings from company career pages and shows the date the employer posted them. It hides anything older than two months, shows no promoted jobs, and works without an account. LinkedIn and Indeed have far more jobs across every industry, plus things Jobly doesn’t do, like Easy Apply.' },
      { top: true, q: 'Is it really free?', a: 'Yes. Jobly is free, has no premium tier and shows no ads.' },
      { q: 'Do I need an account?', a: 'No. There is no sign-up, no login and no email. You pick your roles in the extension and that’s it.' },
      { top: true, q: 'Which browsers does it work in?', a: 'Chrome on desktop. Chromium browsers that install extensions from the Chrome Web Store, such as Edge and Brave, should work too, but we test on Chrome.' },
      { q: 'Does Jobly apply to jobs for me?', a: 'No. Jobly can fill an application form on the tab you’re on, from your profile, but it shows you every answer first and never presses Submit. You check the form and send it yourself.' },
    ],
  },
  {
    id: 'jobs', title: 'Jobs and dates', items: [
      { top: true, q: 'Which jobs does it cover?', a: 'Every role, with design, development and IT sorted by area at every level from intern to VP: product and UX design, creative design, frontend, fullstack, backend, mobile, DevOps and cloud, data, AI/ML, QA, cybersecurity, IT and support, enterprise apps and product management. Other jobs (sales, marketing, finance, operations and more) are under More roles. Jobly reads the career pages of 1,600+ companies in the US, Europe, Israel, India, Southeast Asia, Australia, Latin America and beyond (on Greenhouse, Ashby, Lever, Workable, SmartRecruiters, Recruitee, Teamtailor, Personio, Workday and Amazon), plus three remote job boards: We Work Remotely, Himalayas and Arbeitnow.' },
      { top: true, q: 'How fresh are the jobs?', a: 'Jobly refreshes every four hours and drops anything older than 60 days or no longer listed by the employer. Your browser checks for new matches every 60 to 90 minutes.' },
      { q: 'Where does the posting date come from?', a: 'From the system the employer published the job in, for example Greenhouse’s first-published date or Lever’s created date. The How dates work page lists the exact field for every source.' },
      { q: 'Why don’t I see jobs from a company I like?', a: 'Jobly only reads the companies on its list (1,600+ and growing every week), and For you only shows roles that match your preferences. Check the Companies page, and suggest a company through the support form.' },
      { q: 'Does Jobly have jobs outside tech?', a: 'Yes. Jobly lists every job from the career pages it reads. Design, development and IT jobs each get their own list; sales, marketing, finance, people, operations, legal, healthcare and other jobs are under More roles.' },
      { q: 'Does it cover every design level?', a: 'Yes: intern, junior, mid, senior, staff, principal, lead, manager, director, head of design, VP and chief design officer, plus UX research, UX writing, content, service and DesignOps roles. Graphic, brand, motion and other creative roles have their own list.' },
      { q: 'Can I see jobs in my country?', a: 'Yes, if the employers on Jobly’s list hire there. Use the location filter, or add your city or country as a keyword. Turn on Remote only to see remote roles.' },
    ],
  },
  {
    id: 'alerts', title: 'Alerts and saved jobs', items: [
      { q: 'How do alerts work?', a: 'Every 60 to 90 minutes your browser reads Jobly’s public job files, picks the jobs that match your preferences and compares them with what it has already seen. New ones show up as a badge on the toolbar icon and, if you turn it on, as a desktop notification.' },
      { q: 'I’m not getting desktop notifications.', a: 'Turn alerts on in Jobly’s Preferences, then check that Chrome is allowed to show notifications in your computer’s system settings. Focus or Do Not Disturb modes can also hide them.' },
      { q: 'Are my saved jobs backed up?', a: 'They live in this browser. Turn on sync in Preferences to copy your preferences, tracker and profiles to Chrome on your other computers, or use Backup in the Tracker to save everything as a file.' },
      { q: 'Does Jobly track my applications?', a: 'Yes. Mark any job as Applied, Interviewing, Offer or Rejected, add notes, follow-up reminders and interviews with prep checklists, and see your weekly progress. You can also import a spreadsheet of applications you kept elsewhere.' },
    ],
  },
  {
    id: 'privacy', title: 'Privacy', items: [
      { top: true, q: 'What do you store about me?', a: 'Nothing in a database. Your preferences, saved jobs and alerts stay in your browser. Jobly downloads its public job files and filters them in your browser, so your preferences never leave it. Only if those files can’t be reached does it ask Jobly’s backup server, which gets your preferences with that request and doesn’t keep them.' },
      { q: 'Can Jobly see the pages I visit?', a: 'Only the tab you click on, and only when you ask: Save, Fit check or Autofill. It never reads your history or other tabs, and it only talks to its own job data and server.' },
      { q: 'Why does the extension need notifications and alarms?', a: 'Alarms let it check for new jobs in the background every 60 to 90 minutes. Notifications let it tell you about a new match, only if you turn alerts on.' },
    ],
  },
  {
    id: 'help', title: 'Troubleshooting', items: [
      { q: 'Jobs take a long time to load.', a: 'Jobs now load from fast public files, usually in under a second. If those can’t be reached, Jobly falls back to its server, which runs on a free plan and can take up to a minute to wake up.' },
      { q: 'A job is gone when I click Apply.', a: 'The employer probably closed it after Jobly’s last refresh. Closed jobs disappear from Jobly within about four hours.' },
      { q: 'A listing looks wrong or suspicious.', a: 'Use Report this listing on the job card, or write to us through the support page. We read every report.' },
    ],
  },
];
export const ALL_FAQS = FAQ_GROUPS.flatMap((g) => g.items);
export const TOP_FAQS = ALL_FAQS.filter((f) => f.top);
