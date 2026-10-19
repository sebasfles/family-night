import { describe, expect, test } from 'vitest';
import { shiftOffsets } from './shuffle';

describe('the places a row shifts from', () => {
  test('each row starts where it stood in the old order, with rows of any height', () => {
    const rows = [
      { id: 'b', top: 100, height: 40 },
      { id: 'c', top: 148, height: 64 },
      { id: 'a', top: 220, height: 40 },
    ];

    const offsets = shiftOffsets(rows, ['a', 'b', 'c'], 8);

    expect(Object.fromEntries(offsets)).toEqual({ a: -120, b: 48, c: 48 });
  });

  test('an unchanged order moves nothing, and unknown ids are skipped', () => {
    const rows = [
      { id: 'a', top: 0, height: 40 },
      { id: 'b', top: 48, height: 40 },
    ];

    expect(Object.fromEntries(shiftOffsets(rows, ['gone', 'a', 'b'], 8))).toEqual({ a: 0, b: 0 });
  });
});
