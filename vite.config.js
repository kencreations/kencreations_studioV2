import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  // Public clients are downloadable. These reduce source disclosure, not access.
  build: {
    sourcemap: false,
    minify: true,
  },
  resolve: {
    // Three's TTFLoader imports this URL at module load. Bundle the installed
    // parser so a CDN outage/offline desktop launch cannot blank the whole app.
    alias: {
      'https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/+esm': 'opentype.js',
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['manifold-3d'],
  },
})
