// Generates marketing + Chrome Web Store images from the real UI (fictional demo companies, no real brands).
//   npm run e2e:screens   ->  store-assets/*.png  and  web/public/img/*.webp (the website's product window)
import { launch, open, sleep } from './lib.mjs';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STORE = path.join(root, 'store-assets');
const WEB = path.join(root, 'web', 'public', 'img');
fs.mkdirSync(STORE, { recursive: true }); fs.mkdirSync(WEB, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jobly-shots-'));
const SWITZER = { 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold' };
const fontUrl = (w) => pathToFileURL(path.join(root, 'web', 'public', 'fonts', 'switzer', `Switzer-${SWITZER[w]}.woff2`)).href;
const wordmarkUrl = pathToFileURL(path.join(root, 'store-assets', 'jobly_logo_wordmark.png')).href;
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

const h = await launch();
await h.ctx.route(/t2\.gstatic\.com/, (r) => r.abort());          // letter avatars instead of generic globe icons
const settle = async (p) => { await p.locator('article').first().waitFor({ timeout: 30000 }); await sleep(1200); };
const shot = async (p, file) => { await p.screenshot({ path: file }); console.log('wrote', path.relative(root, file)); };

// 1. dashboard (light/dark), 2. filters open
for (const theme of ['light', 'dark']) {
  const p = await open(h, 'options.html', { theme, width: 1280, height: 800 }); await settle(p);
  await shot(p, path.join(STORE, `screenshot-${theme === 'light' ? 1 : 2}-dashboard-${theme}.png`));
  if (theme === 'light') { await p.getByRole('button', { name: /Filters/ }).click(); await p.locator('#f-new').selectOption('7'); await sleep(1500); await shot(p, path.join(STORE, 'screenshot-3-filters-date-posted.png')); }
  await p.close();
}

// popup shots (light + dark + an empty-state)
const popup = async (theme, after) => { const p = await open(h, 'popup.html', { theme, width: 400, height: 590 }); await settle(p); if (after) await after(p); const f = path.join(tmp, `popup-${theme}-${Math.random().toString(36).slice(2)}.png`); await p.screenshot({ path: f }); await p.close(); return f; };
const popLight = await popup('light'); const popDark = await popup('dark');
const popEmpty = await popup('light', async (p) => { await p.getByLabel('Search jobs').fill('zzzzqqq'); await p.getByText(/No jobs match/).waitFor(); await sleep(900); });

// welcome screen (fresh profile)
const g = await launch({ onboarded: false }); await g.ctx.route(/t2\.gstatic\.com/, (r) => r.abort());
const w = await open(g, 'options.html#welcome', { width: 1280, height: 800 }); await w.getByRole('heading', { name: 'Welcome to Jobly' }).waitFor({ timeout: 20000 }); await w.getByRole('button', { name: 'Get started' }).click(); await sleep(1500);
await shot(w, path.join(STORE, 'screenshot-4-welcome.png')); await g.ctx.close();

// composite pages (popup frames on a branded background) and the small promo tile
const css = `@font-face{font-family:A;font-weight:500;src:url(${fontUrl(500)})}@font-face{font-family:A;font-weight:700;src:url(${fontUrl(700)})}
*{box-sizing:border-box;margin:0}body{font-family:A,system-ui,sans-serif;background:#fff1e8;color:#18181b;width:1280px;height:800px;display:flex;align-items:center;justify-content:center;gap:56px;padding:0 64px;overflow:hidden}
.t{max-width:430px}.t h1{font-size:52px;line-height:1.05;letter-spacing:-.03em;font-weight:700}.t p{font-size:21px;margin-top:20px;color:#52525b;line-height:1.45}
img.f{width:360px;border-radius:14px;border:1px solid #e4e4e7;box-shadow:0 30px 70px rgba(0,0,0,.2);background:#fff}`;
const page = await h.ctx.newPage(); await page.setViewportSize({ width: 1280, height: 800 });
const composite = async (name, title, text, imgs) => {
  const html = `<!doctype html><style>${css}</style><div class="t"><h1>${title}</h1><p>${text}</p></div>${imgs.map((i) => `<img class="f" src="${b64(i)}">`).join('')}`;
  const f = path.join(tmp, 'c.html'); fs.writeFileSync(f, html); await page.goto(pathToFileURL(f).href); await sleep(500); await shot(page, path.join(STORE, name));
};
await composite('screenshot-5-popup.png', 'Quick look from your toolbar', 'Open the popup for matched jobs in light or dark, without leaving your tab.', [popLight, popDark]);
await composite('screenshot-6-calm-empty-states.png', 'Calm when there is nothing to show', 'Clear explanations and a way forward in every empty or offline state.', [popEmpty]);
const tile = `<!doctype html><style>@font-face{font-family:A;font-weight:700;src:url(${fontUrl(700)})}@font-face{font-family:A;font-weight:500;src:url(${fontUrl(500)})}*{margin:0;box-sizing:border-box}
body{width:440px;height:280px;background:#fff1e8;color:#18181b;font-family:A,system-ui,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 36px;gap:16px}
img{height:88px;width:auto;align-self:flex-start}p{font-size:25px;font-weight:700;line-height:1.2;letter-spacing:-.02em}small{color:#52525b;font-size:15px;font-weight:500}</style>
<img src="${wordmarkUrl}"><p>Find jobs.<br>Apply smarter.</p><small>Real posting dates. Free, no account.</small>`;
const tf = path.join(tmp, 'tile.html'); fs.writeFileSync(tf, tile); await page.setViewportSize({ width: 440, height: 280 }); await page.goto(pathToFileURL(tf).href); await sleep(500);
await shot(page, path.join(STORE, 'promo-small-440x280.png'));
await h.ctx.close();

// Web Store wants 24-bit PNGs without alpha: flatten the screenshots and promo tile we wrote (never the logo masters beside them)
const py = process.env.PYTHON || path.join(root, '.venv', 'bin', 'python');
// website hero showcase: four views of the dashboard at 1440x900, retina, light and dark (converted to WebP below)
const hi = await launch({ scale: 2 }); await hi.ctx.route(/t2\.gstatic\.com/, (r) => r.abort());
const all = (await (await fetch('http://127.0.0.1:8000/api/jobs?limit=200')).json()).items;
const demo = all.filter((j) => j.title.length < 40 && j.application_url.startsWith('https'));
// Everything the fixture has counts as seen, so the background check can't add a flood of alerts on top of these.
const seedUserData = () => hi.sw.evaluate(({ demo, all }) => chrome.storage.local.set({
  savedJobs: demo.slice(8, 12).map((j) => ({ ...j, is_saved: true })), // not the first jobs in the feed, so the feed shows a natural mix
  alerts: demo.slice(4, 10).map((j, i) => ({ id: j.application_url, title: j.title, company_name: j.company_name, location: j.location, application_url: j.application_url, sent_at: new Date(Date.now() - [6, 38, 95, 180, 300, 420][i] * 60000).toISOString(), is_read: i > 1 })),
  seenAlertKeys: all.map((j) => j.application_url),
}), { demo, all });
await seedUserData();
for (const theme of ['light', 'dark']) {
  const p = await open(hi, 'options.html', { theme, width: 1440, height: 900 }); await settle(p);
  const snap = async (name) => { await sleep(700); await p.screenshot({ path: path.join(WEB, `dashboard-${name}-${theme}.png`) }); console.log('wrote', `web/public/img/dashboard-${name}-${theme}.png`); };
  await snap('jobs');
  await p.getByRole('button', { name: /Filters/ }).click(); await p.locator('#f-new').selectOption('7'); await sleep(900); await snap('filters');
  await p.getByRole('button', { name: /^Saved/ }).click(); await p.locator('article').first().waitFor(); await snap('saved');
  await seedUserData(); await p.reload(); await settle(p);
  await p.getByRole('button', { name: /^Alerts/ }).click(); await snap('alerts');
  await p.close();
}
await hi.ctx.close();

execFileSync(py, ['-c', `import glob,sys\nfrom PIL import Image\nfor f in glob.glob(r"${STORE}/screenshot-*.png") + glob.glob(r"${STORE}/promo-*.png"):\n    Image.open(f).convert("RGB").save(f, optimize=True)`]);
execFileSync(py, ['-c', `import glob,os\nfrom PIL import Image\nfor f in glob.glob(r"${WEB}/dashboard-*.png"):\n    im = Image.open(f).convert("RGB")\n    im.save(f[:-4] + ".webp", quality=82, method=6)\n    [im.resize((n, round(im.height * n / im.width)), Image.LANCZOS).save(f[:-4] + "-%d.webp" % n, quality=82, method=6) for n in (720, 1080)]\n    os.remove(f)`]);
console.log('done');
process.exit(0);
