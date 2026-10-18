import type { APIRoute } from 'astro';
import { listPages } from '../lib/pages';
import { SITE } from '../lib/site';

export const GET: APIRoute = async () => {
  const pages = await listPages();
  const urls = pages.map((p) => `  <url><loc>${new URL(p.path, SITE.url).href}</loc><lastmod>${p.lastmod}</lastmod></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
