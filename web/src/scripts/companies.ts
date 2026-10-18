// Companies page: refresh the list from the live API, then search, filter and sort it in the browser.
import { apiGet } from './api';

type Company = { id: number; name: string; careers_url: string; source_type: string; job_count: number };
const root = document.querySelector<HTMLElement>('[data-companies]');

if (root) {
  const list = root.querySelector<HTMLUListElement>('[data-list]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const empty = root.querySelector<HTMLElement>('[data-empty]')!;
  const search = root.querySelector<HTMLInputElement>('[data-search]')!;
  const sort = root.querySelector<HTMLSelectElement>('[data-sort]')!;
  const labels: Record<string, [string, 'career' | 'board']> = {
    greenhouse: ['Greenhouse', 'career'], ashby: ['Ashby', 'career'], lever: ['Lever', 'career'], workday: ['Workday', 'career'],
    amazon: ['Amazon Jobs', 'career'], custom: ['Careers page', 'career'], weworkremotely: ['We Work Remotely', 'board'],
    remotive: ['Remotive', 'board'], himalayas: ['Himalayas', 'board'], arbeitnow: ['Arbeitnow', 'board'],
  };
  const arrow = list.querySelector('.co-link svg')?.outerHTML ?? '↗';
  let data: Company[] | null = null;

  const kind = () => root.querySelector<HTMLInputElement>('input[name="kind"]:checked')?.value ?? 'all';

  const item = (c: Company) => {
    const [label, k] = labels[c.source_type] ?? [c.source_type, 'career'];
    const li = document.createElement('li');
    li.className = 'co';
    li.dataset.kind = k;
    const av = Object.assign(document.createElement('span'), { className: 'av', textContent: c.name.trim().charAt(0).toUpperCase() });
    av.setAttribute('aria-hidden', 'true');
    const main = Object.assign(document.createElement('span'), { className: 'co-main' });
    main.append(Object.assign(document.createElement('span'), { className: 'co-name', textContent: c.name }),
      Object.assign(document.createElement('span'), { className: 'co-meta', textContent: `${label} · ${c.job_count} open ${c.job_count === 1 ? 'job' : 'jobs'}` }));
    li.append(av, main);
    if (k === 'career' && /^https:\/\//.test(c.careers_url)) {
      const a = Object.assign(document.createElement('a'), { className: 'co-link', href: c.careers_url, target: '_blank', rel: 'noopener nofollow' });
      a.setAttribute('aria-label', `${c.name} careers page (opens in a new tab)`);
      a.innerHTML = arrow; // our own icon markup, copied from the server-rendered list
      li.append(a);
    }
    return li;
  };

  // Astro scopes styles with a data attribute: copy it onto the items we create so they keep their look.
  const scope = [...(list.attributes as unknown as Attr[])].find((a) => a.name.startsWith('data-astro-cid'))?.name;
  const tag = (el: Element) => { if (scope) { el.setAttribute(scope, ''); el.querySelectorAll('*').forEach((c) => c.setAttribute(scope, '')); } return el; };

  const render = () => {
    if (!data) return;
    const q = search.value.trim().toLowerCase();
    const k = kind();
    const rows = data
      .filter((c) => (k === 'all' || (labels[c.source_type]?.[1] ?? 'career') === k) && (!q || c.name.toLowerCase().includes(q)))
      .sort(sort.value === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.job_count - a.job_count || a.name.localeCompare(b.name));
    list.replaceChildren(...rows.map((c) => tag(item(c))));
    empty.hidden = rows.length > 0;
    status.textContent = rows.length === data.length ? `${data.length} companies` : `${rows.length} of ${data.length} companies`;
  };

  // Until the live list arrives, filter what the server rendered.
  const readInitial = (): Company[] => [...list.querySelectorAll<HTMLLIElement>('.co')].map((li, i) => {
    const meta = li.querySelector('.co-meta')?.textContent ?? '';
    const label = meta.split(' · ')[0];
    const source = Object.entries(labels).find(([, [l]]) => l === label)?.[0] ?? 'custom';
    return { id: i, name: li.querySelector('.co-name')?.textContent ?? '', careers_url: li.querySelector('a')?.getAttribute('href') ?? '', source_type: source, job_count: Number(meta.match(/(\d+) open/)?.[1] ?? 0) };
  });
  if (list.children.length) data = readInitial();

  search.addEventListener('input', render);
  sort.addEventListener('change', render);
  root.querySelectorAll('input[name="kind"]').forEach((r) => r.addEventListener('change', render));

  apiGet<Company[]>('/api/companies', {}, { timeoutMs: 60000, onSlow: () => { if (!data) status.textContent = 'Waking up the server, this can take up to a minute…'; } })
    .then((live) => {
      data = live;
      const career = live.filter((c) => (labels[c.source_type]?.[1] ?? 'career') === 'career').length;
      root.querySelector('[data-sum="career"]')!.textContent = String(career);
      root.querySelector('[data-sum="board"]')!.textContent = String(live.length - career);
      render();
    })
    .catch(() => { if (!data) status.textContent = 'Couldn’t load the list right now. Please try again in a minute.'; });
}
