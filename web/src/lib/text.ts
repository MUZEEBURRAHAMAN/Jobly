export const readingMinutes = (text: string) => Math.max(1, Math.round(text.trim().split(/\s+/).length / 220));
export const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
