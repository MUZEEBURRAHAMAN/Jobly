// UI-only preview images for marketing use: the date-posted, alerts and saved-jobs cards, light theme, transparent background,
// 3840 px wide. No headline or backdrop. Run:  node e2e/ui-previews.mjs   (writes to store-assets/*-ui-preview.png)
// Keep these as RGBA: the Web Store flatten step in screenshots.mjs only touches screenshot-*.png and promo-*.png.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import * as H from '@hugeicons/core-free-icons';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const font = (w, f) => `@font-face{font-family:S;font-weight:${w};src:url(${pathToFileURL(path.join(root, 'web/public/fonts/switzer', `Switzer-${f}.woff2`)).href})}`;
const icon = (n, size, color) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="color:${color};flex:none">${H[n]
  .map(([t, a]) => `<${t} ${Object.entries(a).filter(([k]) => k !== 'key').map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}="${v}"`).join(' ')}/>`).join('')}</svg>`;
const BR = '#b83a0a', GR = '#71717a';
const BASE = `${font(400, 'Regular')}${font(500, 'Medium')}${font(600, 'Semibold')}${font(700, 'Bold')}
*{box-sizing:border-box;margin:0}body{width:960px;background:transparent;font-family:S,system-ui,sans-serif;color:#18181b}
.card{background:#fff;border:1.5px solid #ead9cc;border-radius:36px;padding:44px}`;

// ---- date posted
const dateRow = (title, co, loc, age, tone, pct) => {
  const t = { g: ['#e8f6ee', '#166534'], n: ['#f4f4f5', '#27272a'], a: ['#fef3c7', '#92400e'] }[tone];
  return `<div class="row"><div class="rt"><div class="av">${co[0]}</div><div class="rm"><b>${title}</b><span>${co} · ${icon('Location01Icon', 22, GR)}${loc}</span></div>
  <div class="badge" style="background:${t[0]};color:${t[1]}">${icon('Clock01Icon', 26, t[1])}${age}</div></div><div class="bar"><i style="width:${pct}%;background:${t[1]}"></i></div></div>`;
};
const date = `<style>${BASE}
.ch{display:flex;align-items:center;gap:16px;margin-bottom:26px;font-size:30px;font-weight:600}.ch small{margin-left:auto;font-size:22px;font-weight:500;color:#71717a}
.row{border:1.5px solid #e4e4e7;border-radius:22px;padding:24px 26px 22px;margin-bottom:18px;background:#fff}
.rt{display:flex;align-items:center;gap:20px}.av{width:68px;height:68px;border-radius:16px;border:1.5px solid #e4e4e7;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:600;color:#52525b;flex:none}
.rm{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}.rm b{font-size:34px;font-weight:600;letter-spacing:-.01em}.rm span{display:flex;align-items:center;gap:8px;font-size:24px;color:#52525b}
.badge{display:flex;align-items:center;gap:10px;padding:12px 22px;border-radius:14px;font-size:27px;font-weight:600;white-space:nowrap}
.bar{height:8px;background:#f4f4f5;border-radius:4px;margin-top:20px}.bar i{display:block;height:8px;border-radius:4px}
.leg{display:flex;gap:14px;margin-top:26px}.leg div{flex:1;border:1.5px solid #e4e4e7;border-radius:16px;padding:14px 16px;font-size:20px;color:#52525b;line-height:1.3}
.leg b{display:inline-block;padding:3px 12px;border-radius:9px;font-size:20px;font-weight:600;margin-bottom:8px}</style>
<div class="card"><div class="ch">${icon('Briefcase02Icon', 34, BR)}Jobs for you<small>Newest first</small></div>
${dateRow('Frontend Engineer', 'Copperfield AI', 'San Francisco, CA', '2 hours ago', 'g', 3)}
${dateRow('Senior Product Designer', 'Quill Systems', 'Remote', '5 days ago', 'n', 25)}
${dateRow('AI Engineer', 'Northwind Labs', 'London, UK', '6 weeks ago', 'a', 72)}
<div class="leg"><div><b style="background:#e8f6ee;color:#166534">Just now</b><br>Under 24 hours</div><div><b style="background:#f4f4f5;color:#27272a">5 days ago</b><br>1 to 14 days</div><div><b style="background:#fef3c7;color:#92400e">6 weeks ago</b><br>15 to 60 days</div><div><b style="background:#f4f4f5;color:#a1a1aa;text-decoration:line-through">61+ days</b><br>Never shown</div></div></div>`;

