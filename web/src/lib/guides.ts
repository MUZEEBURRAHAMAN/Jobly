import { getCollection, type CollectionEntry } from 'astro:content';
import { readingMinutes } from './text';

export type Guide = CollectionEntry<'guides'> & { minutes: number; href: string };
export const CATEGORIES = ['Search tips', 'Roles', 'Tools', 'Privacy'] as const;

/** All guides, featured first, then newest, then by title. */
export async function getGuides(): Promise<Guide[]> {
  const all = await getCollection('guides');
  return all
    .map((g) => ({ ...g, minutes: readingMinutes(g.body ?? ''), href: `/guides/${g.id}` }))
    .sort((a, b) => Number(b.data.featured) - Number(a.data.featured) || +b.data.date - +a.data.date || a.data.title.localeCompare(b.data.title));
}

/** Guides to read next: same category first, then the rest. */
export function related(all: Guide[], current: Guide, n = 3) {
  const others = all.filter((g) => g.id !== current.id);
  return [...others.filter((g) => g.data.category === current.data.category), ...others.filter((g) => g.data.category !== current.data.category)].slice(0, n);
}
