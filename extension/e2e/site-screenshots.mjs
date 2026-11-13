// The website's product tour (the tabbed window under the home page hero): four screens of the current extension
// (jobs, apply assist, tailor, profile import), in light and dark, at 1440x900 and 2x, written as PNG to $OUT.
// Use a dev build and real job data:
//   OUT=/tmp/tour EXT_DIST=<dev build> STATIC_DIR=<static export> node e2e/site-screenshots.mjs
// Then make the three sizes the site loads (web/public/img/dashboard-<tab>-<theme>[-1080|-720].webp):
//   for f in /tmp/tour/*.png; do b=$(basename "$f" .png); cwebp -q 80 "$f" -o "web/public/img/$b.webp";
//     cwebp -q 80 -resize 1080 0 "$f" -o "web/public/img/$b-1080.webp"; cwebp -q 80 -resize 720 0 "$f" -o "web/public/img/$b-720.webp"; done
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { launch, open, sleep, staticJobs } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT || path.join(os.tmpdir(), 'jobly-tour');
fs.mkdirSync(OUT, { recursive: true });
const iso = (d) => new Date(Date.now() + d * 86400000).toISOString();
const profile = {
  id: 'p1', label: 'Product design', first_name: 'Ananya', last_name: 'Rao', email: 'ananya.rao@example.com', phone: '+91 98765 43210', location: 'Bengaluru, India',
  headline: 'Senior Product Designer', summary: 'Product designer with seven years of experience shipping consumer and fintech products, from research to polished UI.',
  linkedin: 'linkedin.com/in/ananyarao', github: '', portfolio: 'ananyarao.design', website: '', work_authorization: 'Indian citizen', needs_sponsorship: 'no',
  years_experience: '7', salary_expectation: '', notice_period: '30 days', skills: 'Figma, Design systems, User research, Accessibility, Prototyping, Usability testing',
  work: [
    { id: 'w1', company: 'Northwind Labs', title: 'Senior Product Designer', location: 'Bengaluru, India', start: '2022-04', end: '', current: true,
      bullets: 'Ran weekly research sessions with customers\nBuilt the design system used by 6 product teams\nLed the redesign of checkout, lifting conversion by 18%' },
    { id: 'w2', company: 'Quill Systems', title: 'Product Designer', location: 'Pune, India', start: '2019-07', end: '2022-03', current: false,
      bullets: 'Designed the mobile app from first sketch to launch\nCut onboarding time in half with a new setup flow' },
  ],
  education: [{ id: 'e1', school: 'National Institute of Design', degree: 'B.Des', field: 'Interaction Design', start: '2015-07', end: '2019-05' }], updated_at: iso(0),
};
const JD = ['Senior Product Designer, Acme (demo posting)', 'Requirements', '- 5+ years of experience in product design', '- Expert in Figma and prototyping',
  '- Experience building and maintaining design systems', '- Strong user research skills', 'Nice to have', '- Experience with fintech products', '- Familiarity with React'].join('\n');

