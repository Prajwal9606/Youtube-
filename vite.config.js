import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none'
    }
  },
  worker: {
    format: 'es'
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'esnext',
    chunkSizeWarningLimit: 2000
  }
});
