// 1280x800 Chrome Web Store screenshots (and a 400x600 popup) with a made-up demo profile, written to
// store-assets/screenshots/v1.1/. With the test fixture: `bash e2e/run.sh store-screenshots`. With real job data (better):
//   python -m backend.app.static_export /tmp/jobly-data   (DATABASE_PATH = a downloaded "snapshot" release database)
//   npx vite build --mode development --outDir /tmp/jobly-dev
//   EXT_DIST=/tmp/jobly-dev STATIC_DIR=/tmp/jobly-data node e2e/store-screenshots.mjs
import path from 'path';
import { fileURLToPath } from 'url';
import { launch, open, sleep, staticJobs } from './lib.mjs';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'store-assets', 'screenshots', 'v1.1');
const h = await launch();
await h.ctx.route(/t2\.gstatic\.com/, (r) => r.abort());
const iso = (d, hr = 10) => { const x = new Date(Date.now() + d * 86400000); x.setHours(hr, 0, 0, 0); return x.toISOString(); };
// The tracker shows a made-up person's applications, so they go to made-up companies (the job list itself is real).
const fake = [['Senior Product Designer', 'Copperfield AI', 'Bengaluru, India'], ['Product Designer', 'Skylark', 'Remote'], ['Lead Product Designer', 'Tidewater', 'Pune, India'],
  ['UX Designer', 'Lumen Works', 'Hyderabad, India'], ['Design Systems Lead', 'Brightloop', 'Remote'], ['Senior Product Designer', 'Redwood Pay', 'Mumbai, India'],
  ['Product Design Manager', 'Harbor & Co', 'Gurugram, India'], ['Staff Product Designer', 'Mosaic Health', 'Bengaluru, India'], ['UX Researcher', 'Fernhill', 'Chennai, India']];
const jobs = fake.map(([title, company_name, location], n) => ({ title, company_name, location, application_url: `https://example.com/jobs/${n + 1}` }));
const app = (j, status, applied, follow) => ({ key: j.application_url, title: j.title, company_name: j.company_name, location: j.location, application_url: j.application_url,
  source: 'jobly', status, notes: '', applied_at: applied === null ? null : iso(applied), follow_up_at: follow === undefined ? null : iso(follow), created_at: iso(-6), updated_at: iso(-1) });
const apps = [app(jobs[0], 'saved', null), app(jobs[1], 'saved', null), app(jobs[2], 'applied', -3, 2), app(jobs[3], 'applied', -5, -1), app(jobs[4], 'applied', -1),
  app(jobs[5], 'interview', -8), app(jobs[6], 'interview', -10), app(jobs[7], 'offer', -18), app(jobs[8], 'rejected', -20)];
const work = [
  { id: 'w1', company: 'Northwind Labs', title: 'Senior Product Designer', location: 'Bengaluru, India', start: '2022-04', end: '', current: true,
    bullets: 'Led the redesign of checkout, lifting conversion by 18%\nBuilt the design system used by 6 product teams\nRan weekly research sessions with customers' },
  { id: 'w2', company: 'Quill Systems', title: 'Product Designer', location: 'Pune, India', start: '2019-07', end: '2022-03', current: false,
    bullets: 'Designed the mobile app from first sketch to launch\nCut onboarding time in half with a new setup flow' },
];
await h.sw.evaluate(async (d) => chrome.storage.local.set(d), {
  applications: apps,
  interviews: [
    { id: 'i1', app_key: apps[5].key, round: 'Portfolio review', at: iso(1, 15), link: 'https://meet.example.com/abc', notes: 'Walk through the checkout case study',
      checklist: [{ id: 'c1', text: 'Research the team', done: true, due: null }, { id: 'c2', text: 'Prepare two case studies', done: true, due: null }, { id: 'c3', text: 'Questions to ask', done: false, due: null }], rating: null },
    { id: 'i2', app_key: apps[6].key, round: 'Hiring manager', at: iso(3, 11), link: '', notes: '', checklist: [{ id: 'c4', text: 'Review the job description', done: false, due: null }], rating: null },
  ],
  tasks: [
    { id: 't1', text: 'Send a thank-you note after the portfolio review', due_at: iso(1), done: false, app_key: apps[5].key, created_at: iso(-1) },
    { id: 't2', text: 'Update the checkout case study', due_at: iso(2), done: false, app_key: null, created_at: iso(-1) },
    { id: 't3', text: 'Ask Priya for a referral', due_at: null, done: false, app_key: null, created_at: iso(-1) },
  ],
  trackerSettings: { weekly_goal: 8, reminders: true },
  profiles: [{ id: 'p1', label: 'Product design', first_name: 'Ananya', last_name: 'Rao', email: 'ananya.rao@example.com', phone: '+91 98765 43210', location: 'Bengaluru, India',
    headline: 'Senior Product Designer', summary: 'Product designer with seven years of experience shipping consumer and fintech products, from research to polished UI.',
    linkedin: 'linkedin.com/in/ananyarao', github: '', portfolio: 'ananyarao.design', website: '', work_authorization: 'Indian citizen', needs_sponsorship: 'no',
    years_experience: '7', salary_expectation: '₹35,00,000', notice_period: '30 days', skills: 'Figma, Design systems, User research, Prototyping, Accessibility',
    work, education: [{ id: 'e1', school: 'National Institute of Design', degree: 'B.Des', field: 'Interaction Design', start: '2015-07', end: '2019-05' }], updated_at: iso(0) }],
  activeProfileId: 'p1',
  userPreferences: { roles: ['product_design', 'product_management'], seniorities: ['mid', 'senior', 'lead'], locations: [], remote_only: false, custom_keywords: '', excluded_keywords: '', min_salary: 0, employment_types: [], notify_enabled: true, sync_interval_mins: 30 },
  seenAlertKeys: staticJobs().map((j) => j.application_url),
});
const d = await open(h, 'options.html', { width: 1280, height: 800 });
await d.locator('article').first().waitFor({ timeout: 30000 });
const snap = async (tab, file) => { if (tab) await d.goto(`chrome-extension://${h.id}/options.html#${tab}`); await sleep(1200); await d.screenshot({ path: path.join(OUT, file) }); console.log('wrote', file); };
const before = await d.locator('article').first().getAttribute('aria-label');
await d.getByLabel('Search jobs').fill('UX');
for (let i = 0; i < 40 && (await d.locator('article').first().getAttribute('aria-label')) === before; i++) await sleep(500);
await d.evaluate(() => document.activeElement.blur()); await sleep(800);
await snap(null, '1-jobs.png');
await d.getByLabel('Search jobs').fill(''); await sleep(800);
await snap('tracker', '2-tracker.png');
await snap('interviews', '3-interviews.png');
await snap('resume', '4-resume.png');
await snap('profile', '5-profile.png');
await d.goto(`chrome-extension://${h.id}/options.html#letters`); await sleep(800);
await d.locator('#cl-target').selectOption({ index: 6 });
await snap(null, '6-cover-letter.png');
await snap('tasks', '7-tasks.png');
const p = await open(h, 'popup.html', { width: 400, height: 600 }); await p.locator('article').first().waitFor({ timeout: 30000 }); await sleep(800);
await p.screenshot({ path: path.join(OUT, 'popup-400x600.png') }); console.log('wrote popup-400x600.png');
await h.ctx.close();
