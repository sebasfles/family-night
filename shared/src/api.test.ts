import { expectTypeOf, test } from 'vitest';
import type { HealthResponse } from './index.ts';

test('the health response carries ok and the deployed version', () => {
  expectTypeOf<HealthResponse>().toEqualTypeOf<{ ok: true; version: string }>();
});
