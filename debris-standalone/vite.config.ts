import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Registers the service worker itself, in the background, after the
      // page has already loaded -- nothing blocks on it and nothing prompts
      // the player. Updates on a new deploy apply the same way, silently,
      // the next time the page loads.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'DEBRIS',
        short_name: 'DEBRIS',
        description: 'A neon asteroids-style arcade shooter.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything the game needs to run a full match, audio
        // included, so a second visit works with no network at all.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3}'],
      },
    }),
  ],
});
