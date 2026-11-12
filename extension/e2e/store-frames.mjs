// Chrome Web Store screenshots in the marketing layout: a brand panel with a headline on the left, the real extension
// screen framed on the right with one callout. 1280x800, written to store-assets/screenshots/v1.5/.
//   RAW=<folder with dashboard-<name>-light.png from site-screenshots.mjs (THEMES=light)> node e2e/store-frames.mjs
// Only the made-up demo profile and demo companies appear in callouts; no third-party logos.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { chromiumPath } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const RAW = process.env.RAW;
if (!RAW) throw new Error('Set RAW to the folder of raw screens');
const OUT = path.join(root, 'store-assets', 'screenshots', 'v1.5');
fs.mkdirSync(OUT, { recursive: true });
const font = (w) => `file://${path.join(root, 'web', 'public', 'fonts', 'switzer', `Switzer-${w}.woff2`)}`;
const icon = `file://${path.join(root, 'web', 'public', 'img', 'icon-128.png')}`;
const shot = (n) => `file://${path.join(RAW, `dashboard-${n}-light.png`)}`;

// crop: the part of the 1440x900 screen to show (CSS px); callout: HTML placed over the frame
const slides = [
  {
    file: '1-jobs.png', shot: 'jobs', eyebrow: 'Find jobs', title: 'Fresh jobs,<br>real posting dates.',
    text: 'Jobs from 2,000+ company career pages, each with the date it was really posted and how well it fits you.',
    crop: { x: 244, y: 196, w: 1196, h: 640 }, url: 'Jobly · Jobs',
    callout: `<div class="co co-bl"><div class="co-row"><span class="pill brand">✦ 100% match</span></div>
      <ul class="ticks"><li>One of your roles</li><li>Senior level</li><li>Title mentions product designer</li></ul></div>`,
  },
  {
    file: '2-apply-assist.png', shot: 'assist-filled', eyebrow: 'Apply faster', title: 'You approve.<br>Jobly fills.<br>You submit.',
    text: 'Apply assist fills each step from your profile, shows where every answer came from, and marks what only you can answer.',
    crop: { x: 60, y: 120, w: 760, h: 760 }, url: 'careers.northwind.example/apply', frameWidth: 470, frameAlign: 'start',
    overlay: { crop: { x: 1048, y: 414, w: 362, h: 470 }, width: 330, right: 40, top: 150 },
    callout: `<div class="co co-bl wide"><div class="co-row"><span class="dot ok"></span><b>Filled 9 fields from your profile</b></div>
      <div class="co-row"><span class="dot need"></span><span>Each answer shows where it came from</span></div><div class="co-foot">You press Submit. Jobly never does.</div></div>`,
  },
  {
    file: '3-tailor.png', shot: 'tailor', eyebrow: 'Tailor', title: 'A resume<br>for each job.',
    text: 'Paste a job description. See what it asks for, which line of your resume covers each point, and what to change.',
    crop: { x: 244, y: 56, w: 960, h: 640 }, url: 'Jobly · Tailor for a job',
    callout: `<div class="co co-br"><div class="co-label">Coverage</div><div class="co-big"><span class="muted-num">68%</span> → <span class="brand-num">82%</span></div>
      <div class="co-foot">after the changes you accept</div></div>`,
  },
  {
    file: '4-profile.png', shot: 'profile', eyebrow: 'Set up in a minute', title: 'Your profile<br>in a minute.',
    text: 'Import the PDF LinkedIn makes of your profile, or your resume. It is read in your browser and never uploaded.',
    crop: { x: 244, y: 56, w: 980, h: 660 }, url: 'Jobly · Profile',
    callout: `<div class="co co-br"><div class="co-row"><span class="file">PDF</span><b>linkedin.pdf read</b></div>
      <div class="chips"><span>Name</span><span>Email</span><span>3 roles</span><span>1 school</span><span>Skills</span></div></div>`,
  },
  {
    file: '5-people.png', shot: 'people', eyebrow: 'Get noticed', title: 'Reach the people<br>who hire.',
    text: 'Find recruiters, hiring managers and the team, ask for a referral, and keep your references together.',
    crop: { x: 244, y: 150, w: 900, h: 460 }, url: 'Jobly · People',
    callout: `<div class="co co-br people"><div class="co-label">Saved people</div>
      <div class="person"><span class="av">PS</span><span class="who"><b>Priya Shah</b><small>Design Manager · Northwind Labs</small></span><span class="pill">Hiring manager</span></div>
      <div class="person"><span class="av">AM</span><span class="who"><b>Arjun Menon</b><small>Talent Partner · Northwind Labs</small></span><span class="pill ok">Contacted</span></div>
      <div class="person"><span class="av">RM</span><span class="who"><b>Rahul Mehta</b><small>Former manager · Quill Systems</small></span><span class="pill">Reference</span></div>
      <div class="co-foot">Jobly opens the searches. It never collects anything.</div></div>`,
  },
];

