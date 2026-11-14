import { Application } from './tracker';
import { bulletList, fullName, Profile } from './profile';

/**
 * Follow-ups for jobs you applied to: the first one 7 days after applying, then 7 days after each follow-up you log;
 * after two follow-ups with no reply, Jobly suggests moving on. (The cadence idea comes from the open-source
 * career-ops project, MIT; this is Jobly's own code.) Follow-ups you log are kept as dated lines in the job's notes.
 */
export const FOLLOW_UP_DAYS = 7;
export const MAX_FOLLOW_UPS = 2;
const DAY = 86_400_000;
const LOG = /^Followed up (\d{4}-\d{2}-\d{2})/gm;

export type FollowState = 'due' | 'waiting' | 'cold';
export interface FollowUp { state: FollowState; count: number; due: Date | null; days: number }

export function followUp(app: Application, now = Date.now()): FollowUp | null {
  if (app.status !== 'applied' || !app.applied_at) return null;
  const dates = [...(app.notes ?? '').matchAll(LOG)].map((m) => Date.parse(m[1]));
  const count = dates.length;
  const last = count ? Math.max(...dates) : Date.parse(app.applied_at);
  const days = Math.floor((now - Date.parse(app.applied_at)) / DAY);
  if (count >= MAX_FOLLOW_UPS) return { state: 'cold', count, due: null, days };
  const due = app.follow_up_at ? new Date(app.follow_up_at) : new Date(last + FOLLOW_UP_DAYS * DAY);
  return { state: now >= due.getTime() ? 'due' : 'waiting', count, due, days };
}

/** The changes to save when the user says they followed up today. */
export function logFollowUp(app: Application, now = new Date()): Partial<Application> {
  const day = now.toISOString().slice(0, 10);
  return { notes: `${app.notes ? `${app.notes.trimEnd()}\n` : ''}Followed up ${day}`.slice(0, 4000), follow_up_at: new Date(now.getTime() + FOLLOW_UP_DAYS * DAY).toISOString(), follow_up_notified: false };
}

/** A short follow-up message: the role, when you applied, one result from your profile, and a clear ask. */
export function followUpDraft(app: Application, p: Profile | null, now = Date.now()): { subject: string; body: string } {
  const applied = app.applied_at ? new Date(app.applied_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : 'recently';
  const proof = p ? p.work.flatMap((w) => bulletList(w.bullets).map((b) => ({ b, w }))).find((x) => /\d/.test(x.b)) ?? null : null;
  const second = followUp(app, now)?.count ?? 0;
  const lines = [
    'Hi,',
    '',
    second
      ? `I'm following up once more on my application for the ${app.title} role at ${app.company_name}. I'm still keen and happy to share more about my work.`
      : `I applied for the ${app.title} role at ${app.company_name} on ${applied} and wanted to follow up. I'm still very interested in the role.`,
    ...(proof && !second ? ['', `A quick example of my work: at ${proof.w.company || 'my last role'}, I ${proof.b.charAt(0).toLowerCase()}${proof.b.slice(1).replace(/\.$/, '')}.`] : []),
    '',
    'Is there anything else you need from me, or a good time to talk about next steps?',
    '',
    'Thank you,',
    (p && fullName(p)) || '[your name]',
  ];
  return { subject: `Following up: ${app.title} application`, body: lines.join('\n') };
}
