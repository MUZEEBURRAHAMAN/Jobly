import { readKey, writeKey } from './userData';

/**
 * Answers the user typed into application forms, kept on this device so the next form asking the same question is
 * filled for them ("Saved answer"). Questions about protected characteristics, identity numbers and passwords are
 * never saved.
 */
export interface SavedAnswer { question: string; key: string; value: string; kind: string; used_at: string; uses: number }

export const ANSWER_KEY = 'savedAnswers';
export const MAX_ANSWERS = 200;

const SENSITIVE = /gender|sex\b|pronoun|race|ethnic|hispanic|latino|veteran|disab|sexual|orientation|religio|caste|marital|pregnan|date\s*of\s*birth|birth\s*date|\bdob\b|\bage\b|social\s*security|\bssn\b|aadhaar|\bpan\b|passport|national\s*(id|insurance)|tax\s*(id|number)|driver.?s?\s*licen|password|bank|account\s*number|iban|card\s*number|criminal|convict|signature/i;

export const isSensitive = (question: string) => SENSITIVE.test(question);

/** "Why do you want to work here?*" and "why do you want to work here" are the same question. */
export const questionKey = (q: string) => q.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\b(the|a|an|your|you|please|do|are)\b/g, ' ').replace(/\s+/g, ' ').trim();

const words = (k: string) => new Set(k.split(' ').filter((w) => w.length > 1));

/** The saved answer for a question: the same question, or one with nearly all the same words. */
export function findSaved(list: SavedAnswer[], question: string): SavedAnswer | null {
  const key = questionKey(question);
  if (!key || isSensitive(question)) return null;
  const exact = list.find((a) => a.key === key);
  if (exact) return exact;
  const mine = words(key);
  if (mine.size < 3) return null;
  let best: SavedAnswer | null = null; let score = 0;
  for (const a of list) {
    const theirs = words(a.key);
    const shared = [...mine].filter((w) => theirs.has(w)).length;
    const s = shared / new Set([...mine, ...theirs]).size;
    if (s > score) { score = s; best = a; }
  }
  return score >= 0.8 ? best : null;
}

export async function loadAnswers(): Promise<SavedAnswer[]> {
  const list = await readKey<SavedAnswer[]>(ANSWER_KEY);
  return Array.isArray(list) ? list.filter((a) => a && typeof a.key === 'string' && typeof a.value === 'string') : [];
}

/** Adds or updates answers; returns how many were saved. The most recently used are kept when the list is full. */
export async function rememberAnswers(items: { question: string; value: string; kind: string }[]): Promise<number> {
  const list = await loadAnswers();
  const now = new Date().toISOString();
  let saved = 0;
  for (const it of items) {
    const question = it.question.replace(/\s+/g, ' ').trim().slice(0, 300);
    const value = it.value.trim().slice(0, 3000);
    const key = questionKey(question);
    if (!key || !value || isSensitive(question)) continue;
    const i = list.findIndex((a) => a.key === key);
    const entry: SavedAnswer = { question, key, value, kind: it.kind, used_at: now, uses: i >= 0 ? list[i].uses : 0 };
    if (i >= 0) list.splice(i, 1);
    list.unshift(entry); saved++;
  }
  if (saved) await writeKey(ANSWER_KEY, list.slice(0, MAX_ANSWERS));
  return saved;
}

export async function markUsed(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const list = await loadAnswers();
  const now = new Date().toISOString();
  await writeKey(ANSWER_KEY, list.map((a) => (keys.includes(a.key) ? { ...a, uses: a.uses + 1, used_at: now } : a)));
}

export async function forgetAnswer(key: string): Promise<boolean> {
  return writeKey(ANSWER_KEY, (await loadAnswers()).filter((a) => a.key !== key));
}
