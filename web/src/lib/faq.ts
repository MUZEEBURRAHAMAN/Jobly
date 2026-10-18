// Questions shown on /faq (all) and on the landing page (the ones marked `top`). Answers are plain text.
export type Faq = { q: string; a: string; top?: boolean };
export const FAQ_GROUPS: { id: string; title: string; items: Faq[] }[] = [
  {
    id: 'basics', title: 'The basics', items: [
      { top: true, q: 'How is Jobly different from LinkedIn or Indeed?', a: 'Jobly reads postings from company career pages and shows the date the employer posted them. It hides anything older than two months, shows no promoted jobs, and works without an account. LinkedIn and Indeed have far more jobs across every industry, plus things Jobly doesn’t do, like Easy Apply.' },
      { top: true, q: 'Is it really free?', a: 'Yes. Jobly is free, has no premium tier and shows no ads.' },
      { q: 'Do I need an account?', a: 'No. There is no sign-up, no login and no email. You pick your roles in the extension and that’s it.' },
      { top: true, q: 'Which browsers does it work in?', a: 'Chrome on desktop. Chromium browsers that install extensions from the Chrome Web Store, such as Edge and Brave, should work too, but we test on Chrome.' },
      { q: 'Does Jobly apply to jobs for me?', a: 'No. Every Apply button opens the original listing, usually the employer’s own careers page and sometimes the remote job board it came from. You apply there yourself. Jobly never submits anything on your behalf.' },
    ],
  },
  {
    id: 'jobs', title: 'Jobs and dates', items: [
      { top: true, q: 'Which jobs does it cover?', a: 'Product design, frontend, product management, AI/ML and fullstack roles. Jobly reads more than 170 company career pages on Greenhouse, Ashby, Lever, Workday and Amazon, plus remote job boards such as We Work Remotely, Remotive, Himalayas and Arbeitnow.' },
      { top: true, q: 'How fresh are the jobs?', a: 'The server refreshes every two hours and drops anything older than 60 days or no longer listed by the employer. Your browser checks for new matches every 60 to 90 minutes.' },
      { q: 'Where does the posting date come from?', a: 'From the system the employer published the job in, for example Greenhouse’s first-published date or Lever’s created date. The How dates work page lists the exact field for every source.' },
      { q: 'Why don’t I see jobs from a company I like?', a: 'Jobly only reads the companies on its list, and only shows tech roles that match your preferences. Check the Companies page, and suggest a company through the support form.' },
      { q: 'Does Jobly have jobs outside tech?', a: 'Not at the moment. It focuses on five tech role families so the matching stays accurate.' },
      { q: 'Can I see jobs in my country?', a: 'Yes, if the employers on Jobly’s list hire there. Use the location filter, or add your city or country as a keyword. Turn on Remote only to see remote roles.' },
    ],
  },
  {
    id: 'alerts', title: 'Alerts and saved jobs', items: [
      { q: 'How do alerts work?', a: 'Every 60 to 90 minutes your browser asks Jobly’s server for jobs that match your preferences and compares them with what it has already seen. New ones show up as a badge on the toolbar icon and, if you turn it on, as a desktop notification.' },
      { q: 'I’m not getting desktop notifications.', a: 'Turn alerts on in Jobly’s Preferences, then check that Chrome is allowed to show notifications in your computer’s system settings. Focus or Do Not Disturb modes can also hide them.' },
      { q: 'Are my saved jobs backed up?', a: 'No. Saved jobs live only in this browser, so they aren’t copied to other devices and are deleted if you uninstall Jobly.' },
    ],
  },
  {
    id: 'privacy', title: 'Privacy', items: [
      { top: true, q: 'What do you store about me?', a: 'Nothing in a database. Your preferences, saved jobs and alerts stay in your browser. Your search words and preferences go to the server with each request to pick matching jobs, and the server doesn’t keep them.' },
      { q: 'Can Jobly see the pages I visit?', a: 'No. Jobly has no permission to read your tabs, history or the pages you browse. It only talks to its own server.' },
      { q: 'Why does the extension need notifications and alarms?', a: 'Alarms let it check for new jobs in the background every 60 to 90 minutes. Notifications let it tell you about a new match, only if you turn alerts on.' },
    ],
  },
  {
    id: 'help', title: 'Troubleshooting', items: [
      { q: 'Jobs take a long time to load.', a: 'Jobly’s server runs on a free plan and sleeps when nobody is using it. The first request after a quiet period can take up to a minute. After that it’s quick.' },
      { q: 'A job is gone when I click Apply.', a: 'The employer probably closed it after Jobly’s last refresh. Closed jobs disappear from Jobly within about two hours.' },
      { q: 'A listing looks wrong or suspicious.', a: 'Use Report this listing on the job card, or write to us through the support page. We read every report.' },
    ],
  },
];
export const ALL_FAQS = FAQ_GROUPS.flatMap((g) => g.items);
export const TOP_FAQS = ALL_FAQS.filter((f) => f.top);
