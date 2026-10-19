import { describe, expect, test } from 'vitest';
import { place, podiumPoints } from './scoring.ts';

describe('place', () => {
  test('ties share a place and the next one skips it', () => {
    const scores = [7, 7, 5, 3, 3, 3, 0];
    expect(scores.map((score) => place(score, scores))).toEqual([1, 1, 3, 4, 4, 4, 7]);
  });
});

describe('podiumPoints', () => {
  test('first gets one point per player, each place one less', () => {
    expect(podiumPoints({ a: 3, b: 10, c: 0, d: 6 }, ['a', 'b', 'c', 'd'])).toEqual({
      b: 4,
      d: 3,
      a: 2,
      c: 1,
    });
  });

  test('ties share the place and get its points', () => {
    expect(podiumPoints({ a: 5, b: 5, c: 2, d: 2, e: 1 }, ['a', 'b', 'c', 'd', 'e'])).toEqual({
      a: 5,
      b: 5,
      c: 3,
      d: 3,
      e: 1,
    });
    expect(podiumPoints({ a: 0, b: 0, c: 0 }, ['a', 'b', 'c'])).toEqual({ a: 3, b: 3, c: 3 });
  });

  test('only the listed players count, and a missing total is 0', () => {
    expect(podiumPoints({ a: 4, gone: 99 }, ['a', 'b'])).toEqual({ a: 2, b: 1 });
  });
});
