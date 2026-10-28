// End-to-end suite: real Chromium + the built extension + a backend on a fixture database.
import { launch, open, makeRunner, LOCAL, JSON_HEADERS, sleep, json, API } from './lib.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build as esbuild } from 'esbuild';

const t = makeRunner('e2e suite');
const { ok, step, axe } = t;
const text = async (p) => (await p.innerText('body')).replace(/\n+/g, ' | ');
const count = async (p) => Number((await p.getByText(/^\d+\+? jobs?/).first().innerText()).match(/\d+/)[0]);
const art = (p) => p.locator('.empty-art svg').count();
const cards = (p) => p.locator('article').count();
const firstCard = (p) => p.locator('article').first().waitFor({ timeout: 40000 });

await step('accessibility, both themes', async () => {
  for (const theme of ['light', 'dark']) {
    const h = await launch({ colorScheme: theme });
    const p = await open(h, 'popup.html', { theme }); await firstCard(p);
    for (const tab of ['Jobs', 'Apply', 'Companies', 'Saved', 'Preferences']) { await p.getByRole('button', { name: new RegExp('^' + tab) }).click(); await sleep(500); await axe(p, `popup/${tab}/${theme}`); }
    await p.getByRole('button', { name: /^Jobs/ }).click(); await p.getByRole('button', { name: /Filters/ }).click(); await axe(p, `popup/filters/${theme}`);
    const d = await open(h, 'options.html', { theme, width: 1280, height: 860 }); await firstCard(d);
    for (const tab of ['Jobs', 'Companies', 'Saved', 'Tracker', 'Interviews', 'Tasks', 'Profile', 'Resume', 'Cover letters', 'Contacts', 'Alerts', 'Preferences']) { await d.getByRole('button', { name: new RegExp('^' + tab) }).click(); await sleep(500); await axe(d, `dashboard/${tab}/${theme}`); }
    await h.ctx.close();
  }
});

await step('welcome tour', async () => {
  const h = await launch({ onboarded: false });
  const p = await open(h); await p.getByRole('heading', { name: 'Welcome to Jobly' }).waitFor({ timeout: 20000 });
  ok(await cards(p) === 0, 'first run shows the welcome, not the job list'); await axe(p, 'welcome 1');
  await p.getByRole('button', { name: 'Get started' }).click(); await axe(p, 'welcome 2');
  await p.getByRole('button', { name: 'Next' }).click(); await axe(p, 'welcome 3');
  await p.getByRole('button', { name: /Start exploring/ }).click(); await firstCard(p); ok(true, 'finishing lands on the jobs list');
  const p2 = await open(h); await firstCard(p2); ok(await p2.getByRole('heading', { name: 'Welcome to Jobly' }).count() === 0, 'welcome does not come back');
  await p2.getByRole('button', { name: /^Preferences/ }).click(); await p2.getByRole('button', { name: /welcome tour again/ }).click();
  await p2.getByRole('heading', { name: 'Welcome to Jobly' }).waitFor({ timeout: 5000 }); ok(true, 'tour can be replayed from Preferences');
  ok((await h.ctx.pages()).some((x) => x.url().endsWith('options.html#welcome')), 'installing opens the welcome page in a tab');
  await h.ctx.close();
  const g = await launch({ onboarded: false }); const q = await open(g); await q.getByRole('button', { name: 'Skip for now' }).click(); await firstCard(q); ok(true, '"Skip for now" goes to the jobs list'); await g.ctx.close();
});

await step('jobs: search, categories, date posted, 2-month rule', async () => {
  const h = await launch(); const p = await open(h); await firstCard(p);
  await p.getByLabel('Search jobs').fill('Ancient Listing'); await p.getByText(/No jobs match/).waitFor({ timeout: 10000 });
  ok(true, 'a job posted 75 days ago is never shown (2-month rule)');
  await p.getByLabel('Search jobs').fill('Unknown Date'); await p.getByText('Unknown Date Engineer').first().waitFor({ timeout: 10000 }); ok(true, 'a job with an unknown date is still listed');
  await p.getByLabel('Search jobs').fill(''); await p.locator('article').first().waitFor();
  ok(await p.getByLabel('Search jobs').inputValue() === '', 'search cleared');
  await p.getByRole('button', { name: /^Design/ }).click(); await sleep(1200); ok(await p.getByRole('button', { name: /^Design/ }).getAttribute('aria-pressed') === 'true', 'category chip toggles');
  await p.getByRole('button', { name: /^All/ }).click(); await sleep(1200);
  const all = await count(p); ok(/last 2 months/.test(await text(p)), 'list says it only covers the last 2 months');
  await p.getByRole('button', { name: /Filters/ }).click();
  ok(await p.getByText('Jobs older than 2 months are never shown.').count() === 1, 'Date posted explains the 2-month limit');
  const options = await p.locator('#f-new option').allInnerTexts(); ok(options.join('|') === 'Any time|Past 24 hours|Past 3 days|Past week|Past 2 weeks|Past month', `Date posted options: ${options.join(', ')}`);
  const reqs = []; p.on('request', (r) => { if (/\/api\/jobs\?/.test(r.url())) reqs.push(new URL(r.url()).searchParams.get('freshness_days')); });
  const counts = { all };
  for (const [value, label] of [['1', 'day'], ['7', 'week'], ['30', 'month']]) { await p.locator('#f-new').selectOption(value); await sleep(1400); counts[label] = await count(p); }
  ok(reqs.includes('1') && reqs.includes('7') && reqs.includes('30'), 'Date posted is sent to the server (so paging stays correct)');
  ok(counts.day < counts.week && counts.week < counts.month && counts.month <= counts.all, `narrower date → fewer jobs (all ${counts.all} ≥ month ${counts.month} > week ${counts.week} > day ${counts.day})`);
  await p.locator('#f-new').selectOption('1'); await p.getByLabel('Search jobs').fill('Unknown Date'); await p.getByText(/No jobs match/).waitFor({ timeout: 10000 });
  ok(true, 'with a Date posted filter, unknown-date jobs are excluded (like LinkedIn)');
  await h.ctx.close();
  const g = await launch(); const q = await open(g); await firstCard(q); await q.getByLabel('Search jobs').fill('Broken Link'); await q.getByText('Broken Link Designer').first().waitFor();
  ok(await q.getByText('Link unavailable').count() === 1, 'a javascript: apply link is shown as "Link unavailable"');
  await q.getByLabel('Search jobs').fill('Extraordinarily'); await q.locator('article').first().waitFor();
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'a very long title does not overflow the popup'); await g.ctx.close();
});

