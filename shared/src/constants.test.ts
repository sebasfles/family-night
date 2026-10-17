import { describe, expect, test } from 'vitest';
import { isOnline, normalizeRoomCode, ONLINE_WINDOW_MS } from './constants.ts';

describe('normalizeRoomCode', () => {
  test('uppercases and trims a valid code', () => {
    expect(normalizeRoomCode(' abcd ')).toBe('ABCD');
  });

  test.each(['ABCI', 'ABCL', 'ABCO', 'ABC', 'ABCDE', 'AB1D', 'ÁBCD', ''])('rejects %j', (raw) => {
    expect(normalizeRoomCode(raw)).toBeNull();
  });
});

describe('isOnline', () => {
  const lastSeenAt = '2026-10-17T20:00:00.000Z';
  const seen = Date.parse(lastSeenAt);

  test('is online just inside the window', () => {
    expect(isOnline(lastSeenAt, seen + ONLINE_WINDOW_MS - 1)).toBe(true);
  });

  test('is offline once the window has passed', () => {
    expect(isOnline(lastSeenAt, seen + ONLINE_WINDOW_MS)).toBe(false);
  });

  test('treats a last seen in the future (clock skew, away setback) by the same rule', () => {
    expect(isOnline(lastSeenAt, seen - 1_000)).toBe(true);
  });
});
