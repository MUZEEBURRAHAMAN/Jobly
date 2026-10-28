// Draws a 1200x630 social image for every page into public/og/.
// Run after a build (it reads dist/og-pages.json):  npm run build && npm run og && npm run build
// Uses Playwright from the extension's dev dependencies, so the website itself needs no extra packages.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '..');
const LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(web, 'public', 'img', 'logo-wordmark-136.png')).toString('base64');
const require = createRequire(path.resolve(web, '../extension/package.json'));
const { chromium } = require('playwright');
const { chromiumPath } = await import(path.resolve(web, '../extension/e2e/lib.mjs'));

const pages = JSON.parse(fs.readFileSync(path.join(web, 'dist/og-pages.json'), 'utf8'));
pages.push({ key: 'default', title: 'Find jobs posted this week, not last year.', eyebrow: 'Free Chrome extension' });
const out = path.join(web, 'public/og');
fs.mkdirSync(out, { recursive: true });

const fonts = path.join(web, 'public/fonts/switzer');
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const html = (p) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Switzer; font-weight: 500; src: url('${fonts}/Switzer-Medium.woff2'); }
@font-face { font-family: Switzer; font-weight: 700; src: url('${fonts}/Switzer-Bold.woff2'); }
@font-face { font-family: Switzer; font-weight: 400; src: url('${fonts}/Switzer-Regular.woff2'); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; font-family: Switzer, sans-serif; background: #ffffff; padding: 18px; }
.card { position: relative; width: 100%; height: 100%; border-radius: 36px; overflow: hidden; background: #f6f6f5; padding: 64px 72px; display: flex; flex-direction: column; }
.b1 { position: absolute; width: 640px; height: 520px; right: -140px; top: -180px; border-radius: 50%; background: #ffc9a8; filter: blur(80px); opacity: .9; }
.b2 { position: absolute; width: 520px; height: 420px; right: 160px; bottom: -260px; border-radius: 50%; background: #ffe3cf; filter: blur(80px); }
.b3 { position: absolute; width: 360px; height: 320px; right: -60px; bottom: -120px; border-radius: 50%; background: #e8e4ff; filter: blur(70px); opacity: .8; }
.logo { position: relative; display: flex; align-items: center; gap: 14px; font-weight: 700; font-size: 34px; letter-spacing: -0.02em; color: #0a0a0a; }
.logo img { height: 64px; width: auto; display: block; }
.eyebrow { position: relative; margin-top: auto; display: flex; align-items: center; gap: 10px; color: #b83a0a; font-size: 28px; font-weight: 500; }
.eyebrow::before { content: ''; width: 10px; height: 10px; border-radius: 50%; background: currentColor; }
h1 { position: relative; margin-top: 18px; font-size: ${p.title.length > 48 ? 62 : 74}px; line-height: 1.04; letter-spacing: -0.045em; font-weight: 500; color: #0a0a0a; max-width: 960px; text-wrap: balance; }
.foot { position: relative; margin-top: 36px; display: flex; justify-content: space-between; align-items: center; font-size: 24px; color: #525252; }
.pill { padding: 10px 20px; border-radius: 999px; background: #0a0a0a; color: #fff; font-weight: 500; font-size: 22px; }
</style></head><body><div class="card"><span class="b1"></span><span class="b2"></span><span class="b3"></span>
<div class="logo"><img src="${LOGO}" alt="Jobly"></div>
<p class="eyebrow">${esc(p.eyebrow)}</p><h1>${esc(p.title)}</h1>
<div class="foot"><span>joblyextension.netlify.app</span><span class="pill">Free · No account</span></div></div></body></html>`;

const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--headless=new', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const tmp = path.join(os.tmpdir(), 'jobly-og.html');
for (const p of pages) {
  fs.writeFileSync(tmp, html(p));
  await page.goto('file://' + tmp);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, `${p.key}.jpg`), type: 'jpeg', quality: 86 });
}
await browser.close();
console.log(`Drew ${pages.length} social images into public/og/`);
