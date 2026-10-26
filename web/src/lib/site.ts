// One place for links and facts used across the site.
export const SITE = {
  name: 'Jobly',
  url: 'https://joblyextension.netlify.app',
  email: 'rahamanmuzeeb1108@gmail.com',
  // The Chrome Web Store listing (live since 2026-10-26). Empty = the buttons fall back to /how-it-works#install.
  storeUrl: 'https://chromewebstore.google.com/detail/phdobnnjceecemndkgeclghkjcfjfgfl',
  api: (import.meta.env.PUBLIC_API_BASE as string | undefined) || 'https://jobly-yd6l.onrender.com',
  github: 'https://github.com/MUZEEBURRAHAMAN/Jobly',
};

export const installHref = SITE.storeUrl || '/how-it-works#install';

export type MenuItem = { label: string; text: string; href: string; icon: string };

export const MENUS: { id: string; label: string; items: MenuItem[]; preview: { title: string; text: string } }[] = [
  {
    id: 'product',
    label: 'Product',
    items: [
      { label: 'Jobs feed', text: 'The freshest matches first, each with its posting date.', href: '/#features', icon: 'briefcase' },
      { label: 'Alerts', text: 'A notification when a new match appears.', href: '/#features', icon: 'bell' },
      { label: 'Saved jobs', text: 'A shortlist that stays on your device.', href: '/#features', icon: 'bookmark' },
      { label: 'Filters', text: 'Date posted, experience, salary, location, remote.', href: '/#features', icon: 'sliders-horizontal' },
      { label: 'How it works', text: 'From career page to your toolbar.', href: '/how-it-works', icon: 'layers' },
      { label: 'How dates work', text: 'Where dates come from and the 60-day rule.', href: '/how-dates-work', icon: 'calendar-clock' },
    ],
    preview: { title: 'Jobly dashboard', text: 'Your matches, sorted by posting date.' },
  },
  {
    id: 'resources',
    label: 'Resources',
    items: [
      { label: 'Guides', text: 'Practical help for your job search.', href: '/guides', icon: 'book-open' },
      { label: 'Alternatives', text: 'How Jobly compares with LinkedIn, Indeed and others.', href: '/alternatives', icon: 'scale' },
      { label: 'Companies', text: 'Every employer and job board Jobly reads.', href: '/companies', icon: 'building-2' },
      { label: 'Roadmap', text: "What's next and what already shipped.", href: '/roadmap', icon: 'git-branch' },
      { label: 'FAQ', text: 'Answers to common questions.', href: '/faq', icon: 'circle-help' },
      { label: 'Support', text: 'Questions, bugs or ideas: write to us.', href: '/support', icon: 'life-buoy' },
    ],
    preview: { title: 'Live right now', text: 'New jobs Jobly found today.' },
  },
];

export const NAV_LINKS = [{ label: 'Jobs', href: '/jobs' }, { label: 'Companies', href: '/companies' }];