await step('report dialog + failure handling', async () => {
  const h = await launch(); const p = await open(h); await firstCard(p);
  await p.locator('article').nth(1).getByRole('button', { name: /^Report:/ }).click(); await sleep(400);
  ok(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), 'focus moves into the dialog');
  const seq = []; for (let i = 0; i < 10; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))); }
  ok(seq.every(Boolean), 'Tab stays inside the dialog');
  await p.getByRole('radio', { name: /Spam/ }).check(); await h.ctx.route(LOCAL, (r) => (r.request().method() === 'POST' ? r.abort('connectionrefused') : r.continue()));
  await p.getByRole('button', { name: 'Send report' }).click(); await sleep(2500);
  ok(await p.getByRole('alert').filter({ hasText: /Couldn't send/ }).count() === 1, 'a failed report shows an error, not "sent"');
  await h.ctx.unroute(LOCAL); await p.getByRole('button', { name: 'Send report' }).click(); await p.getByText('Report sent').waitFor({ timeout: 8000 }); ok(true, 'a successful report is confirmed');
  await p.keyboard.press('Escape'); await sleep(300); ok(await p.getByRole('dialog').count() === 0, 'Escape closes the dialog'); await h.ctx.close();
});

await step('on-device data: preferences, saved jobs, alerts', async () => {
  const h = await launch();
  const writes = []; const jobReqs = [];
  h.ctx.on('request', (r) => { if (LOCAL.test(r.url())) { if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method())) writes.push(`${r.method()} ${new URL(r.url()).pathname}`); if (/\/api\/(jobs|stats)\?/.test(r.url())) jobReqs.push(r.url()); } });
  let p = await open(h); await firstCard(p);
  // saving a job
  const card = p.locator('article').first(); const label = await card.getAttribute('aria-label');
  await card.getByRole('button', { name: /^Save:/ }).click(); await sleep(500);
  ok(await card.getByRole('button', { name: /^Remove from saved:/ }).count() === 1, 'Save is instant');
  ok((await h.sw.evaluate(() => chrome.storage.local.get('savedJobs'))).savedJobs?.length === 1, 'the saved job is stored on the device');
  // it survives a restart of the page, even with the server down, and shows in the dashboard
  await p.close(); await h.ctx.route(LOCAL, (r) => r.abort('connectionrefused'));
  const d = await open(h, 'options.html', { width: 1280, height: 860 });
  await d.getByRole('button', { name: /^Saved/ }).click(); await d.locator('article').first().waitFor({ timeout: 10000 });
  ok((await d.locator('article').first().getAttribute('aria-label')) === label, 'saved jobs are there with the server unreachable');
  await d.locator('article').first().getByRole('button', { name: /^Remove from saved:/ }).click(); await d.getByText('Nothing saved yet').waitFor({ timeout: 5000 });
  ok((await h.sw.evaluate(() => chrome.storage.local.get('savedJobs'))).savedJobs?.length === 0, 'removing it clears the device copy'); await d.close();
  await h.ctx.unroute(LOCAL);
  // preferences
  p = await open(h); await firstCard(p); await p.getByRole('button', { name: /^Preferences/ }).click(); await sleep(600);
  await p.getByRole('checkbox', { name: /Product design/ }).click(); await p.getByRole('button', { name: 'Save preferences' }).click(); await p.getByText('Saved on this device.').waitFor({ timeout: 5000 });
  const stored = (await h.sw.evaluate(() => chrome.storage.local.get('userPreferences'))).userPreferences; ok(stored && !stored.roles.includes('product_design'), 'preferences are stored on the device');
  await p.getByRole('button', { name: /^Jobs/ }).click(); await sleep(1500);
  const last = jobReqs.filter((u) => /\/api\/jobs\?/.test(u)).pop(); const prefs = JSON.parse(new URL(last).searchParams.get('prefs')); ok(!prefs.roles.includes('product_design') && prefs.roles.length === 4, 'the job request carries the new preferences');
  ok(await p.locator('article').first().getAttribute('aria-label').then((l) => !!l), 'the list still renders after changing preferences');
  // alerts: computed on the device
  await h.sw.evaluate(() => chrome.storage.local.set({ alerts: [], seenAlertKeys: [] }));
  await p.evaluate(() => new Promise((res) => chrome.runtime.sendMessage({ type: 'TRIGGER_BACKGROUND_CHECK' }, res))); await sleep(500);
  const a1 = (await h.sw.evaluate(() => chrome.storage.local.get('alerts'))).alerts; ok(a1.length > 0 && a1.length <= 50 && a1.every((a) => !a.is_read), `new matching jobs become alerts (${a1.length})`);
  await p.evaluate(() => new Promise((res) => chrome.runtime.sendMessage({ type: 'TRIGGER_BACKGROUND_CHECK' }, res))); await sleep(500);
  ok((await h.sw.evaluate(() => chrome.storage.local.get('alerts'))).alerts.length === a1.length, 'the same job is never announced twice');
  const first = (await h.sw.evaluate(() => chrome.storage.local.get('seenAlertKeys'))).seenAlertKeys.length; ok(first >= a1.length, 'seen jobs are remembered');
  await h.sw.evaluate(() => chrome.storage.local.set({ alerts: [], seenAlertKeys: [] }));
  await p.evaluate(() => new Promise((res) => chrome.runtime.sendMessage({ type: 'TRIGGER_BACKGROUND_CHECK', silent: true }, res))); await sleep(500);
  ok((await h.sw.evaluate(() => chrome.storage.local.get('alerts'))).alerts.length === 0, 'a silent check (after changing preferences) announces nothing');
  await h.sw.evaluate(() => chrome.storage.local.set({ alerts: [], seenAlertKeys: [] }));
  await p.evaluate(() => new Promise((res) => chrome.runtime.sendMessage({ type: 'TRIGGER_BACKGROUND_CHECK' }, res))); await sleep(500); await p.close();
  const dash = await open(h, 'options.html', { width: 1280, height: 860 }); await firstCard(dash);
  ok(await dash.getByRole('button', { name: /^Alerts/ }).innerText().then((t) => /\d/.test(t)), 'the Alerts tab shows an unread count');
  await dash.getByRole('button', { name: /^Alerts/ }).click(); await dash.getByText(/\d+ new/).waitFor({ timeout: 5000 }); await axe(dash, 'alerts with items');
  await sleep(800); ok((await h.sw.evaluate(() => chrome.storage.local.get('alerts'))).alerts.every((a) => a.is_read), 'opening Alerts stores them as read (the badge clears)');
  ok(await dash.getByText(/new since your last visit/).count() === 1 && await dash.locator('.badge', { hasText: 'New' }).count() > 0, 'but they stay highlighted as new for this visit');
  ok(writes.every((w) => w.startsWith('POST /api/jobs/') && w.endsWith('/report')), `the server only ever receives reports: ${writes.length ? writes.join(', ') : 'no writes at all'}`);
  await h.ctx.close();
});

