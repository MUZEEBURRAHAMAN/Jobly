// Role pages: the latest jobs for one role, live from Jobly's server, with date and remote filters.
import { apiGet, formatNumber } from './api';

type Job = { id: number; title: string; company_name: string; location: string | null; posted_at: string | null; application_url: string; work_mode: string | null; seniority: string | null; salary_summary: string | null };
type Page = { items: Job[]; total: number };

const root = document.querySelector<HTMLElement>('[data-role-jobs]');
if (root) {
  const role = root.dataset.role!;
  const list = root.querySelector<HTMLOListElement>('[data-list]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const more = root.querySelector<HTMLButtonElement>('[data-more]')!;
  const remote = root.querySelector<HTMLInputElement>('[data-remote]')!;
  const PAGE = 20;
  const MODE: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', 'on-site': 'On-site' };
  const LEVEL: Record<string, string> = { intern: 'Intern', junior: 'Junior', mid: 'Mid-level', senior: 'Senior', lead: 'Lead / Staff' };
  let offset = 0, total = 0, request = 0;

  const days = () => Number(root.querySelector<HTMLInputElement>('input[name="days"]:checked')?.value ?? 7);
  const ago = (iso: string | null) => {
    if (!iso) return '';
    const mins = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 60) return 'Just now';
    const h = Math.round(mins / 60); if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24); return d === 1 ? 'Yesterday' : `${d} days ago`;
  };
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) => { const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e; };

  const card = (j: Job) => {
    const li = el('li', 'job');
    const av = el('span', 'av', (j.company_name || '?').trim().charAt(0).toUpperCase()); av.setAttribute('aria-hidden', 'true');
    const main = el('div', 'j-main');
    const title = el('p', 'j-title', j.title);
    const meta = el('p', 'j-meta');
    const age = ago(j.posted_at);
    if (age) meta.append(el('span', 'j-age', age));
    meta.append(el('span', '', j.company_name));
    if (j.location) meta.append(el('span', '', j.location));
    if (j.work_mode && MODE[j.work_mode]) meta.append(el('span', 'j-tag', MODE[j.work_mode]));
    if (j.seniority && LEVEL[j.seniority]) meta.append(el('span', 'j-tag', LEVEL[j.seniority]));
    if (j.salary_summary) meta.append(el('span', 'j-tag', j.salary_summary));
    main.append(title, meta);
    li.append(av, main);
    if (/^https?:\/\//.test(j.application_url)) {
      const a = el('a', 'btn btn-outline btn-sm j-apply', 'Apply') as HTMLAnchorElement;
      a.href = j.application_url; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
      a.setAttribute('aria-label', `Apply for ${j.title} at ${j.company_name} (opens the original listing in a new tab)`);
      li.append(a);
    }
    return li;
  };

  const load = async (reset: boolean) => {
    const mine = ++request;
    if (reset) { offset = 0; list.replaceChildren(...Array.from({ length: 5 }, () => el('li', 'skel'))); list.setAttribute('aria-busy', 'true'); }
    more.disabled = true;
    try {
      const page = await apiGet<Page>('/api/jobs', { role, freshness_days: days(), work_mode: remote.checked ? 'remote' : undefined, limit: PAGE, offset }, {
        timeoutMs: 60000, onSlow: () => { if (mine === request) status.textContent = 'Waking up the server, this can take up to a minute…'; },
      });
      if (mine !== request) return;
      total = page.total;
      const cards = page.items.map(card);
      if (reset) list.replaceChildren(...cards); else list.append(...cards);
      offset += page.items.length;
      more.hidden = offset >= total;
      status.textContent = total ? `${formatNumber(total)} ${total === 1 ? 'job' : 'jobs'} · showing ${formatNumber(offset)}` : 'No jobs in this range yet. Try a longer time range.';
    } catch {
      if (mine !== request) return;
      if (reset) list.replaceChildren();
      status.textContent = 'Couldn’t load jobs right now. Please try again in a minute.';
    } finally {
      if (mine === request) { list.removeAttribute('aria-busy'); more.disabled = false; }
    }
  };

  root.querySelectorAll('input[name="days"]').forEach((r) => r.addEventListener('change', () => load(true)));
  remote.addEventListener('change', () => load(true));
  more.addEventListener('click', () => load(false));
  load(true);

  // The "posted in the last 7 days" badge in the hero.
  const week = document.querySelector<HTMLElement>('[data-week]');
  if (week) apiGet<Page>('/api/jobs', { role, freshness_days: 7, limit: 1 }, { timeoutMs: 60000 })
    .then((p) => { week.textContent = formatNumber(p.total); })
    .catch(() => { week.parentElement!.hidden = true; });
}
