/** Short, readable ids. A prefix says what a fact is when a model cites it (exp_…, b_…, sk_…). */
export function uid(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return `${prefix}_${Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 7)}`;
}

export const now = () => new Date().toISOString();
