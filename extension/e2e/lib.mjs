// Shared helpers for the browser tests: launches Chromium with the built extension loaded.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const BUILD = process.env.EXT_DIST || '';   // set by run.sh (a build in the system temp dir)
export const API = 'http://127.0.0.1:8000';
export const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost):8000\//;
export const JSON_HEADERS = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const bundled = chromium.executablePath();
  if (fs.existsSync(bundled)) return bundled;
  // Fall back to the newest browser already cached by any Playwright version (macOS layout).
  const cache = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  if (fs.existsSync(cache)) {
    const dirs = fs.readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) {
      const exe = path.join(cache, d, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
      if (fs.existsSync(exe)) return exe;
    }
  }
  throw new Error('No Chromium found. Run `npx playwright install chromium` or set CHROMIUM_PATH.');
}

export const STATIC = process.env.STATIC_DIR || '';   // the fixture database as static job data (set by run.sh)

/** Answer requests for Jobly's static job data from a local export. */
export async function serveStatic(ctx, dir = STATIC) {
  await ctx.route(/^https:\/\/jobly-data\.pages\.dev\//, async (route) => {
    const file = path.join(dir, new URL(route.request().url()).pathname);
    if (!file.startsWith(dir) || !fs.existsSync(file)) return route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: 'not found' });
    await route.fulfill({ status: 200, headers: JSON_HEADERS, body: fs.readFileSync(file) });
  });
}

export async function launch({ onboarded = true, blockProd = true, colorScheme = 'light', dist = BUILD, scale = 1, staticData = false } = {}) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobly-e2e-'));
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    executablePath: chromiumPath(), headless: false, colorScheme, viewport: { width: 1280, height: 800 }, deviceScaleFactor: scale,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--headless=new', `--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  // Each run gets a throwaway profile; remove it when the browser closes so test runs don't fill the disk.
  const closeBrowser = ctx.close.bind(ctx);
  ctx.close = async (...args) => { try { await closeBrowser(...args); } finally { fs.rmSync(userDataDir, { recursive: true, force: true }); } };
  process.once('exit', () => fs.rmSync(userDataDir, { recursive: true, force: true }));
  if (blockProd) await ctx.route(/^https:\/\/jobly-yd6l\.onrender\.com\//, (r) => r.abort('connectionrefused'));
  // Development builds read their (absent) static data from the local server and fall back to its API.
  // Production builds read jobly-data.pages.dev: tests either serve the fixture as static data or block it.
  if (staticData) await serveStatic(ctx);
  else if (dist !== BUILD) await ctx.route(/^https:\/\/jobly-data\.pages\.dev\//, (r) => r.abort('connectionrefused'));
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 20000 });
  const id = sw.url().split('/')[2];
  if (onboarded) await sw.evaluate(() => chrome.storage.local.set({ onboarded: true }));
  return { ctx, sw, id };
}

export async function open(h, page = 'popup.html', { theme = 'light', width = 400, height = 590 } = {}) {
  const p = await h.ctx.newPage();
  await p.setViewportSize({ width, height });
  await p.addInitScript((t) => localStorage.setItem('muzeeb_theme_preference', t), theme);
  await p.goto(`chrome-extension://${h.id}/${page}`);
  return p;
}

export function makeRunner(name, hardTimeoutMs = 600000) {
  let pass = 0, fail = 0;
  setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2); }, hardTimeoutMs).unref();
  const ok = (cond, msg) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); };
  const step = async (label, fn, ms = 120000) => {
    try { await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), ms))]); }
    catch (e) { fail++; console.log(`FAIL  [${label}] ${String(e).slice(0, 240)}`); }
  };
  const axe = async (page, label) => {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    ok(bad.length === 0, `axe ${label}${bad.length ? ': ' + bad.map((v) => `${v.id} ${v.nodes[0].html.slice(0, 70)}`).join(' | ') : ''}`);
  };
  const done = () => { console.log(`\n${name}: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); };
  return { ok, step, axe, done };
}

export const json = async (p, init) => (await fetch(API + p, init)).json();
