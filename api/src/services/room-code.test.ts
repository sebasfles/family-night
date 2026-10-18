import { isRoomCode, ROOM_CODE_ALPHABET } from '@family-night/shared';
import { expect, test } from 'vitest';
import { randomRoomCode } from './room-code.ts';

test('a room code is four letters of the alphabet without I, L and O', () => {
  for (let i = 0; i < 500; i++) {
    const code = randomRoomCode(Math.random);
    expect(isRoomCode(code)).toBe(true);
    expect(code).not.toMatch(/[ILO]/);
  }
});

test('the whole alphabet is reachable, first to last letter', () => {
  expect(randomRoomCode(() => 0)).toBe('AAAA');
  expect(randomRoomCode(() => 0.999_999)).toBe(ROOM_CODE_ALPHABET.at(-1)?.repeat(4));
});
