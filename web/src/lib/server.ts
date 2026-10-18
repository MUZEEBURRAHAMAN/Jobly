// The Jobly server (free plan) empties its job list when it restarts and then crawls for a minute or two, and it restarts on
// every push. A website build that reads numbers during that crawl would bake half-filled counts into the pages, so
// builds wait here until the crawl has finished (or give up after a few minutes and let the browser fill the numbers in).
import { SITE } from './site';

type Stats = { total_jobs: number; is_syncing: boolean };
let ready: Promise<boolean> | undefined;

export function serverReady(maxWaitMs = 4 * 60 * 1000): Promise<boolean> {
  ready ??= (async () => {
    const until = Date.now() + maxWaitMs;
    while (Date.now() < until) {
      try {
        const res = await fetch(`${SITE.api}/api/stats`, { signal: AbortSignal.timeout(60000) });
        if (res.ok) {
          const s = (await res.json()) as Stats;
          if (!s.is_syncing && s.total_jobs > 0) return true;
        }
      } catch { /* asleep or restarting: try again */ }
      await new Promise((r) => setTimeout(r, 10000));
    }
    return false;
  })();
  return ready;
}
