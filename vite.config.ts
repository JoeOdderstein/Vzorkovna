import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { taskboardDevApi } from './dev-api-plugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl =
    env.VITE_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  return {
    plugins: [
      react(),
      taskboardDevApi(),
      {
        name: 'inject-share-preview-url',
        transformIndexHtml(html) {
          if (!siteUrl) return html;

          const shareImageUrl = `${siteUrl}/images/social/share-preview.jpg`;
          return html.replace(
            /content="\/images\/social\/share-preview\.jpg"/g,
            `content="${shareImageUrl}"`,
          );
        },
      },
    ],
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
  };
});
