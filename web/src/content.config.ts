import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Hairline figures the site loads (see scripts/figures.ts).
const figure = z.enum(['slow', 'cabinet', 'router', 'hub', 'plug', 'padlock', 'query', 'terrain', 'phosphor', 'laptop', 'settle', 'relay',
  'plot', 'vault', 'format', 'dish', 'branches', 'drawer', 'turntable', 'loupe', 'sieve', 'stack', 'rail', 'lockers',
  'terminal', 'exploded', 'keyboard', 'riffle', 'basket', 'phone', 'elevator', 'patch', 'rebuild']);

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string().max(90),
    description: z.string().max(170),
    category: z.enum(['Search tips', 'Roles', 'Tools', 'Privacy']),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    figure,
    featured: z.boolean().default(false),
    /** For role guides: the live count shown on the page. */
    role: z.string().optional(),
  }),
});

// Long documents with a table of contents: privacy, terms, security.
const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(170),
    eyebrow: z.string(),
    updated: z.coerce.date(),
    figure,
  }),
});

export const collections = { guides, docs };
