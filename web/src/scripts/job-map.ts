// "Where the jobs are": a dotted world map on a canvas. Land is a grid of small dots; each hiring hub is a cluster
// sized by its open jobs. Near the pointer the land dots swell, and a hovered cluster pulls its dots together into one
// brand-coloured blob with a halo and a card of numbers. Rows in the country list drive the same highlight, so the
// whole thing works with a keyboard and on touch. Numbers refresh live from /api/geo.
import { apiGet, formatNumber } from './api';
import { ROLE_LABELS, type Geo, type GeoPlace } from '../lib/geo';

type Grid = { w: number; h: number; ystep: number; lat: [number, number]; lng: [number, number]; dots: number[] };
type Sat = { a: number; d: number; s: number };
type Cluster = { place: GeoPlace; x: number; y: number; r: number; sats: Sat[]; hover: number; target: number };
type Focus = { clusters: number[]; anchor: number; title: string; sub: string; roles: Record<string, number>; sticky: boolean };

const root = document.querySelector<HTMLElement>('[data-job-map]');
if (root) init(root);

function init(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const stage = canvas.parentElement as HTMLElement;                       // the wide inner box the canvas fills
  const frame_ = stage.closest<HTMLElement>('.stage')!;                    // the visible frame (it scrolls on phones)
  const scroller = stage.closest<HTMLElement>('[data-scroll]')!;
  const tip = root.querySelector<HTMLElement>('[data-tip]')!;
  const list = root.querySelector<HTMLOListElement>('[data-list]')!;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let grid: Grid | null = null;
  let geo: Geo | null = null;
  let land = new Float32Array(0);          // x, y of every land dot, in CSS pixels
  let clusters: Cluster[] = [];
  let focus: Focus | null = null;
  let cell = 6, cssW = 0, cssH = 0, dpr = 1;
  let intro = reduce ? 1 : 0, introStart = 0, started = reduce;
  const pointer = { x: -999, y: -999, strength: 0, target: 0 };
  let raf = 0;
  const colors = { land: '#d4d4d2', ink: '#0a0a0a', brand: '#b83a0a', card: '#ffffff' };

  const readColors = () => {
    const css = getComputedStyle(document.documentElement);
    const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    colors.land = get('--border-strong', colors.land); colors.ink = get('--ink', colors.ink); colors.brand = get('--brand', colors.brand); colors.card = get('--card', colors.card);
  };

  // ---------- layout: project the land grid and the places onto the canvas
  const project = (lat: number, lng: number) => {
    const g = grid!;
    return { x: ((lng - g.lng[0]) / (g.lng[1] - g.lng[0])) * g.w * cell, y: ((g.lat[1] - lat) / (g.lat[1] - g.lat[0])) * g.h * cell };
  };
  const seeded = (seed: string) => { // small deterministic random numbers, so a cluster keeps its shape between visits
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (((h ^= h >>> 16) >>> 0) / 4294967296); };
  };
  const buildClusters = () => {
    if (!grid || !geo) return;
    clusters = geo.places.map((place) => {
      const { x, y } = project(place.lat, place.lng);
      const rnd = seeded(place.name);
      const count = Math.min(11, 2 + Math.round(Math.log2(place.jobs + 1) * 1.2));
      const sats = Array.from({ length: count }, () => ({ a: rnd() * Math.PI * 2, d: 0.95 + rnd() * 0.65, s: 0.2 + rnd() * 0.2 }));
      return { place, x, y, r: cell * (0.5 + 0.085 * Math.sqrt(place.jobs)), sats, hover: 0, target: 0 };
    });
    // keep the previous highlight pointing at the same place after a refresh
    if (focus) setFocus(null);
  };
  const layout = () => {
    if (!grid) return;
    const rect = stage.getBoundingClientRect();
    cssW = Math.max(280, Math.round(rect.width)); cell = cssW / grid.w; cssH = Math.round(grid.h * cell);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    land = new Float32Array(grid.dots.length);
    for (let i = 0; i < grid.dots.length; i += 2) { land[i] = (grid.dots[i] / 2) * cell; land[i + 1] = grid.dots[i + 1] * grid.ystep * cell; }
    buildClusters();
    draw();
    // A map wider than its frame (phones) must be reachable by keyboard too, (it starts at the left edge, over the Americas)
    const wide = scroller.scrollWidth > scroller.clientWidth + 2;
    if (wide && !scroller.hasAttribute('tabindex')) { scroller.tabIndex = 0; scroller.setAttribute('role', 'region'); scroller.setAttribute('aria-label', 'Map of tech jobs by place, scrolls sideways') ; }
    if (!wide && scroller.hasAttribute('tabindex')) { scroller.removeAttribute('tabindex'); scroller.removeAttribute('role'); scroller.removeAttribute('aria-label'); }
  };

  // ---------- drawing
  const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  const back = (t: number) => { const c = 1.9, x = Math.min(1, Math.max(0, t)) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };

  function draw() {
    ctx!.clearRect(0, 0, cssW, cssH);
    if (!grid) return;
    const swellR = cell * 12, base = cell * 0.3;
    ctx!.fillStyle = colors.land;
    ctx!.beginPath();
    for (let i = 0; i < land.length; i += 2) {
      const x = land[i], y = land[i + 1];
      const wave = intro >= 1 ? 1 : ease(intro * 1.7 - (x / cssW) * 0.7);
      if (wave <= 0) continue;
      let r = base * wave;
      if (pointer.strength > 0.01) {
        const dx = x - pointer.x, dy = y - pointer.y, d2 = dx * dx + dy * dy;
        if (d2 < swellR * swellR) { const k = 1 - Math.sqrt(d2) / swellR; r *= 1 + 1.3 * k * k * pointer.strength; }
      }
      ctx!.moveTo(x + r, y); ctx!.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx!.fill();

    clusters.forEach((c, i) => {
      const appear = intro >= 1 ? 1 : back((intro - 0.35 - (c.x / cssW) * 0.35) / 0.35);
      if (appear <= 0) return;
      const h = c.hover, r = c.r * appear;
      if (h > 0.01) { // halo
        ctx!.fillStyle = colors.brand; ctx!.globalAlpha = 0.16 * h;
        ctx!.beginPath(); ctx!.arc(c.x, c.y, r * (2.1 + 0.9 * h), 0, Math.PI * 2); ctx!.fill(); ctx!.globalAlpha = 1;
      }
      ctx!.fillStyle = h > 0.02 ? mix(colors.ink, colors.brand, h) : colors.ink;
      ctx!.beginPath();
      for (const s of c.sats) { // satellites drift in and swell as the cluster is hovered
        const d = r * s.d * (1 - 0.62 * h), sr = r * s.s * (1 + 1.1 * h);
        const sx = c.x + Math.cos(s.a) * d, sy = c.y + Math.sin(s.a) * d;
        ctx!.moveTo(sx + sr, sy); ctx!.arc(sx, sy, sr, 0, Math.PI * 2);
      }
      const core = r * 0.62 * (1 + 0.45 * h);
      ctx!.moveTo(c.x + core, c.y); ctx!.arc(c.x, c.y, core, 0, Math.PI * 2);
      ctx!.fill();
      if (h > 0.5) { // a small bright centre, like the star in lassie's flowers
        ctx!.fillStyle = colors.card; ctx!.globalAlpha = (h - 0.5) * 2;
        ctx!.beginPath(); ctx!.arc(c.x, c.y, Math.max(1.2, core * 0.22), 0, Math.PI * 2); ctx!.fill(); ctx!.globalAlpha = 1;
      }
      void i;
    });
  }
  const mix = (a: string, b: string, t: number) => {
    const pa = hex(a), pb = hex(b);
    return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)} ${Math.round(pa[1] + (pb[1] - pa[1]) * t)} ${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`;
  };
  const hex = (c: string): [number, number, number] => {
    const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
    if (m) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
    const m3 = /^#?([0-9a-f]{3})$/i.exec(c.trim());
    if (m3) return [...m3[1]].map((x) => parseInt(x + x, 16)) as [number, number, number];
    return [128, 128, 128];
  };

  // ---------- animation loop: runs only while something is moving
  const frame = (now: number) => {
    raf = 0;
    let busy = false;
    if (started && intro < 1) { intro = Math.min(1, (now - introStart) / 1500); busy = intro < 1; }
    const k = reduce ? 1 : 0.2;
    for (const c of clusters) { const d = c.target - c.hover; if (Math.abs(d) > 0.004) { c.hover += d * k; busy = true; } else c.hover = c.target; }
    const ps = pointer.target - pointer.strength;
    if (Math.abs(ps) > 0.004) { pointer.strength += ps * (reduce ? 1 : 0.16); busy = true; } else pointer.strength = pointer.target;
    draw();
    if (busy) raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };

  // ---------- the highlight card
  const clusterRoles = (roles: Record<string, number>) => Object.entries(roles).sort((a, b) => b[1] - a[1]);
  function showTip() {
    if (!focus) { tip.removeAttribute('data-open'); return; }
    tip.querySelector('[data-t="name"]')!.textContent = focus.title;
    tip.querySelector('[data-t="sub"]')!.textContent = focus.sub;
    const ul = tip.querySelector<HTMLElement>('[data-t="roles"]')!;
    const narrowNow = frame_.clientWidth < 520;
    const entries = clusterRoles(focus.roles).slice(0, narrowNow ? 3 : 5), max = entries[0]?.[1] || 1;
    ul.replaceChildren(...entries.map(([role, n]) => {
      const li = document.createElement('li');
      const name = Object.assign(document.createElement('span'), { textContent: ROLE_LABELS[role] ?? role });
      const num = Object.assign(document.createElement('span'), { textContent: formatNumber(n) });
      const bar = document.createElement('span'); bar.className = 'bar';
      const fill = document.createElement('span'); fill.style.width = `${Math.max(4, (n / max) * 100)}%`; bar.append(fill);
      li.append(name, num, bar);
      return li;
    }));
    // The card lives in the visible frame (the map may be scrolled sideways on phones), so work in frame coordinates.
    const frameW = frame_.clientWidth, sl = scroller.scrollLeft, narrow = frameW < 520;
    const box = focus.clusters.reduce((b, i) => {
      const c = clusters[i], reach = c.r * 2.4;
      return { x0: Math.min(b.x0, c.x - reach - sl), x1: Math.max(b.x1, c.x + reach - sl), y0: Math.min(b.y0, c.y - reach), y1: Math.max(b.y1, c.y + reach) };
    }, { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
    tip.style.width = narrow ? `${frameW - 8}px` : '';
    tip.toggleAttribute('data-narrow', narrow);
    const w = tip.offsetWidth || 288, h = tip.offsetHeight || 150;
    let left: number, top: number;
    if (narrow) { // phones: a full-width card on the half of the map the cluster isn't in
      left = 4; top = (box.y0 + box.y1) / 2 < cssH / 2 ? cssH - h : 0;
    } else { // desktop: beside the whole highlighted group (one cluster, or every cluster of a country), never on top of it
      const right = box.x1 + 10, leftSide = box.x0 - w - 10;
      left = Math.min(frameW - w - 4, Math.max(4, right + w <= frameW - 4 ? right : leftSide >= 4 ? leftSide : right));
      top = Math.min(cssH - h, Math.max(0, (box.y0 + box.y1) / 2 - h / 2));
    }
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(Math.max(0, top))}px)`;
    tip.setAttribute('data-open', '');
  }
  function setFocus(next: Focus | null) {
    focus = next;
    const on = new Set(next?.clusters ?? []);
    clusters.forEach((c, i) => { c.target = on.has(i) ? 1 : 0; });
    list.querySelectorAll<HTMLElement>('[data-country]').forEach((row) => {
      const mine = !!next && geo?.places.some((p, i) => on.has(i) && p.country === row.dataset.country) && next.title === row.dataset.country;
      row.toggleAttribute('data-on', !!mine);
    });
    canvas.toggleAttribute('data-hover', !!next);
    showTip();
    wake();
  }
  // A "country" dot holds the jobs in a country outside its named hubs; say so when the country also has hubs
  const placeTitle = (p: GeoPlace) => (p.kind === 'country' && geo?.places.some((q) => q.kind === 'hub' && q.country === p.country) ? `Elsewhere in ${p.country}` : p.name);
  const focusOnPlace = (i: number, sticky = false): Focus => {
    const p = clusters[i].place;
    return { clusters: [i], anchor: i, title: placeTitle(p), sub: `${p.kind === 'hub' ? p.country + ' · ' : ''}${formatNumber(p.jobs)} jobs · ${p.employers} employers`, roles: p.roles, sticky };
  };
  const focusOnCountry = (country: string): Focus | null => {
    const row = geo?.by_country.find((c) => c.country === country);
    const idx = clusters.map((c, i) => (c.place.country === country ? i : -1)).filter((i) => i >= 0);
    if (!row || !idx.length) return null;
    const anchor = idx.reduce((a, b) => (clusters[b].place.jobs > clusters[a].place.jobs ? b : a));
    return { clusters: idx, anchor, title: country, sub: `${formatNumber(row.jobs)} jobs · ${row.employers} employers`, roles: row.roles, sticky: false };
  };

  // ---------- pointer, touch and keyboard
  const nearest = (x: number, y: number) => {
    let best = -1, bestD = Infinity;
    clusters.forEach((c, i) => {
      const reach = c.r * 2.3 + 8, d = Math.hypot(x - c.x, y - c.y);
      if (d < reach && d / reach < bestD) { best = i; bestD = d / reach; }
    });
    return best;
  };
  const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * cssW, y: ((e.clientY - r.top) / r.height) * cssH }; };
  canvas.addEventListener('pointermove', (e) => {
    const p = local(e); pointer.x = p.x; pointer.y = p.y;
    pointer.target = e.pointerType === 'mouse' ? 1 : 0;
    frame_.setAttribute('data-used', '');
    if (!focus?.sticky) { const i = nearest(p.x, p.y); if (i < 0) { if (focus) setFocus(null); } else if (!focus || focus.anchor !== i || focus.clusters.length > 1) setFocus(focusOnPlace(i)); }
    wake();
  });
  canvas.addEventListener('pointerleave', () => { pointer.target = 0; if (!focus?.sticky) setFocus(null); wake(); });
  canvas.addEventListener('pointerdown', (e) => { // touch: tap a cluster to open it, tap elsewhere to close
    if (e.pointerType === 'mouse') return;
    const p = local(e), i = nearest(p.x, p.y);
    frame_.setAttribute('data-used', '');
    setFocus(i < 0 ? null : focusOnPlace(i, true));
  });
  document.addEventListener('pointerdown', (e) => { if (focus?.sticky && !frame_.contains(e.target as Node)) setFocus(null); });
  scroller.addEventListener('scroll', () => { if (focus) showTip(); }, { passive: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && focus) setFocus(null); });

  const bindList = () => {
    list.querySelectorAll<HTMLElement>('[data-country]').forEach((row) => {
      const country = row.dataset.country!;
      const on = () => { const f = focusOnCountry(country); if (f) setFocus(f); };
      const off = () => setFocus(null);
      row.addEventListener('pointerenter', on); row.addEventListener('pointerleave', off);
      row.addEventListener('focus', on); row.addEventListener('blur', off);
      row.addEventListener('click', () => { const f = focusOnCountry(country); if (f) setFocus({ ...f, sticky: true }); });
    });
  };

  // ---------- live numbers
  const fmtInto = (key: string, value: string) => root.querySelectorAll<HTMLElement>(`[data-geo="${key}"]`).forEach((el) => { el.textContent = value; });
  const scope = [...(list.attributes as unknown as Attr[])].find((a) => a.name.startsWith('data-astro-cid'))?.name;
  const tag = <T extends Element>(el: T): T => { if (scope) { el.setAttribute(scope, ''); el.querySelectorAll('*').forEach((c) => c.setAttribute(scope, '')); } return el; };
  const renderList = () => {
    if (!geo) return;
    const top = geo.by_country.slice(0, 10), max = top[0]?.jobs || 1;
    list.replaceChildren(...top.map((c) => {
      const li = document.createElement('li');
      li.innerHTML = `<button type="button" class="c-row" data-country=""><span class="c-name"></span><span class="c-bar" aria-hidden="true"><span class="c-fill"></span></span><span class="c-num"></span></button>`;
      const b = li.querySelector('button')!;
      b.dataset.country = c.country;
      li.querySelector('.c-name')!.textContent = c.country;
      const num = li.querySelector('.c-num')!;
      num.innerHTML = '<span class="sr-only">, </span><span class="n"></span><span class="sr-only"></span>';
      num.querySelector('.n')!.textContent = formatNumber(c.jobs);
      num.querySelector('.sr-only:last-child')!.textContent = ` tech jobs at ${c.employers} employers`;
      li.querySelector('.c-fill')!.classList.add(`w${Math.max(5, Math.round((c.jobs / max) * 20) * 5)}`);
      return tag(li);
    }));
    requestAnimationFrame(() => list.querySelectorAll('li').forEach((li) => li.classList.add('in')));
    bindList();
  };
  const applyGeo = (g: Geo) => {
    geo = g;
    fmtInto('total', formatNumber(g.total)); fmtInto('total2', formatNumber(g.total)); fmtInto('countries', String(g.countries)); fmtInto('countries2', String(g.countries));
    fmtInto('employers', formatNumber(g.employers)); fmtInto('hubs', String(g.places.filter((p) => p.kind === 'hub').length));
    renderList(); buildClusters(); draw();
  };

  // ---------- go
  new ResizeObserver(() => { const w = Math.round(stage.getBoundingClientRect().width); if (grid && w && w !== cssW) layout(); }).observe(stage);
  new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { started = true; introStart = performance.now(); wake(); io.disconnect(); } }, { threshold: 0.3 }).observe(frame_);
  bindList();
  readColors();

  // The build-time numbers are embedded in the page, so the map draws at once; the live answer then refreshes everything.
  const seedEl = root.querySelector<HTMLScriptElement>('script[data-geo-seed]');
  if (seedEl?.textContent) { try { geo = JSON.parse(seedEl.textContent) as Geo; } catch { geo = null; } }

  Promise.all([
    fetch('/data/world-dots.json').then((r) => r.json() as Promise<Grid>),
    apiGet<Geo>('/api/geo', {}, { timeoutMs: 60000 }).catch(() => null),
  ]).then(([g, live]) => {
    grid = g;
    layout();
    if (live && live.total > 0) applyGeo(live);
  }).catch(() => { /* the numbers and the list still tell the story without the map */ });
}