// ---- alerts
const alert = (title, meta, isNew) => `<div class="it" style="border-color:${isNew ? BR : '#e4e4e7'}"><div class="g"><div class="t">${isNew ? '<span class="nb">New</span>' : ''}${title}</div><div class="m">${meta}</div></div><div class="vb">View ${icon('LinkSquare02Icon', 26, '#18181b')}</div></div>`;
const alerts = `<style>${BASE}
.h{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}.h h2{font-size:40px;font-weight:600;letter-spacing:-.02em;display:flex;align-items:center;gap:14px}.h p{font-size:24px;color:#52525b;margin-top:6px}
.mk{display:flex;align-items:center;gap:10px;border:1.5px solid #d4d4d8;border-radius:14px;padding:14px 22px;font-size:25px;font-weight:600}
.it{display:flex;align-items:center;gap:20px;border:2px solid;border-radius:22px;padding:24px 26px;margin-bottom:16px}.g{flex:1;min-width:0}
.t{font-size:32px;font-weight:600;letter-spacing:-.01em;display:flex;align-items:center;gap:14px}.nb{background:#fff1e8;color:${BR};font-size:21px;font-weight:600;padding:5px 14px;border-radius:10px}
.m{font-size:24px;color:#71717a;margin-top:8px}.vb{display:flex;align-items:center;gap:10px;border:1.5px solid #d4d4d8;border-radius:14px;padding:13px 22px;font-size:25px;font-weight:600;white-space:nowrap}</style>
<div class="card"><div class="h"><div><h2>${icon('Notification03Icon', 40, BR)}Alerts</h2><p>2 new since your last visit</p></div><div class="mk">${icon('Tick02Icon', 26, '#18181b')}Mark all read</div></div>
${alert('Senior Product Designer', 'Quill Systems · Remote · 6 minutes ago', true)}
${alert('Frontend Engineer', 'Copperfield AI · San Francisco, CA · 38 minutes ago', true)}
${alert('AI Engineer', 'Northwind Labs · London, UK · 2 hours ago', false)}
${alert('Product Manager', 'Skylark · Bengaluru, India · 5 hours ago', false)}</div>`;

// ---- saved jobs
const job = (title, co, loc, ago, badges) => `<div class="jc"><div class="top"><div class="av">${co[0]}</div><div class="g"><div class="t">${title}</div><div class="m">${co} · ${icon('Location01Icon', 22, GR)}${loc}</div></div><div class="ago">${ago}</div></div>
<div class="bd">${badges.map(([k, x]) => `<span class="b ${k}">${k === 'br' ? icon('SparklesIcon', 20, BR) : ''}${x}</span>`).join('')}</div>
<div class="act"><div class="sv">${icon('BookmarkCheck02Icon', 26, BR)}Saved</div><div class="ic">${icon('Share08Icon', 28, '#52525b')}</div><div class="ic">${icon('Flag02Icon', 28, '#52525b')}</div><div class="ap">Apply ${icon('SquareArrowUpRightIcon', 26, '#fff')}</div></div></div>`;
const saved = `<style>${BASE}
h2{font-size:40px;font-weight:600;letter-spacing:-.02em}.sub{font-size:24px;color:#52525b;margin:6px 0 24px}
.s{display:flex;align-items:center;gap:14px;border:1.5px solid #d4d4d8;border-radius:16px;padding:20px 24px;font-size:26px;color:#a1a1aa;margin-bottom:22px}
.jc{border:1.5px solid #e4e4e7;border-radius:24px;padding:26px 28px;margin-bottom:18px}
.top{display:flex;align-items:flex-start;gap:20px}.av{width:72px;height:72px;border-radius:16px;border:1.5px solid #e4e4e7;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:600;color:#52525b;flex:none}
.g{flex:1;min-width:0}.t{font-size:34px;font-weight:600;letter-spacing:-.01em}.m{display:flex;align-items:center;gap:8px;font-size:24px;color:#52525b;margin-top:6px}.ago{font-size:22px;color:#71717a;flex:none;padding-top:6px}
.bd{display:flex;gap:10px;margin:20px 0 22px;flex-wrap:wrap}.b{display:inline-flex;align-items:center;gap:8px;font-size:22px;font-weight:500;padding:7px 16px;border-radius:12px;border:1.5px solid transparent}
.b.br{background:#fff1e8;color:${BR}}.b.gr{background:#e8f6ee;color:#166534}.b.ol{border-color:#e4e4e7;color:#52525b}
.act{display:flex;align-items:center;gap:10px}.sv{display:flex;align-items:center;gap:10px;background:#fff1e8;color:${BR};border:1.5px solid #f1d0bb;border-radius:14px;padding:13px 22px;font-size:25px;font-weight:600}
.ic{width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-radius:14px}.ap{margin-left:auto;display:flex;align-items:center;gap:10px;background:#18181b;color:#fff;border-radius:14px;padding:14px 28px;font-size:26px;font-weight:600}</style>
<div class="card"><h2>Saved jobs</h2><p class="sub">3 saved</p><div class="s">${icon('Search01Icon', 28, GR)}Search saved jobs…</div>
${job('Senior Product Designer', 'Quill Systems', 'Remote', '2 hours ago', [['br', 'Matches you'], ['gr', 'Remote'], ['ol', '5–8 yrs'], ['ol', '$150K – $210K']])}
${job('Frontend Engineer', 'Copperfield AI', 'San Francisco, CA', '1 day ago', [['br', 'Matches you'], ['ol', '0–2 yrs'], ['ol', '$170K – $240K']])}
${job('AI Engineer', 'Northwind Labs', 'London, UK', '3 days ago', [['ol', '5–8 yrs'], ['ol', '$120K – $160K']])}</div>`;

const browser = await chromium.launch();
for (const [file, body] of [['date-posted-ui-preview.png', date], ['alerts-ui-preview.png', alerts], ['saved-jobs-ui-preview.png', saved]]) {
  const page = await browser.newPage({ viewport: { width: 960, height: 800 }, deviceScaleFactor: 4 });
  await page.setContent(`<!doctype html><meta charset=utf-8>${body}`);
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
  const out = path.join(root, 'store-assets', file);
  await (await page.$('.card')).screenshot({ path: out, omitBackground: true });
  console.log('wrote', path.relative(root, out));
}
await browser.close();
