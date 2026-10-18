import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routeFileIgnorePattern: '\\.test\\.',
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': { target: 'https://family-night.fless.dev', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    env: { VITE_EVENTS_HTTP_DOMAIN: '', VITE_EVENTS_REALTIME_DOMAIN: '' },
    setupFiles: ['src/test-setup.ts'],
    fileParallelism: false,
  },
});
