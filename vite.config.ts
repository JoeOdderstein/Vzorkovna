import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // base: './' uses relative paths so the site works when uploaded to any
  // folder on a traditional web host (e.g. public_html/ or a subdirectory).
  base: './',
  build: {
    outDir: 'dist',
    // Generate a clean dist on every build
    emptyOutDir: true,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
