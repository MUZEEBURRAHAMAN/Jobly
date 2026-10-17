// End-to-end suite: real Chromium + the built extension + a backend on a fixture database.
import { launch, open, makeRunner, LOCAL, JSON_HEADERS, sleep, json, API } from './lib.mjs';

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
    for (const tab of ['Jobs', 'Companies', 'Saved', 'Preferences']) { await p.getByRole('button', { name: new RegExp('^' + tab) }).click(); await sleep(500); await axe(p, `popup/${tab}/${theme}`); }
    await p.getByRole('button', { name: /^Jobs/ }).click(); await p.getByRole('button', { name: /Filters/ }).click(); await axe(p, `popup/filters/${theme}`);
    const d = await open(h, 'options.html', { theme, width: 1280, height: 860 }); await firstCard(d);
    for (const tab of ['Jobs', 'Companies', 'Saved', 'Alerts', 'Preferences']) { await d.getByRole('button', { name: new RegExp('^' + tab) }).click(); await sleep(500); await axe(d, `dashboard/${tab}/${theme}`); }
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
  await sleep(800); ok(await dash.getByText('All caught up').count() === 1 || await dash.getByRole('button', { name: 'Mark all read' }).count() === 0, 'opening Alerts marks them read');
  ok(writes.every((w) => w.startsWith('POST /api/jobs/') && w.endsWith('/report')), `the server only ever receives reports: ${writes.length ? writes.join(', ') : 'no writes at all'}`);
  await h.ctx.close();
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
  for (const [status, expect] of [[429, 'Too many requests'], [500, 'Something went wrong on our side']]) {
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
  const manifest = await h.sw.evaluate(() => chrome.runtime.getManifest()); ok(manifest.host_permissions.every((x) => x.startsWith('https://')) && manifest.host_permissions.length === 1, `host permissions: ${manifest.host_permissions.join(', ')}`);
  await h.ctx.close();
});

t.done();
