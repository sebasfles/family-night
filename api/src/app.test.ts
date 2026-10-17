import type { ErrorResponse, HealthResponse } from '@family-night/shared';
import { beforeAll, expect, test } from 'vitest';
import { createHarness, type Harness } from './test/harness.ts';

let harness: Harness;
beforeAll(async () => {
  harness = await createHarness();
});

test('GET /api/health answers ok with the version', async () => {
  const response = await harness.app.request('/api/health');

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toMatch(/^application\/json/);
  expect(await response.json()).toEqual<HealthResponse>({ ok: true, version: 'dev' });
});

test('an unknown route answers the error envelope', async () => {
  const response = await harness.app.request('/api/nope');

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual<ErrorResponse>({
    error: { code: 'NOT_FOUND', message: 'No encontramos lo que buscas' },
  });
});
