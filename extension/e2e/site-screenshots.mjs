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
  years_experience: '7', salary_expectation: '', notice_period: '30 days', skills: 'Figma, Design systems, User research, Accessibility',
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

for (const theme of ['light', 'dark']) {
  const h = await launch({ colorScheme: theme, scale: 2 });
  await h.ctx.route(/t2\.gstatic\.com/, (r) => r.abort());
  await h.sw.evaluate((d) => chrome.storage.local.set(d), {
    profiles: [profile], activeProfileId: 'p1',
    resumeFile: { p1: { name: 'Ananya-Rao-resume.pdf', type: 'application/pdf', size: 20, data: 'data:application/pdf;base64,JVBERi0xLjQK' } },
    savedAnswers: [{ question: 'How did you hear about us?', key: 'how did hear about us', value: 'LinkedIn', kind: 'text', used_at: iso(-3), uses: 2 }],
    userPreferences: { roles: ['product_design'], seniorities: ['mid', 'senior', 'lead'], locations: [], remote_only: false, custom_keywords: '', excluded_keywords: '', min_salary: 0, employment_types: [], notify_enabled: true, sync_interval_mins: 60 },
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
  await shot(form, 'assist'); await form.close();
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
  await h.ctx.close();
}
