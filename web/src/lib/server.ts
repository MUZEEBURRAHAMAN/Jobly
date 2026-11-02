// Build-time reads of Jobly's static job data, so pages carry real numbers without JavaScript.
import { SITE } from './site';

/** A file of the static job data at build time, or null when it can't be read. */
export async function staticData<T>(file: string): Promise<T | null> {
  try {
    const res = await fetch(`${SITE.data}/${file}`, { signal: AbortSignal.timeout(30000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}