await step('efficiency: repeat visits are cached and revalidated', async () => {
  const h = await launch({ blockProd: false }); const seen = []; // no request interception: Playwright switches the HTTP cache off when routes are active
  h.ctx.on('requestfinished', async (r) => {
    if (!LOCAL.test(r.url()) || !/\/api\/(jobs|companies)/.test(r.url())) return;
    const res = await r.response(); const sizes = await r.sizes();
    seen.push({ revalidated: !!(await r.allHeaders())['if-none-match'], body: sizes.responseBodySize, cache: res.headers()['x-cache'] });
  });
  let p = await open(h); await firstCard(p); await sleep(1500); await p.close();
  p = await open(h); await firstCard(p); await sleep(1500);
  ok(seen.some((r) => r.revalidated && r.body === 0), `a repeat visit asks "has it changed?" and gets an empty "not modified" answer (${seen.filter((r) => r.revalidated && r.body === 0).length} of ${seen.length} requests)`);
  ok(seen.some((r) => r.cache === 'HIT'), 'the server answered the repeat from memory');
  ok(await cards(p) > 0, 'the list still renders after a "not modified" answer'); await h.ctx.close();
  const g = await launch(); const a = await open(g); await firstCard(a);
  const period = await g.sw.evaluate(async () => (await chrome.alarms.get('jobly-sync'))?.periodInMinutes);
  ok(period >= 60 && period <= 90, `background check runs every ${period} minutes (60-90)`);
  await g.sw.evaluate(async () => { await chrome.alarms.clear('jobly-sync'); await chrome.alarms.create('jobly-sync', { periodInMinutes: 30 }); });
  await g.sw.evaluate(() => new Promise((res) => { chrome.runtime.onInstalled.dispatch({ reason: 'update' }); setTimeout(res, 1500); }));
  const migrated = await g.sw.evaluate(async () => (await chrome.alarms.get('jobly-sync'))?.periodInMinutes);
  ok(migrated >= 60 && migrated <= 90, `an old 30-minute schedule is replaced after an update (now ${migrated})`); await g.ctx.close();
});

await step('states: offline, 429, 500, gathering, empty, hidden', async () => {
  // offline, nothing cached
  let h = await launch(); await h.ctx.route(LOCAL, (r) => r.abort('connectionrefused')); let p = await open(h); await p.getByText("Can't reach Jobly").waitFor({ timeout: 70000 });
  ok(await art(p) === 1, 'offline: plug illustration'); await axe(p, 'offline');
  await p.getByRole('button', { name: /^Companies/ }).click(); ok(await p.getByText("Can't load companies").count() === 1, 'offline: companies');
  await p.getByRole('button', { name: /^Saved/ }).click(); ok(await p.getByText('Nothing saved yet').count() === 1, 'offline: saved jobs live on the device, so the page still works');
  await p.getByRole('button', { name: /^Preferences/ }).click(); await sleep(800); ok(await p.getByRole('button', { name: 'Save preferences' }).count() === 1, 'offline: preferences still usable');
  await h.ctx.close();
  // offline with cache
  h = await launch(); p = await open(h); await firstCard(p); await sleep(1500); await p.close(); await h.ctx.route(LOCAL, (r) => r.abort('connectionrefused'));
  p = await open(h); await p.getByText(/You're offline/).waitFor({ timeout: 70000 }); ok(await cards(p) > 0, 'offline with cache: saved jobs stay visible + banner'); await h.ctx.close();
  // 429 / 500
  for (const [status, expect] of [[429, 'Jobly is busy right now'], [503, 'Jobly is busy right now'], [500, 'Something went wrong on our side']]) {
    h = await launch(); await h.ctx.route(LOCAL, (r) => (r.request().url().includes('/api/jobs?') ? r.fulfill({ status, headers: JSON_HEADERS, body: '{}' }) : r.continue()));
    p = await open(h); await p.getByText(expect).first().waitFor({ timeout: 40000 }); ok(await art(p) === 1, `${status}: "${expect}" state`); await h.ctx.close();
  }
  // brand-new server
  h = await launch();
  await h.ctx.route(/\/api\/stats/, (r) => r.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify({ total_jobs: 0, active_companies: 1, matched_jobs: 0, new_jobs_today: 0, last_sync_time: null, is_syncing: true }) }));
  await h.ctx.route(/\/api\/jobs\?/, (r) => r.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify({ items: [], total: 0, limit: 100, offset: 0 }) }));
  p = await open(h); await p.getByText('Gathering jobs for the first time').waitFor({ timeout: 40000 }); ok(await art(p) === 1, 'brand-new server: gathering state'); await h.ctx.close();
  // empty search, narrow filters, hidden companies
  h = await launch(); p = await open(h); await firstCard(p);
  await p.getByLabel('Search jobs').fill('zzzzqqqq'); await p.getByText(/No jobs match "zzzzqqqq"/).waitFor({ timeout: 10000 }); ok(await art(p) === 1, 'no search results: loupe'); await axe(p, 'empty search');
  await p.getByRole('button', { name: 'Clear search' }).click(); await firstCard(p);
  await p.getByRole('button', { name: /Filters/ }).click(); await p.locator('#f-pay').selectOption('250000'); await p.locator('#f-new').selectOption('1'); await p.locator('#f-hub').selectOption('apac'); await p.getByRole('button', { name: /^All/ }).click();
  await p.getByText('Your filters are too narrow').waitFor({ timeout: 10000 }); ok(true, 'filters exclude everything: sieve + "too narrow"');
  await p.getByRole('button', { name: 'Reset filters' }).last().click(); await firstCard(p); ok(true, 'reset restores the list');
  const first = (await p.locator('article').first().getAttribute('aria-label')).split(' at ').pop();
  await p.getByRole('button', { name: /^Companies/ }).click(); await p.getByLabel('Search companies').fill(first); await p.getByRole('switch', { name: new RegExp('Show jobs from ' + first) }).first().uncheck();
  await p.getByRole('button', { name: /^Jobs/ }).click(); await sleep(900); ok(/hidden from companies you turned off/.test(await text(p)), 'hidden-company hint');
  const ids = (await json('/api/companies')).map((c) => c.id); await h.sw.evaluate((all) => chrome.storage.local.set({ mutedCompanyIds: all }), ids); await sleep(1200);
  ok(await p.getByText("You've hidden every company in this list").count() === 1, 'everything hidden: explained, with a way back'); await h.ctx.close();
});

