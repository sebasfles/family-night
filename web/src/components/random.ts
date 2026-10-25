import type { RandomInt } from '@family-night/shared';

const RANGE = 2 ** 32;

export const cryptoRandomInt: RandomInt = (maxExclusive) => {
  const limit = RANGE - (RANGE % maxExclusive);
  const word = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(word);
    const value = word[0] ?? 0;
    if (value < limit) return value % maxExclusive;
  }
};
