import type { APIRoute } from 'astro';
import { listPages, ogKey } from '../lib/pages';

// Read by scripts/make-og.mjs to draw one social image per page. Not linked from anywhere.
export const GET: APIRoute = async () => {
  const pages = await listPages();
  return new Response(JSON.stringify(pages.map((p) => ({ key: ogKey(p.path), title: p.title, eyebrow: p.eyebrow }))), { headers: { 'Content-Type': 'application/json' } });
};
