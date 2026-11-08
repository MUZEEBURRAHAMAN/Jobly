import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { build as esbuild } from 'esbuild';

// `vite build --mode development` (npm run build:dev) marks the name "(DEV)" and, when VITE_JOBLY_DATA points at a local
// export of the job data, allows that address too. Such a build must never ship to the Web Store.
function devBuild(): Plugin {
  const data = process.env.VITE_JOBLY_DATA;
  let outDir = 'dist';
  return {
    name: 'jobly-dev-build',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      const file = resolve(outDir, 'manifest.json');
      const manifest = JSON.parse(readFileSync(file, 'utf8'));
      if (data) {
        const origin = new URL(data).origin;
        manifest.host_permissions.push(`${origin}/*`);
        manifest.content_security_policy.extension_pages = manifest.content_security_policy.extension_pages.replace(
          /connect-src ([^;]*)/, (_m: string, list: string) => `connect-src ${list} ${origin}`
        );
      }
      // The browser tests start apply assist on a test application page from the service worker
      manifest.host_permissions.push('https://apply.example.test/*');
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

// Apply assist runs inside the application page (chrome.scripting.executeScript with `files`), which needs one classic
// script, not ES modules with chunks: built on its own with esbuild. Development builds open its shadow root for tests.
function assistScript(dev: boolean): Plugin {
  let outDir = 'dist';
  return {
    name: 'jobly-assist-script',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    async closeBundle() {
      await esbuild({
        entryPoints: [resolve(__dirname, 'src/assist/main.ts')], bundle: true, format: 'iife', target: 'es2022', minify: !dev,
        outfile: resolve(outDir, 'assist.js'), define: { __JOBLY_TEST__: dev ? 'true' : 'false' }, logLevel: 'error',
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), googleOAuth(), assistScript(mode === 'development'), ...(mode === 'development' ? [devBuild()] : [])],
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
