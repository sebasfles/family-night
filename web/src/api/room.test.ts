import { expect, test } from 'vitest';
import { snapshot } from '../test/app';
import { newer, toCachedRoom } from './room';

const at = (iso: string) => ({ serverTime: iso });
const cached = toCachedRoom(snapshot({ version: 5, ...at('2026-10-17T20:00:00.000Z') }));

test('a snapshot with a greater version replaces the cached one', () => {
  const next = snapshot({ version: 6, ...at('2026-10-17T19:00:00.000Z') });
  expect(newer(cached, next).snapshot).toBe(next);
});

test('a snapshot with an older version is dropped', () => {
  expect(newer(cached, snapshot({ version: 4, ...at('2026-10-17T21:00:00.000Z') }))).toBe(cached);
});

test('at equal version only a newer server time replaces it, so presence stays fresh', () => {
  const fresher = snapshot({ version: 5, ...at('2026-10-17T20:00:20.000Z') });
  expect(newer(cached, fresher).snapshot).toBe(fresher);
  expect(newer(cached, snapshot({ version: 5, ...at('2026-10-17T20:00:00.000Z') }))).toBe(cached);
});

test('the clock offset is the server time minus the local time at receipt', () => {
  const ahead = new Date(Date.now() + 60_000).toISOString();
  expect(toCachedRoom(snapshot({ serverTime: ahead })).clockOffsetMs).toBeGreaterThan(59_000);
});
