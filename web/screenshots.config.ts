import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = 5180;
const output = process.env.SCREENSHOTS_DIR;
if (!output) throw new Error('SCREENSHOTS_DIR must name the folder the screenshots are written to');
process.env.SCREENSHOTS_DIR = resolve(output);

const desktop = devices['Desktop Chrome'];

export default defineConfig({
  testDir: 'screenshots',
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  outputDir: 'test-results/screenshots',
  use: { baseURL: `http://localhost:${String(PORT)}`, reducedMotion: 'reduce' },
  webServer: {
    command: `pnpm exec vite --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: '390',
      use: {
        ...desktop,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: '768',
      use: {
        ...desktop,
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2,
        hasTouch: true,
      },
    },
    { name: '1280', use: { ...desktop, viewport: { width: 1280, height: 800 } } },
  ],
});