await step('dashboard layout fills the window', async () => {
  const h = await launch(); const p = await open(h, 'options.html', { width: 1920, height: 900 });
  for (const [w, minCols] of [[1920, 3], [1280, 2], [700, 1]]) {
    await p.setViewportSize({ width: w, height: 900 }); await p.goto(`chrome-extension://${h.id}/options.html`); await p.locator('article').nth(3).waitFor({ timeout: 30000 }); await sleep(400);
    const m = await p.evaluate(() => ({ cols: new Set([...document.querySelectorAll('article')].slice(0, 12).map((a) => Math.round(a.getBoundingClientRect().left))).size, inner: document.querySelector('.content-inner').getBoundingClientRect().width, over: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
    ok(m.cols >= minCols && !m.over, `${w}px: ${m.cols} column(s), content ${Math.round(m.inner)}px, no sideways scroll`);
    if (w === 1920) ok(m.inner > 1500, 'uses the full 1920px window');
  }
  await h.ctx.close();
});

await step('static job data: the popup reads jobly-data, with the API down', async () => {
  const h = await launch({ dist: process.env.EXT_PROD, staticData: true });   // blockProd: the API is unreachable
  const reqs = []; const errors = []; const p = await h.ctx.newPage(); p.on('request', (r) => reqs.push(r.url())); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.setViewportSize({ width: 400, height: 590 }); await p.goto(`chrome-extension://${h.id}/popup.html`); await firstCard(p); await sleep(800);
  ok(await cards(p) > 0, 'jobs render from the static data');
  ok(reqs.some((u) => u.endsWith('/v1/meta.json')) && reqs.some((u) => /\/v1\/jobs\/[a-z_]+\/\w+\.json$/.test(u)), 'it read meta.json and job files');
  ok(!/offline|can.t reach/i.test(await text(p)), 'no offline message');
  ok(!errors.some((e) => /Content Security Policy/.test(e)), 'no CSP violations reading the data');
  const shown = await count(p);
  const apiTotal = (await json('/api/jobs?limit=1')).total;
  ok(shown > 0 && shown <= apiTotal, `the count (${shown}) is within what the API holds (${apiTotal})`);
  await p.getByLabel('More roles').selectOption('sales'); await p.getByText('Enterprise Account Executive').waitFor({ timeout: 15000 });
  ok(await cards(p) === 1, '"More roles" → Sales lists the one sales job');
  await axe(p, 'jobs with "More roles" picked');
  await h.ctx.close();
});

await step('production build: https only, no localhost, no CSP errors', async () => {
  const h = await launch({ blockProd: false, dist: process.env.EXT_PROD });
  await h.ctx.route(/^https:\/\/jobly-yd6l\.onrender\.com\//, async (route) => {
    const u = new URL(route.request().url()); const req = route.request();
    try {
      const res = await fetch(API + u.pathname + u.search, { method: req.method(), headers: { 'content-type': req.headers()['content-type'] || 'application/json' }, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData() });
      await route.fulfill({ status: res.status, headers: { 'access-control-allow-origin': '*', 'content-type': res.headers.get('content-type') || 'application/json' }, body: Buffer.from(await res.arrayBuffer()) });
    } catch { await route.abort(); }
  });
  const reqs = []; const errors = []; const p = await h.ctx.newPage(); p.on('request', (r) => reqs.push(r.url())); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.setViewportSize({ width: 400, height: 590 }); await p.goto(`chrome-extension://${h.id}/popup.html`); await firstCard(p); await sleep(1500);
  ok(await cards(p) > 0, 'production build renders jobs over https');
  ok(!reqs.some((u) => /127\.0\.0\.1|localhost|getcatchly/.test(u)), 'no requests to localhost or getcatchly');
  ok(!errors.some((e) => /Content Security Policy/.test(e)), 'no CSP violations');
  const manifest = await h.sw.evaluate(() => chrome.runtime.getManifest()); ok(manifest.host_permissions.every((x) => x.startsWith('https://')) && manifest.host_permissions.length === 2 && manifest.host_permissions.includes('https://jobly-data.pages.dev/*'), `host permissions: ${manifest.host_permissions.join(', ')}`);
  await h.ctx.close();
});

await step('tracker: track, details, interviews, tasks, import/export, reminders, "Did you apply?"', async () => {
  const h = await launch();
  const store = async (k) => (await h.sw.evaluate((key) => chrome.storage.local.get(key), k))[k];
  const day = (n) => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const d = await open(h, 'options.html', { width: 1280, height: 860 }); await firstCard(d);
  // track from a job card
  const card = d.locator('article').first(); const label = await card.getAttribute('aria-label'); const company = label.split(' at ').pop();
  await card.getByRole('combobox', { name: /^Track / }).selectOption('applied'); await sleep(500);
  let apps = await store('applications');
  ok(apps?.length === 1 && apps[0].status === 'applied' && !!apps[0].applied_at, 'Track → Applied stores the application with today\'s date');
  ok(await card.locator('.badge', { hasText: 'Applied' }).count() === 1, 'the card says Applied');
  const sibling = d.locator('article', { hasText: company }).nth(1);
  if (await sibling.count()) ok(await sibling.locator('.badge', { hasText: 'You applied here before' }).count() === 1, 'other jobs at the same company warn "You applied here before"');
  // board + details
  await d.getByRole('button', { name: /^Tracker/ }).click(); await d.getByRole('heading', { name: 'Tracker', exact: true }).waitFor({ timeout: 5000 });
  ok(await d.locator('section[aria-labelledby="col-applied"] .board-card').count() === 1, 'it appears in the Applied column');
  await d.getByRole('button', { name: /^Details for/ }).first().click(); await d.getByRole('dialog').waitFor();
  await axe(d, 'application details dialog');
  await d.getByLabel('Notes').fill('Recruiter: Sam'); await d.getByLabel('Follow up on').fill(day(2));
  await d.getByRole('button', { name: 'Save changes' }).click(); await sleep(500);
  apps = await store('applications');
  ok(apps[0].notes === 'Recruiter: Sam' && !!apps[0].follow_up_at, 'notes and the follow-up date are saved');
  ok(await d.locator('.board-card .badge', { hasText: /Follow up in 2 days/ }).count() === 1, 'the card shows when to follow up');
  // interview from the details dialog
  await d.getByRole('button', { name: /^Details for/ }).first().click();
  await d.getByRole('button', { name: 'Add interview' }).click(); await d.getByRole('dialog', { name: 'Add interview' }).waitFor();
  await axe(d, 'interview dialog');
  await d.getByLabel('Round').fill('Technical'); await d.getByLabel('New checklist item').fill('Review system design'); await d.getByRole('button', { name: 'Add', exact: true }).click();
  await d.getByRole('radio', { name: '4 of 5' }).click();
  await d.getByRole('button', { name: 'Save interview' }).click(); await sleep(500);
  const ivs = await store('interviews');
  ok(ivs?.length === 1 && ivs[0].round === 'Technical' && ivs[0].checklist.length === 5 && ivs[0].rating === 4, 'the interview is saved with its checklist and rating');
  ok((await store('applications'))[0].status === 'interview', 'adding an interview moves the application to Interviewing');
  await d.keyboard.press('Escape'); await sleep(300);
  await d.getByRole('button', { name: /^Interviews/ }).click(); await d.getByText(/Technical ·/).waitFor({ timeout: 5000 }); ok(true, 'the Interviews page lists it');
  // tasks + weekly goal
  await d.getByRole('button', { name: /^Tasks/ }).click(); await d.getByText(/of 10 applications this week/).waitFor({ timeout: 5000 });
  ok(await d.getByText('1 of 10 applications this week').count() === 1, 'the weekly goal counts this week\'s applications');
  await d.getByLabel('New task').fill('Send a thank-you note'); await d.getByLabel('Due date').fill(day(1)); await d.getByRole('button', { name: 'Add task' }).click(); await sleep(400);
  ok((await store('tasks'))?.[0]?.text === 'Send a thank-you note', 'a task is stored');
  await d.getByRole('checkbox', { name: /Send a thank-you note/ }).click(); await sleep(400); // it moves into the collapsed Done list
  ok((await store('tasks'))[0].done === true, 'ticking a task marks it done');
  // add by hand, export CSV, import CSV
  await d.getByRole('button', { name: /^Tracker/ }).click(); await d.getByRole('button', { name: 'Add application' }).click();
  await d.getByLabel('Company').fill('Initech'); await d.getByLabel('Role').fill('Staff Designer'); await d.getByRole('button', { name: 'Add to tracker' }).click(); await sleep(500);
  ok((await store('applications')).some((a) => a.company_name === 'Initech' && a.source === 'manual'), 'a job added by hand is tracked');
  const [csvDl] = await Promise.all([d.waitForEvent('download'), d.getByRole('button', { name: 'Export CSV' }).click()]);
  const csv = fs.readFileSync(await csvDl.path(), 'utf8');
  ok(csv.startsWith('Company,Role,Status,Applied') && csv.includes('Initech') && csv.includes('Recruiter: Sam'), 'Export CSV has a header row and every application');
  await d.locator('input[type="file"]').setInputFiles({ name: 'sheet.csv', mimeType: 'text/csv', buffer: Buffer.from('Company,Position,Stage,Date applied,Notes\nGlobex,Product Designer,Phone screen,2026-10-01,"Referral, from Ana"\n"Acme, Inc",PM,Offer,,\n,No company,,,\n') });
  await d.getByText(/Imported 2 applications/).waitFor({ timeout: 5000 });
  apps = await store('applications');
  ok(apps.some((a) => a.company_name === 'Globex' && a.status === 'interview' && a.notes === 'Referral, from Ana') && apps.some((a) => a.company_name === 'Acme, Inc' && a.status === 'offer'), 'CSV import maps columns and statuses, keeps quoted commas, skips rows without a company');
  // backup round trip
  const [bkDl] = await Promise.all([d.waitForEvent('download'), d.getByRole('button', { name: 'Backup' }).click()]);
  const backup = fs.readFileSync(await bkDl.path(), 'utf8');
  await h.sw.evaluate(() => chrome.storage.local.set({ applications: [], interviews: [], tasks: [] })); await sleep(400);
  await d.locator('input[type="file"]').setInputFiles({ name: 'jobly-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await d.getByText(/Backup restored: 4 applications/).waitFor({ timeout: 5000 });
  ok((await store('interviews')).length === 1 && (await store('tasks')).length === 1, 'a backup restores applications, interviews and tasks');
  await d.locator('input[type="file"]').setInputFiles({ name: 'evil.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"other"}') });
  await d.getByText("That isn't a Jobly backup file.").waitFor({ timeout: 5000 }); ok(true, 'a file that is not a Jobly backup is refused');
  // reminders, worked out on the device
  await h.sw.evaluate(() => chrome.storage.local.get('applications').then(({ applications }) => chrome.storage.local.set({ applications: applications.map((a, i) => (i === 0 ? { ...a, follow_up_at: new Date(Date.now() - 86400000).toISOString(), follow_up_notified: false } : a)) })));
  await h.sw.evaluate(() => chrome.storage.local.get('interviews').then(({ interviews }) => chrome.storage.local.set({ interviews: interviews.map((i) => ({ ...i, at: new Date(Date.now() + 30 * 60000).toISOString(), reminded: false })) })));
  await d.evaluate(() => new Promise((res) => chrome.runtime.sendMessage({ type: 'CHECK_REMINDERS' }, res))); await sleep(500);
  ok((await store('applications'))[0].follow_up_notified === true, 'a due follow-up is announced once');
  ok((await store('interviews'))[0].reminded === true, 'an interview 30 minutes away gets its reminder');
  const reminderAlarm = await h.sw.evaluate(async () => (await chrome.alarms.get('jobly-reminders'))?.periodInMinutes);
  ok(reminderAlarm === 15, `reminders are checked every ${reminderAlarm} minutes, locally`);
  await d.close();
  // "Did you apply?" after opening a job
  const p = await open(h); await firstCard(p);
  const fresh = p.locator('article').nth(3); const freshLabel = await fresh.getAttribute('aria-label');
  const [tab] = await Promise.all([h.ctx.waitForEvent('page'), fresh.getByRole('link', { name: /^Apply to/ }).click()]); await tab.close();
  await p.getByRole('region', { name: 'Did you apply?' }).waitFor({ timeout: 5000 }); await axe(p, 'did-you-apply prompt');
  await p.getByRole('button', { name: 'Yes, track it' }).click(); await sleep(500);
  ok((await store('applications')).some((a) => freshLabel.startsWith(a.title) && a.status === 'applied'), '"Yes, track it" adds the job as Applied');
  ok(await p.getByRole('region', { name: 'Did you apply?' }).count() === 0, 'the prompt goes away once answered');
  await h.ctx.close();
});

await step('dealbreakers, job type filter, following companies', async () => {
  const h = await launch(); const jobReqs = [];
  h.ctx.on('request', (r) => { if (/\/api\/jobs\?/.test(r.url())) jobReqs.push(new URL(r.url())); });
  const p = await open(h); await firstCard(p);
  await p.getByRole('button', { name: /^Preferences/ }).click(); await sleep(500);
  await p.getByRole('button', { name: 'Contract' }).click(); await p.getByLabel('Lowest yearly salary').fill('150000');
  await p.getByRole('button', { name: 'Save preferences' }).click(); await p.getByText('Saved on this device.').waitFor({ timeout: 5000 });
  const prefs = (await h.sw.evaluate(() => chrome.storage.local.get('userPreferences'))).userPreferences;
  ok(prefs.min_salary === 150000 && prefs.employment_types.join() === 'contract', 'dealbreakers are stored on the device');
  await p.getByRole('button', { name: /^Jobs/ }).click(); await sleep(1500);
  const sent = JSON.parse(jobReqs.filter((u) => u.searchParams.get('prefs')).pop().searchParams.get('prefs'));
  ok(sent.min_salary === 150000 && sent.employment_types[0] === 'contract', 'the job request carries the dealbreakers');
  await p.getByRole('button', { name: /^All/ }).click(); await p.getByRole('button', { name: /Filters/ }).click();
  ok(await p.locator('#f-type option').count() === 5, 'the filters offer a Job type');
  await p.locator('#f-type').selectOption('internship'); await sleep(600);
  const shown = await p.locator('article').count(); const interns = await p.locator('article .badge', { hasText: 'Internship' }).count();
  ok(shown >= 1 && shown === interns, `Job type = Internship shows only internships (${shown})`);
  await axe(p, 'job type filter'); await p.close();
  // follow a company: its new jobs become alerts even when they don't match
  const d = await open(h, 'options.html', { width: 1280, height: 860 }); await firstCard(d);
  await d.getByRole('button', { name: /^Companies/ }).click(); await d.getByRole('button', { name: /^Follow / }).first().waitFor({ timeout: 10000 });
  await d.getByRole('button', { name: /^Follow / }).first().click(); await sleep(400);
  const followed = (await h.sw.evaluate(() => chrome.storage.local.get('followedCompanyIds'))).followedCompanyIds;
  ok(followed?.length === 1, 'following a company is stored on the device');
  await axe(d, 'companies with follow');
  // follow a company that has jobs from the last 3 days, so the check has something to find
  const recent = await json('/api/jobs?freshness_days=3&limit=1'); const recentCompany = recent.items[0].company_id;
  await h.sw.evaluate((id) => chrome.storage.local.set({ followedCompanyIds: [id] }), recentCompany);
  await h.sw.evaluate(() => chrome.storage.local.set({ alerts: [], seenAlertKeys: [], userPreferences: { roles: ['nonexistent_role'], seniorities: [], locations: [], remote_only: false, custom_keywords: '', excluded_keywords: '', min_salary: 0, employment_types: [], notify_enabled: false, sync_interval_mins: 30 } }));
  await d.evaluate(() => new Promise((res) => chrome.runtime.sendMessage({ type: 'TRIGGER_BACKGROUND_CHECK' }, res))); await sleep(800);
  const alerts = (await h.sw.evaluate(() => chrome.storage.local.get('alerts'))).alerts;
  ok(alerts.length > 0 && alerts.every((a) => a.reason === 'follow'), `new jobs at a followed company become alerts even with no matching preferences (${alerts.length})`);
  ok(jobReqs.some((u) => u.searchParams.get('company_ids') === String(recentCompany)), 'followed companies are asked for in one request');
  await h.ctx.close();
});

await step('profile, copy kit, resume, cover letter, backup, sync', async () => {
  const h = await launch(); const store = async (k, area = 'local') => (await h.sw.evaluate(([key, a]) => chrome.storage[a].get(key), [k, area]))[k];
  const d = await open(h, 'options.html', { width: 1280, height: 900 }); await firstCard(d);
  await d.getByRole('button', { name: /^Profile/ }).click(); await d.getByRole('button', { name: 'Create profile' }).click(); await sleep(400);
  await d.getByLabel('First name', { exact: true }).fill('Ada'); await d.getByLabel('Last name', { exact: true }).fill('Lovelace'); await d.getByLabel('Email', { exact: true }).fill('ada@example.com');
  await d.getByLabel('Headline', { exact: true }).fill('Senior Product Designer'); await d.getByLabel('Years of experience', { exact: true }).fill('6');
  await d.getByLabel('Skills', { exact: true }).fill('Figma, Design systems, React, User research');
  await d.getByRole('button', { name: 'Add a role' }).click(); await d.getByLabel('Title', { exact: true }).fill('Lead Designer'); await d.getByLabel('Company', { exact: true }).fill('Analytical Engines');
  await d.getByLabel(/What you did/).fill('Led the redesign of checkout, lifting conversion 12%\nBuilt the design system');
  await d.getByRole('button', { name: 'Save profile' }).click(); await sleep(500);
  const prof = (await store('profiles'))?.[0];
  ok(prof?.first_name === 'Ada' && prof.work[0].company === 'Analytical Engines' && prof.work[0].current === true, 'the profile is saved on the device with its experience');
  await axe(d, 'profile filled');
  // resume
  await d.getByRole('button', { name: /^Resume/ }).click(); await d.locator('.resume h1').waitFor({ timeout: 5000 });
  ok((await d.locator('.resume h1').innerText()) === 'Ada Lovelace' && await d.locator('.resume li', { hasText: 'Built the design system' }).count() === 1, 'the resume preview is built from the profile');
  await d.getByText('Classic', { exact: true }).click(); await sleep(300); ok((await store('resumeTemplate')) === 'classic', 'the chosen template is remembered');
  ok(await d.evaluate(() => getComputedStyle(document.querySelector('.resume')).fontFamily.includes('Georgia')), 'the Classic template applies its own styles (constructed stylesheet, no inline <style>)');
  const [doc] = await Promise.all([d.waitForEvent('download'), d.getByRole('button', { name: 'Word' }).click()]);
  const docText = fs.readFileSync(await doc.path(), 'utf8'); ok(docText.includes('Ada Lovelace') && docText.includes('Experience') && doc.suggestedFilename() === 'Ada-Lovelace.doc', 'Word export holds the resume');
  await axe(d, 'resume');
  // cover letter
  await d.getByRole('button', { name: /^Cover letters/ }).click(); await d.getByLabel('Role', { exact: true }).fill('Staff Designer'); await d.getByLabel('Company', { exact: true }).fill('Initech'); await sleep(300);
  const letter = await d.getByLabel('Letter', { exact: true }).inputValue();
  ok(letter.includes('Dear Initech hiring team') && letter.includes('Staff Designer') && letter.includes('Ada Lovelace') && letter.includes('led the redesign of checkout'), 'the cover letter fills in the job and the profile');
  await axe(d, 'cover letters');
  // backup carries profiles
  await d.getByRole('button', { name: /^Tracker/ }).click();
  const [bk] = await Promise.all([d.waitForEvent('download'), d.getByRole('button', { name: 'Backup' }).click()]);
  ok(JSON.parse(fs.readFileSync(await bk.path(), 'utf8')).data.profiles?.[0]?.first_name === 'Ada', 'the backup includes profiles');
  // copy kit in the popup
  const p = await open(h); await firstCard(p); await p.getByRole('button', { name: /^Apply/ }).click();
  await p.locator('.kit-row', { hasText: 'ada@example.com' }).waitFor({ timeout: 5000 }); ok(true, 'the popup copy kit lists the profile answers');
  await p.getByText('Open a job posting, then open Jobly').waitFor({ timeout: 5000 }); ok(true, 'on a non-job page the Apply tab explains how to save a job');
  await axe(p, 'apply kit'); await p.close();
  // sync across Chrome browsers (opt-in)
  await d.getByRole('button', { name: /^Preferences/ }).click(); await d.getByRole('switch', { name: /Sync across your Chrome browsers/ }).click(); await sleep(1500);
  const meta = await store('jobly_meta', 'sync'); ok(meta?.chunks >= 1, `turning sync on writes a snapshot to Chrome sync (${meta?.chunks} chunk)`);
  const snapshot = JSON.parse((await h.sw.evaluate(async (n) => { const k = Array.from({ length: n }, (_, i) => `jobly_${i}`); const r = await chrome.storage.sync.get(k); return k.map((x) => r[x]).join(''); }, meta.chunks)));
  ok(snapshot.profiles?.[0]?.first_name === 'Ada' && !('savedJobs' in snapshot), 'the snapshot holds the synced data only');
  snapshot.tasks = [{ id: 'remote-task', text: 'Made on my laptop', due_at: null, done: false, app_key: null, created_at: new Date().toISOString() }];
  const json = JSON.stringify(snapshot);
  await h.sw.evaluate(async ([js]) => { const parts = {}; for (let i = 0; i * 7000 < js.length; i++) parts[`jobly_${i}`] = js.slice(i * 7000, (i + 1) * 7000); await chrome.storage.sync.set({ ...parts, jobly_meta: { chunks: Object.keys(parts).length, updatedAt: Date.now() + 60000, device: 'other-device', trimmed: false } }); }, [json]);
  await sleep(1500);
  ok((await store('tasks'))?.[0]?.text === 'Made on my laptop', 'a newer snapshot from another browser is applied');
  await h.ctx.close();
});

await step('reading a job page and the fit check (in a real page)', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const bundle = await esbuild({ entryPoints: [path.join(root, 'src/e2e-units.ts')], bundle: true, write: false, format: 'iife', globalName: 'units', platform: 'browser' })
    .catch(() => null);
  ok(!!bundle, 'the page-reading code bundles on its own');
  if (!bundle) return;
  const h = await launch(); const page = await h.ctx.newPage();
  const posting = { '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Senior Product Designer', datePosted: '2026-10-20', employmentType: 'FULL_TIME',
    hiringOrganization: { '@type': 'Organization', name: 'Quill Systems' }, jobLocation: { '@type': 'Place', address: { addressLocality: 'Austin', addressRegion: 'TX', addressCountry: 'US' } },
    baseSalary: { currency: 'USD', value: { minValue: 150000, maxValue: 190000, unitText: 'YEAR' } },
    description: '<p>We want 5+ years of product design. You know <b>Figma</b> and design systems, and you have run user research. Bonus: TypeScript, Storybook, accessibility.</p><img src=x onerror="window.pwned=1">' };
  await page.route('https://jobs.example.test/**', (r) => r.fulfill({ contentType: 'text/html', body: `<html><head><title>Senior Product Designer - Quill</title><script type="application/ld+json">${JSON.stringify({ '@graph': [posting] })}</script></head><body><main>Apply now</main></body></html>` }));
  await page.goto('https://jobs.example.test/123'); await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const job = await page.evaluate(() => window.units.extractJobFromPage());
  ok(job.found && job.title === 'Senior Product Designer' && job.company === 'Quill Systems' && job.location === 'Austin, TX, US' && job.datePosted === '2026-10-20' && /150000 – 190000 USD per year/.test(job.salary), 'a schema.org JobPosting is read (title, company, place, date, salary)');
  ok(job.description.includes('5+ years') && !job.description.includes('<p>'), 'the description arrives as plain text');
  ok(await page.evaluate(() => !window.pwned), "reading the page never runs the page's markup");
  const fit = await page.evaluate((d) => window.units.fitCheck({ ...window.units.emptyProfile(), skills: 'Figma, Design systems, User research, Python', years_experience: '6' }, d), job.description);
  ok(fit.level === 'strong' && fit.found.length === 3 && fit.missing.join() === 'Python' && fit.yearsAsked === 5, `fit check: ${fit.level}, ${fit.found.length} skills found, asks ${fit.yearsAsked} years`);
  ok(fit.suggestions.includes('TypeScript') && fit.suggestions.includes('Storybook') && !fit.suggestions.includes('Figma'), 'it suggests skills the posting asks for that the profile lacks');
  await page.route('https://plain.example.test/**', (r) => r.fulfill({ contentType: 'text/html', body: '<html><head><title>Frontend Engineer at Paperplane</title></head><body><h1>Frontend Engineer</h1></body></html>' }));
  await page.goto('https://plain.example.test/job'); await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const plain = await page.evaluate(() => window.units.extractJobFromPage());
  ok(!plain.found && plain.title === 'Frontend Engineer' && plain.company === 'Paperplane', 'a page without structured data falls back to its heading and title');
  await h.ctx.close();
});

await step('autofill: scan, propose, fill only approved fields (in a real page)', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const bundle = await esbuild({ entryPoints: [path.join(root, 'src/e2e-units.ts')], bundle: true, write: false, format: 'iife', globalName: 'units', platform: 'browser' });
  const h = await launch(); const page = await h.ctx.newPage();
  const form = `<html><body><form>
    <label for="fn">First Name *</label><input id="fn" name="first_name" required>
    <label for="ln">Last Name *</label><input id="ln" name="last_name" required>
    <label for="em">Email</label><input id="em" type="email">
    <div class="field"><div class="application-label">Phone</div><input name="phone" type="tel"></div>
    <label>LinkedIn Profile <input name="urls[LinkedIn]"></label>
    <label for="spon">Will you now or in the future require visa sponsorship?</label><select id="spon"><option value="">Select…</option><option value="1">Yes</option><option value="0">No</option></select>
    <fieldset><legend>Are you legally authorized to work in the United States?</legend><label><input type="radio" name="auth" value="y"> Yes</label><label><input type="radio" name="auth" value="n"> No</label></fieldset>
    <label for="cl">Why do you want to join us?</label><textarea id="cl"></textarea>
    <label for="cv">Resume/CV</label><input id="cv" type="file">
    <label><input type="checkbox" id="consent"> I agree to the privacy notice</label>
    <label for="fav">Favourite colour</label><input id="fav">
    <input type="hidden" name="token" value="x"><input type="password" id="pw">
  </form></body></html>`;
  await page.route('https://apply.example.test/**', (r) => r.fulfill({ contentType: 'text/html', body: form }));
  await page.goto('https://apply.example.test/job'); await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate(() => { window.events = 0; document.getElementById('fn').addEventListener('input', () => window.events++); });
  const scan = await page.evaluate(() => window.units.scanForm());
  const labels = scan.fields.map((f) => f.label);
  ok(labels.includes('First Name') && labels.includes('Phone') && labels.includes('LinkedIn Profile') && labels.some((l) => /legally authorized/.test(l)), `the scan finds questions by label, nearby text and legend (${scan.fields.length} fields)`);
  ok(!scan.fields.some((f) => f.type === 'password' || f.type === 'hidden'), 'password and hidden fields are never touched');
  const profile = await page.evaluate(() => ({ ...window.units.emptyProfile(), first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', phone: '+1 555 0100', linkedin: 'linkedin.com/in/ada', work_authorization: 'US citizen', needs_sponsorship: 'no', summary: 'I build design systems.' }));
  const props = await page.evaluate(([f, p]) => window.units.proposeAnswers(f, p, true), [scan.fields, profile]);
  const byLabel = Object.fromEntries(props.map((p) => [p.field.label, p]));
  ok(byLabel['First Name'].value === 'Ada' && byLabel['Phone'].value === '+1 555 0100' && byLabel['LinkedIn Profile'].value === 'linkedin.com/in/ada', 'contact answers are proposed from the profile');
  ok(byLabel['Will you now or in the future require visa sponsorship?'].value === 'No' && props.find((p) => /legally/.test(p.field.label)).value === 'Yes', 'yes/no questions get one of their own options');
  ok(byLabel['Why do you want to join us?'].value === 'I build design systems.' && byLabel['Resume/CV'].answerId === 'resume', 'open questions get the summary as a starting point, the file field gets the resume');
  ok(!byLabel['I agree to the privacy notice'].include && !byLabel['Favourite colour'].include, 'consent boxes and unknown questions are left for the user');
  const items = props.filter((p) => p.include && p.value && p.field.label !== 'Phone').map((p) => ({ id: p.field.id, kind: p.field.kind, value: p.value }));
  const res = await page.evaluate(([i]) => window.units.fillForm(i, { name: 'ada.pdf', type: 'application/pdf', data: 'data:application/pdf;base64,JVBERi0xLjQK' }), [items]);
  const vals = await page.evaluate(() => ({ fn: document.getElementById('fn').value, phone: document.querySelector('[name=phone]').value, spon: document.getElementById('spon').selectedOptions[0].textContent, auth: document.querySelector('input[name=auth]:checked')?.value, cl: document.getElementById('cl').value, file: document.getElementById('cv').files[0]?.name, consent: document.getElementById('consent').checked, events: window.events }));
  ok(res.filled === items.length && res.failed.length === 0, `filled ${res.filled} approved fields, none failed`);
  ok(vals.fn === 'Ada' && vals.spon === 'No' && vals.auth === 'y' && vals.cl === 'I build design systems.' && vals.file === 'ada.pdf', 'text, select, radio, textarea and the resume file are filled');
  ok(vals.phone === '' && vals.consent === false, 'an unchecked answer and the consent box stay untouched');
  ok(vals.events >= 1, 'fields get input events, so sites built with React register the values');
  await h.ctx.close();
});

await step('contacts, outreach drafts, connections, calendar import state', async () => {
  const h = await launch(); const store = async (k) => (await h.sw.evaluate((key) => chrome.storage.local.get(key), k))[k];
  await h.sw.evaluate(() => chrome.storage.local.set({ applications: [{ key: 'manual:1', title: 'Staff Designer', company_name: 'Initech', location: null, application_url: 'https://careers.initech.com/jobs/1', source: 'manual', status: 'applied', notes: '', applied_at: new Date().toISOString(), follow_up_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
    profiles: [{ id: 'p1', label: 'Design', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', phone: '', location: '', headline: 'Senior Product Designer', summary: '', linkedin: '', github: '', portfolio: '', website: '', work_authorization: '', needs_sponsorship: '', years_experience: '6', salary_expectation: '', notice_period: '', skills: '', work: [{ id: 'w1', company: 'Analytical Engines', title: 'Lead Designer', location: '', start: '2022-01', end: '', current: true, bullets: 'Led the checkout redesign' }], education: [], updated_at: new Date().toISOString() }], activeProfileId: 'p1' }));
  const d = await open(h, 'options.html', { width: 1280, height: 900 }); await firstCard(d);
  await d.getByRole('button', { name: /^Contacts/ }).click(); await d.getByText('Finding contacts uses your own Hunter account').waitFor({ timeout: 5000 });
  ok(await d.getByRole('button', { name: 'Find contacts' }).isDisabled(), 'without a Hunter key, searching is off and the page says how to add one');
  await d.getByLabel('For application').selectOption('manual:1'); ok((await d.getByLabel('Company domain').inputValue()) === 'initech.com', "the company's domain is taken from the application link");
  await axe(d, 'contacts');
  // a contact by hand, then an outreach draft
  await d.getByRole('button', { name: 'Add a contact' }).click(); const dlg = d.getByRole('dialog'); await dlg.getByLabel('Name').fill('Grace Hopper'); await dlg.getByLabel('Position').fill('Head of Talent'); await dlg.getByLabel('Email').fill('grace@initech.com');
  await d.getByRole('dialog').getByLabel('Application', { exact: true }).selectOption('manual:1'); await d.getByRole('button', { name: 'Save contact' }).click(); await sleep(400);
  ok((await store('contacts'))?.[0]?.company === 'Initech', 'a contact is saved with its application');
  await d.getByRole('button', { name: 'Draft message' }).click(); await d.getByRole('dialog').waitFor();
  const msg = await d.getByLabel('Text', { exact: true }).inputValue();
  ok(msg.startsWith('Hi Grace,') && msg.includes('Staff Designer role at Initech') && msg.includes('Ada Lovelace') && msg.includes('led the checkout redesign'), 'the outreach draft is filled from the contact, the job and the profile');
  await d.getByLabel('Message', { exact: true }).selectOption('linkedin'); ok(await d.getByText(/\d+\/300 characters/).count() === 1, 'the LinkedIn note shows the 300-character limit');
  await axe(d, 'outreach dialog');
  await d.getByRole('button', { name: 'Mark as contacted' }).click(); await sleep(400); ok(!!(await store('contacts'))[0].contacted_at, 'marking as contacted is remembered');
  // calendar import state in a build without an OAuth client
  await d.getByRole('button', { name: /^Interviews/ }).click(); ok(await d.getByRole('button', { name: 'Import from Google Calendar' }).isDisabled(), 'calendar import is shown but off until it is set up');
  // Hunter key in Preferences, never in a backup
  await d.getByRole('button', { name: /^Preferences/ }).click(); await d.getByLabel(/Hunter API key/).fill('test-key-123'); await d.getByRole('button', { name: 'Save', exact: true }).click(); await sleep(300);
  ok((await store('hunterApiKey')) === 'test-key-123', 'the Hunter key is stored on the device');
  await d.getByRole('button', { name: /^Tracker/ }).click();
  const [bk] = await Promise.all([d.waitForEvent('download'), d.getByRole('button', { name: 'Backup' }).click()]);
  const backup = fs.readFileSync(await bk.path(), 'utf8'); ok(!backup.includes('test-key-123') && JSON.parse(backup).data.contacts?.length === 1, 'backups include contacts but never the API key');
  // the Hunter search itself (in a real page, with the service mocked)
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const bundle = await esbuild({ entryPoints: [path.join(root, 'src/e2e-units.ts')], bundle: true, write: false, format: 'iife', globalName: 'units', platform: 'browser' });
  const page = await h.ctx.newPage(); const asked = [];
  await page.route('https://api.hunter.io/**', (r) => { asked.push(new URL(r.request().url())); r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: { emails: [
    { first_name: 'Bob', last_name: 'Smith', position: 'Software Engineer', value: 'bob@initech.com', confidence: 90 },
    { first_name: 'Ann', last_name: 'Lee', position: 'Technical Recruiter', value: 'ann@initech.com', confidence: 70, linkedin: 'https://linkedin.com/in/annlee' },
    { first_name: 'No', last_name: 'Email', position: 'CEO' }] } }) }); });
  await page.route('https://apply.example.test/**', (r) => r.fulfill({ contentType: 'text/html', body: '<html><body>ok</body></html>' }));
  await page.goto('https://apply.example.test/'); await page.addInitScript(() => {});
  await page.evaluate(() => { window.chrome = { permissions: { contains: async () => true, request: async () => true }, storage: { local: { get: async () => ({ hunterApiKey: 'k1' }) } } }; });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const found = await page.evaluate(() => window.units.findContacts('initech.com', 'hr'));
  ok(found.length === 2 && found[0].name === 'Ann Lee', 'contacts without an email are dropped and recruiters come first');
  ok(asked[0]?.searchParams.get('domain') === 'initech.com' && asked[0].searchParams.get('department') === 'hr' && asked[0].searchParams.get('api_key') === 'k1', 'the search goes straight to Hunter with the user\'s own key');
  ok(await page.evaluate(() => window.units.companyDomain('https://boards.greenhouse.io/acme/jobs/1') === '' && window.units.companyDomain('https://jobs.acme.com/x') === 'acme.com'), 'hiring-system links are not mistaken for company domains');
  await h.ctx.close();
});

t.done();
