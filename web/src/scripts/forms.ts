// Feedback forms open the visitor's email app with the message filled in (the site is static: there is no form server).
// Without JavaScript the form's own mailto: action does the same, less neatly.
const LABELS: Record<string, string> = { name: 'Name', email: 'Reply to', topic: 'Topic', message: 'Message', reason: 'Reason', note: 'Note' };

for (const form of document.querySelectorAll<HTMLFormElement>('form[data-form]')) {
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const done = document.getElementById(form.dataset.form!);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const lines: string[] = [];
    new FormData(form).forEach((v, k) => { const text = String(v).trim(); if (text) lines.push(k === 'message' || k === 'note' ? `\n${text}` : `${LABELS[k] ?? k}: ${text}`); });
    const href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(form.dataset.subject ?? 'Jobly')}&body=${encodeURIComponent(lines.join('\n'))}`;
    window.location.href = href;
    if (done) { form.hidden = true; done.hidden = false; done.focus(); }
    else if (status) { status.dataset.state = 'ok'; status.textContent = 'Your email app should now be open. Press Send there.'; }
  });
}
