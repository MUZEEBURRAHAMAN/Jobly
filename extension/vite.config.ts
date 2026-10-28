import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

// Production builds talk only to the real backend. `vite build --mode development` (npm run build:dev) also
// allows the local API at 127.0.0.1:8000 / localhost:8000 — it must never ship to the Web Store.
function localDevBackend(): Plugin {
  const hosts = ['http://127.0.0.1:8000', 'http://localhost:8000'];
  let outDir = 'dist';
  return {
    name: 'jobly-local-dev-backend',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      const file = resolve(outDir, 'manifest.json');
      const manifest = JSON.parse(readFileSync(file, 'utf8'));
      manifest.host_permissions.push(...hosts.map((h) => `${h}/*`));
      manifest.content_security_policy.extension_pages = manifest.content_security_policy.extension_pages.replace(
        /connect-src ([^;]*)/, (_m: string, list: string) => `connect-src ${list} ${hosts.join(' ')}`
      );
      manifest.name += ' (DEV)';
      writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
    },
  };
}

// Google Calendar import needs an OAuth client made for this extension's ID. Set JOBLY_GOOGLE_CLIENT_ID when building
// and it is added to the manifest; without it the extension builds and works, with calendar import shown as not set up.
function googleOAuth(): Plugin {
  let outDir = 'dist';
  return {
    name: 'jobly-google-oauth',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      const id = process.env.JOBLY_GOOGLE_CLIENT_ID?.trim();
      if (!id) return;
      const file = resolve(outDir, 'manifest.json');
      const manifest = JSON.parse(readFileSync(file, 'utf8'));
      manifest.oauth2 = { client_id: id, scopes: ['https://www.googleapis.com/auth/calendar.readonly'] };
      // Only a build with the client asks for what calendar import uses, so no version requests a permission it can't use.
      manifest.permissions.push('identity');
      manifest.optional_host_permissions = [...(manifest.optional_host_permissions ?? []), 'https://www.googleapis.com/*'];
      manifest.content_security_policy.extension_pages = manifest.content_security_policy.extension_pages.replace(
        /connect-src ([^;]*)/, (_m: string, list: string) => `connect-src ${list} https://www.googleapis.com https://oauth2.googleapis.com`);
      writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), googleOAuth(), ...(mode === 'development' ? [localDevBackend()] : [])],
  build: {
    outDir: mode === 'development' ? 'dist-dev' : 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        options: resolve(__dirname, 'options.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') {
            return 'service-worker.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
}));
