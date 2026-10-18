// Jobs index: how many jobs each role got in the last 7 days.
import { apiGet, formatNumber } from './api';

document.querySelectorAll<HTMLElement>('[data-count-role]').forEach((el) => {
  apiGet<{ total: number }>('/api/jobs', { role: el.dataset.countRole, freshness_days: 7, limit: 1 }, { timeoutMs: 60000 })
    .then((p) => { el.textContent = formatNumber(p.total); })
    .catch(() => { el.closest('.count')?.setAttribute('hidden', ''); });
});
