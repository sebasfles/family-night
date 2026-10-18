import { JUST_ONE_GUESS_MAX, sameWord } from '@family-night/shared';
import { describe, expect, test } from 'vitest';
import { justOneWords } from './words.ts';

describe('justone-words.json', () => {
  test('has about 200 words with unique stable ids', () => {
    expect(justOneWords.length).toBeGreaterThanOrEqual(190);
    const ids = justOneWords.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
  });

  test('every word is one word a guesser can type', () => {
    for (const { word } of justOneWords) {
      expect(word, word).toMatch(/^\p{Lu}\p{Ll}+$/u);
      expect(word.length, word).toBeLessThanOrEqual(JUST_ONE_GUESS_MAX);
    }
  });

  test('no two words read as the same guess', () => {
    const clashes = justOneWords.flatMap((a, i) =>
      justOneWords
        .slice(i + 1)
        .flatMap((b) => (sameWord(a.word, b.word) ? [[a.word, b.word]] : [])),
    );
    expect(clashes).toEqual([]);
  });
});
