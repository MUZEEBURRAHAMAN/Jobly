// Daily job email sign-up (/daily-email). Choices can come in the link from the extension
// (?roles=product_design,frontend_engineering&seniority=senior&hub=india&remote=1); the email is only typed here.
const form = document.querySelector<HTMLFormElement>('form[data-digest]');
const status = form?.querySelector<HTMLElement>('[data-form-status]');
const params = new URLSearchParams(location.search);

// A confirmation or unsubscribe result from the links in the emails
const result = params.get('status');
const tpl = result ? document.querySelector<HTMLTemplateElement>(`template[data-msg="${CSS.escape(result)}"]`) : null;
const box = document.querySelector<HTMLElement>('[data-status]');
if (tpl && box) {
  box.querySelector('[data-status-title]')!.textContent = tpl.content.querySelector('[data-t]')!.textContent;
  box.querySelector('[data-status-text]')!.textContent = tpl.content.querySelector('[data-d]')!.textContent;
  box.hidden = false; box.focus();
}

if (form) {
  const list = (k: string) => (params.get(k) ?? '').split(',').filter(Boolean);
  for (const k of ['roles', 'seniority']) for (const v of list(k)) {
    const box = form.querySelector<HTMLInputElement>(`input[name="${k}"][value="${CSS.escape(v)}"]`);
    if (box) box.checked = true;
  }
  const hub = form.querySelector<HTMLSelectElement>('select[name="hub"]')!;
  if ([...hub.options].some((o) => o.value === params.get('hub'))) hub.value = params.get('hub')!;
  if (params.get('remote') === '1') form.querySelector<HTMLInputElement>('input[name="remote"]')!.checked = true;

  // Hidden until the service is set up
  fetch('/api/digest/status').then((r) => r.json()).then((s: { ready?: boolean }) => {
    if (!s.ready) { form.hidden = true; document.querySelector<HTMLElement>('[data-unavailable]')!.hidden = false; }
  }).catch(() => { form.hidden = true; document.querySelector<HTMLElement>('[data-unavailable]')!.hidden = false; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const say = (m: string) => { if (status) status.textContent = m; };
    const roles = data.getAll('roles').map(String);
    const email = String(data.get('email') ?? '').trim();
    if (!roles.length) return say('Pick at least one kind of job.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return say('Enter a valid email address.');
    if (!data.get('consent')) return say('Tick the box to agree to the daily email.');
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true; say('Sending…');
    try {
      const res = await fetch('/api/digest/subscribe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, roles, seniority: data.getAll('seniority').map(String), hub: String(data.get('hub') ?? ''), remote: !!data.get('remote'), consent: true, website: String(data.get('website') ?? '') }),
      });
      const out = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { say(out.error ?? 'Something went wrong. Try again.'); return; }
      form.reset();
      say(`Almost done: we sent a link to ${email}. Open it to confirm (check spam if it isn’t there in a minute).`);
    } catch {
      say('Couldn’t reach Jobly. Check your connection and try again.');
    } finally { button.disabled = false; }
  });
}
