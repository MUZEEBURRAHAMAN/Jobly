import { apiGet, formatNumber } from './api';

const header = document.querySelector<HTMLElement>('[data-header]');

// ---------- header background once the page scrolls
const onScroll = () => header?.toggleAttribute('data-scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// ---------- mega menus: click or keyboard opens; a mouse can also hover; Esc / outside click / leaving focus closes
const roots = [...document.querySelectorAll<HTMLElement>('[data-menu-root]')];
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
let openRoot: HTMLElement | null = null;
let hoverTimer = 0;

function setOpen(root: HTMLElement, open: boolean) {
  const trigger = root.querySelector<HTMLButtonElement>('[data-menu-trigger]')!;
  const panel = root.querySelector<HTMLElement>('[data-menu]')!;
  trigger.setAttribute('aria-expanded', String(open));
  panel.toggleAttribute('data-open', open);
  if (open) { if (openRoot && openRoot !== root) setOpen(openRoot, false); openRoot = root; loadLiveStats(); mountLiveArt(root); }
  else if (openRoot === root) openRoot = null;
}

for (const root of roots) {
  const trigger = root.querySelector<HTMLButtonElement>('[data-menu-trigger]')!;
  trigger.addEventListener('click', () => setOpen(root, trigger.getAttribute('aria-expanded') !== 'true'));
  root.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse' || !finePointer.matches) return;
    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => setOpen(root, true), openRoot ? 0 : 90);
  });
  root.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => setOpen(root, false), 180);
  });
  root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget as Node | null)) setOpen(root, false); });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openRoot === root) { setOpen(root, false); trigger.focus(); }
    if (e.key === 'ArrowDown' && document.activeElement === trigger) {
      e.preventDefault(); setOpen(root, true);
      root.querySelector<HTMLAnchorElement>('[data-menu] a')?.focus();
    }
  });
}
document.addEventListener('pointerdown', (e) => { if (openRoot && !openRoot.contains(e.target as Node)) setOpen(openRoot, false); });

// ---------- mobile sheet
const toggle = document.querySelector<HTMLButtonElement>('[data-mobile-toggle]');
const sheet = document.querySelector<HTMLElement>('[data-mobile-sheet]');
function setSheet(open: boolean) {
  if (!toggle || !sheet) return;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  sheet.toggleAttribute('data-open', open);
  document.documentElement.style.overflow = open ? 'hidden' : '';
  if (open) sheet.querySelector<HTMLAnchorElement>('a')?.focus();
}
toggle?.addEventListener('click', () => setSheet(toggle.getAttribute('aria-expanded') !== 'true'));
sheet?.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a')) setSheet(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') { setSheet(false); toggle.focus(); } });
window.matchMedia('(min-width: 921px)').addEventListener('change', (e) => { if (e.matches) setSheet(false); });

// ---------- theme: follows the system until the visitor picks one
const themeBtn = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
const root = document.documentElement;
const label = () => themeBtn?.setAttribute('aria-label', root.dataset.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
label();
themeBtn?.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('jobly-theme', next); } catch { /* private mode: still switches for this page */ }
  label();
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  let saved: string | null = null;
  try { saved = localStorage.getItem('jobly-theme'); } catch { /* ignore */ }
  if (!saved) { root.dataset.theme = e.matches ? 'dark' : 'light'; label(); }
});

// ---------- live number in the Resources menu (loaded the first time a menu opens)
let statsLoaded = false;
function loadLiveStats() {
  if (statsLoaded) return;
  statsLoaded = true;
  apiGet<Record<string, number>>('/api/stats', {}, { timeoutMs: 15000 })
    .then((stats) => {
      document.querySelectorAll<HTMLElement>('[data-live-stat]').forEach((el) => {
        const v = stats[el.dataset.liveStat!];
        if (typeof v === 'number') el.textContent = formatNumber(v);
      });
    })
    .catch(() => { statsLoaded = false; /* keep the last known number; try again next time */ });
}

// ---------- the dot-matrix figure in the "Live right now" card (loaded only when that menu first opens)
let artMounted = false;
function mountLiveArt(menuRoot: HTMLElement) {
  const host = menuRoot.querySelector<HTMLElement>('[data-live-art]');
  if (!host || artMounted) return;
  artMounted = true;
  import('@lucasmarkes/hairline')
    .then(({ phosphor }) => phosphor(host, { play: true, intensity: 0.6 }))
    .catch(() => { artMounted = false; });
}
