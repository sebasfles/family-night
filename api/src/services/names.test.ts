import { describe, expect, test } from 'vitest';
import names from '../data/names.json' with { type: 'json' };
import { NAME_ATTEMPTS, randomName, suffixedName } from './names.ts';

function word(list: 'animals' | 'adjectives', index: number): string {
  return names[list][index] ?? '';
}

describe('names.json', () => {
  test.each(['animals', 'adjectives'] as const)('holds 100 distinct capitalized %s', (key) => {
    const list = names[key];
    expect(list).toHaveLength(100);
    expect(new Set(list).size).toBe(100);
    for (const word of list) expect(word).toMatch(/^\p{Lu}\p{Ll}+$/u);
  });
});

describe('randomName', () => {
  test('is an animal followed by an adjective', () => {
    expect(randomName(() => 0)).toBe(`${word('animals', 0)} ${word('adjectives', 0)}`);
    expect(randomName(() => 0.999_999)).toBe(`${word('animals', 99)} ${word('adjectives', 99)}`);
  });

  test('draws the animal and the adjective independently', () => {
    const draws = [0.5, 0.01];
    expect(randomName(() => draws.shift() ?? 0)).toBe(
      `${word('animals', 50)} ${word('adjectives', 1)}`,
    );
  });
});

describe('suffixedName', () => {
  test('keeps the plain name for the random attempts', () => {
    expect(suffixedName('Cóndor Veloz', NAME_ATTEMPTS)).toBe('Cóndor Veloz');
  });

  test('numbers from 2 once the random attempts are spent', () => {
    expect(suffixedName('Cóndor Veloz', NAME_ATTEMPTS + 1)).toBe('Cóndor Veloz 2');
    expect(suffixedName('Cóndor Veloz', NAME_ATTEMPTS + 2)).toBe('Cóndor Veloz 3');
  });
});
