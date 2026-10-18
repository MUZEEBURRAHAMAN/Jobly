// Netlify Forms without leaving the page: post the form in the background and show the result in place.
// Without JavaScript the form still posts normally and Netlify shows /thanks.
for (const form of document.querySelectorAll<HTMLFormElement>('form[data-form]')) {
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const done = document.getElementById(form.dataset.form!);
  const say = (state: 'ok' | 'error' | 'busy', text: string) => { if (status) { status.dataset.state = state; status.textContent = text; } };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const body = new URLSearchParams();
    new FormData(form).forEach((v, k) => body.append(k, String(v)));
    if (button) button.disabled = true;
    say('busy', 'Sending…');
    try {
      const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      if (done) { form.hidden = true; done.hidden = false; done.focus(); } else say('ok', 'Sent. Thank you!');
    } catch {
      say('error', `That didn't go through. Please try again, or email ${form.dataset.email}.`);
    } finally {
      if (button) button.disabled = false;
    }
  });
}
