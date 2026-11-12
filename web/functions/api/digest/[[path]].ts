/**
 * Daily job email: sign-up with double opt-in, and unsubscribe. Cloudflare Pages Functions on the website's own
 * address, so no extra domain or server. The daily send runs in GitHub Actions (scripts/send_digest.py).
 *
 *   GET  /api/digest/status       { ready } — whether the email is set up (KV binding and Brevo key present)
 *   POST /api/digest/subscribe    { email, roles[], seniority[], hub, remote, consent } → sends a confirmation email
 *   GET  /api/digest/confirm?t=…  turns the pending sign-up into a subscription, then back to /daily-email
 *   GET  /api/digest/unsubscribe?id=…&t=…  removes it at once (also answers POST, for one-click List-Unsubscribe)
 *
 * Storage (KV binding SUBS):
 *   pending:<token>   the sign-up waiting for confirmation, expires after 48 hours
 *   sub:<id>          { email, prefs, token, created } where id = SHA-256 of the email
 *   rate:<ip>:<day>   sign-up attempts from one address per day (max 5)
 * Secrets: BREVO_API_KEY. Variables: DIGEST_FROM (sender email verified in Brevo), DIGEST_FROM_NAME.
 */
interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}
interface Env { SUBS?: KV; BREVO_API_KEY?: string; DIGEST_FROM?: string; DIGEST_FROM_NAME?: string }
interface Ctx { request: Request; env: Env; params: { path?: string[] } }

export interface Prefs { roles: string[]; seniority: string[]; hub: string; remote: boolean }
const ROLE = /^[a-z_]{2,40}$/;
const SENIORITY = new Set(['intern', 'junior', 'mid', 'senior', 'lead']);
const HUBS = new Set(['', 'us', 'india', 'europe', 'apac', 'global']);
const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,24}$/i;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const back = (origin: string, status: string) => Response.redirect(`${origin}/daily-email?status=${status}`, 303);
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const emailId = async (email: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase())));
const token = () => hex(crypto.getRandomValues(new Uint8Array(24)).buffer);

/** Only known values get through; anything else is dropped. */
export function cleanPrefs(x: Record<string, unknown>): Prefs | null {
  const list = (v: unknown) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []).map((s) => String(s).trim()).filter(Boolean);
  const roles = [...new Set(list(x.roles).filter((r) => ROLE.test(r)))].slice(0, 12);
  if (!roles.length) return null;
  return { roles, seniority: list(x.seniority).filter((s) => SENIORITY.has(s)).slice(0, 5), hub: HUBS.has(String(x.hub ?? '')) ? String(x.hub ?? '') : '', remote: x.remote === true || x.remote === '1' || x.remote === 'true' };
}

async function send(env: Env, to: string, subject: string, html: string, text: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { email: env.DIGEST_FROM, name: env.DIGEST_FROM_NAME || 'Jobly' }, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
  });
  return res.ok;
}

const ready = (env: Env) => !!(env.SUBS && env.BREVO_API_KEY && env.DIGEST_FROM);

export async function onRequest({ request, env, params }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const action = (params.path ?? [])[0] ?? '';
  const origin = url.origin;

  if (action === 'status') return json({ ready: ready(env) });
  if (!ready(env)) return json({ error: 'The daily email is not set up yet.' }, 503);
  const kv = env.SUBS!;

  if (action === 'subscribe' && request.method === 'POST') {
    // Same-site form only
    const from = request.headers.get('origin');
    if (from && from !== origin) return json({ error: 'Not allowed.' }, 403);
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    const rateKey = `rate:${ip}:${new Date().toISOString().slice(0, 10)}`;
    const tries = Number((await kv.get(rateKey)) ?? 0);
    if (tries >= 5) return json({ error: 'Too many sign-ups from here today. Try again tomorrow.' }, 429);
    await kv.put(rateKey, String(tries + 1), { expirationTtl: 86400 });

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return json({ error: 'Something went wrong. Try again.' }, 400);
    if (typeof body.website === 'string' && body.website) return json({ ok: true });  // hidden field: bots fill it
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!EMAIL.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
    if (body.consent !== true) return json({ error: 'Tick the box to agree to the daily email.' }, 400);
    const prefs = cleanPrefs(body);
    if (!prefs) return json({ error: 'Pick at least one kind of job.' }, 400);

    const t = token();
    await kv.put(`pending:${t}`, JSON.stringify({ email, prefs, at: Date.now() }), { expirationTtl: 172800 });
    const link = `${origin}/api/digest/confirm?t=${t}`;
    const ok = await send(env, email, 'Confirm your daily Jobly email',
      `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#18181b;max-width:520px">
<p>Hi,</p><p>Press the button to start getting one email a day with new jobs that match what you picked.</p>
<p><a href="${link}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Confirm my email</a></p>
<p style="color:#71717a;font-size:13px">If you didn't ask for this, ignore this email; nothing will be sent. The link works for 48 hours.</p></div>`,
      `Confirm your daily Jobly email: ${link}\n\nIf you didn't ask for this, ignore this email; nothing will be sent. The link works for 48 hours.`);
    if (!ok) return json({ error: "Couldn't send the confirmation email. Try again later." }, 502);
    return json({ ok: true });
  }

  if (action === 'confirm') {
    const t = url.searchParams.get('t') ?? '';
    if (!/^[a-f0-9]{48}$/.test(t)) return back(origin, 'invalid');
    const raw = await kv.get(`pending:${t}`);
    if (!raw) return back(origin, 'expired');
    const { email, prefs } = JSON.parse(raw) as { email: string; prefs: Prefs };
    const id = await emailId(email);
    await kv.put(`sub:${id}`, JSON.stringify({ email, prefs, token: token(), created: new Date().toISOString() }));
    await kv.delete(`pending:${t}`);
    return back(origin, 'confirmed');
  }

  if (action === 'unsubscribe') {
    const id = url.searchParams.get('id') ?? '';
    const t = url.searchParams.get('t') ?? '';
    if (!/^[a-f0-9]{64}$/.test(id) || !/^[a-f0-9]{48}$/.test(t)) return back(origin, 'invalid');
    const raw = await kv.get(`sub:${id}`);
    if (raw && (JSON.parse(raw) as { token: string }).token === t) await kv.delete(`sub:${id}`);
    // Same answer whether or not it existed, so the link reveals nothing
    return request.method === 'POST' ? json({ ok: true }) : back(origin, 'unsubscribed');
  }

  return json({ error: 'Not found.' }, 404);
}
