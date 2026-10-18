// How dates work: live counts of open jobs by age. The API answers "posted within N days", so each bar is the
// difference between two of those counts.
import { apiGet, formatNumber } from './api';

const chart = document.querySelector<HTMLElement>('[data-freshness]');
if (chart) {
  const status = chart.querySelector<HTMLElement>('[data-chart-status]')!;
  const days = [1, 7, 14, 30, 60];
  Promise.all(days.map((d) => apiGet<{ total: number }>('/api/jobs', { freshness_days: d, limit: 1 }, {
    timeoutMs: 60000, onSlow: () => { status.textContent = 'Waking up the server, this can take up to a minute…'; },
  })))
    .then((res) => {
      const totals = res.map((r) => r.total);
      const counts = totals.map((t, i) => Math.max(0, t - (i ? totals[i - 1] : 0)));
      const max = Math.max(...counts, 1);
      const draw = () => days.forEach((d, i) => {
        const row = chart.querySelector<HTMLElement>(`[data-bucket="${d}"]`)!;
        row.querySelector<HTMLElement>('.b-fill')!.style.width = `${(counts[i] / max) * 100}%`;
        row.querySelector<HTMLElement>('[data-value]')!.textContent = formatNumber(counts[i]);
      });
      const week = totals[1];
      status.textContent = `${formatNumber(totals[4])} open jobs with a known date · ${Math.round((week / Math.max(totals[4], 1)) * 100)}% posted in the last 7 days`;
      // Grow the bars when the chart scrolls into view.
      new IntersectionObserver(([e], io) => { if (e.isIntersecting) { draw(); io.disconnect(); } }, { threshold: 0.3 }).observe(chart);
    })
    .catch(() => { status.textContent = 'Live numbers are unavailable right now. Please try again in a minute.'; });
}
