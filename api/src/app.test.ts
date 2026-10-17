import type { HealthResponse } from '@family-night/shared';
import { expect, test } from 'vitest';
import { app } from './app.ts';

test('GET /api/health answers ok with the version', async () => {
  const response = await app.request('/api/health');

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toMatch(/^application\/json/);
  expect(await response.json()).toEqual<HealthResponse>({ ok: true, version: 'dev' });
});
