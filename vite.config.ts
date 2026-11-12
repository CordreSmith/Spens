/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Set BASE_PATH when the app is served from a sub-path, for example GitHub Pages: BASE_PATH=/grocery-app/
  base: process.env.BASE_PATH ?? '/',
  build: { target: 'es2022' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Groceries',
        short_name: 'Groceries',
        description: 'A shared grocery list for your household.',
        theme_color: '#1f7a4d',
        background_color: '#f6f7f4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only the app's own files are cached for offline use. Google sign-in and Drive
        // requests are never cached, so the list always comes fresh from Drive.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
  },
});
