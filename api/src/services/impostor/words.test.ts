import { describe, expect, test } from 'vitest';
import bank from '../../data/impostor-words.json' with { type: 'json' };

function normalized(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

describe('impostor-words.json', () => {
  test('has the 10 agreed categories', () => {
    expect(bank.categories.map((category) => category.name)).toEqual([
      'Animales',
      'Comida',
      'Lugares',
      'Objetos de la casa',
      'Profesiones',
      'Deportes',
      'Películas y series',
      'Marcas',
      'Países y ciudades',
      'Cosas de la familia',
    ]);
  });

  test.each(bank.categories)(
    '$name has enough distinct words for five guess options',
    (category) => {
      const words = category.words.map((entry) => normalized(entry.word));
      expect(words.length).toBeGreaterThanOrEqual(5);
      expect(new Set(words).size).toBe(words.length);
    },
  );

  test('word ids are unique, stable and prefixed by their category', () => {
    const ids = bank.categories.flatMap((category) => category.words.map((entry) => entry.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const category of bank.categories) {
      for (const entry of category.words)
        expect(entry.id).toMatch(new RegExp(`^${category.id}\\.[a-z0-9-]+$`));
    }
  });

  test('no clue gives its word away', () => {
    for (const entry of bank.categories.flatMap((category) => category.words)) {
      expect(entry.clue.trim(), entry.word).not.toBe('');
      expect(normalized(entry.clue), entry.word).not.toContain(normalized(entry.word));
    }
  });
});
