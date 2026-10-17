import { expect, test } from 'vitest';
import { handler } from './events-auth.ts';

test('the events authorizer denies every request until rooms exist', async () => {
  expect(await handler()).toEqual({ isAuthorized: false });
});
