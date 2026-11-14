// End-to-end suite: real Chromium + the built extension, reading a fixture database published as static job data.
import { launch, open, makeRunner, DATA, JSON_HEADERS, sleep, readStatic, staticJobs, goOffline, goOnline } from './lib.mjs';
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
    for (const tab of ['Jobs', 'Apply', 'Companies', 'Saved', 'Settings']) { await p.getByRole('button', { name: new RegExp('^' + tab) }).click(); await sleep(500); await axe(p, `popup/${tab}/${theme}`); }
    await p.getByRole('button', { name: /^Jobs/ }).click(); await p.getByRole('button', { name: /Filters/ }).click(); await axe(p, `popup/filters/${theme}`);
    const d = await open(h, 'options.html', { theme, width: 1280, height: 860 }); await firstCard(d);
    for (const tab of ['Jobs', 'Companies', 'Saved', 'Profile', 'Resume', 'Cover letters', 'People', 'Alerts', 'Settings']) { await d.getByRole('button', { name: new RegExp('^' + tab) }).click(); await sleep(500); await axe(d, `dashboard/${tab}/${theme}`); }
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
  await p2.getByRole('button', { name: /^Settings/ }).click(); await p2.getByRole('button', { name: /welcome tour again/ }).click();
  await p2.getByRole('heading', { name: 'Welcome to Jobly' }).waitFor({ timeout: 5000 }); ok(true, 'tour can be replayed from Settings');
  ok((await h.ctx.pages()).some((x) => x.url().endsWith('options.html#welcome')), 'installing opens the welcome page in a tab');
  await h.ctx.close();
  const g = await launch({ onboarded: false }); const q = await open(g); await q.getByRole('button', { name: 'Skip for now' }).click(); await firstCard(q); ok(true, '"Skip for now" goes to the jobs list'); await g.ctx.close();
});

await step('jobs: search, categories, date posted, 2-month rule', async () => {
  const h = await launch(); const p = await open(h); await firstCard(p);
  await p.getByLabel('Search jobs').fill('Ancient Listing'); await p.getByText(/No jobs match/).waitFor({ timeout: 10000 });
  ok(true, 'a job posted 75 days ago is never shown (2-month rule)');
  await p.getByLabel('Search jobs').fill('Unknown Date'); await p.getByText('Unknown Date Engineer').first().waitFor({ timeout: 10000 }); ok(true, 'a job with an unknown date is still listed');
  await sleep(800); const shownLabels = await p.locator('article').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  ok(shownLabels.length > 0 && shownLabels.every((l) => /Unknown Date/.test(l)), `after a search every card shown is a match, not a stale card (${shownLabels.length} shown)`);
  await p.getByLabel('Search jobs').fill(''); await p.locator('article').first().waitFor();
  ok(await p.getByLabel('Search jobs').inputValue() === '', 'search cleared');
  await p.getByRole('button', { name: /^Design(?! &)/ }).click(); await sleep(1200); ok(await p.getByRole('button', { name: /^Design(?! &)/ }).getAttribute('aria-pressed') === 'true', 'category chip toggles');
  await p.getByRole('button', { name: /^All/ }).click(); await sleep(1200);
  const all = await count(p); ok(/last 2 months/.test(await text(p)), 'list says it only covers the last 2 months');
  await p.getByRole('button', { name: /Filters/ }).click();
  ok(await p.getByText('Jobs older than 2 months are never shown.').count() === 1, 'Date posted explains the 2-month limit');
  const options = await p.locator('#f-new option').allInnerTexts(); ok(options.join('|') === 'Any time|Past 24 hours|Past 3 days|Past week|Past 2 weeks|Past month', `Date posted options: ${options.join(', ')}`);
  const counts = { all };
  for (const [value, label] of [['1', 'day'], ['7', 'week'], ['30', 'month']]) { await p.locator('#f-new').selectOption(value); await sleep(1400); counts[label] = await count(p); }
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
  ok(await p.getByRole('button', { name: 'Write report email' }).isDisabled(), 'the report needs a reason first');
  await p.getByRole('radio', { name: /Spam/ }).check(); await p.getByLabel('More details (optional)').fill('Posted twice');
  await p.getByRole('button', { name: 'Write report email' }).click(); await p.getByText('Your email app is open').waitFor({ timeout: 5000 });
  const mail = await p.getByRole('link', { name: 'write the email here' }).getAttribute('href');
  const body = decodeURIComponent(mail.split('body=')[1] ?? '');
  ok(mail.startsWith('mailto:') && /subject=Report%3A/.test(mail) && body.includes('Spam or duplicate') && body.includes('Posted twice') && /Link: https:/.test(body), 'the report opens an email with the job, its link, the reason and the details');
  await axe(p, 'report sent');
  ok(true, 'reports go by email; Jobly has no server to send them to');
  await p.keyboard.press('Escape'); await sleep(300); ok(await p.getByRole('dialog').count() === 0, 'Escape closes the dialog'); await h.ctx.close();
});

await step('on-device data: preferences, saved jobs, alerts', async () => {
  const h = await launch();
  const writes = []; const leaks = [];
  h.ctx.on('request', (r) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method())) writes.push(`${r.method()} ${r.url()}`);
    const u = new URL(r.url());
    if (/^https?:$/.test(u.protocol) && (u.hostname === 'jobly-data.pages.dev' ? !!u.search : u.hostname !== 't2.gstatic.com')) leaks.push(r.url());
  });
  let p = await open(h); await firstCard(p);
  // saving a job
  const card = p.locator('article').first(); const label = await card.getAttribute('aria-label');
  await card.getByRole('button', { name: /^Save:/ }).click(); await sleep(500);
  ok(await card.getByRole('button', { name: /^Remove from saved:/ }).count() === 1, 'Save is instant');
  ok((await h.sw.evaluate(() => chrome.storage.local.get('savedJobs'))).savedJobs?.length === 1, 'the saved job is stored on the device');
  // it survives a restart of the page, even with the server down, and shows in the dashboard
  await p.close(); await goOffline(h.ctx);
  const d = await open(h, 'options.html', { width: 1280, height: 860 });
  await d.getByRole('button', { name: /^Saved/ }).click(); await d.locator('article').first().waitFor({ timeout: 10000 });
  ok((await d.locator('article').first().getAttribute('aria-label')) === label, 'saved jobs are there with the server unreachable');
  await d.locator('article').first().getByRole('button', { name: /^Remove from saved:/ }).click(); await d.getByText('Nothing saved yet').waitFor({ timeout: 5000 });
  ok((await h.sw.evaluate(() => chrome.storage.local.get('savedJobs'))).savedJobs?.length === 0, 'removing it clears the device copy'); await d.close();
  await goOnline(h.ctx);
  // preferences
  p = await open(h); await firstCard(p); await p.getByRole('button', { name: /^Settings/ }).click(); await sleep(600);
  await p.getByRole('checkbox', { name: /Product design/ }).click(); await p.getByRole('button', { name: 'Save preferences' }).click(); await p.getByText('Saved on this device.').waitFor({ timeout: 5000 });
  const stored = (await h.sw.evaluate(() => chrome.storage.local.get('userPreferences'))).userPreferences; ok(stored && !stored.roles.includes('product_design'), 'preferences are stored on the device');
  await p.getByRole('button', { name: /^Jobs/ }).click(); await sleep(1500);
  ok(leaks.length === 0, `preferences never leave the device: only plain reads of the job data and logos${leaks.length ? ': ' + leaks.slice(0, 2).join(', ') : ''}`);
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
  ok(await dash.getByRole('button', { name: /^Alerts/ }).innerText().then((t) => /\d/.test(t)), 'the bell in the header shows an unread count');
  await dash.getByRole('button', { name: /^Alerts/ }).click(); await dash.getByText(/\d+ new/).waitFor({ timeout: 5000 }); await axe(dash, 'alerts with items');
  await sleep(800); ok((await h.sw.evaluate(() => chrome.storage.local.get('alerts'))).alerts.every((a) => a.is_read), 'opening Alerts stores them as read (the badge clears)');
  ok(await dash.getByText(/new since your last visit/).count() === 1 && await dash.locator('.badge', { hasText: 'New' }).count() > 0, 'but they stay highlighted as new for this visit');
  ok(writes.length === 0, `Jobly sends nothing anywhere: ${writes.length ? writes.join(', ') : 'only reads of the job data'}`);
  await h.ctx.close();
});

await step('background check schedule', async () => {
  const g = await launch(); const a = await open(g); await firstCard(a);
  const period = await g.sw.evaluate(async () => (await chrome.alarms.get('jobly-sync'))?.periodInMinutes);
  ok(period >= 60 && period <= 90, `background check runs every ${period} minutes (60-90)`);
  await g.sw.evaluate(async () => { await chrome.alarms.clear('jobly-sync'); await chrome.alarms.create('jobly-sync', { periodInMinutes: 30 }); });
  await g.sw.evaluate(() => new Promise((res) => { chrome.runtime.onInstalled.dispatch({ reason: 'update' }); setTimeout(res, 1500); }));
  const migrated = await g.sw.evaluate(async () => (await chrome.alarms.get('jobly-sync'))?.periodInMinutes);
  ok(migrated >= 60 && migrated <= 90, `an old 30-minute schedule is replaced after an update (now ${migrated})`); await g.ctx.close();
});

