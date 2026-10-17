import { join } from 'node:path';
import type { HealthResponse } from '@family-night/shared';
import { expect, type Page, test } from '@playwright/test';

async function capture(page: Page, name: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${name} overflows horizontally`).toBe(0);
  const width = String(page.viewportSize()?.width ?? 0);
  await page.screenshot({
    path: join(process.env.SCREENSHOTS_DIR ?? '', `${width}-${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}

test('home with the server online', async ({ page }) => {
  const health: HealthResponse = { ok: true, version: 'abc1234' };
  await page.route('**/api/health', (route) => route.fulfill({ json: health }));
  await page.goto('/');
  await expect(page.getByText('En línea, versión abc1234')).toBeVisible();
  await capture(page, 'home');
});

test('home with the server down', async ({ page }) => {
  await page.route('**/api/health', (route) =>
    route.fulfill({ status: 503, json: { error: 'not deployed yet' } }),
  );
  await page.goto('/');
  await expect(page.getByText('El servidor no responde')).toBeVisible();
  await capture(page, 'home-server-down');
});