const page = (s) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Switzer; src: url('${font('Regular')}') format('woff2'); font-weight: 400; }
@font-face { font-family: Switzer; src: url('${font('Medium')}') format('woff2'); font-weight: 500; }
@font-face { font-family: Switzer; src: url('${font('Semibold')}') format('woff2'); font-weight: 600; }
@font-face { font-family: Switzer; src: url('${font('Bold')}') format('woff2'); font-weight: 700; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1280px; height: 800px; overflow: hidden; }
body { font-family: Switzer, system-ui, sans-serif; color: #0a0a0a; display: grid; grid-template-columns: 448px 1fr;
  background: linear-gradient(160deg, #27272a 0%, #18181b 48%, #09090b 100%); position: relative; }
/* faint grid on the brand panel */
body::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgb(255 255 255 / .06) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / .06) 1px, transparent 1px);
  background-size: 40px 40px; mask-image: linear-gradient(90deg, #000 0, #000 30%, transparent 40%); }
.left { position: relative; padding: 64px 40px 40px 48px; display: flex; flex-direction: column; color: #fff; }
.eyebrow { font-size: 13px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: rgb(255 255 255 / .75); }
h1 { margin-top: 18px; font-size: 54px; line-height: 1.04; font-weight: 600; letter-spacing: -0.025em; }
.lead { margin-top: 22px; font-size: 19px; line-height: 1.5; color: rgb(255 255 255 / .86); max-width: 350px; }
.brand { margin-top: auto; display: flex; align-items: center; gap: 12px; }
.brand img { width: 40px; height: 40px; border-radius: 10px; box-shadow: 0 4px 14px rgb(0 0 0 / .25); }
.brand b { font-size: 20px; font-weight: 600; }
.brand small { display: block; font-size: 13px; color: rgb(255 255 255 / .75); margin-top: 2px; }
.right { position: relative; margin: 16px 16px 16px 0; border-radius: 22px; background: #f4f2ef; overflow: hidden;
  background-image: radial-gradient(circle, rgb(10 10 10 / .07) 1px, transparent 1.4px); background-size: 18px 18px; display: grid; place-items: center; }
.frame { position: relative; width: var(--fw, 740px); border-radius: 14px; background: #fff; box-shadow: 0 2px 6px rgb(0 0 0 / .06), 0 30px 70px -20px rgb(0 0 0 / .3); overflow: hidden; border: 1px solid #e4e4e7; }
.bar { height: 34px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border-bottom: 1px solid #eee9e3; background: #faf8f6; }
.bar i { width: 9px; height: 9px; border-radius: 50%; background: #ddd6ce; display: inline-block; margin-right: 4px; }
.bar span { flex: 1; font-size: 12px; color: #6b6b6b; background: #fff; border: 1px solid #ece6df; border-radius: 999px; padding: 3px 12px; }
.view { position: relative; width: var(--fw, 740px); overflow: hidden; }
.right.start { place-items: center start; padding-left: 40px; }
.overlay { position: absolute; z-index: 2; border-radius: 14px; overflow: hidden; background: #fff; border: 1px solid #e4e4e7; box-shadow: 0 30px 60px -18px rgb(0 0 0 / .35), 0 2px 6px rgb(0 0 0 / .08); }
.overlay img { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.co.wide { min-width: 0; }
.view img { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.co { position: absolute; z-index: 3; background: #fff; border: 1px solid #e4e4e7; border-radius: 16px; padding: 16px 18px; box-shadow: 0 24px 50px -16px rgb(0 0 0 / .3), 0 2px 6px rgb(0 0 0 / .06);
  font-size: 14px; display: grid; gap: 10px; min-width: 230px; }
.co-bl { left: 28px; bottom: 30px; } .co-tl { left: 28px; top: 34px; } .co-br { right: 26px; bottom: 30px; }
.co-row { display: flex; align-items: center; gap: 10px; }
.co-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #6b6b6b; }
.co-big { font-size: 34px; font-weight: 700; letter-spacing: -0.02em; }
.muted-num { color: #8a8a8a; } .brand-num { color: #18181b; }
.co-foot { font-size: 12.5px; color: #6b6b6b; }
.pill { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; background: #f4f2ef; color: #3f3f46; white-space: nowrap; }
.pill.brand { background: #f4f4f5; color: #18181b; font-size: 14px; padding: 5px 12px; }
.pill.ok { background: #e8f6ee; color: #166534; }
.ticks { list-style: none; padding: 0; display: grid; gap: 6px; font-size: 13.5px; }
.ticks li::before { content: '✓'; color: #166534; font-weight: 700; margin-right: 8px; }
.dot { width: 10px; height: 10px; border-radius: 50%; } .dot.ok { background: #16a34a; } .dot.need { background: #d97706; }
.file { font-size: 10px; font-weight: 700; color: #fff; background: #18181b; border-radius: 4px; padding: 2px 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; max-width: 250px; }
.chips span { font-size: 12px; padding: 3px 9px; border-radius: 999px; background: #e8f6ee; color: #166534; }
.people { min-width: 330px; gap: 8px; }
.person { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid #f1ece6; }
.person:first-of-type { border-top: 0; }
.av { width: 32px; height: 32px; flex: none; border-radius: 50%; background: #f4f4f5; color: #18181b; display: grid; place-items: center; font-size: 12px; font-weight: 700; }
.who { flex: 1; display: flex; flex-direction: column; line-height: 1.25; } .who small { font-size: 12px; color: #6b6b6b; }
</style></head><body>
<div class="left"><div class="eyebrow">${s.eyebrow}</div><h1>${s.title}</h1><p class="lead">${s.text}</p>
  <div class="brand"><img src="${icon}" alt=""><div><b>Jobly</b><small>Free · No account · Stays in your browser</small></div></div></div>
<div class="right${s.frameAlign === 'start' ? ' start' : ''}"><div class="frame" style="--fw:${s.frameWidth ?? 740}px"><div class="bar"><i></i><i></i><i></i><span>${s.url}</span></div>
  <div class="view" style="height:${Math.round((s.frameWidth ?? 740) * s.crop.h / s.crop.w)}px"><img src="${shot(s.shot)}" style="width:${2880}px; transform: scale(${(s.frameWidth ?? 740) / s.crop.w / 2}) translate(${-s.crop.x * 2}px, ${-s.crop.y * 2}px)"></div></div>
  ${s.overlay ? `<div class="overlay" style="width:${s.overlay.width}px; height:${Math.round(s.overlay.width * s.overlay.crop.h / s.overlay.crop.w)}px; right:${s.overlay.right}px; top:${s.overlay.top}px"><img src="${shot(s.shot)}" style="width:2880px; transform: scale(${s.overlay.width / s.overlay.crop.w / 2}) translate(${-s.overlay.crop.x * 2}px, ${-s.overlay.crop.y * 2}px)"></div>` : ''}
  ${s.callout}</div>
</body></html>`;

const browser = await chromium.launch({ executablePath: chromiumPath() || undefined });
const p = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jobly-frames-'));
for (const s of slides) {
  const file = path.join(tmp, `${s.file}.html`);
  fs.writeFileSync(file, page(s));
  await p.goto(`file://${file}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, s.file) }); console.log('wrote', s.file);
}
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
