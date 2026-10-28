// @ts-check
import { defineConfig } from 'astro/config';

// Static site, deployed to Cloudflare Pages (.github/workflows/web.yml). Strict CSP: styles and scripts are always external files.
export default defineConfig({
  site: 'https://jobly-88t.pages.dev',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'never' },
  vite: { build: { assetsInlineLimit: 0 }, optimizeDeps: { include: ['@lucasmarkes/hairline'] } },
  devToolbar: { enabled: false },
});
