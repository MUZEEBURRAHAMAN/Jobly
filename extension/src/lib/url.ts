/** Returns the URL only if it is plain http(s). Job/company links come from third-party data: never render
 *  javascript:/data:/file: URLs, and never let a lookalike through as something it isn't. */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function hostOf(url: string | null | undefined): string {
  const safe = safeHttpUrl(url);
  return safe ? new URL(safe).hostname.replace(/^www\./, '') : '';
}