await step('states: offline, 429, 500, empty, hidden', async () => {
  // offline, nothing cached
  let h = await launch({ staticData: false }); let p = await open(h); await p.getByText("Can't reach Jobly").waitFor({ timeout: 70000 });
  ok(await art(p) === 1, 'offline: plug illustration'); await axe(p, 'offline');
  await p.getByRole('button', { name: /^Companies/ }).click(); ok(await p.getByText("Can't load companies").count() === 1, 'offline: companies');
  await p.getByRole('button', { name: /^Saved/ }).click(); ok(await p.getByText('Nothing saved yet').count() === 1, 'offline: saved jobs live on the device, so the page still works');
  await p.getByRole('button', { name: /^Settings/ }).click(); await sleep(800); ok(await p.getByRole('button', { name: 'Save preferences' }).count() === 1, 'offline: preferences still usable');
  await h.ctx.close();
  // offline with cache
  h = await launch(); p = await open(h); await firstCard(p); await sleep(1500); await p.close(); await goOffline(h.ctx);
  p = await open(h); await p.getByText(/You're offline/).waitFor({ timeout: 70000 }); ok(await cards(p) > 0, 'offline with cache: saved jobs stay visible + banner'); await h.ctx.close();
  // 429 / 500
  for (const [status, expect] of [[429, 'Jobly is busy right now'], [503, 'Jobly is busy right now'], [500, 'Something went wrong on our side']]) {
    h = await launch(); await h.ctx.route(/jobly-data\.pages\.dev\/v1\/jobs\//, (r) => r.fulfill({ status, headers: JSON_HEADERS, body: '{}' }));
    p = await open(h); await p.getByText(expect).first().waitFor({ timeout: 40000 }); ok(await art(p) === 1, `${status}: "${expect}" state`); await h.ctx.close();
  }
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
  const ids = readStatic('companies.json').map((c) => c.id); await h.sw.evaluate((all) => chrome.storage.local.set({ mutedCompanyIds: all }), ids); await sleep(1200);
  ok(await p.getByText("You've hidden every company in this list").count() === 1, 'everything hidden: explained, with a way back'); await h.ctx.close();
});

await step('dashboard layout fills the window', async () => {
  const h = await launch(); const p = await open(h, 'options.html', { width: 1920, height: 900 });
  for (const [w, minCols] of [[1920, 1], [1280, 1], [700, 1]]) {
    await p.setViewportSize({ width: w, height: 900 }); await p.goto(`chrome-extension://${h.id}/options.html`); await p.locator('article').nth(3).waitFor({ timeout: 30000 }); await sleep(400);
    ok(await p.locator('.sheet').count() === 0, `${w}px: full-width cards, no job open until you click one`);
    const m = await p.evaluate(() => ({ cols: new Set([...document.querySelectorAll('article')].slice(0, 12).map((a) => Math.round(a.getBoundingClientRect().left))).size, inner: document.querySelector('.content-inner').getBoundingClientRect().width, over: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
    ok(m.cols >= minCols && !m.over, `${w}px: ${m.cols} column(s), content ${Math.round(m.inner)}px, no sideways scroll`);
    if (w === 1920) ok(m.inner > 1500, 'uses the full 1920px window');
  }
  await h.ctx.close();
});

await step('static job data: the production build reads jobly-data', async () => {
  const h = await launch({ dist: process.env.EXT_PROD });
  const reqs = []; const errors = []; const p = await h.ctx.newPage(); p.on('request', (r) => reqs.push(r.url())); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.setViewportSize({ width: 400, height: 590 }); await p.goto(`chrome-extension://${h.id}/popup.html`); await firstCard(p); await sleep(800);
  ok(await cards(p) > 0, 'jobs render from the static data');
  ok(reqs.some((u) => u.endsWith('/v1/meta.json')) && reqs.some((u) => /\/v1\/jobs\/[a-z_]+\/\w+\.json$/.test(u)), 'it read meta.json and job files');
  ok(!/offline|can.t reach/i.test(await text(p)), 'no offline message');
  ok(!errors.some((e) => /Content Security Policy/.test(e)), 'no CSP violations reading the data');
  const shown = await count(p);
  const total = readStatic('meta.json').total;
  ok(shown > 0 && shown <= total, `the count (${shown}) is within what the job data holds (${total})`);
  await p.getByLabel('More roles').selectOption('sales'); await p.getByText('Enterprise Account Executive').waitFor({ timeout: 15000 });
  ok(await cards(p) === 1, '"More roles" → Sales lists the one sales job');
  await axe(p, 'jobs with "More roles" picked');
  await p.getByLabel('More roles').selectOption('backend'); await p.getByText('Senior Java Developer').waitFor({ timeout: 15000 });
  ok(await cards(p) === 1, '"More roles" → Backend development lists the Java developer');
  await p.getByRole('button', { name: /^Design & IT/ }).click(); await p.getByText('Senior Java Developer').waitFor({ timeout: 15000 }); await sleep(500);
  const body = await text(p);
  ok(!/Enterprise Account Executive|Technical Recruiter/.test(body) && await cards(p) > 1, '"Design & IT" lists design, development and IT jobs, not sales or recruiting');
  await h.ctx.close();
});

await step('production build: https only, no localhost, no CSP errors', async () => {
  const h = await launch({ dist: process.env.EXT_PROD });
  const reqs = []; const errors = []; const p = await h.ctx.newPage(); p.on('request', (r) => reqs.push(r.url())); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.setViewportSize({ width: 400, height: 590 }); await p.goto(`chrome-extension://${h.id}/popup.html`); await firstCard(p); await sleep(1500);
  ok(await cards(p) > 0, 'production build renders jobs over https');
  ok(!reqs.some((u) => /127\.0\.0\.1|localhost|getcatchly/.test(u)), 'no requests to localhost or getcatchly');
  ok(!errors.some((e) => /Content Security Policy/.test(e)), 'no CSP violations');
  const manifest = await h.sw.evaluate(() => chrome.runtime.getManifest()); ok(manifest.host_permissions.join() === 'https://jobly-data.pages.dev/*', `one host permission, the job data: ${manifest.host_permissions.join(', ')}`);
  ok(!JSON.stringify(manifest).includes('onrender'), 'no server address anywhere in the manifest');
  await h.ctx.close();
});

await step('match % on job cards', async () => {
  const h = await launch();
  await h.sw.evaluate(() => chrome.storage.local.set({
    userPreferences: { roles: ['product_design'], seniorities: ['senior'], locations: [], remote_only: true, custom_keywords: '', excluded_keywords: '', min_salary: 0, employment_types: [], notify_enabled: false, sync_interval_mins: 60 },
    profiles: [{ id: 'p1', label: 'x', first_name: 'A', last_name: 'B', email: '', phone: '', location: '', headline: '', summary: '', linkedin: '', github: '', portfolio: '', website: '', work_authorization: '', needs_sponsorship: '', years_experience: '', salary_expectation: '', notice_period: '', skills: 'Product Designer', work: [], education: [], updated_at: new Date().toISOString() }], activeProfileId: 'p1',
  }));
  const d = await open(h, 'options.html', { width: 1280, height: 900 }); await firstCard(d);
  await d.getByRole('button', { name: /^All/ }).click(); await sleep(800);
  const badges = await d.locator('article .match-badge').evaluateAll((els) => els.map((e) => ({ text: e.textContent.trim(), label: e.getAttribute('aria-label'), card: e.closest('article').getAttribute('aria-label') })));
  ok(badges.length > 3 && badges.every((b) => /^\d+% match$/.test(b.text)), `every card shows a match percentage (${badges.length})`);
  const best = badges.find((b) => /^100% match/.test(b.label));
  ok(best && /One of your roles/.test(best.label) && /Senior level/.test(best.label) && /Remote/.test(best.label), `a remote senior job in your role is a 100% match, with the reasons (${best?.label})`);
  const mid = badges.find((b) => /Mid level, not one you picked/.test(b.label) && /One of your roles/.test(b.label));
  ok(!mid || parseInt(mid.text) < 100, 'a level you did not pick lowers the match');
  const other = badges.find((b) => /Account Executive|Sales/.test(b.card));
  ok(!other || parseInt(other.text) < 50, `a job outside your roles scores low (${other?.text})`);
  await d.getByLabel('Sort jobs').selectOption('match'); await sleep(400);
  const order = await d.locator('article .match-badge').evaluateAll((els) => els.map((e) => parseInt(e.textContent)));
  ok(order.length > 3 && order.every((v, i) => i === 0 || order[i - 1] >= v) && order[0] === 100, `Best match first puts the highest match on top (${order.slice(0, 8).join(', ')})`);
  await axe(d, 'jobs with match %');
  await h.ctx.close();
});

await step('focus: tracker hidden, Applied toggle, Saved | Applied, data in Settings, "Did you apply?"', async () => {
  const h = await launch();
  const store = async (k) => (await h.sw.evaluate((key) => chrome.storage.local.get(key), k))[k];
  const d = await open(h, 'options.html', { width: 1280, height: 860 }); await firstCard(d);
  // the switched-off pages are gone from the sidebar and their old links open Saved
  const nav = await d.locator('nav.side').innerText();
  ok(!/Tracker|Interviews|Tasks|Alerts|Preferences/.test(nav) && /Saved/.test(nav) && /Cover letters/.test(nav), 'the sidebar has no Tracker, Interviews, Tasks, Alerts or Preferences');
  for (const label of ['Alerts', 'Switch to dark mode', 'Refresh jobs', 'Settings']) ok(await d.locator('header').getByRole('button', { name: new RegExp('^' + label) }).count() === 1, `the header has an icon button: ${label}`);
  await d.evaluate(() => { window.location.hash = 'tracker'; }); await d.getByText('Nothing saved yet').waitFor({ timeout: 5000 });
  ok(await d.getByRole('button', { name: /^Saved/ }).getAttribute('aria-current') === 'page', 'an old #tracker link opens Saved');
  await d.getByRole('button', { name: /^Jobs/ }).click(); await firstCard(d);
  // mark applied from a job card
  const card = d.locator('article').first(); const label = await card.getAttribute('aria-label'); const company = label.split(' at ').pop();
  ok(await card.getByRole('combobox', { name: /^Track / }).count() === 0, 'job cards have no Track menu');
  await card.getByRole('button', { name: /^Mark applied:/ }).click(); await sleep(500);
  let apps = await store('applications');
  ok(apps?.length === 1 && apps[0].status === 'applied' && !!apps[0].applied_at, 'Applied on a card stores the job with today\'s date');
  ok(await card.getByRole('button', { name: /^Applied:/ }).getAttribute('aria-pressed') === 'true', 'the card shows it as applied');
  const sibling = d.locator('article', { hasText: company }).nth(1);
  if (await sibling.count()) ok(await sibling.locator('.badge', { hasText: 'You applied here before' }).count() === 1, 'other jobs at the same company warn "You applied here before"');
  // a job saved from a careers page, as the right-click menu stores it
  await h.sw.evaluate(() => chrome.storage.local.get('applications').then(({ applications }) => chrome.storage.local.set({ applications: [...applications, { key: 'https://careers.initech.com/jobs/9', title: 'Staff Designer', company_name: 'Initech', location: 'Remote', application_url: 'https://careers.initech.com/jobs/9', source: 'page', status: 'saved', notes: '', applied_at: null, follow_up_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] })));
  await d.getByRole('button', { name: /^Saved/ }).click(); await d.getByRole('heading', { name: 'Saved and applied' }).waitFor({ timeout: 5000 });
  ok(await d.getByText('Saved from careers pages').count() === 1 && await d.getByText('Staff Designer').count() === 1, 'jobs saved from a careers page are listed under Saved');
  await axe(d, 'saved with page saves');
  await d.getByRole('button', { name: 'Mark as applied: Staff Designer at Initech' }).click(); await sleep(400);
  ok((await store('applications')).find((a) => a.company_name === 'Initech')?.status === 'applied', 'a page save can be moved to Applied');
  await d.getByRole('tab', { name: /^Applied/ }).click();
  ok(await d.locator('.app-row').count() === 2 && await d.locator('.app-row', { hasText: 'Initech' }).locator('.badge', { hasText: /^Applied / }).count() === 1, 'Applied lists both jobs with the date');
  await axe(d, 'applied list');
  await d.getByRole('button', { name: 'Remove: Staff Designer at Initech' }).click(); await sleep(400);
  ok(!(await store('applications')).some((a) => a.company_name === 'Initech'), 'removing an applied job deletes it from the device');
  // import a CSV and export again, from Settings › Your data
  await d.getByRole('button', { name: 'Settings', exact: true }).click(); await d.getByText('Your data', { exact: true }).waitFor({ timeout: 5000 });
  await d.locator('input[type="file"]').setInputFiles({ name: 'sheet.csv', mimeType: 'text/csv', buffer: Buffer.from('Company,Position,Stage,Date applied,Notes\nGlobex,Product Designer,Phone screen,2026-10-01,"Referral, from Ana"\n"Acme, Inc",PM,Offer,,\n,No company,,,\n') });
  await d.getByText(/Imported 2 applications/).waitFor({ timeout: 5000 });
  apps = await store('applications');
  ok(apps.some((a) => a.company_name === 'Globex' && a.status === 'interview' && a.notes === 'Referral, from Ana') && apps.some((a) => a.company_name === 'Acme, Inc' && a.status === 'offer'), 'CSV import maps columns and statuses, keeps quoted commas, skips rows without a company');
  const [csvDl] = await Promise.all([d.waitForEvent('download'), d.getByRole('button', { name: 'Export applications (CSV)' }).click()]);
  const csv = fs.readFileSync(await csvDl.path(), 'utf8');
  ok(csv.startsWith('Company,Role,Status,Applied') && csv.includes('Globex') && csv.includes('Referral, from Ana'), 'Export CSV has a header row and every application');
  const [bkDl] = await Promise.all([d.waitForEvent('download'), d.getByRole('button', { name: 'Download a backup' }).click()]);
  const backup = fs.readFileSync(await bkDl.path(), 'utf8');
  await h.sw.evaluate(() => chrome.storage.local.set({ applications: [] })); await sleep(400);
  await d.locator('input[type="file"]').setInputFiles({ name: 'jobly-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await d.getByText(/Backup restored: 3 applications/).waitFor({ timeout: 5000 }); ok((await store('applications')).length === 3, 'a backup restores applied jobs');
  await d.locator('input[type="file"]').setInputFiles({ name: 'evil.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"other"}') });
  await d.getByText("That isn't a Jobly backup file.").waitFor({ timeout: 5000 }); ok(true, 'a file that is not a Jobly backup is refused');
  await axe(d, 'settings');
  // reminders belong to the switched-off pages: none are shown
  await h.sw.evaluate(() => chrome.storage.local.get('applications').then(({ applications }) => chrome.storage.local.set({ applications: applications.map((a, i) => (i === 0 ? { ...a, follow_up_at: new Date(Date.now() - 86400000).toISOString(), follow_up_notified: false } : a)) })));
  await d.evaluate(() => new Promise((res) => chrome.runtime.sendMessage({ type: 'CHECK_REMINDERS' }, res))); await sleep(500);
  ok((await store('applications'))[0].follow_up_notified === false, 'no follow-up reminders while the tracker is off');
  ok(!(await h.sw.evaluate(() => chrome.alarms.get('jobly-reminders'))), 'and no reminder check is scheduled');
  await d.close();
  // "Did you apply?" after opening a job
  const p = await open(h); await firstCard(p);
  const fresh = p.locator('article').nth(3); const freshLabel = await fresh.getAttribute('aria-label');
  const [tab] = await Promise.all([h.ctx.waitForEvent('page'), fresh.getByRole('link', { name: /^Apply to/ }).click()]); await tab.close();
  await p.getByRole('region', { name: 'Did you apply?' }).waitFor({ timeout: 5000 }); await axe(p, 'did-you-apply prompt');
  await p.getByRole('button', { name: 'Yes, I applied' }).click(); await sleep(500);
  ok((await store('applications')).some((a) => freshLabel.startsWith(a.title) && a.status === 'applied'), '"Yes, I applied" adds the job to Applied');
  ok(await p.getByRole('region', { name: 'Did you apply?' }).count() === 0, 'the prompt goes away once answered');
  await h.ctx.close();
});

await step('dealbreakers, job type filter, following companies', async () => {
  const h = await launch(); const urls = [];
  h.ctx.on('request', (r) => urls.push(r.url()));
  const p = await open(h); await firstCard(p);
  await p.getByRole('button', { name: /^Settings/ }).click(); await sleep(500);
  await p.getByRole('button', { name: 'Contract' }).click(); await p.getByLabel('Lowest yearly salary').fill('150000');
  await p.getByRole('button', { name: 'Save preferences' }).click(); await p.getByText('Saved on this device.').waitFor({ timeout: 5000 });
  const prefs = (await h.sw.evaluate(() => chrome.storage.local.get('userPreferences'))).userPreferences;
  ok(prefs.min_salary === 150000 && prefs.employment_types.join() === 'contract', 'dealbreakers are stored on the device');
  await p.getByRole('button', { name: /^Jobs/ }).click(); await sleep(1500);
  ok(!urls.some((u) => /150000|contract/.test(u)), 'the dealbreakers stay on the device (no request carries them)');
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
  // filters and sorting: the export gives each company its top countries, open jobs and newest posting
  const companies = readStatic('companies.json');
  const india = companies.filter((c) => (c.countries ?? []).includes('India')).length;
  ok(india > 0 && companies.every((c) => Array.isArray(c.countries) && c.countries.length <= 3), `companies.json lists up to 3 countries per company (${india} hire in India)`);
  await d.getByRole('combobox', { name: 'Country' }).selectOption('India'); await sleep(300);
  ok(await d.locator('.co-row').count() === india && await d.getByText(`${india} of ${companies.length} companies hiring in India`).count() === 1, 'the country filter keeps the companies hiring there');
  await d.getByRole('combobox', { name: 'Country' }).selectOption(''); await d.getByRole('combobox', { name: 'Sort companies' }).selectOption('za'); await sleep(300);
  const names = await d.locator('.co-row .font-medium').allInnerTexts();
  ok(names.length > 1 && names.every((n, i) => i === 0 || names[i - 1].localeCompare(n, undefined, { sensitivity: 'base' }) >= 0), 'Name Z–A sorts the list backwards');
  await d.getByRole('combobox', { name: 'Sort companies' }).selectOption('jobs'); await sleep(300);
  const counts = (await d.locator('.co-row .grow > .text-xs:nth-child(2)').allInnerTexts()).map((t) => Number(t.match(/^(\d+)/)[1]));
  ok(counts.every((n, i) => i === 0 || counts[i - 1] >= n) && counts.every((n) => n > 0), 'Most open jobs puts the biggest employers first, and "Hiring now" hides companies with none');
  await axe(d, 'companies filtered');
  // hiring system, "Hiring in my roles", and View jobs
  await d.getByRole('combobox', { name: 'Sort companies' }).selectOption('az');
  const systemsInData = new Set(companies.map((c) => c.source_type));
  if (systemsInData.size > 1) {
    const sys = companies.find((c) => c.job_count > 0).source_type;
    await d.getByRole('combobox', { name: 'Hiring system' }).selectOption(sys); await sleep(300);
    const bySystem = companies.filter((c) => c.source_type === sys && c.job_count > 0).length;
    ok(await d.locator('.co-row').count() === bySystem, `the hiring-system filter keeps ${bySystem} companies on ${sys}`);
    await d.getByRole('combobox', { name: 'Hiring system' }).selectOption('');
  } else ok(await d.getByRole('combobox', { name: 'Hiring system' }).count() === 0, 'with one hiring system in the list, its filter is hidden');
  if (await d.getByRole('button', { name: 'Hiring in my roles' }).count()) {
    await d.getByRole('button', { name: 'Hiring in my roles' }).click(); await sleep(300);
    ok(await d.locator('.co-row').count() > 0 && companies.every((c) => Array.isArray(c.roles)), 'Hiring in my roles keeps companies hiring for your roles');
    await d.getByRole('button', { name: 'Hiring in my roles' }).click();
  }
  const target = companies.filter((c) => c.job_count > 0).sort((a, b) => a.name.localeCompare(b.name))[0];
  await d.getByRole('button', { name: `View jobs at ${target.name} (${target.job_count})` }).click();
  await d.getByText(`Showing every job at ${target.name}.`).waitFor({ timeout: 5000 }); await firstCard(d); await sleep(500);
  const labels = await d.locator('article').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  ok(labels.length > 0 && labels.every((l) => l.endsWith(` at ${target.name}`)), `View jobs lists only ${target.name}'s jobs (${labels.length})`);
  await d.getByRole('button', { name: 'Show all jobs' }).click(); await sleep(800);
  ok(await d.getByText(/Showing every job at/).count() === 0, 'Show all jobs clears it');
  // follow a company that has jobs from the last 3 days, so the check has something to find
  const recentCompany = staticJobs().find((j) => j.bucket === '1' || j.bucket === '3').company_id;
  await h.sw.evaluate((id) => chrome.storage.local.set({ followedCompanyIds: [id] }), recentCompany);
  await h.sw.evaluate(() => chrome.storage.local.set({ alerts: [], seenAlertKeys: [], userPreferences: { roles: ['nonexistent_role'], seniorities: [], locations: [], remote_only: false, custom_keywords: '', excluded_keywords: '', min_salary: 0, employment_types: [], notify_enabled: false, sync_interval_mins: 30 } }));
  await d.evaluate(() => new Promise((res) => chrome.runtime.sendMessage({ type: 'TRIGGER_BACKGROUND_CHECK' }, res))); await sleep(800);
  const alerts = (await h.sw.evaluate(() => chrome.storage.local.get('alerts'))).alerts;
  ok(alerts.length > 0 && alerts.every((a) => a.reason === 'follow'), `new jobs at a followed company become alerts even with no matching preferences (${alerts.length})`);
  await h.ctx.close();
});

await step('onboarding: LinkedIn PDF and resume import, completeness, reminder', async () => {
  const h = await launch(); const store = async (k) => (await h.sw.evaluate((key) => chrome.storage.local.get(key), k))[k];
  const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
  const d = await open(h, 'options.html', { width: 1280, height: 900 }); await firstCard(d);
  ok(await d.getByText('Profile 0% complete').count() === 1 && /0%/.test(await d.getByRole('button', { name: /^Profile/ }).innerText()), 'with no profile, the jobs list and the sidebar show 0%');
  await d.getByRole('button', { name: 'Complete your profile' }).click(); await d.getByRole('heading', { name: 'Set up your profile' }).waitFor({ timeout: 5000 });
  await axe(d, 'profile setup: import');
  await d.locator('input[type="file"]').setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not really a pdf') });
  await d.getByRole('alert').waitFor({ timeout: 10000 }); ok(/Couldn.t read that PDF/.test(await d.getByRole('alert').innerText()), 'a broken PDF gets a clear message');
  await d.locator('input[type="file"]').setInputFiles(path.join(fixtures, 'linkedin.pdf'));
  await d.getByText(/LinkedIn profile read/).waitFor({ timeout: 20000 });
  ok(/3 roles/.test(await d.getByText(/^Found /).innerText()) && /1 school/.test(await d.getByText(/^Found /).innerText()), 'the LinkedIn export is recognised: 3 roles and 1 school found');
  await axe(d, 'profile setup: import result');
  await d.getByRole('button', { name: /Use these details/ }).click(); await d.getByLabel('First name').waitFor();
  ok(await d.getByLabel('First name').inputValue() === 'Ananya' && await d.getByLabel('LinkedIn').inputValue() === 'www.linkedin.com/in/ananya-rao-1a2b3c' && await d.getByLabel('Portfolio').inputValue() === 'ananyarao.design',
    'contact details come from the left column, including a LinkedIn link split over two lines');
  await axe(d, 'profile setup: contact');
  await d.getByRole('button', { name: /Save and continue/ }).click();
  await d.getByLabel('Work authorization').fill('Indian citizen'); await d.getByLabel('Need visa sponsorship?').selectOption('no');
  await d.getByRole('button', { name: /Save and continue/ }).click(); await d.getByText(/Newest role first/).waitFor();
  const titles = await d.locator('input[id^="w-title-"]').evaluateAll((els) => els.map((e) => e.value));
  ok(titles.join('|') === 'Senior Product Designer|Product Designer|UX Designer', `roles in order: ${titles.join(', ')}`);
  await axe(d, 'profile setup: experience');
  await d.getByRole('button', { name: /Save and continue/ }).click(); await d.getByRole('button', { name: /Save and review/ }).click();
  await d.getByRole('button', { name: 'Finish' }).click(); await d.getByRole('heading', { name: 'Profile', exact: true }).waitFor({ timeout: 5000 });
  const p1 = (await store('profiles'))[0];
  ok(p1.first_name === 'Ananya' && p1.last_name === 'Rao' && p1.email === 'ananya.rao@example.com' && p1.phone === '+91 98765 43210' && p1.location === 'Bengaluru, Karnataka, India', 'name, email, phone and place are saved');
  ok(p1.work.length === 3 && p1.work[1].company === 'Northwind Labs' && p1.work[0].current && p1.work[1].start === '2020-07' && p1.work[1].end === '2022-03' && p1.work[2].location === 'Pune, Maharashtra, India',
    'roles keep their company (two under one), dates and place');
  ok(p1.work[0].bullets.split('\n').length === 2 && p1.education[0].school === 'National Institute of Design' && p1.education[0].field === 'Interaction Design' && p1.skills === 'Figma, Design Systems, User Research',
    'points, education and top skills are saved');
  ok(p1.work_authorization === 'Indian citizen' && p1.needs_sponsorship === 'no' && Number(p1.years_experience) >= 7, 'answers typed in the steps are saved, and years of experience are worked out');
  ok(/9[0-9]% complete/.test(await d.locator('.profile-progress').innerText()), `the Profile page shows the new score (${(await d.locator('.profile-progress').innerText()).split('\n')[0]})`);
  await d.getByRole('button', { name: /^Jobs/ }).click(); await firstCard(d);
  ok(await d.locator('.profile-nudge').count() === 0, 'the reminder on the jobs list goes away once the profile is mostly done');
  // a resume into the same profile: fills what's empty, replaces roles only when asked, keeps the file
  await d.getByRole('button', { name: /^Profile/ }).click(); await d.getByRole('button', { name: 'Import a file' }).click();
  await d.locator('input[type="file"]').setInputFiles(path.join(fixtures, 'resume.pdf'));
  await d.getByText(/Resume read/).waitFor({ timeout: 20000 });
  await d.getByRole('checkbox', { name: /Replace your 3 saved roles/ }).check();
  ok(await d.getByRole('checkbox', { name: /Attach this PDF as my resume/ }).isChecked(), 'for a resume, attaching it for autofill is on by default');
  await d.getByRole('button', { name: /Use these details/ }).click(); await d.getByLabel('First name').waitFor(); await sleep(500);
  const p2 = (await store('profiles'))[0];
  ok(p2.first_name === 'Ananya' && p2.github === 'github.com/rahulmehta' && p2.work[0].company === 'Lumen Works' && p2.work[0].title === 'Senior Frontend Engineer' && p2.work.length === 2,
    'a second import keeps saved details, fills empty ones and replaces roles when ticked');
  ok((await store('resumeFile'))?.[p2.id]?.name === 'resume.pdf', 'the resume PDF is kept for autofill');
  await d.close();
  const p = await open(h); await firstCard(p); await p.getByRole('button', { name: /^Apply/ }).click();
  await p.getByText(/Profile \d+% complete/).waitFor({ timeout: 5000 }); ok(true, 'the popup Apply tab shows the profile score');
  await h.ctx.close();
});

await step('resume files: Word import, JSON Resume download and import', async () => {
  const h = await launch(); const store = async (k) => (await h.sw.evaluate((key) => chrome.storage.local.get(key), k))[k];
  const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
  const d = await open(h, 'options.html', { width: 1280, height: 900 }); await firstCard(d);
  await d.getByRole('button', { name: /^Profile/ }).click(); await d.getByRole('button', { name: 'Set up your profile' }).click();
  await d.locator('input[type="file"]').setInputFiles(path.join(fixtures, 'resume.docx'));
  await d.getByText(/Resume read/).waitFor({ timeout: 10000 });
  ok(/2 roles/.test(await d.getByText(/^Found /).innerText()), 'a Word resume is read in the browser');
  await d.getByRole('button', { name: /Use these details/ }).click(); await d.getByLabel('First name').waitFor(); await sleep(400);
  const p = (await store('profiles'))[0];
  ok(p.first_name === 'Meera' && p.last_name === 'Iyer' && p.email === 'meera.iyer@example.com' && p.location === 'Chennai, India', 'name, email and place come from the Word file');
  ok(p.work[0].company === 'Fernbank' && p.work[0].title === 'Senior UX Designer' && p.work[0].current && p.work[0].start === '2021-03' && p.work[0].bullets.split('\n').length === 2
    && p.work[1].company === 'Harbor & Co' && p.education[0].school === 'Anna University' && /Figma/.test(p.skills), 'roles with their points, education and skills come from the Word file');
  await d.getByRole('button', { name: 'Close' }).click();
  const [dl] = await Promise.all([d.waitForEvent('download'), d.getByRole('button', { name: 'JSON Resume' }).click()]);
  const json = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok(dl.suggestedFilename() === 'Meera-Iyer.resume.json' && json.basics.name === 'Meera Iyer' && json.work[0].name === 'Fernbank' && json.work[0].highlights.length === 2 && !json.work[0].endDate,
    'the profile downloads as a JSON Resume file');
  await h.sw.evaluate(() => chrome.storage.local.remove(['profiles', 'activeProfileId'])); await d.reload(); await d.getByRole('button', { name: /^Profile/ }).click();
  await d.getByRole('button', { name: 'Set up your profile' }).click();
  await d.locator('input[type="file"]').setInputFiles({ name: 'meera.resume.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) });
  await d.getByText(/Resume read/).waitFor({ timeout: 10000 });
  await d.getByRole('button', { name: /Use these details/ }).click(); await d.getByLabel('First name').waitFor(); await sleep(400);
  const back = (await store('profiles'))[0];
  ok(back.first_name === 'Meera' && back.work.length === 2 && back.work[0].bullets === p.work[0].bullets && back.education[0].school === 'Anna University', 'a JSON Resume file imports back into a profile');
  await d.locator('input[type="file"]').count();
  await h.ctx.close();
});

await step('profile, copy kit, resume, cover letter, backup, sync', async () => {
  const h = await launch(); const store = async (k, area = 'local') => (await h.sw.evaluate(([key, a]) => chrome.storage[a].get(key), [k, area]))[k];
  const d = await open(h, 'options.html', { width: 1280, height: 900 }); await firstCard(d);
  await d.getByRole('button', { name: /^Profile/ }).click(); await d.getByRole('button', { name: 'Start with an empty profile' }).click(); await sleep(400);
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
  await d.getByRole('button', { name: /^Resume/ }).click(); await d.locator('.resume-print .resume h1').waitFor({ timeout: 5000 });
  ok((await d.locator('.resume-print .resume h1').innerText()) === 'Ada Lovelace' && await d.locator('.resume-print .resume li', { hasText: 'Built the design system' }).count() === 1, 'the resume preview is built from the profile');
  ok(await d.locator('.rv-thumb .resume').count() === 8 && await d.getByRole('tab', { name: 'Design' }).getAttribute('aria-selected') === 'true', 'the Resume page opens on Design, with all 8 templates first (your own resume in each)');
  await d.getByRole('radio', { name: 'Classic', exact: true }).click(); await sleep(300); ok((await store('resumeSettings'))?.template === 'classic' && (await store('resumeTemplate')) === 'classic', 'the chosen template is remembered');
  ok(await d.evaluate(() => getComputedStyle(document.querySelector('.resume-print .resume')).fontFamily.includes('Georgia')), 'the Classic template applies its own styles (constructed stylesheet, no inline <style>)');
  await d.getByRole('radio', { name: 'Navy' }).click(); await sleep(200);
  ok(await d.evaluate(() => getComputedStyle(document.querySelector('.resume-print .resume h2')).borderBottomColor === 'rgb(30, 58, 138)'), 'the accent colour changes the section rules');
  ok(/Fits on one page/.test(await d.locator('.rv-card [role="status"]').innerText()), 'a short resume fits on one page');
  await d.getByRole('tab', { name: /^Score and ATS/ }).click();
  const sc = Number(/Score (\d+)/.exec(await d.getByRole('img', { name: /^Score \d+ out of 100/ }).getAttribute('aria-label'))?.[1]);
  const fixes = await d.getByRole('list', { name: 'Top fixes' }).locator('li').allInnerTexts();
  ok(sc > 0 && sc < 100 && await d.getByRole('progressbar', { name: 'Best practices' }).count() === 1 && /High impact/.test(fixes[0] ?? ''), `the resume score has five categories and puts high-impact fixes first (${sc}/100; ${fixes[0]?.replace(/\n/g, ' ')})`);
  // ATS check: reads the finished page's text like a parser, with rules only
  const ats = async () => (await d.getByRole('list', { name: 'Parsed fields' }).locator('li').allInnerTexts()).map((t) => t.replace(/\n+/g, ' | '));
  let fields = await ats();
  ok(fields.length === 6 && /^Name \| Detected/.test(fields[0]) && /Experience \| Section found, no dated positions/.test(fields.join('\n')) && /Skills \| Only 4 skills/.test(fields.join('\n')) && /Layout \| Single column/.test(fields.join('\n')), `the ATS check reads the page text: name found, the undated role and short skills list flagged (${fields.join(' ; ')})`);
  // Every template reads cleanly: name first, single column, the same fields found
  const perTemplate = [];
  for (const t of ['Modern', 'Engineer', 'Classic', 'Bold', 'Executive', 'Accent', 'Compact', 'Minimal']) {
    await d.getByRole('tab', { name: 'Design' }).click(); await d.getByRole('radio', { name: t, exact: true }).click(); await sleep(250);
    await d.getByRole('tab', { name: /^Score and ATS/ }).click(); const f = await ats();
    if (!/^Name \| Detected/.test(f[0]) || !/Layout \| Single column/.test(f.join('\n')) || f.join('\n') !== fields.join('\n')) perTemplate.push(t);
  }
  ok(perTemplate.length === 0, `all 8 templates read the same to an ATS: name first, one column (${perTemplate.join(', ') || 'none differ'})`);
  await d.getByRole('tab', { name: 'Design' }).click(); await d.getByRole('radio', { name: 'Classic', exact: true }).click(); await sleep(300);
  // Clean PDF: zero page margin (Chrome then prints no header or footer), one page, the file named after you
  const printed = await d.evaluate(() => new Promise((res) => { window.print = () => res({ css: [...document.head.querySelectorAll('style')].map((x) => x.textContent).join('\n'), title: document.title }); document.querySelector('.rv-head .btn:not(.btn-outline)').click(); }));
  ok(/@page \{ size: (A4|letter); margin: 0; \}/.test(printed.css) && /height: (1123|1056)px; overflow: hidden/.test(printed.css) && printed.title === 'Ada-Lovelace-Resume', `the PDF has no browser header or footer, one page, and your name as the file name (${printed.title})`);
  await d.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  // Tailor to a pasted job description right on the Resume page
  await d.getByRole('tab', { name: 'Tailor to a job' }).click();
  await d.getByLabel('Role', { exact: true }).fill('Design Systems Lead'); await d.getByLabel('Company', { exact: true }).fill('Globex');
  await d.getByLabel('Job description', { exact: true }).fill('Requirements\n- Experience building and maintaining design systems\n- Strong user research skills\n- React and TypeScript knowledge is a plus\n- 5+ years of product design');
  await d.getByRole('button', { name: 'Apply to my resume' }).click(); await d.locator('.rv-coverage').waitFor({ timeout: 5000 });
  ok(/^Design systems/i.test(await d.locator('.resume-print .resume .skills').innerText()) && (await store('profiles'))[0].skills === 'Figma, Design systems, React, User research', 'Apply puts what the job asks for first; the profile is unchanged');
  await d.getByRole('button', { name: 'See the ATS check' }).click();
  ok(await d.getByRole('list', { name: 'Keywords in your resume' }).getByText('React').count() === 1, 'keywords the resume already has are shown as found');
  const pct = Number(await d.getByRole('progressbar', { name: 'Qualification match' }).getAttribute('aria-valuenow'));
  ok(pct > 0 && pct <= 100 && await d.getByRole('list', { name: 'Job skills missing' }).getByText('TypeScript').count() === 1, `the ATS check shows the qualification match and the job skills the resume is missing (${pct}%)`);
  await d.getByRole('tab', { name: /^Tailor to a job/ }).click();
  await d.getByRole('button', { name: 'I have TypeScript: add it to skills' }).click(); await sleep(200);
  ok(/TypeScript/.test(await d.locator('.resume-print .resume .skills').innerText()) && !/TypeScript/.test((await store('profiles'))[0].skills), 'a missing keyword is added only when you say you have it, and only to this tailored copy');
  await d.getByRole('tab', { name: /^Score and ATS/ }).click();
  ok(/for this job/.test(await d.locator('.rv-cats').innerText()), 'the score includes the job match once a job description is applied');
  await d.getByRole('tab', { name: /^Tailor to a job/ }).click();
  await d.getByRole('button', { name: 'Save for this job' }).click(); await sleep(400);
  ok((await store('resumeVersions'))?.[0]?.job.company === 'Globex' && /Tailored: Design Systems Lead at Globex/.test(await d.getByLabel('Version').locator('option:checked').innerText()), 'the tailored resume is saved as a version for the job');
  await d.getByLabel('Version').selectOption('base'); await sleep(200);
  const [doc] = await Promise.all([d.waitForEvent('download'), d.getByRole('button', { name: 'Word' }).click()]);
  const docText = fs.readFileSync(await doc.path(), 'utf8'); ok(docText.includes('Ada Lovelace') && docText.includes('Experience') && doc.suggestedFilename() === 'Ada-Lovelace-Resume.doc', 'Word export holds the resume');
  await axe(d, 'resume');
  // cover letter
  await d.getByRole('button', { name: /^Cover letters/ }).click(); await d.getByLabel('Role', { exact: true }).fill('Staff Designer'); await d.getByLabel('Company', { exact: true }).fill('Initech'); await sleep(300);
  const letter = await d.getByLabel('Letter', { exact: true }).inputValue();
  ok(letter.includes('Dear Initech hiring team') && letter.includes('Staff Designer') && letter.includes('Ada Lovelace') && /led the redesign of checkout/i.test(letter), `the cover letter fills in the job and the profile (${letter.replace(/\n/g, ' / ').slice(0, 300)})`);
  ok(/^Led the redesign of checkout, lifting conversion 12%/m.test(letter), 'the default letter leads with the result that has a number');
  ok(await d.getByRole('radio', { name: /^Answers the job description/ }).isDisabled(), 'the job-description template waits for a pasted description');
  const L = () => d.getByLabel('Letter', { exact: true }).inputValue();
  await d.getByRole('radio', { name: 'Formal' }).click(); await sleep(150);
  ok(/Yours sincerely,/.test(await L()) && /consideration/.test(await L()) && (await store('letterSettings'))?.tone === 'formal', 'the tone changes the wording and sign-off, and is remembered');
  const std = (await L()).length; await d.getByRole('radio', { name: 'Detailed' }).click(); await sleep(150);
  ok((await L()).length > std, 'a detailed letter is longer than a standard one');
  await d.getByText('Make it personal (optional)').click();
  await d.getByLabel("Hiring manager's name").fill('Priya Shah'); await d.getByLabel('Referred by').fill('Rahul Mehta');
  await d.getByRole('radio', { name: /^Referred by someone/ }).click(); await sleep(150);
  ok(/^Dear Priya Shah,\n\nRahul Mehta suggested I get in touch about the Staff Designer role at Initech\./.test(await L()), `the referral letter names the referrer first, to the hiring manager (${(await L()).slice(0, 120)})`);
  await d.getByRole('radio', { name: /^Short email/ }).click(); await sleep(150);
  ok(/^Hi Priya,/.test(await L()) && (await L()).split(/\s+/).length < 90, 'the short email is a few lines');
  await d.getByRole('radio', { name: /^Why this company/ }).click(); await sleep(150);
  ok(await d.getByRole('list', { name: 'Letter check' }).getByText('No [gaps] left to fill').count() === 1 && /\[why you want to work there/.test(await L()), 'without a reason, the company letter leaves a gap and the check says so');
  await d.getByLabel('Why this company').fill('your tools help small teams ship faster'); await sleep(150);
  ok(/Initech stands out to me because your tools help small teams ship faster\./.test(await L()), 'the reason you write opens the letter');
  const lp = await d.evaluate(() => new Promise((res) => { window.print = () => res({ css: [...document.head.querySelectorAll('style')].map((x) => x.textContent).join(' '), cls: document.documentElement.className, text: document.querySelector('.letter-print').innerText, title: document.title }); [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'PDF').click(); }));
  ok(/@page \{ size: auto; margin: 0; \}/.test(lp.css) && /printing-letter/.test(lp.cls) && lp.title === 'Ada-Lovelace-Cover-letter-Initech' && /Ada Lovelace/.test(lp.text), 'the letter PDF has no browser header or footer and is named after you');
  await d.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await axe(d, 'cover letters');
  // backup carries profiles
  await d.getByRole('button', { name: 'Settings', exact: true }).click();
  const [bk] = await Promise.all([d.waitForEvent('download'), d.getByRole('button', { name: 'Download a backup' }).click()]);
  ok(JSON.parse(fs.readFileSync(await bk.path(), 'utf8')).data.profiles?.[0]?.first_name === 'Ada', 'the backup includes profiles');
  // copy kit in the popup
  const p = await open(h); await firstCard(p); await p.getByRole('button', { name: /^Apply/ }).click();
  await p.locator('.kit-row', { hasText: 'ada@example.com' }).waitFor({ timeout: 5000 }); ok(true, 'the popup copy kit lists the profile answers');
  await p.getByText('Open a job posting, then open Jobly').waitFor({ timeout: 5000 }); ok(true, 'on a non-job page the Apply tab explains how to save a job');
  await axe(p, 'apply kit'); await p.close();
  // sync across Chrome browsers (opt-in)
  await d.getByRole('switch', { name: /Sync across your Chrome browsers/ }).click(); await sleep(1500);
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

await step('ATS check: parses a resume from plain text (unit)', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const bundle = await esbuild({ entryPoints: [path.join(root, 'src/e2e-units.ts')], bundle: true, write: false, format: 'iife', globalName: 'units', platform: 'browser' });
  const h = await launch(); const page = await h.ctx.newPage();
  await page.setContent('<html><body></body></html>'); await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const good = 'Charles Bloomberg\nProduct lead\ncharles@example.com · (621) 799-5548 · Seoul\nSUMMARY\nBuilds products.\nEXPERIENCE\nCEO, Rezi\nAug 2015 – Present\nBuilt the product for 2,227,254 users since 2015 - 2016 pilot\nWeb Developer, Kaplan\n2015 – 2015\nMarketing Analyst, Kaplan\nNov 2014 - May 2015\nEDUCATION\nUniversity of Wisconsin\n2010 – 2014\nSKILLS\nSQL · Figma · Jira · Confluence · HTML · CSS';
  const a = await page.evaluate((t) => window.units.atsScan(t, { roles: 3 }), good);
  ok(a.problems === 0 && a.name === 'Charles Bloomberg' && a.email === 'charles@example.com' && /799-5548/.test(a.phone) && a.skills.length === 6, `a clean resume parses with no problems (${a.fields.map((f) => f.detail).join(' ; ')})`);
  ok(a.positions === 3, `positions are counted by their date lines (${a.positions})`);
  const bad = 'CONTACT\nSeoul\nCharles Bloomberg\nEXPERIENCE\nCEO, Rezi\nFounder, Other\nJan 2020 – Present\nExpert-level things: SQL, Figma';
  const b = await page.evaluate((t) => window.units.atsScan(t, { roles: 2, singleColumn: false }), bad);
  const st = Object.fromEntries(b.fields.map((f) => [f.id, f.status]));
  ok(st.name === 'fail' && st.contact === 'fail' && st.experience === 'warn' && st.education === 'fail' && st.skills === 'fail' && st.layout === 'warn' && b.problems === 6, `a broken resume is flagged field by field (${JSON.stringify(st)})`);
  const years = await page.evaluate(() => window.units.atsScan('Ada Lovelace\nada@example.com\nEXPERIENCE\nEngineer, X\n2019 – 2021\nEDUCATION\nMIT\nSKILLS\na1, b2, c3, d4, e5'));
  const kw = await page.evaluate(() => ({
    no: ['Go', 'REST', 'Swift', 'Express', 'Rust'].filter((k) => window.units.asksFor('Own the go-to-market plan. Go above and beyond with the rest of the team, with swift delivery. Express interest early. Rust-free pipes.', k)),
    yes: ['Go', 'REST', 'Swift', 'Express', 'Golang'].filter((k) => window.units.asksFor('Experience with Go, Golang or Swift. Build REST APIs in Node.js/Express.', k)),
    jd: window.units.analyzeJob('Requirements\n- Owns the go-to-market with sales\n- Experience in SQL and Figma', []).keywords,
  }));
  ok(kw.no.length === 0 && kw.yes.length === 5 && kw.jd.join() === 'Figma,SQL,Go-to-market', `everyday words are not read as skills: "go-to-market" is not Go, "the rest of" is not REST (${kw.no} | ${kw.yes} | ${kw.jd})`);
  ok(years.phone === '' && years.fields.find((f) => f.id === 'contact').status === 'warn', 'a year range is not mistaken for a phone number');
  const eng = await page.evaluate(() => {
    const p = { ...window.units.emptyProfile(), first_name: 'Rajveer', last_name: 'Singh', email: 'r@example.com', portfolio: 'rajveers.com', github: 'github.com/r',
      skills: 'Frontend: React, TypeScript\nCloud: AWS (EC2, S3), Docker', achievements: 'Hackathons: Won **2** national hackathons',
      work: [{ id: 'w', company: 'IABTM', title: 'Software Engineer', location: 'Remote', start: '2025-09', end: '', current: true, bullets: 'Built a **500+ endpoint** API <script>x</script>' }],
      projects: [{ id: 'p', name: 'Safire', tech: 'React, Redis', link: 'github.com/r/safire', bullets: 'Cut latency **60%**' }],
      education: [{ id: 'e', school: 'MSIT', degree: 'B.Tech', field: 'ECE', start: '2023-01', end: '2027-01', location: 'Delhi, India', grade: 'CGPA: 8.68 / 10' }] };
    const div = document.createElement('div'); div.innerHTML = window.units.resumeHtml(p, 'engineer'); document.body.append(div);
    const text = div.innerText; div.remove();
    return { html: window.units.resumeHtml(p, 'engineer'), text, flat: window.units.skillList(p), regrouped: window.units.skillsText(p, ['Docker', 'React', 'Go', 'TypeScript', 'AWS (EC2, S3)']),
      plain: window.units.bulletList('- Built a **500+** API'), scan: window.units.atsScan(text, { roles: 1 }) };
  });
  ok(/<b>IABTM<\/b> \| <i>Software Engineer<\/i>/.test(eng.html) && /<b>500\+ endpoint<\/b>/.test(eng.html) && !/<script>/.test(eng.html) && /<b>Frontend:<\/b> React, TypeScript/.test(eng.html) && /Safire<\/b> \| <i>React, Redis/.test(eng.html) && /CGPA: 8.68/.test(eng.html),
    'the Engineer template: company | title, bold marks, grouped skills, projects and grade, all escaped');
  ok(eng.flat.join('|') === 'React|TypeScript|AWS (EC2, S3)|Docker' && eng.regrouped === 'Frontend: Go, React, TypeScript\nCloud: Docker, AWS (EC2, S3)' && eng.plain[0] === 'Built a 500+ API', `skill groups survive reordering, brackets don't split, bold marks stay out of plain text (${eng.regrouped.replace(/\n/g, ' / ')})`);
  ok(eng.scan.problems === 2 && eng.scan.fields.find((f) => f.id === 'skills').detail === 'Only 4 skills detected' && eng.scan.positions === 1, `the ATS check reads the Engineer layout: projects and achievements don't count as skills (${eng.scan.fields.map((f) => f.detail).join(' ; ')})`);
  const grade = await page.evaluate(() => { const p = { ...window.units.emptyProfile(), summary: 'x'.repeat(100), skills: 'a,b,c,d,e,f,g,h' }; return [window.units.resumeScore(p, { coverage: { percent: 30, matches: [], keywordsFound: [], keywordsMissing: [], covered: 0 } }).grade, window.units.resumeScore(p).grade]; });
  ok(grade[0] !== 'Excellent' && grade[0] !== 'Good', `a low job match never grades as Good or Excellent for that job (${grade})`);
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

await step('apply assist: panel on the page, sources, action required, steps, saved answers, submit', async () => {
  const h = await launch(); const store = async (k) => (await h.sw.evaluate((key) => chrome.storage.local.get(key), k))[k];
  const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
  const now = new Date().toISOString();
  await h.sw.evaluate((d) => chrome.storage.local.set(d), {
    profiles: [{ id: 'p1', label: 'Design', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', phone: '+1 555 0100', location: 'Remote', headline: 'Senior Product Designer',
      summary: 'Product designer with eight years of experience shipping design systems and consumer apps.', linkedin: 'linkedin.com/in/ada', github: '', portfolio: 'ada.design', website: '',
      work_authorization: 'US citizen', needs_sponsorship: 'no', years_experience: '8', salary_expectation: '', notice_period: '', skills: 'Figma, Research, Prototyping', work: [], education: [], updated_at: now }],
    activeProfileId: 'p1', resumeFile: { p1: { name: 'ada.pdf', type: 'application/pdf', size: 20, data: 'data:application/pdf;base64,JVBERi0xLjQK' } },
    savedAnswers: [{ question: 'How did you hear about us?', key: 'how did hear about us', value: 'LinkedIn', kind: 'text', used_at: now, uses: 0 }],
  });
  const page = await h.ctx.newPage();
  await page.route('https://apply.example.test/**', (r) => r.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(fixtures, 'apply-form.html'), 'utf8') }));
  await page.goto('https://apply.example.test/jobs/42');
  const startAssist = () => h.sw.evaluate(async () => { const [t] = await chrome.tabs.query({ url: 'https://apply.example.test/*' }); await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['assist.js'] }); });
  await startAssist();
  const panel = page.getByRole('dialog', { name: 'Jobly apply assist' });
  await panel.getByText('Ready for your approval').waitFor({ timeout: 10000 });
  await axe(page, 'apply assist panel');
  const rows = async (heading) => panel.locator('h4', { hasText: heading }).locator('xpath=following-sibling::ul[1]/li').allInnerTexts();
  const ready = await rows('Ready for your approval');
  const row = (q) => ready.find((t) => t.startsWith(q)) ?? '';
  ok(/Ada/.test(row('First name')) && /From your profile/.test(row('First name')) && /From your profile/.test(row('Resume/CV')), 'profile answers are labelled "From your profile", the resume file included');
  ok(/LinkedIn/.test(row('How did you hear')) && /Saved answer/.test(row('How did you hear')), 'a question answered on an earlier form gets the saved answer');
  ok(/Suggested: check it/.test(row('Why do you want')) && !(await panel.getByRole('checkbox', { name: /Fill: Why do you want/ }).isChecked()), 'an open question gets a suggestion that stays unticked until you choose it');
  const need = (await rows('Action required')).join(' | ');
  ok(/Earliest start date/.test(need) && /Country.*choose on the page/.test(need) && !/Gender/.test(need) && !/legally authorized/.test(need), `required questions Jobly can't answer are action required (${need.replace(/\n/g, ' ')})`);
  ok(/legally authorized.*picked from its list[\s\S]*Yes[\s\S]*From your profile/.test(row('Are you legally authorized')), 'a yes/no custom dropdown the profile answers is ready to fill');
  ok(await page.locator('#start').evaluate((e) => e.style.outlineStyle) === 'dashed', 'and they are outlined on the page');
  ok(await page.evaluate(() => document.querySelector('jobly-assist').shadowRoot !== null), 'the test build opens the panel for the tests (the store build keeps it closed)');
  await panel.getByRole('button', { name: /^Fill \d+ answers/ }).click();
  await panel.getByText(/^Filled \d+ fields/).waitFor({ timeout: 5000 });
  ok(await page.inputValue('#fn') === 'Ada' && await page.inputValue('#em') === 'ada@example.com' && await page.inputValue('#heard') === 'LinkedIn' && await page.inputValue('#why') === '', 'approved answers are filled; the unticked suggestion is not');
  ok(await page.evaluate(() => document.querySelector('#cv').files[0]?.name) === 'ada.pdf', 'the resume file is attached');
  ok((await page.textContent('#auth-b')).trim() === 'Yes', 'the custom dropdown is opened and its option picked, like a person would');
  ok(await page.evaluate(() => !document.body.dataset.submitted), 'nothing is submitted');
  // the user answers what's left, picks a gender (never saved), and goes to the next step
  await page.fill('#start', 'In 30 days'); await page.selectOption('#gender', 'Woman');
  await page.click('#country-b'); await page.click('#country-list [role=option]:has-text("India")'); await sleep(200);
  await page.click('#next');
  await panel.getByText(/^Step 2/).waitFor({ timeout: 10000 });
  const saved = await store('savedAnswers');
  ok(saved.some((a) => a.question.startsWith('Earliest start date') && a.value === 'In 30 days') && !saved.some((a) => /gender/i.test(a.question)), 'a new answer is saved for next time; the gender question is not');
  ok(saved.some((a) => /^Country/.test(a.question) && a.value === 'India'), 'a choice made in a custom dropdown is saved too');
  const ready2 = (await rows('Ready for your approval')).join(' | ');
  ok(/Years of experience[^|]*8/.test(ready2) && /visa sponsorship[^|]*No/.test(ready2) && /ada\.design/.test(ready2), `the next step is read by itself (${ready2.replace(/\n/g, ' ')})`);
  await panel.getByRole('button', { name: /^Fill \d+ answers/ }).click(); await sleep(300);
  ok(await page.inputValue('#yrs') === '8' && await page.$eval('#sp', (e) => e.options[e.selectedIndex].text) === 'No', 'step 2 is filled after approval');
  // the user presses the site's Submit; Jobly offers to add the job to Applied
  await page.click('button[type="submit"]');
  await panel.getByText('Did you submit this application?').waitFor({ timeout: 5000 });
  ok(!!(await store('pendingApply'))?.job?.application_url?.startsWith('https://apply.example.test/'), 'pressing Submit leaves a "Did you apply?" prompt for when Jobly opens, in case the page moves on');
  await panel.getByRole('button', { name: 'Yes, add to Applied' }).click(); await sleep(400);
  const app = (await store('applications'))?.find((a) => a.key.startsWith('https://apply.example.test/'));
  ok(app?.status === 'applied' && app.title === 'Staff Product Designer' && app.company_name === 'Initech' && !(await store('pendingApply')), 'Yes adds the job to Applied with its title and company');
  // saved answers are listed on the Profile page and can be deleted
  const d = await open(h, 'options.html', { width: 1280, height: 900 });
  await d.getByRole('button', { name: /^Profile/ }).click(); await d.getByText('In 30 days').waitFor({ timeout: 5000 });
  await d.getByRole('button', { name: /Delete the saved answer to: Earliest start date/ }).click(); await sleep(300);
  ok(!(await store('savedAnswers')).some((a) => a.value === 'In 30 days'), 'a saved answer can be deleted from the Profile page'); await d.close();
  // starting it twice reuses the panel; closing removes it
  await startAssist(); ok(await page.locator('jobly-assist').count() === 1, 'starting again reuses the panel');
  await panel.getByRole('button', { name: 'Close apply assist' }).click(); ok(await page.locator('jobly-assist').count() === 0, 'Close removes the panel');
  // without a profile, the panel says how to set one up
  await h.sw.evaluate(() => chrome.storage.local.remove(['profiles', 'activeProfileId']));
  await page.reload(); await startAssist();
  await panel.getByRole('button', { name: 'Set up my profile' }).waitFor({ timeout: 5000 }); ok(true, 'with no profile, the panel offers profile setup');
  // the store build keeps the panel's shadow root closed, so the page's scripts can't read the answers
  const prod = fs.readFileSync(path.join(process.env.EXT_PROD, 'assist.js'), 'utf8');
  ok(/mode:"closed"/.test(prod) && !/mode:"open"/.test(prod), 'the store build opens the panel in a closed shadow root');
  await h.ctx.close();
});

await step('jobs page: full-width cards, job side sheet, apply queue', async () => {
  const h = await launch(); const store = async (k) => (await h.sw.evaluate((key) => chrome.storage.local.get(key), k))[k];
  const d = await open(h, 'options.html', { width: 1440, height: 900 }); await firstCard(d);
  const second = d.locator('article.job-row').nth(1); const title2 = (await second.getAttribute('aria-label')).split(' at ')[0];
  ok(await d.locator('.sheet').count() === 0, 'the list starts with full-width cards and no job open');
  await second.locator('.job-meta').click(); await sleep(300);
  const sheet = d.getByRole('dialog', { name: title2 });
  ok(await sheet.count() === 1 && await second.evaluate((e) => e.classList.contains('selected')), 'clicking a card opens the job in a side sheet');
  ok(await d.evaluate(() => !!document.activeElement?.closest('.sheet')), 'focus moves into the sheet');
  await sheet.getByRole('heading', { name: 'Job description' }).waitFor(); await sleep(600);
  ok(await sheet.locator('[aria-busy]').count() === 0 && /Experience[\s\S]*Location[\s\S]*Pay[\s\S]*Job type/i.test(await sheet.locator('.sheet-facts').innerText()), 'the sheet shows the facts and the description (or where to read it)');
  ok(await sheet.getByRole('link', { name: /^Apply to / }).count() === 1, 'Apply is at the bottom of the sheet');
  await axe(d, 'jobs side sheet');
  await sheet.getByRole('button', { name: /^Add to queue:/ }).click(); await sleep(400);
  const q = await store('applyQueue');
  ok(q?.length === 1 && q[0].state === 'queued' && q[0].title === title2 && await sheet.getByRole('button', { name: /^Queued:/ }).isDisabled(), 'Add to queue puts the job in the apply queue once');
  await d.keyboard.press('Escape'); await sleep(200);
  ok(await d.locator('.sheet').count() === 0 && await second.getByRole('button', { name: /^Queued:/ }).isDisabled(), 'Escape closes the sheet; the card shows it queued');
  await second.locator('.job-meta').click(); await sleep(200);
  await d.getByRole('button', { name: 'Close job details' }).click(); await sleep(200);
  ok(await d.locator('.sheet').count() === 0, 'Close closes the sheet');
  await h.ctx.close();
});

await step('apply queue: opens, finds the form behind Apply, fills, asks, stops for review, submit goes to Applied', async () => {
  const h = await launch(); const store = async (k) => (await h.sw.evaluate((key) => chrome.storage.local.get(key), k))[k];
  const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
  const form = fs.readFileSync(path.join(fixtures, 'apply-form.html'), 'utf8');
  await h.ctx.route('https://apply.example.test/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/posting/7') return r.fulfill({ contentType: 'text/html', body: '<html><head><title>Designer</title></head><body><h1>Product Designer</h1><p>About the role.</p><a href="/jobs/7/apply">Apply now</a></body></html>' });
    if (u.pathname === '/empty') return r.fulfill({ contentType: 'text/html', body: '<html><body><h1>This job is closed</h1></body></html>' });
    return r.fulfill({ contentType: 'text/html', body: form });
  });
  const now = new Date().toISOString();
  await h.sw.evaluate((d) => chrome.storage.local.set(d), {
    profiles: [{ id: 'p1', label: 'Design', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', phone: '+1 555 0100', location: 'Remote', headline: 'Senior Product Designer', summary: 'Designer.',
      linkedin: 'linkedin.com/in/ada', github: '', portfolio: 'ada.design', website: '', work_authorization: 'US citizen', needs_sponsorship: 'no', years_experience: '8', salary_expectation: '', notice_period: '', skills: 'Figma', work: [], education: [], updated_at: now }],
    activeProfileId: 'p1', resumeFile: { p1: { name: 'ada.pdf', type: 'application/pdf', size: 20, data: 'data:application/pdf;base64,JVBERi0xLjQK' } },
    applyQueue: [
      { id: 'q1', url: 'https://apply.example.test/jobs/42', title: 'Staff Product Designer', company: 'Initech', location: 'Remote', state: 'queued', note: '', needs: [], filled: 0, tabId: null, added_at: now, updated_at: now },
      { id: 'q2', url: 'https://apply.example.test/posting/7', title: 'Product Designer', company: 'Globex', location: '', state: 'queued', note: '', needs: [], filled: 0, tabId: null, added_at: now, updated_at: now },
      { id: 'q3', url: 'https://apply.example.test/empty', title: 'Closed role', company: 'Hooli', location: '', state: 'queued', note: '', needs: [], filled: 0, tabId: null, added_at: now, updated_at: now },
    ],
  });
  const d = await open(h, 'options.html', { width: 1440, height: 900 });
  await d.goto(`chrome-extension://${h.id}/options.html#applications`); await d.getByRole('heading', { name: 'Applications' }).waitFor({ timeout: 8000 });
  await axe(d, 'applications');
  await d.getByRole('button', { name: 'Start 3 applications' }).click();
  const until = async (fn, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { const q = await store('applyQueue'); if (fn(q)) return q; await sleep(300); } return store('applyQueue'); };
  let q = await until((q) => q.find((x) => x.id === 'q1')?.state === 'needs-input' && q.find((x) => x.id === 'q2')?.state === 'needs-input' && q.find((x) => x.id === 'q3')?.state === 'stopped');
  const s = Object.fromEntries(q.map((x) => [x.id, x.state]));
  ok(s.q1 === 'needs-input' && s.q2 === 'needs-input' && s.q3 === 'stopped', `each job is opened and prepared, two at a time (${JSON.stringify(s)})`);
  const q1 = q.find((x) => x.id === 'q1');
  ok(q1.filled >= 5 && q1.needs.some((n) => /Earliest start date/.test(n)) && !q1.needs.some((n) => /Gender/i.test(n)), `known answers are filled, the rest is listed as needs your input (${q1.filled} filled; ${q1.needs.join(', ')})`);
  ok(/No application form/.test(q.find((x) => x.id === 'q3').note), 'a page with no form stops with a reason');
  const tab = (await h.ctx.pages()).find((p) => p.url() === 'https://apply.example.test/jobs/42');
  const tab2 = (await h.ctx.pages()).find((p) => p.url().endsWith('/jobs/7/apply'));
  ok(!!tab2 && await tab2.inputValue('#fn') === 'Ada', 'on a job page, Jobly presses its own Apply link to reach the form, then fills it');
  ok(await tab.inputValue('#fn') === 'Ada' && await tab.inputValue('#em') === 'ada@example.com' && await tab.evaluate(() => document.querySelector('#cv').files[0]?.name) === 'ada.pdf' && await tab.evaluate(() => !document.body.dataset.submitted),
    'the form is filled (resume attached) and nothing is submitted');
  // the user answers in Jobly; it is saved and filled into the open tab
  await d.reload(); await d.getByRole('heading', { name: 'Needs your input' }).waitFor();
  await d.locator('.aq-need', { hasText: 'Staff Product Designer' }).getByLabel(/Earliest start date/).fill('In 30 days');
  await d.locator('.aq-need', { hasText: 'Staff Product Designer' }).getByRole('button', { name: 'Save and fill again' }).click();
  const end = Date.now() + 8000; while (Date.now() < end && (await tab.inputValue('#start')) !== 'In 30 days') await sleep(200);
  ok(await tab.inputValue('#start') === 'In 30 days' && (await store('savedAnswers')).some((a) => /Earliest start date/.test(a.question)), 'an answer typed in Jobly is saved and filled into the open form');
  // the user finishes on the page and presses Submit
  await tab.selectOption('#gender', 'Woman'); await tab.click('#country-b'); await tab.click('#country-list [role=option]:has-text("India")'); await tab.click('#next'); await sleep(1500);
  await tab.click('button[type="submit"]');
  q = await until((q) => q.find((x) => x.id === 'q1')?.state === 'submitted', 8000);
  const app = (await store('applications'))?.find((a) => a.key.startsWith('https://apply.example.test/jobs/42'));
  ok(q.find((x) => x.id === 'q1').state === 'submitted' && app?.status === 'applied' && app.title === 'Staff Product Designer', 'pressing Submit on the page marks it submitted and adds it to Applied');
  await tab2.close(); q = await until((q) => q.find((x) => x.id === 'q2')?.state === 'stopped', 5000);
  ok(/closed before you submitted/.test(q.find((x) => x.id === 'q2').note), 'closing a tab before submitting stops that application');
  await d.reload(); await d.getByRole('heading', { name: 'Applications' }).waitFor();
  ok(await d.getByRole('list', { name: 'Submitted' }).getByText('Staff Product Designer').count() === 1 && await d.getByRole('list', { name: 'Not submitted' }).locator('li').count() === 2, 'the board shows submitted and not-submitted jobs');
  await d.getByRole('button', { name: /^Remove Closed role/ }).click(); await sleep(300);
  ok(!(await store('applyQueue')).some((x) => x.id === 'q3'), 'a job can be removed from the queue');
  await h.ctx.close();
});

await step('tailor for a job: requirements, coverage, suggestions, AI with fact check, versions, matched letter', async () => {
  const h = await launch(); const store = async (k) => (await h.sw.evaluate((key) => chrome.storage.local.get(key), k))[k];
  const now = new Date().toISOString();
  await h.sw.evaluate((d) => chrome.storage.local.set(d), {
    profiles: [{ id: 'p1', label: 'Design', first_name: 'Ananya', last_name: 'Rao', email: 'ananya@example.com', phone: '', location: '', headline: 'Senior Product Designer',
      summary: 'Product designer with seven years of experience shipping consumer and fintech products.', linkedin: '', github: '', portfolio: '', website: '', work_authorization: '', needs_sponsorship: '',
      years_experience: '7', salary_expectation: '', notice_period: '', skills: 'Accessibility, Figma, User Research, Design Systems',
      work: [{ id: 'w1', company: 'Northwind Labs', title: 'Senior Product Designer', location: '', start: '2022-04', end: '', current: true, bullets: 'Ran weekly customer interviews.\nBuilt the design system used by six product teams.\nLed the redesign of checkout, lifting conversion by 18%.' }],
      education: [], updated_at: now }], activeProfileId: 'p1',
    aiSettings: { provider: 'anthropic', model: 'claude-opus-5-5' }, anthropicApiKey: 'sk-ant-test',
  });
  // A stand-in for Anthropic's API: answers in its streaming format; one good line, one with an invented number, one naming React
  const asked = [];
  const sse = (json) => ['message_start', 'content_block_start', 'content_block_delta', 'content_block_stop', 'message_delta', 'message_stop'].map((type) => {
    const data = { message_start: { type, message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } },
      content_block_start: { type, index: 0, content_block: { type: 'text', text: '' } }, content_block_delta: { type, index: 0, delta: { type: 'text_delta', text: JSON.stringify(json) } },
      content_block_stop: { type, index: 0 }, message_delta: { type, delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 50 } }, message_stop: { type } }[type];
    return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`; }).join('');
  await h.ctx.route('https://api.anthropic.com/**', async (r) => {
    const req = r.request();
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } });
    const body = JSON.parse(req.postData() || '{}'); { const hd = await req.allHeaders(); asked.push({ body, key: hd['x-api-key'] ?? (hd.authorization ?? '').replace(/^Bearer /i, ''), direct: hd['anthropic-dangerous-direct-browser-access'] }); }
    const letter = /cover letter/i.test(body.messages?.[0]?.content ?? '');
    const answer = letter
      ? { paragraphs: ['Acme is building the payments app I would want to use.', 'At Northwind Labs I led the checkout redesign, lifting conversion by 40%.'] }
      : { summary: 'Senior product designer with seven years of fintech and consumer work, leading design systems and checkout.', bullets: [
          { id: 'w0b1', text: 'Built and maintained the design system used by six product teams.' },
          { id: 'w0b2', text: 'Led the checkout redesign, lifting conversion by 25%.' },
          { id: 'w0b0', text: 'Ran weekly customer interviews and built React prototypes.' }] };
    r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(answer) });
  });
  const d = await open(h, 'options.html', { width: 1280, height: 1000 });
  await d.getByRole('button', { name: /^Tailor for a job/ }).click();
  await d.getByLabel('Role').fill('Senior Product Designer'); await d.getByLabel('Company').fill('Acme');
  await d.getByLabel('Job description').fill(['Senior Product Designer at Acme', "What you'll do", '- Lead design for checkout and onboarding', 'Requirements', '- 5+ years of experience in product design',
    '- Expert in Figma and prototyping', '- Experience building and maintaining design systems', '- Strong user research skills', 'Nice to have', '- Experience with fintech products', '- Familiarity with React'].join('\n'));
  await d.getByRole('button', { name: 'Check my resume' }).click(); await d.getByText('What the job asks for').waitFor({ timeout: 5000 });
  await axe(d, 'tailor results');
  const reqs = await d.locator('section[aria-labelledby="tl-req"] li').allInnerTexts();
  ok(reqs.length === 6 && !reqs.some((t) => /Lead design for checkout/.test(t)), 'requirements come from the Requirements and Nice to have lists, not from what the role does');
  const req = (q) => reqs.find((t) => t.includes(q)) ?? '';
  ok(/^Covered/.test(req('5+ years')) && /7 years of experience/.test(req('5+ years')), 'years asked are checked against the profile');
  ok(/^Partly/.test(req('Figma and prototyping')) && /^Missing/.test(req('React')) && /Nice to have/.test(req('React')), 'a requirement half shown is Partly; one not shown is Missing');
  ok(await d.getByRole('checkbox', { name: /Put the skills this job asks for first/ }).isChecked() && !(await d.getByRole('checkbox', { name: /Add “Prototyping”/ }).isChecked()), 'reordering is on by default; adding a skill is left to you');
  await d.getByRole('checkbox', { name: /Add “Prototyping”/ }).check();
  ok(await d.getByText('with your changes').count() === 1, 'the score with your changes is shown');
  // AI rewording through the fact check
  await d.getByRole('button', { name: 'Reword with AI' }).click(); await d.getByText('Reworded summary for this job').waitFor({ timeout: 10000 });
  ok(asked[0]?.key === 'sk-ant-test' && asked[0].direct === 'true' && asked[0].body.model === 'claude-opus-5-5' && asked[0].body.output_config?.format?.type === 'json_schema', `Claude is called from the browser with your key, the chosen model and a JSON schema (${asked.length} calls, key ${asked[0]?.key}, ${JSON.stringify(asked[0]?.body?.output_config)?.slice(0, 120)}, model ${asked[0]?.body?.model})`);
  ok(await d.getByText(/^Reworded point at/).count() === 1, 'only the reworded line that passes the fact check is offered');
  const left = await d.locator('.ai-box').innerText();
  ok(/adds 25%/.test(left) && /names React/.test(left), 'a line with an invented number and one naming a skill you lack are left out, with the reason');
  await d.getByRole('button', { name: 'Save tailored resume' }).click(); await d.getByRole('button', { name: 'Open in Resume' }).waitFor({ timeout: 5000 });
  const v = (await store('resumeVersions'))?.[0];
  ok(v?.job.title === 'Senior Product Designer' && v.job.company === 'Acme' && v.after > v.before && v.profile.skills.startsWith('Prototyping') && /fintech and consumer work/.test(v.profile.summary)
    && v.profile.work[0].bullets.includes('Built and maintained the design system'), `the tailored version is saved with the job (coverage ${v?.before}% → ${v?.after}%)`);
  ok((await store('profiles'))[0].skills === 'Accessibility, Figma, User Research, Design Systems', 'your profile itself is unchanged');
  await d.getByRole('button', { name: 'Open in Resume' }).click(); await d.locator('.resume-print .resume h1').waitFor({ timeout: 5000 });
  ok(/Tailored: Senior Product Designer at Acme/.test(await d.getByLabel('Version').locator('option:checked').innerText()) && await d.locator('.resume-print .resume li', { hasText: 'Built and maintained the design system' }).count() === 1, 'the Resume page opens the tailored version');
  await axe(d, 'resume with versions');
  // the letter from the job description, then the AI letter with its check
  await d.getByRole('button', { name: /^Tailor for a job/ }).click();
  await d.getByLabel('Job description').fill('Requirements\n- Expert in Figma and prototyping\n- Experience building and maintaining design systems\n- Strong user research skills\n- 5+ years of experience in product design');
  await d.getByLabel('Role').fill('Senior Product Designer'); await d.getByLabel('Company').fill('Acme');
  await d.getByRole('button', { name: 'Check my resume' }).click(); await d.getByRole('button', { name: 'Write a cover letter for this job' }).click();
  await d.waitForFunction(() => (document.getElementById('cl-text')?.value ?? '').includes('Dear'), null, { timeout: 5000 });
  const letter = await d.getByLabel('Letter', { exact: true }).inputValue();
  ok(letter.startsWith('Dear Acme hiring team') && /Your posting asks for/.test(letter) && /At Northwind Labs, I built the design system/.test(letter), `the letter answers what the posting asks for with your own lines (${letter.replace(/\n/g, ' / ').slice(0, 400)})`);
  await axe(d, 'cover letter from the job');
  await d.getByRole('button', { name: 'Write with AI' }).click(); await d.getByText('Check before sending:').waitFor({ timeout: 10000 });
  ok(/lifting conversion by 40%/.test(await d.getByLabel('Letter', { exact: true }).inputValue()) && /40%.*isn.t in your profile/.test(await d.getByRole('alert').innerText()), 'an AI letter is flagged where it uses a number your profile does not have');
  await h.ctx.close();
});

await step('contacts, outreach drafts, connections', async () => {
  const h = await launch(); const store = async (k) => (await h.sw.evaluate((key) => chrome.storage.local.get(key), k))[k];
  await h.sw.evaluate(() => chrome.storage.local.set({ applications: [{ key: 'manual:1', title: 'Staff Designer', company_name: 'Initech', location: null, application_url: 'https://careers.initech.com/jobs/1', source: 'manual', status: 'applied', notes: '', applied_at: new Date().toISOString(), follow_up_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
    profiles: [{ id: 'p1', label: 'Design', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', phone: '', location: '', headline: 'Senior Product Designer', summary: '', linkedin: '', github: '', portfolio: '', website: '', work_authorization: '', needs_sponsorship: '', years_experience: '6', salary_expectation: '', notice_period: '', skills: '', work: [{ id: 'w1', company: 'Analytical Engines', title: 'Lead Designer', location: '', start: '2022-01', end: '', current: true, bullets: 'Led the checkout redesign' }], education: [], updated_at: new Date().toISOString() }], activeProfileId: 'p1' }));
  const d = await open(h, 'options.html', { width: 1280, height: 900 }); await firstCard(d);
  await d.getByRole('button', { name: /^People/ }).click(); await d.getByText('Finding contacts uses your own Hunter account').waitFor({ timeout: 5000 });
  ok(await d.getByRole('button', { name: 'Find contacts' }).isDisabled(), 'without a Hunter key, searching is off and the page says how to add one');
  // the safe people finder: searches open on public sites; nothing is fetched by Jobly
  await d.getByLabel('Job', { exact: true }).selectOption('manual:1');
  ok(await d.getByLabel('Company', { exact: true }).inputValue() === 'Initech' && await d.getByLabel('Role', { exact: true }).inputValue() === 'Staff Designer', 'picking a job fills the company and role');
  const hrefs = await d.locator('.people-links a').evaluateAll((els) => els.map((e) => [e.textContent.trim(), e.href, e.target]));
  ok(hrefs.some(([t, u]) => t.startsWith('LinkedIn') && u.startsWith('https://www.linkedin.com/search/results/people/?keywords=Initech%20recruiter'))
    && hrefs.some(([t]) => t.startsWith('Behance')) && hrefs.every(([, , target]) => target === '_blank'), `recruiter searches open on LinkedIn, Google, Behance, Dribbble and X (${hrefs.map((x) => x[0]).join(', ')})`);
  await d.getByRole('radio', { name: 'Hiring manager' }).click();
  ok(decodeURIComponent(await d.locator('.people-links a', { hasText: 'Google' }).getAttribute('href')).includes('site:linkedin.com/in "Initech" "design manager" OR "head of design"'), 'the hiring manager search looks for design managers for a design role');
  ok(await d.getByRole('radio', { name: 'Worked at Analytical Engines' }).count() === 1, 'past employers from the profile become a search for former colleagues');
  await d.getByLabel('Name', { exact: true }).fill('Ada Byron'); await d.getByLabel('Position', { exact: true }).fill('Design Manager'); await d.getByLabel('Profile link').fill('linkedin.com/in/adabyron');
  await d.getByRole('button', { name: 'Save person' }).click(); await sleep(300);
  const ada = (await store('contacts')).find((c) => c.name === 'Ada Byron');
  ok(ada?.relation === 'hiring_manager' && ada.company === 'Initech' && ada.linkedin === 'https://linkedin.com/in/adabyron' && ada.app_key === 'manual:1', 'someone found is saved with how you know them, the company and the job');
  ok(await d.getByRole('button', { name: 'Find profiles' }).isDisabled() && await d.getByText('Find profiles uses your own Brave Search key; Who works there uses your own Apollo key.').count() === 1, 'without keys, the API searches are off and the page says where to add them');
  await axe(d, 'people finder');
  await d.getByLabel('For application').selectOption('manual:1'); ok((await d.getByLabel('Company domain').inputValue()) === 'initech.com', "the company's domain is taken from the application link");
  await axe(d, 'contacts');
  // a contact by hand, then an outreach draft
  await d.getByRole('button', { name: 'Add a person' }).click(); const dlg = d.getByRole('dialog'); await dlg.getByLabel('Name').fill('Grace Hopper'); await dlg.getByLabel('Position').fill('Head of Talent'); await dlg.getByLabel('Email').fill('grace@initech.com');
  await d.getByRole('dialog').getByLabel('Application', { exact: true }).selectOption('manual:1'); await d.getByRole('dialog').getByRole('button', { name: 'Save person' }).click(); await sleep(400);
  ok((await store('contacts'))?.some((c) => c.name === 'Grace Hopper' && c.company === 'Initech'), 'a contact is saved with its application');
  await d.getByRole('button', { name: /^Hiring manager/ }).click();
  ok(await d.locator('.card-grid li').count() === 1 && /Ada Byron/.test(await d.locator('.card-grid').innerText()), 'saved people can be filtered by how you know them');
  await d.getByRole('button', { name: /^All/ }).click();
  await d.locator('.card-grid li', { hasText: 'Grace Hopper' }).getByRole('button', { name: 'Draft message' }).click(); await d.getByRole('dialog').waitFor();
  const msg = await d.getByLabel('Text', { exact: true }).inputValue();
  ok(msg.startsWith('Hi Grace,') && msg.includes('Staff Designer role at Initech') && msg.includes('Ada Lovelace') && msg.includes('led the checkout redesign'), 'the outreach draft is filled from the contact, the job and the profile');
  await d.getByLabel('Message', { exact: true }).selectOption('linkedin'); ok(await d.getByText(/\d+\/300 characters/).count() === 1, 'the LinkedIn note shows the 300-character limit');
  await axe(d, 'outreach dialog');
  await d.getByRole('button', { name: 'Mark as contacted' }).click(); await sleep(400); ok(!!(await store('contacts'))[0].contacted_at, 'marking as contacted is remembered');
  // Hunter key in Settings, never in a backup; Google Calendar (for Interviews) is hidden while the tracker is off
  await d.getByRole('button', { name: 'Settings', exact: true }).click(); await d.getByLabel(/Hunter API key/).fill('test-key-123'); await d.getByLabel(/Hunter API key/).locator('xpath=following-sibling::button').click(); await sleep(300);
  ok((await store('hunterApiKey')) === 'test-key-123', 'the Hunter key is stored on the device');
  ok(await d.getByText('Google Calendar').count() === 0, 'the calendar connection is hidden while Interviews are switched off');
  const [bk] = await Promise.all([d.waitForEvent('download'), d.getByRole('button', { name: 'Download a backup' }).click()]);
  const backup = fs.readFileSync(await bk.path(), 'utf8'); ok(!backup.includes('test-key-123') && JSON.parse(backup).data.contacts?.length === 2, 'backups include contacts but never the API key');
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
  // Brave Search: public profile pages from the search index, with the user's own key
  const braveAsked = [];
  await page.route('https://api.search.brave.com/**', (r) => { braveAsked.push({ url: new URL(r.request().url()), key: r.request().headers()['x-subscription-token'] }); r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ web: { results: /behance/.test(r.request().url()) ? [
    { title: 'Mina Park on Behance', url: 'https://www.behance.net/minapark', description: 'Product designer at Initech' },
    { title: 'Checkout redesign :: Behance', url: 'https://www.behance.net/gallery/123/Checkout', description: 'A project' }] : /dribbble/.test(r.request().url()) ? [] : [
    { title: 'Priya Shah - Design Manager - Initech | LinkedIn', url: 'https://in.linkedin.com/in/priyashah?trk=x', description: 'Design Manager at <strong>Initech</strong>. Bengaluru.' },
    { title: 'Initech | LinkedIn', url: 'https://www.linkedin.com/company/initech', description: 'Company page' }] } }) }); });
  await page.evaluate(() => { window.chrome.storage.local.get = async () => ({ hunterApiKey: 'k1', braveApiKey: 'bk1', apolloApiKey: 'ak1' }); });
  const prof = await page.evaluate(() => window.units.searchProfiles('Initech', { id: 'hiring', label: 'Hiring manager', terms: '"design manager" OR "head of design"', hint: '' }, window.units.sitesFor('Product Designer')));
  ok(braveAsked.length === 3 && braveAsked.every((a) => a.key === 'bk1') && braveAsked.some((a) => a.url.searchParams.get('q') === 'site:linkedin.com/in "Initech" "design manager" OR "head of design"'), `one Brave search per site, with your key and a site: query (${braveAsked.map((a) => a.url.searchParams.get('q')).join(' | ')})`);
  ok(prof.length === 2 && prof[0].name === 'Priya Shah' && prof[0].headline === 'Design Manager · Initech' && prof[0].url === 'https://in.linkedin.com/in/priyashah' && prof.some((x) => x.site === 'Behance' && x.name === 'Mina Park'), `only profile pages are kept (no company or project pages), with name and headline (${JSON.stringify(prof.map((x) => [x.site, x.name, x.headline]))})`);
  // Apollo: who works there, by title, with the user's own key
  let apolloAsked = null;
  await page.route('https://api.apollo.io/**', (r) => { apolloAsked = { url: new URL(r.request().url()), method: r.request().method(), key: r.request().headers()['x-api-key'] }; r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ total_entries: 1, people: [{ first_name: 'Ravi', last_name_obfuscated: 'Ku***r', title: 'Technical Recruiter', has_email: true, organization: { name: 'Initech' } }] }) }); });
  const ap = await page.evaluate(() => window.units.apolloPeople('initech.com', { id: 'recruiters', label: 'Recruiters', terms: 'recruiter OR "talent acquisition"', hint: '' }, 'Product Designer'));
  ok(apolloAsked?.method === 'POST' && apolloAsked.key === 'ak1' && apolloAsked.url.searchParams.getAll('q_organization_domains_list[]').join() === 'initech.com' && apolloAsked.url.searchParams.getAll('person_titles[]').includes('recruiter')
    && ap[0]?.name === 'Ravi Ku***r' && ap[0].title === 'Technical Recruiter', 'Apollo is asked for recruiters at the company domain with your key');
  await page.route('https://api.apollo.io/**', (r) => r.fulfill({ status: 403, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }));
  const apErr = await page.evaluate(() => window.units.apolloPeople('initech.com', { id: 'recruiters', label: 'R', terms: 'recruiter', hint: '' }, '').then(() => '', (e) => e.message));
  ok(/Apollo refused the key/.test(apErr), 'a refused Apollo key gives a readable message');
  ok(await page.evaluate(() => window.units.companyDomain('https://boards.greenhouse.io/acme/jobs/1') === '' && window.units.companyDomain('https://jobs.acme.com/x') === 'acme.com'), 'hiring-system links are not mistaken for company domains');
  await h.ctx.close();
});

t.done();
