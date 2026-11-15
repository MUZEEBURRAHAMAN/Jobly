// Apply queue on real application forms (not run by the suite: it reaches the internet).
// Fills a made-up profile into real forms and never submits. Run:
//   JOBLY_ALL_HOSTS=1 npx vite build --mode development --outDir /tmp/jobly-real --emptyOutDir
//   EXT_DIST=/tmp/jobly-real OUT=/tmp/real node e2e/real-forms.mjs <url> [<url> ...]
import fs from 'fs';
import { launch, open, sleep } from './lib.mjs';

const OUT = process.env.OUT || '/tmp/jobly-real-forms';
fs.mkdirSync(OUT, { recursive: true });
const urls = process.argv.slice(2);
const now = new Date().toISOString();
const profile = {
  id: 'p1', label: 'Test', first_name: 'Testa', last_name: 'Candidate', email: 'testa.candidate@example.com', phone: '+1 415 555 0100', location: 'San Francisco, CA',
  headline: 'Senior Software Engineer', summary: 'Software engineer with eight years of experience building web products.', linkedin: 'linkedin.com/in/example-testa', github: 'github.com/example-testa',
  portfolio: 'example.com', website: '', work_authorization: 'Authorized to work in the US', needs_sponsorship: 'no', years_experience: '8', salary_expectation: '', notice_period: '2 weeks',
  skills: 'TypeScript, React, Node.js, Figma', work: [{ id: 'w', company: 'Example Corp', title: 'Senior Software Engineer', location: 'Remote', start: '2020-01', end: '', current: true, bullets: 'Built the web platform used by 2 million people\nPrototyped new flows in Figma with the design team' }],
  education: [{ id: 'e', school: 'Example University', degree: 'BSc', field: 'Computer Science', start: '2012-09', end: '2016-06' }], projects: [], achievements: '', updated_at: now,
};
const h = await launch({ staticData: false });
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n').toString('base64');
await h.sw.evaluate((d) => chrome.storage.local.set(d), {
  profiles: [profile], activeProfileId: 'p1', resumeFile: { p1: { name: 'Testa-Candidate-resume.pdf', type: 'application/pdf', size: 60, data: `data:application/pdf;base64,${pdf}` } },
  applyQueue: urls.map((url, i) => ({ id: `q${i}`, url, title: new URL(url).hostname, company: new URL(url).hostname.split('.')[0], location: '', state: 'queued', note: '', needs: [], filled: 0, tabId: null, added_at: now, updated_at: now })),
});
const d = await open(h, 'options.html', { width: 1280, height: 900 });
await d.goto(`chrome-extension://${h.id}/options.html#applications`); await d.getByRole('heading', { name: 'Applications' }).waitFor();
await d.getByRole('button', { name: /^Start/ }).click();
const queue = async () => (await h.sw.evaluate(() => chrome.storage.local.get('applyQueue'))).applyQueue;
const settled = (q) => q.every((x) => ['needs-input', 'review', 'stopped', 'submitted'].includes(x.state));
const end = Date.now() + 150000;
let q = await queue();
while (Date.now() < end && !settled(q)) { await sleep(2000); q = await queue(); }
await sleep(4000); q = await queue();
for (const [i, x] of q.entries()) {
  const page = (await h.ctx.pages()).find((p) => p.url() !== 'about:blank' && !p.url().startsWith('chrome-extension') && (x.tabId != null) && p.url().includes(new URL(x.url).hostname.split('.').slice(-2).join('.')))
    ?? (await h.ctx.pages()).filter((p) => /^https?:/.test(p.url()))[i];
  const shot = page ? `${OUT}/form-${i}.png` : '';
  if (page) { await page.bringToFront(); await page.screenshot({ path: shot, fullPage: false }).catch(() => {}); }
  const values = page ? await page.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]):not([type=file]), textarea')].filter((e) => e.value).length).catch(() => -1) : -1;
  const files = page ? await page.evaluate(() => [...document.querySelectorAll('input[type=file]')].filter((e) => e.files?.length).length + ((document.body.innerText || '').includes('Testa-Candidate-resume.pdf') ? 1 : 0)).catch(() => -1) : -1;
  const submitted = page ? await page.evaluate(() => /thank you for applying|application (has been )?(submitted|received)/i.test(document.body.innerText)).catch(() => false) : false;
  const texts = page ? await page.evaluate(() => [...document.querySelectorAll('textarea')].filter((e) => e.value).map((e) => `${(e.closest('li,div')?.querySelector('label,.application-label,.text')?.textContent || '').trim().slice(0, 50)} => ${e.value.slice(0, 160)}`)).catch(() => []) : [];
  console.log(JSON.stringify({ texts, url: x.url, now: page?.url(), state: x.state, filled: x.filled, needs: x.needs, note: x.note, fieldsWithValues: values, filesAttached: files, submitted, shot }));
}
console.log('QUESTION LOG', JSON.stringify(((await h.sw.evaluate(() => chrome.storage.local.get('questionLog'))).questionLog ?? []).map((x) => `${x.count}× ${x.question.slice(0, 70)}`)));
await h.ctx.close();
