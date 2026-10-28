// Numbers for the dashboard, from the applications' status histories.
import type { Application, Status } from './types';

const RANK: Record<Status, number> = { draft: 0, applied: 1, interviewing: 2, offer: 3, closed: -1 };
const DAY = 86_400_000;

/** The furthest stage an application reached, ignoring "closed" (a closed one may have interviewed first). */
export function furthest(app: Application): number {
  return Math.max(0, ...app.statusHistory.map((h) => RANK[h.status]), RANK[app.status]);
}

export function funnel(apps: Application[], days: number | null) {
  const since = days ? Date.now() - days * DAY : 0;
  const inRange = apps.filter((a) => Date.parse(a.createdAt) >= since);
  const reached = (n: number) => inRange.filter((a) => furthest(a) >= n).length;
  return [
    { label: 'Started', value: inRange.length },
    { label: 'Applied', value: reached(1) },
    { label: 'Interviewing', value: reached(2) },
    { label: 'Offer', value: reached(3) },
  ];
}

/** Applications sent per week (by the date they moved to Applied), last `weeks` weeks, oldest first. */
export function weekly(apps: Application[], weeks = 8) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // this Monday
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const from = start.getTime() - (weeks - 1 - i) * 7 * DAY;
    return { from, label: new Date(from).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: 0 };
  });
  for (const a of apps) {
    const sent = a.statusHistory.find((h) => h.status === 'applied');
    if (!sent) continue;
    const t = Date.parse(sent.at);
    const b = buckets.findLast((x) => t >= x.from);
    if (b && t < b.from + 7 * DAY) b.value++;
  }
  return buckets;
}

export interface Nudge { app: Application; text: string; kind: 'interview' | 'follow-up' | 'draft' }

/** What's worth doing next: interviews this week, follow-ups due, drafts left waiting. */
export function nudges(apps: Application[]): Nudge[] {
  const out: Nudge[] = [];
  const t = Date.now();
  for (const a of apps) {
    for (const i of a.interviews) {
      const at = Date.parse(i.at);
      if (at >= t - DAY / 2 && at <= t + 7 * DAY) {
        out.push({ app: a, kind: 'interview', text: `${i.kind || 'Interview'} ${new Date(at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` });
      }
    }
    if (a.followUp && Date.parse(a.followUp) <= t && a.status !== 'closed') {
      out.push({ app: a, kind: 'follow-up', text: 'Follow-up date reached' });
    } else if (a.status === 'applied' && !a.followUp) {
      const sent = a.statusHistory.findLast((h) => h.status === 'applied');
      const days = sent ? Math.floor((t - Date.parse(sent.at)) / DAY) : 0;
      if (days >= 7) out.push({ app: a, kind: 'follow-up', text: `Applied ${days} days ago with no reply: a short follow-up helps` });
    }
    if (a.status === 'draft') {
      const days = Math.floor((t - Date.parse(a.createdAt)) / DAY);
      if (days >= 3) out.push({ app: a, kind: 'draft', text: `Draft waiting for ${days} days` });
    }
  }
  const order = { interview: 0, 'follow-up': 1, draft: 2 };
  return out.sort((x, y) => order[x.kind] - order[y.kind]).slice(0, 8);
}
