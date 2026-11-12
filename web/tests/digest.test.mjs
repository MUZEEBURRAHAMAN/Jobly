// Daily email sign-up functions, run in Node with an in-memory KV and Brevo stubbed. Run: node tests/digest.test.mjs (Node 22.18+ runs the TypeScript directly)
import assert from 'node:assert/strict';
import { onRequest, cleanPrefs, emailId } from '../functions/api/digest/[[path]].ts';

const store = new Map();
const SUBS = { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); } };
const sent = [];
globalThis.fetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body), key: init.headers['api-key'] }); return new Response('{}', { status: 201 }); };
const env = { SUBS, BREVO_API_KEY: 'bk', DIGEST_FROM: 'hello@jobly.test' };
const call = (path, init = {}, e = env) => onRequest({ request: new Request(`https://jobly.test/api/digest/${path}`, init), env: e, params: { path: path.split('?')[0].split('/') } });
const post = (body, headers = {}) => call('subscribe', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://jobly.test', 'cf-connecting-ip': '1.1.1.1', ...headers }, body: JSON.stringify(body) });
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('PASS ', m); };

ok((await (await call('status', {}, {})).json()).ready === false && (await call('status')).status === 200 && (await (await call('status')).json()).ready === true, 'status says whether the email is set up');
ok((await call('subscribe', { method: 'POST', body: '{}' }, {})).status === 503, 'nothing works until it is set up');
ok(JSON.stringify(cleanPrefs({ roles: ['product_design', 'x;drop', 'product_design'], seniority: ['senior', 'god'], hub: 'mars', remote: '1' })) === JSON.stringify({ roles: ['product_design'], seniority: ['senior'], hub: '', remote: true }), 'only known choices are kept');
let r = await post({ email: 'not-an-email', roles: ['product_design'], consent: true }); ok(r.status === 400, 'a bad email is refused');
r = await post({ email: 'a@b.co', roles: ['product_design'] }); ok(r.status === 400 && /Tick the box/.test((await r.json()).error), 'consent is required');
r = await post({ email: 'a@b.co', roles: [], consent: true }); ok(r.status === 400, 'at least one kind of job is required');
r = await post({ email: 'a@b.co', roles: ['product_design'], consent: true }, { origin: 'https://evil.test' }); ok(r.status === 403, 'other sites cannot post the form');
r = await post({ email: 'bot@b.co', roles: ['product_design'], consent: true, website: 'spam' }); ok(r.status === 200 && sent.length === 0, 'the hidden field quietly drops bots');
r = await post({ email: 'Priya@Example.com', roles: ['product_design'], seniority: ['senior'], hub: 'india', consent: true });
const pending = [...store.keys()].find((k) => k.startsWith('pending:'));
ok(r.status === 200 && pending && sent.length === 1 && sent[0].key === 'bk' && sent[0].body.to[0].email === 'priya@example.com' && sent[0].body.htmlContent.includes(`/api/digest/confirm?t=${pending.slice(8)}`), 'sign-up stores a pending entry and emails a confirmation link');
ok(![...store.keys()].some((k) => k.startsWith('sub:')), 'nobody is subscribed before confirming');
r = await call(`confirm?t=${pending.slice(8)}`);
const id = await emailId('priya@example.com');
const sub = JSON.parse(store.get(`sub:${id}`) ?? 'null');
ok(r.status === 303 && r.headers.get('location').endsWith('/daily-email?status=confirmed') && sub?.prefs.hub === 'india' && !store.has(pending), 'the link confirms the subscription once');
ok((await call(`confirm?t=${pending.slice(8)}`)).headers.get('location').endsWith('status=expired'), 'a used link says it expired');
ok((await call(`unsubscribe?id=${id}&t=${'0'.repeat(48)}`)).headers.get('location').endsWith('status=unsubscribed') && store.has(`sub:${id}`), 'a wrong token does not unsubscribe (and reveals nothing)');
r = await call(`unsubscribe?id=${id}&t=${sub.token}`, { method: 'POST' });
ok(r.status === 200 && !store.has(`sub:${id}`), 'one-click unsubscribe deletes the email and choices');
for (let i = 0; i < 5; i++) await post({ email: `x${i}@b.co`, roles: ['qa'], consent: true }, { 'cf-connecting-ip': '9.9.9.9' });
ok((await post({ email: 'y@b.co', roles: ['qa'], consent: true }, { 'cf-connecting-ip': '9.9.9.9' })).status === 429, 'at most five sign-ups a day from one address');
console.log(`\ndigest functions: ${pass} passed`);
