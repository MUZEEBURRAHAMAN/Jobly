// Apply assist: a small Jobly panel on the application page. It is injected only into the tab the user opened Jobly on,
// only when they press "Start apply assist" (activeTab). It reads each step of the form, shows the proposed answers with
// where each came from, fills only what the user approves, lists the questions left for them, and remembers what they
// type. It never presses Next or Submit. Built on its own as assist.js (an IIFE) by vite.config.ts.
import { fillForm, FillItem, ResumePayload, scanForm, ScannedField } from '../lib/autofill';
import { extractJobFromPage, PageJob } from '../lib/pageJob';
import type { AssistAnswer } from '../lib/assistLogic';

declare const __JOBLY_TEST__: boolean;
type W = Window & { __joblyAssist?: { show: () => void } };

const send = <T>(message: Record<string, unknown>): Promise<T | null> =>
  new Promise((resolve) => {
    try { chrome.runtime.sendMessage(message, (r) => { void chrome.runtime.lastError; resolve((r as T) ?? null); }); } catch { resolve(null); }
  });

const SOURCE_LABEL: Record<string, string> = { profile: 'From your profile', saved: 'Saved answer', suggested: 'Suggested: check it' };
const SUBMIT = /^(submit|submit application|submit your application|send application|send|apply|apply now|complete application|finish|finish application)$/i;

const STYLES = `
:host { all: initial; }
.panel { --bg:#fff; --fg:#0a0a0a; --muted:#52525b; --line:#e4e4e7; --soft:#f4f4f5; --brand:#18181b; --brand-soft:#f4f4f5; --ok:#166534; --ok-soft:#ecfdf3; --warn:#92400e; --warn-soft:#fffbeb;
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 360px; max-width: calc(100vw - 32px); max-height: min(640px, calc(100vh - 32px));
  display: flex; flex-direction: column; background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 12px;
  box-shadow: 0 12px 32px rgb(0 0 0 / .16); font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; overflow: hidden; }
@media (prefers-color-scheme: dark) { .panel { --bg:#111113; --fg:#fafafa; --muted:#a1a1aa; --line:#27272a; --soft:#1c1c1f; --brand:#fafafa; --brand-soft:#27272a; --ok:#4ade80; --ok-soft:#0d2417; --warn:#fbbf24; --warn-soft:#2a1f05; } }
.panel.min .body, .panel.min .foot { display: none; }
.head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--line); }
.mark { width: 22px; height: 22px; border-radius: 6px; background: var(--brand); color: var(--bg); display: grid; place-items: center; font-weight: 700; font-size: 12px; }
.title { font-weight: 600; flex: 1; min-width: 0; }
.title small { display: block; font-weight: 400; color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
button { font: inherit; cursor: pointer; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); padding: 6px 10px; min-height: 30px; }
button:hover { background: var(--soft); }
button:focus-visible, input:focus-visible { outline: 2px solid var(--brand); outline-offset: 1px; }
button.primary { background: var(--fg); color: var(--bg); border-color: var(--fg); font-weight: 600; }
button.primary:disabled { opacity: .5; cursor: default; }
button.icon { width: 30px; padding: 0; border-color: transparent; background: transparent; color: var(--muted); }
.body { overflow-y: auto; padding: 10px 12px; display: grid; gap: 10px; }
.status { color: var(--muted); }
.status b { color: var(--fg); }
h4 { margin: 2px 0; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 600; }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
li { border: 1px solid var(--line); border-radius: 8px; padding: 8px; display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; align-items: start; }
li.need { grid-template-columns: 1fr auto; background: var(--warn-soft); border-color: transparent; }
li .q { color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
li .a { overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
li .src { font-size: 11px; font-weight: 600; justify-self: start; padding: 1px 6px; border-radius: 6px; }
.src.profile { background: var(--ok-soft); color: var(--ok); }
.src.saved { background: var(--soft); color: var(--fg); }
.src.suggested { background: var(--brand-soft); color: var(--brand); }
input[type=checkbox] { margin: 2px 0 0; width: 16px; height: 16px; accent-color: var(--brand); }
.cell { grid-column: 2; display: grid; gap: 2px; min-width: 0; }
details summary { cursor: pointer; color: var(--muted); }
.note { color: var(--muted); font-size: 12px; }
.done { color: var(--ok); font-weight: 600; }
.ask { background: var(--brand-soft); border-radius: 8px; padding: 10px; display: grid; gap: 8px; }
.row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.foot { border-top: 1px solid var(--line); padding: 10px 12px; display: grid; gap: 6px; }
`;

