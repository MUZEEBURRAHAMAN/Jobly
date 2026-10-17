import { SITE } from '../lib/site';

/** GET a JSON endpoint of the Jobly API with a timeout. `onSlow` fires if the free server is still waking up. */
export async function apiGet<T>(path: string, params: Record<string, string | number | undefined> = {}, opts: { timeoutMs?: number; onSlow?: () => void } = {}): Promise<T> {
  const url = new URL(path, SITE.api);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30000);
  const slow = opts.onSlow ? window.setTimeout(opts.onSlow, 4000) : 0;
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
    if (slow) window.clearTimeout(slow);
  }
}

export const formatNumber = (n: number) => new Intl.NumberFormat('en-US').format(n);