for (const theme of (process.env.THEMES || 'light,dark').split(',')) {
  const h = await launch({ colorScheme: theme, scale: 2 });
  await h.ctx.route(/t2\.gstatic\.com/, (r) => r.abort());
  await h.sw.evaluate((d) => chrome.storage.local.set(d), {
    profiles: [profile], activeProfileId: 'p1',
    resumeFile: { p1: { name: 'Ananya-Rao-resume.pdf', type: 'application/pdf', size: 20, data: 'data:application/pdf;base64,JVBERi0xLjQK' } },
    savedAnswers: [{ question: 'How did you hear about us?', key: 'how did hear about us', value: 'LinkedIn', kind: 'text', used_at: iso(-3), uses: 2 }],
    userPreferences: { roles: ['product_design'], seniorities: ['mid', 'senior', 'lead'], locations: [], remote_only: false, custom_keywords: 'product designer', excluded_keywords: '', min_salary: 0, employment_types: [], notify_enabled: true, sync_interval_mins: 60 },
    applications: [{ key: 'https://careers.northwind.example/designer', title: 'Senior Product Designer', company_name: 'Northwind Labs', location: 'Bengaluru, India', application_url: 'https://careers.northwind.example/designer', source: 'page', status: 'applied', notes: '', applied_at: iso(-1), follow_up_at: null, created_at: iso(-1), updated_at: iso(-1) }],
    contacts: [
      { id: 'c1', name: 'Priya Shah', position: 'Design Manager', email: '', linkedin: 'https://linkedin.com/in/example-priya', company: 'Northwind Labs', app_key: 'https://careers.northwind.example/designer', source: 'manual', relation: 'hiring_manager', notes: '', contacted_at: null, created_at: iso(0) },
      { id: 'c2', name: 'Arjun Menon', position: 'Talent Partner', email: 'arjun@example.com', linkedin: '', company: 'Northwind Labs', app_key: 'https://careers.northwind.example/designer', source: 'manual', relation: 'recruiter', notes: '', contacted_at: iso(-1), created_at: iso(0) },
      { id: 'c3', name: 'Rahul Mehta', position: 'Former manager at Quill Systems', email: 'rahul@example.com', linkedin: '', company: 'Quill Systems', app_key: null, source: 'manual', relation: 'reference', notes: '', contacted_at: null, created_at: iso(0) },
    ],
    // The apply queue with made-up companies (their logos fall back to a letter)
    applyQueue: [
      { id: 'q1', url: 'https://careers.globex.example/1', title: 'Product Designer, Payments', company: 'Globex', location: 'Remote', state: 'queued', note: '', needs: [], filled: 0, tabId: null, added_at: iso(0), updated_at: iso(0) },
      { id: 'q2', url: 'https://careers.initech.example/2', title: 'Senior Product Designer', company: 'Initech', location: 'Bengaluru', state: 'filling', note: '', needs: [], filled: 7, tabId: null, added_at: iso(0), updated_at: iso(0) },
      { id: 'q3', url: 'https://careers.hooli.example/3', title: 'Design Systems Lead', company: 'Hooli', location: 'Remote', state: 'needs-input', note: '', needs: ['Earliest start date', 'Why do you want to work at Hooli?'], filled: 12, tabId: null, added_at: iso(0), updated_at: iso(0) },
      { id: 'q4', url: 'https://careers.acme.example/4', title: 'Lead Product Designer', company: 'Acme', location: 'Pune', state: 'review', note: '', needs: [], filled: 15, tabId: null, added_at: iso(0), updated_at: iso(0) },
      { id: 'q5', url: 'https://careers.northwind.example/designer', title: 'Senior Product Designer', company: 'Northwind Labs', location: 'Bengaluru', state: 'submitted', note: '', needs: [], filled: 14, tabId: null, added_at: iso(0), updated_at: iso(0) },
      { id: 'q6', url: 'https://careers.umbrella.example/6', title: 'UX Designer', company: 'Umbrella', location: 'Hyderabad', state: 'stopped', note: 'This site asks you to sign in first.', needs: [], filled: 0, tabId: null, added_at: iso(0), updated_at: iso(0) },
    ],
    resumeSettings: { template: 'modern', accent: 'black', page: 'a4', fit: true },
    seenAlertKeys: staticJobs().filter((j) => ['1', '3', '7'].includes(j.bucket)).map((j) => j.application_url),
  });
  const shot = (page, name) => page.screenshot({ path: path.join(OUT, `dashboard-${name}-${theme}.png`) }).then(() => console.log('wrote', name, theme));
  const d = await open(h, 'options.html', { theme, width: 1440, height: 900 });
  await d.locator('article').first().waitFor({ timeout: 40000 }); await sleep(1000);
  const before = await d.locator('article').first().getAttribute('aria-label');
  await d.getByLabel('Search jobs').fill('product designer');
  for (let i = 0; i < 40 && (await d.locator('article').first().getAttribute('aria-label')) === before; i++) await sleep(300);
  await d.evaluate(() => document.activeElement.blur()); await sleep(1200);
  await shot(d, 'jobs');
  // Apply assist on a made-up company's form
  const form = await h.ctx.newPage(); await form.setViewportSize({ width: 1440, height: 900 }); await form.emulateMedia({ colorScheme: theme });
  await form.route('https://apply.example.test/**', (r) => r.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(here, 'fixtures', 'apply-store.html'), 'utf8') }));
  await form.goto('https://apply.example.test/northwind/senior-product-designer');
  await h.sw.evaluate(async () => { const [t] = await chrome.tabs.query({ url: 'https://apply.example.test/*' }); await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['assist.js'] }); });
  await form.getByRole('dialog', { name: 'Jobly apply assist' }).getByText('Ready for your approval').waitFor({ timeout: 10000 }); await sleep(800);
  await shot(form, 'assist');
  // the same form after Fill, for the store screenshot
  await form.getByRole('button', { name: /^Fill \d+ answers/ }).click(); await sleep(1500);
  await shot(form, 'assist-filled'); await form.close();
  // Tailor for a job
  await d.goto(`chrome-extension://${h.id}/options.html#tailor`); await sleep(1000);
  await d.getByLabel('Role').fill('Senior Product Designer'); await d.getByLabel('Company').fill('Acme'); await d.getByLabel('Job description').fill(JD);
  await d.getByRole('button', { name: 'Check my resume' }).click(); await sleep(600);
  await d.evaluate(() => document.querySelector('.tailor-score')?.scrollIntoView({ block: 'start' })); await d.evaluate(() => window.scrollBy(0, -16)); await sleep(500);
  await shot(d, 'tailor');
  // Profile setup after a LinkedIn PDF import (the made-up person in the test fixture)
  await d.goto(`chrome-extension://${h.id}/options.html#profile`); await sleep(1000);
  await d.getByRole('button', { name: 'Import a file' }).click();
  await d.locator('input[type="file"]').setInputFiles(path.join(here, 'fixtures', 'linkedin.pdf'));
  await d.getByText(/LinkedIn profile read/).waitFor({ timeout: 20000 }); await sleep(500);
  await shot(d, 'profile');
  // Applications: the apply queue board
  await d.goto(`chrome-extension://${h.id}/options.html#applications`); await d.getByRole('heading', { name: 'Applications' }).waitFor(); await sleep(1200);
  await shot(d, 'applications');
  // Resume: the Score and ATS tab beside the page
  await d.goto(`chrome-extension://${h.id}/options.html#resume`); await d.locator('.resume-print .resume h1').waitFor(); await sleep(600);
  await d.getByRole('tab', { name: /^Score and ATS/ }).click(); await sleep(600);
  await shot(d, 'resume');
  // People: who to look for at the company, and saved people with how you know them
  await d.goto(`chrome-extension://${h.id}/options.html#contacts`); await sleep(1000);
  await d.getByLabel('Job', { exact: true }).selectOption({ index: 1 }); await d.getByRole('radio', { name: 'Hiring manager' }).click(); await sleep(500);
  await shot(d, 'people');
  await h.ctx.close();
}
