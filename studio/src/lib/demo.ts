// Demo data so someone can see Studio working before typing anything. Sam Rivera is made up.
import { emptyData } from './defaults';
import { now } from './ids';
import type { Application, Profile, StudioData } from './types';
import { applyDraft, newApplication, setStatus } from './workflows';

export const DEMO_PROFILE: Profile = {
  basics: {
    name: 'Sam Rivera',
    headline: 'Frontend engineer',
    email: 'sam.rivera@example.com',
    phone: '+1 555 0100',
    location: 'Austin, TX',
    summary: 'Frontend engineer with 6 years building React and TypeScript products, from design systems to checkout flows. I care about fast pages, accessible interfaces and shipping in small steps.',
    links: [{ id: 'ln_gh', label: 'github.com/samrivera', url: 'https://github.com/samrivera' }],
  },
  experience: [
    {
      id: 'exp_lumen', title: 'Senior Frontend Engineer', company: 'Lumen Health', location: 'Remote', start: 'Mar 2022', end: '',
      bullets: [
        { id: 'b_l1', text: 'Rebuilt the patient booking flow in React and TypeScript, raising completed bookings by 18%' },
        { id: 'b_l2', text: 'Cut the main bundle from 1.4 MB to 610 KB with route-level code splitting and image work' },
        { id: 'b_l3', text: 'Led the accessibility programme: fixed 140 WCAG issues and added axe checks to CI' },
        { id: 'b_l4', text: 'Mentored 3 engineers through their first year on the team' },
      ],
    },
    {
      id: 'exp_parcel', title: 'Frontend Engineer', company: 'Parcelly', location: 'Austin, TX', start: 'Jun 2019', end: 'Feb 2022',
      bullets: [
        { id: 'b_p1', text: 'Built the company design system (42 components) used by 5 product teams' },
        { id: 'b_p2', text: 'Moved the dashboard from REST polling to GraphQL subscriptions, removing 30 seconds of delay for live tracking' },
        { id: 'b_p3', text: 'Wrote the end-to-end test suite in Playwright that now gates every release' },
      ],
    },
  ],
  projects: [
    { id: 'prj_tiny', name: 'tinycharts', role: 'Author', url: 'https://github.com/samrivera/tinycharts', start: '2023', end: '',
      bullets: [{ id: 'b_t1', text: 'Open-source SVG chart library for React, 2 KB gzipped, 900 GitHub stars' }] },
  ],
  education: [{ id: 'edu_ut', school: 'University of Texas at Austin', degree: 'BS Computer Science', start: '2015', end: '2019', details: '' }],
  skills: [
    { id: 'sk_react', name: 'React', group: 'Frontend' },
    { id: 'sk_ts', name: 'TypeScript', group: 'Frontend' },
    { id: 'sk_next', name: 'Next.js', group: 'Frontend' },
    { id: 'sk_css', name: 'CSS', group: 'Frontend' },
    { id: 'sk_gql', name: 'GraphQL', group: 'Data' },
    { id: 'sk_node', name: 'Node.js', group: 'Data' },
    { id: 'sk_pw', name: 'Playwright', group: 'Quality' },
    { id: 'sk_a11y', name: 'Accessibility (WCAG)', group: 'Quality' },
    { id: 'sk_figma', name: 'Figma', group: 'Tools' },
  ],
  languages: [{ id: 'lang_en', name: 'English', level: 'Native' }, { id: 'lang_es', name: 'Spanish', level: 'Professional' }],
  order: ['summary', 'experience', 'projects', 'skills', 'education', 'languages'],
};

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

