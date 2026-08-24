import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/TempleOfNumbers/',

  server: {
    port: 5173,
    open: false,
  },

  build: {
    outDir: 'dist',
    // Two HTML entry points sharing the exact same game/scene code (see
    // src/main-mobile.ts) — the dedicated mobile link
    // (TempleOfNumbers/mobile/) at mobile/index.html, alongside the
    // regular one at the project root. GitHub Pages publishes the whole
    // dist/ folder as static files, so both simply appear side by side
    // with no separate deploy step needed.
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mobile: resolve(__dirname, 'mobile/index.html'),
      },
    },
  },
});