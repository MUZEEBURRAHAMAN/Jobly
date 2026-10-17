import { apiGet, formatNumber } from './api';
import { installHref } from '../lib/site';

const form = document.querySelector<HTMLFormElement>('[data-hero-search]');
const result = document.querySelector<HTMLElement>('[data-result]');

function init(form: HTMLFormElement, result: HTMLElement) {
  const input = form.querySelector<HTMLInputElement>('input[name="q"]')!;
  const days = form.querySelector<HTMLSelectElement>('select[name="days"]')!;
  const remote = form.querySelector<HTMLInputElement>('input[name="remote"]')!;
  const chips = [...document.querySelectorAll<HTMLButtonElement>('.chip[data-role]')];
  const examples: string[] = JSON.parse(form.dataset.examples || '[]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ---------- the search box types example searches by itself until someone uses it
  const basePlaceholder = input.placeholder;
  let typing = true;
  let timer = 0;
  let visible = true;
  const stopTyping = () => { typing = false; window.clearTimeout(timer); input.placeholder = basePlaceholder; };

  function typeLoop(i = 0, chars = 0, deleting = false) {
    if (!typing) return;
    if (!visible || document.hidden) { timer = window.setTimeout(() => typeLoop(i, chars, deleting), 600); return; }
    const word = examples[i % examples.length];
    input.placeholder = word.slice(0, chars) + '│';
    if (!deleting && chars < word.length) timer = window.setTimeout(() => typeLoop(i, chars + 1, false), 55 + Math.random() * 45);
    else if (!deleting) timer = window.setTimeout(() => typeLoop(i, chars, true), 1700);
    else if (chars > 0) timer = window.setTimeout(() => typeLoop(i, chars - 1, true), 28);
    else timer = window.setTimeout(() => typeLoop(i + 1, 0, false), 350);
  }
  if (!reduceMotion.matches && examples.length) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(form);
    timer = window.setTimeout(() => typeLoop(), 900);
  }
  input.addEventListener('focus', stopTyping);
  input.addEventListener('input', () => { stopTyping(); setRole(null); });

  // ---------- role chips fill the box and search straight away
  let role: string | null = null;
  function setRole(next: HTMLButtonElement | null) {
    role = next?.dataset.role ?? null;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === next)));
  }
  chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      stopTyping();
      const already = chip.getAttribute('aria-pressed') === 'true';
      setRole(already ? null : chip);
      input.value = already ? '' : chip.textContent!.trim();
      if (!already) void run();
      else result.textContent = '';
    });
  }

  // ---------- live counts from the Jobly API
  type Count = { total: number };
  const cache = new Map<string, number>();
  let seq = 0;

  async function count(params: Record<string, string | undefined>, onSlow: () => void) {
    const key = JSON.stringify(params);
    if (cache.has(key)) return cache.get(key)!;
    const res = await apiGet<Count>('/api/jobs', { ...params, limit: '1' }, { onSlow });
    cache.set(key, res.total);
    return res.total;
  }

  const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  const icon = (d: string) => `<svg class="icon spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const SPINNER = icon('M21 12a9 9 0 1 1-6.219-8.56');
  const PERIOD: Record<string, string> = { '1': 'in the last 24 hours', '7': 'in the past week', '30': 'in the past month' };

  async function run() {
    const q = input.value.trim();
    if (!q && !role) { input.focus(); result.innerHTML = 'Type a job title, skill or city, or pick a role below.'; return; }
    const mine = ++seq;
    const base: Record<string, string | undefined> = role ? { role } : { search: q.slice(0, 100) };
    if (remote.checked) base.work_mode = 'remote';
    const what = `“${esc(q || 'this role')}”${remote.checked ? ', remote' : ''}`;
    result.innerHTML = `<span class="res-row">${SPINNER} Checking live jobs…</span>`;
    const slow = () => { if (mine === seq) result.innerHTML = `<span class="res-row">${SPINNER} Waking the server up. This can take up to 30 seconds on the free plan…</span>`; };
    try {
      const install = `<a class="res-link" href="${installHref}">Get alerts for these</a>`;
      if (days.value) {
        const n = await count({ ...base, freshness_days: days.value }, slow);
        if (mine !== seq) return;
        result.innerHTML = n
          ? `<span class="res-row"><span><strong>${formatNumber(n)}</strong> ${n === 1 ? 'job' : 'jobs'} matching ${what} went up ${PERIOD[days.value]}.</span> ${install}</span>`
          : `No jobs matching ${what} went up ${PERIOD[days.value]}. Try “Any time” or a broader word.`;
        return;
      }
      const [all, week] = await Promise.all([count(base, slow), count({ ...base, freshness_days: '7' }, slow)]);
      if (mine !== seq) return;
      result.innerHTML = all
        ? `<span class="res-row"><span><strong>${formatNumber(all)}</strong> open ${all === 1 ? 'job matches' : 'jobs match'} ${what}. <strong>${formatNumber(week)}</strong> went up this week.</span> ${install}</span>`
        : `No open jobs match ${what} right now. Try a broader word, like “designer” or “engineer”.`;
    } catch {
      if (mine === seq) result.innerHTML = `<span class="res-error">Couldn't reach Jobly right now. Try again in a minute.</span>`;
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); stopTyping(); void run(); });
  days.addEventListener('change', () => { if (input.value.trim() || role) void run(); });
  remote.addEventListener('change', () => { if (input.value.trim() || role) void run(); });
}

if (form && result) init(form, result);