function demoApp(title: string, company: string, status: Application['status'], ageDays: number): Application {
  const posting = {
    title, company, location: 'Remote (US)', url: '', contact: '', language: 'English',
    text: `${title} at ${company}\n\nWe’re looking for a frontend engineer to own our web app. You’ll work in React and TypeScript, care about performance and accessibility, and help shape our design system.\n\nRequirements\n• 5+ years building web apps with React\n• Strong TypeScript\n• Experience with design systems\n• Testing with Playwright or Cypress\n• Nice to have: GraphQL, Go`,
    requirements: [
      { id: 'r1', text: '5+ years building web apps with React', must: true },
      { id: 'r2', text: 'Strong TypeScript', must: true },
      { id: 'r3', text: 'Experience with design systems', must: true },
      { id: 'r4', text: 'End-to-end testing (Playwright or Cypress)', must: false },
      { id: 'r5', text: 'GraphQL', must: false },
      { id: 'r6', text: 'Go', must: false },
    ],
  };
  const matches = [
    { requirementId: 'r1', level: 'met' as const, sources: ['exp_lumen', 'exp_parcel'], note: 'Six years of React across two jobs.' },
    { requirementId: 'r2', level: 'met' as const, sources: ['sk_ts', 'b_l1'], note: 'TypeScript in the booking rebuild.' },
    { requirementId: 'r3', level: 'met' as const, sources: ['b_p1'], note: 'Built a 42-component design system.' },
    { requirementId: 'r4', level: 'met' as const, sources: ['b_p3', 'sk_pw'], note: 'Wrote the Playwright release suite.' },
    { requirementId: 'r5', level: 'met' as const, sources: ['b_p2'], note: 'Moved a dashboard to GraphQL subscriptions.' },
    { requirementId: 'r6', level: 'gap' as const, sources: [], note: 'No Go in the profile.' },
  ];
  let app = newApplication(posting, matches, 'direct', DEMO_PROFILE);
  app = applyDraft(app, {
    resume: {
      headline: 'Senior frontend engineer',
      summary: { text: 'Frontend engineer with 6 years in React and TypeScript, who builds design systems, fast pages and accessible interfaces.', sources: ['summary'] },
      experience: [
        { id: 'exp_lumen', bullets: [
          { text: 'Rebuilt the patient booking flow in React and TypeScript, lifting completed bookings by 18%', sources: ['b_l1'] },
          { text: 'Shrank the main bundle from 1.4 MB to 610 KB with route-level code splitting', sources: ['b_l2'] },
          { text: 'Led accessibility work: fixed 140 WCAG issues and added axe checks to CI', sources: ['b_l3'] },
        ] },
        { id: 'exp_parcel', bullets: [
          { text: 'Built the design system (42 components) used by 5 product teams', sources: ['b_p1'] },
          { text: 'Wrote the Playwright end-to-end suite that gates every release', sources: ['b_p3'] },
          { text: 'Moved live tracking to GraphQL subscriptions, removing 30 seconds of delay', sources: ['b_p2'] },
        ] },
      ],
      projects: [{ id: 'prj_tiny', bullets: [{ text: 'Author of tinycharts, an open-source React chart library (2 KB, 900 stars)', sources: ['b_t1'] }] }],
      skills: ['sk_react', 'sk_ts', 'sk_pw', 'sk_a11y', 'sk_gql', 'sk_next', 'sk_css', 'sk_node', 'sk_figma'],
      education: ['edu_ut'],
    },
    letter: {
      recipient: `${company} hiring team`,
      greeting: 'Dear hiring team,',
      paragraphs: [
        { text: `Your ${title} role asks for someone to own the web app and shape a design system. That is the work I have done for the last six years.`, sources: ['summary'] },
        { text: 'At Parcelly I built the design system our five product teams shipped with, 42 components, and wrote the Playwright suite that gates every release. At Lumen Health I rebuilt the booking flow in React and TypeScript, which lifted completed bookings by 18%, and cut the main bundle from 1.4 MB to 610 KB.', sources: ['b_p1', 'b_p3', 'b_l1', 'b_l2'] },
        { text: 'Accessibility is part of how I build, not a final check: I led the work that fixed 140 WCAG issues and put axe checks into CI.', sources: ['b_l3'] },
        { text: `I would like to bring that to ${company}. I’d be glad to talk about how I could help.`, sources: [] },
      ],
      closing: 'Best regards,',
    },
  }, DEMO_PROFILE).app;
  const created = daysAgo(ageDays);
  app = { ...app, createdAt: created, statusHistory: [{ status: 'draft', at: created }] };
  if (status !== 'draft') {
    app = setStatus(app, 'applied');
    app.statusHistory[app.statusHistory.length - 1].at = daysAgo(ageDays - 1);
  }
  if (status === 'interviewing' || status === 'offer') {
    app = setStatus(app, 'interviewing');
    app.statusHistory[app.statusHistory.length - 1].at = daysAgo(Math.max(ageDays - 6, 1));
    app.interviews = [{ id: 'int_1', at: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16), kind: 'Technical interview', notes: 'Pair on a React component; ask about their design tokens.' }];
  }
  if (status === 'closed') app = setStatus(app, 'closed');
  app.updatedAt = now();
  return app;
}

export function demoData(): StudioData {
  const data = emptyData();
  data.profile = structuredClone(DEMO_PROFILE);
  data.applications = [
    demoApp('Senior Frontend Engineer', 'Northwind', 'interviewing', 16),
    demoApp('Frontend Engineer, Design Systems', 'Brightline', 'applied', 9),
    demoApp('Staff Frontend Engineer', 'Kestrel', 'applied', 23),
    demoApp('UI Engineer', 'Orbit Labs', 'draft', 2),
    demoApp('Frontend Developer', 'Cobalt', 'closed', 40),
  ];
  data.settings.onboarded = true;
  return data;
}
