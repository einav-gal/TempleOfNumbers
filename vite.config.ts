import { defineConfig } from 'vite';

export default defineConfig({
  base: '/TempleOfNumbers/',

  server: {
    port: 5173,
    open: false,
  },

  build: {
    outDir: 'dist',
  },
});