function start() {
  const w = window as W;
  if (w.__joblyAssist) { w.__joblyAssist.show(); return; }

  const host = document.createElement('jobly-assist');
  const root = host.attachShadow({ mode: typeof __JOBLY_TEST__ !== 'undefined' && __JOBLY_TEST__ ? 'open' : 'closed' });
  const style = document.createElement('style'); style.textContent = STYLES; root.appendChild(style);
  const panel = document.createElement('section'); panel.className = 'panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Jobly apply assist');
  root.appendChild(panel);
  document.documentElement.appendChild(host);

  let answers: AssistAnswer[] = [];
  let profileLabel = '';
  let step = 0;
  let message = '';
  let busy = false;
  let asking = false;
  let scannedIds = new Set<string>();
  let seenQuestions = new Set<string>();
  const job: PageJob = (() => { try { return extractJobFromPage(); } catch { return { found: false, title: document.title, company: location.hostname, location: '', datePosted: '', employmentType: '', salary: '', url: location.href, description: '' }; } })();

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...kids: (Node | string | null | false)[]) => {
    const n = document.createElement(tag);
    const { class: cls, ...rest } = props as Record<string, unknown>;
    if (cls) n.className = String(cls);
    Object.assign(n, rest);
    for (const k of kids) if (k) n.append(k);
    return n;
  };
  const fieldEl = (id: string) => document.querySelector<HTMLElement>(`[data-jobly-field="${id}"]`);

  // What the user types, kept as they type: a form's next step removes the old fields before Jobly reads them again
  const typed = new Map<string, string>();
  const record = (e: Event) => {
    const t = e.target as HTMLInputElement | null;
    const id = t?.getAttribute?.('data-jobly-field');
    if (!t || !id || host.contains(t)) return;
    const a = answers.find((x) => x.id === id);
    if (a) { const v = currentValue(a); if (v) typed.set(id, v); else typed.delete(id); }
  };
  document.addEventListener('input', record, true);
  document.addEventListener('change', record, true);
  // A choice made in a custom dropdown changes the button's text, not a value: read it just after the click
  const recordCustom = () => window.setTimeout(() => { for (const a of answers) if (a.kind === 'custom') { const v = currentValue(a); if (v) typed.set(a.id, v); } }, 120);
  document.addEventListener('click', recordCustom, true);

  /** What the user has put in a field (to remember it). Radios give the chosen option's label. */
  const currentValue = (a: AssistAnswer): string => {
    const els = Array.from(document.querySelectorAll<HTMLInputElement>(`[data-jobly-field="${a.id}"]`));
    const first = els[0];
    if (!first) return typed.get(a.id) ?? '';
    if (a.kind === 'radio') {
      const r = els.find((x) => x.checked);
      if (!r) return '';
      return ((r.id && document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.textContent) || r.closest('label')?.textContent || r.value).replace(/\s+/g, ' ').trim();
    }
    if (a.kind === 'select') { const s = first as unknown as HTMLSelectElement; return s.selectedIndex > 0 ? (s.options[s.selectedIndex]?.textContent ?? '').trim() : ''; }
    if (a.kind === 'text' || a.kind === 'textarea') return first.value.trim();
    if (a.kind === 'custom') { const t = (first.textContent ?? '').replace(/\s+/g, ' ').trim(); return /^(select|choose|--|please)/i.test(t) ? '' : t; }
    return '';
  };

  /** Remember what the user typed into questions Jobly couldn't answer (never sensitive ones; the extension checks). */
  const remember = async () => {
    const items = answers.filter((a) => !a.source && ['text', 'textarea', 'select', 'radio', 'custom'].includes(a.kind) && !/e-?mail|phone|name/i.test(a.label))
      .map((a) => ({ question: a.label, value: currentValue(a), kind: a.kind })).filter((x) => x.question && x.value);
    if (!items.length) return 0;
    const r = await send<{ saved: number }>({ type: 'ASSIST_REMEMBER', items });
    typed.clear();
    return r?.saved ?? 0;
  };

  const scan = async (auto = false) => {
    if (busy) return;
    busy = true;
    if (auto) { const saved = await remember(); if (saved) message = `Saved ${saved} answer${saved === 1 ? '' : 's'} for next time.`; }
    let fields: ScannedField[] = [];
    try { fields = scanForm().fields; } catch { fields = []; }
    const r = await send<{ error?: string; profileLabel?: string; answers?: AssistAnswer[] }>({ type: 'ASSIST_PROPOSE', fields });
    busy = false;
    if (!r || r.error === 'no-profile') { answers = []; profileLabel = ''; render('no-profile'); return; }
    profileLabel = r.profileLabel ?? '';
    answers = r.answers ?? [];
    // A new step is a new set of questions (field numbers restart at every read, so compare the questions)
    const questions = new Set(answers.map((a) => `${a.kind}:${a.label}`));
    if (!step || [...questions].some((q) => !seenQuestions.has(q))) step++;
    seenQuestions = questions;
    scannedIds = new Set(answers.map((a) => a.id));
    // Questions left for the user get a dashed outline on the page, so they're easy to spot
    for (const a of answers) {
      const f = fieldEl(a.id);
      if (f && a.required && !a.value && !a.filled) { f.style.outline = '2px dashed #d97706'; f.style.outlineOffset = '2px'; }
    }
    render();
  };

  const fill = async () => {
    const chosen = answers.filter((a) => a.include && a.value);
    if (!chosen.length) return;
    busy = true; render();
    let resume: ResumePayload | null = null;
    if (chosen.some((a) => a.kind === 'file')) resume = (await send<{ resume: ResumePayload | null }>({ type: 'ASSIST_RESUME' }))?.resume ?? null;
    const items: FillItem[] = chosen.map((a) => ({ id: a.id, kind: a.kind as FillItem['kind'], value: a.value }));
    const out = await fillForm(items, resume);
    void send({ type: 'ASSIST_USED', keys: chosen.map((a) => a.savedKey).filter(Boolean) });
    busy = false;
    for (const a of chosen) if (!out.failed.includes(a.id)) { a.filled = true; a.include = false; }
    const left = answers.filter((a) => !a.filled && !a.value && (a.required || a.kind === 'custom')).length;
    message = `Filled ${out.filled} field${out.filled === 1 ? '' : 's'}${out.failed.length ? `; ${out.failed.length} couldn't be filled` : ''}. ${left ? `Answer the ${left} question${left === 1 ? '' : 's'} marked on the page, then` : 'Check the page, then'} press the site's Next or Submit yourself.`;
    render();
  };

  const render = (state?: 'no-profile') => {
    panel.replaceChildren();
    const minimize = el('button', { class: 'icon', type: 'button', title: 'Minimise', ariaLabel: 'Minimise apply assist', textContent: '–', onclick: () => panel.classList.toggle('min') });
    const close = el('button', { class: 'icon', type: 'button', title: 'Close', ariaLabel: 'Close apply assist', textContent: '×', onclick: () => { observer.disconnect(); document.removeEventListener('input', record, true); document.removeEventListener('change', record, true); document.removeEventListener('click', recordCustom, true); host.remove(); delete w.__joblyAssist; } });
    panel.append(el('div', { class: 'head' }, el('span', { class: 'mark', ariaHidden: 'true', textContent: 'J' }),
      el('div', { class: 'title' }, 'Apply assist', el('small', { textContent: profileLabel ? `Profile: ${profileLabel}${job.company ? ` · ${job.company}` : ''}` : 'Jobly' })), minimize, close));
    const body = el('div', { class: 'body' });
    panel.append(body);

    if (state === 'no-profile') {
      body.append(el('p', { textContent: 'Apply assist fills forms from your Jobly profile. Set one up first: import your LinkedIn PDF and it takes a minute.' }),
        el('div', { class: 'row' }, el('button', { class: 'primary', type: 'button', textContent: 'Set up my profile', onclick: () => void send({ type: 'ASSIST_OPEN_PROFILE' }) })));
      return;
    }

    if (asking) {
      body.append(el('div', { class: 'ask' }, el('b', { textContent: 'Did you submit this application?' }),
        el('div', { class: 'row' },
          el('button', { class: 'primary', type: 'button', textContent: 'Yes, add to Applied', onclick: async () => { await send({ type: 'ASSIST_APPLIED', job: { ...job, description: '' } }); asking = false; message = 'Added to Saved › Applied in Jobly.'; render(); } }),
          el('button', { type: 'button', textContent: 'Not yet', onclick: () => { asking = false; render(); } }))));
    }

    const ready = answers.filter((a) => a.value && !a.filled);
    const need = answers.filter((a) => !a.value && !a.filled && (a.required || a.kind === 'custom'));
    const empty = answers.filter((a) => !a.value && !a.filled && !a.required && a.kind !== 'custom' && a.kind !== 'checkbox');
    const filled = answers.filter((a) => a.filled).length;
    body.append(el('p', { class: 'status' }, el('b', { textContent: `Step ${step || 1}` }),
      answers.length ? ` · ${ready.length} answer${ready.length === 1 ? '' : 's'} ready · ${need.length} need${need.length === 1 ? 's' : ''} you${filled ? ` · ${filled} done` : ''}` : ' · no questions found on this part of the page'));
    if (message) body.append(el('p', { class: 'done', role: 'status', textContent: message }));

    if (ready.length) {
      const list = el('ul');
      for (const a of ready) {
        const box = el('input', { type: 'checkbox', checked: a.include, ariaLabel: `Fill: ${a.label || 'unlabelled field'}`, onchange: (e: Event) => { a.include = (e.target as HTMLInputElement).checked; render(); } });
        list.append(el('li', {}, box, el('div', { class: 'cell' },
          el('span', { class: 'q', textContent: `${a.label || 'Unlabelled field'}${a.required ? ' *' : ''}${a.kind === 'custom' ? ' · picked from its list' : ''}` }),
          el('span', { class: 'a', textContent: a.kind === 'file' ? 'Your resume file' : a.value }),
          a.source ? el('span', { class: `src ${a.source}`, textContent: SOURCE_LABEL[a.source] }) : null)));
      }
      body.append(el('h4', { textContent: 'Ready for your approval' }), list);
    }
    if (need.length) {
      const list = el('ul');
      for (const a of need) {
        list.append(el('li', { class: 'need' }, el('span', { class: 'q', textContent: `${a.label || 'Unlabelled question'}${a.kind === 'custom' ? ' (choose on the page)' : ''}` }),
          el('button', { type: 'button', textContent: 'Go to field', ariaLabel: `Go to: ${a.label}`, onclick: () => { const f = fieldEl(a.id); f?.scrollIntoView({ block: 'center', behavior: 'smooth' }); f?.focus(); } })));
      }
      body.append(el('h4', { textContent: 'Action required' }), list,
        el('p', { class: 'note', textContent: 'Jobly remembers what you type here for the next form that asks. Questions about gender, ethnicity, disability, veteran status or ID numbers are never saved.' }));
    }
    if (empty.length) {
      body.append(el('details', {}, el('summary', { textContent: `${empty.length} optional question${empty.length === 1 ? '' : 's'} left empty` }),
        el('ul', {}, ...empty.map((a) => el('li', { class: 'need' }, el('span', { class: 'q', textContent: a.label || 'Unlabelled field' }),
          el('button', { type: 'button', textContent: 'Go to field', onclick: () => { const f = fieldEl(a.id); f?.scrollIntoView({ block: 'center' }); f?.focus(); } }))))));
    }

    const chosen = ready.filter((a) => a.include).length;
    panel.append(el('div', { class: 'foot' },
      el('div', { class: 'row' },
        el('button', { class: 'primary', type: 'button', disabled: !chosen || busy, textContent: busy ? 'Working…' : chosen ? `Fill ${chosen} answer${chosen === 1 ? '' : 's'}` : 'Nothing to fill', onclick: () => void fill() }),
        el('button', { type: 'button', textContent: 'Read this step again', onclick: () => { message = ''; void scan(true); } })),
      el('p', { class: 'note', textContent: 'You press Next and Submit on the page yourself. Jobly never does.' })));
  };

  // A new step of the form (the page swaps its questions): read it again, without filling anything
  let timer = 0;
  const observer = new MutationObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const fresh = Array.from(document.querySelectorAll('input:not([type=hidden]), textarea, select')).some((n) => !n.closest('[data-jobly-field]') && !(n as HTMLElement).hasAttribute('data-jobly-field') && (n as HTMLElement).offsetParent !== null);
      const gone = [...scannedIds].some((id) => !fieldEl(id));
      if (fresh || gone) { message = ''; void scan(true); }
    }, 700);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // The user pressing the site's own Submit: remember their answers and ask whether to add the job to Applied
  const onSubmitLike = () => {
    void remember();
    void send({ type: 'ASSIST_SUBMITTED', job: { ...job, description: '' } });
    window.setTimeout(() => { if (host.isConnected) { asking = true; render(); } }, 1200);
  };
  document.addEventListener('submit', (e) => { if (!host.contains(e.target as Node)) onSubmitLike(); }, true);
  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement | null)?.closest?.('button, input[type="submit"], [role="button"]') as HTMLElement | null;
    if (!t || host.contains(t)) return;
    const label = ((t as HTMLInputElement).value || t.textContent || t.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    if (SUBMIT.test(label) && t.closest('form') === null) onSubmitLike(); // inside a form the submit event above covers it
  }, true);

  w.__joblyAssist = { show: () => { panel.classList.remove('min'); void scan(true); } };
  render();
  void scan();
}

start();
