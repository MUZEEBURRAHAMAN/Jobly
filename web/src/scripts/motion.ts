// Page-wide motion: scroll reveal, count-up numbers, lazy hairline figures, and "play when visible" mocks.
import { apiGet, formatNumber } from './api';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- reveal on scroll, with a short stagger inside [data-stagger] groups
document.querySelectorAll<HTMLElement>('[data-stagger]').forEach((group) => {
  group.querySelectorAll<HTMLElement>(':scope > [data-reveal]').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i, 8) * 70}ms`; });
});
const revealer = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); revealer.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
document.querySelectorAll<HTMLElement>('[data-reveal], [data-play]').forEach((el) => revealer.observe(el));

// ---------- animated mocks only run while on screen
const player = new IntersectionObserver((entries) => {
  for (const e of entries) (e.target as HTMLElement).toggleAttribute('data-playing', e.isIntersecting && !reduce);
}, { threshold: 0.2 });
document.querySelectorAll<HTMLElement>('[data-play]').forEach((el) => player.observe(el));

// ---------- hairline figures: load the library once, mount each figure near the viewport, pause it off screen
type Fig = { update(o: { play?: boolean }): void };
const figs = new Map<HTMLElement, Fig>();
let lib: Promise<Record<string, (el: HTMLElement, o?: object) => Fig>> | null = null;
const figureWatcher = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const host = e.target as HTMLElement;
    const fig = figs.get(host);
    if (fig) { fig.update({ play: e.isIntersecting && host.dataset.autoplay !== 'false' }); continue; }
    if (!e.isIntersecting) continue;
    lib ??= import('@lucasmarkes/hairline') as unknown as Promise<Record<string, (el: HTMLElement, o?: object) => Fig>>;
    lib.then((m) => {
      if (figs.has(host)) return;
      const make = m[host.dataset.figure!];
      if (!make) return;
      figs.set(host, make(host, { play: host.dataset.autoplay !== 'false', intensity: Number(host.dataset.intensity ?? 0.6), label: host.dataset.label }));
      // Decorative figures stay out of the reading order; figures that take the keyboard keep their name.
      if (!host.hasAttribute('tabindex')) host.setAttribute('aria-hidden', 'true');
    }).catch(() => { /* the figure is decoration: the page works without it */ });
  }
}, { rootMargin: '200px 0px' });
document.querySelectorAll<HTMLElement>('[data-figure]').forEach((el) => figureWatcher.observe(el));

// ---------- live numbers: [data-count="new_jobs_today"] etc., counted up when they scroll in
type Stats = Record<string, number | string | null>;
const countEls = [...document.querySelectorAll<HTMLElement>('[data-count]')];
const sinceEls = [...document.querySelectorAll<HTMLElement>('[data-updated]')];

function countUp(el: HTMLElement, to: number) {
  if (reduce) { el.textContent = formatNumber(to); return; }
  const start = performance.now();
  const dur = 1100;
  const tick = (t: number) => {
    const p = Math.min(1, (t - start) / dur);
    el.textContent = formatNumber(Math.round(to * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

if (countEls.length || sinceEls.length) {
  const want = new Set(countEls.map((el) => el.dataset.count!));
  const stats = apiGet<Stats>('/api/stats', {}, { timeoutMs: 20000 });
  const week = want.has('week') ? apiGet<{ total: number }>('/api/jobs', { freshness_days: 7, limit: 1 }, { timeoutMs: 20000 }) : null;
  Promise.all([stats, week]).then(([s, w]) => {
    const values: Record<string, number> = { ...(Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === 'number')) as Record<string, number>) };
    if (w) values.week = w.total;
    const counter = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        const v = values[el.dataset.count!];
        if (typeof v === 'number') countUp(el, v);
        counter.unobserve(el);
      }
    }, { threshold: 0.4 });
    countEls.forEach((el) => counter.observe(el));
    const last = typeof s.last_sync_time === 'string' ? new Date(s.last_sync_time) : null;
    if (last && !Number.isNaN(last.getTime())) {
      const mins = Math.max(1, Math.round((Date.now() - last.getTime()) / 60000));
      const text = mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
      sinceEls.forEach((el) => { el.textContent = `Jobs updated ${text}`; el.closest('[data-status]')?.setAttribute('data-status', 'ok'); });
    }
  }).catch(() => { /* keep the rounded numbers already on the page */ });
}
